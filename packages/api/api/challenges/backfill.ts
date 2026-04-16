import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, SegmentEffort, User } from '../_utils/supabase.js';
import { verifyJWT } from '../_utils/jwt.js';
import { getStravaActivity, refreshStravaToken } from '../_utils/strava-client.js';
import { decryptToken, encryptToken } from '../_utils/crypto.js';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const jwt = authHeader.slice(7);

  try {
    verifyJWT(jwt);

    const { challengeId } = req.body;
    if (!challengeId || typeof challengeId !== 'string') {
      res.status(400).json({ error: 'Missing challengeId' });
      return;
    }

    // Get challenge info
    const { data: challenge, error: challengeError } = await supabase
      .from('challenges')
      .select('id, starts_at, ends_at')
      .eq('id', challengeId)
      .single();

    if (challengeError || !challenge) {
      res.status(404).json({ error: 'Challenge not found' });
      return;
    }

    // Get challenge segments
    const { data: challengeSegments } = await supabase
      .from('challenge_segments')
      .select('id, strava_segment_id')
      .eq('challenge_id', challenge.id);

    if (!challengeSegments || challengeSegments.length === 0) {
      res.status(200).json({ success: true, message: 'No segments to backfill' });
      return;
    }

    const segmentIds = new Set(challengeSegments.map((s) => s.strava_segment_id));

    // Get all challenge members
    const { data: members } = await supabase
      .from('challenge_members')
      .select('user_id')
      .eq('challenge_id', challenge.id);

    // Also include challenge owner
    const { data: owner } = await supabase
      .from('challenges')
      .select('owner_id')
      .eq('id', challenge.id)
      .single();

    const memberIds = [
      ...new Set([
        ...(members?.map((m) => m.user_id) || []),
        owner?.owner_id,
      ].filter(Boolean)),
    ];

    if (memberIds.length === 0) {
      res.status(200).json({ success: true, message: 'No members to backfill' });
      return;
    }

    // Fire off backfill for each member (don't await - background job)
    const backfillStartTime = new Date().getTime();
    memberIds.forEach((userId) => {
      backfillMemberActivities(
        userId as string,
        challenge.id,
        challenge.starts_at,
        segmentIds
      ).catch((err) => {
        console.error(`Backfill failed for user ${userId}:`, err);
      });
    });

    res.status(200).json({
      success: true,
      message: `Backfill started for ${memberIds.length} members`,
    });
  } catch (error) {
    console.error('Backfill error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function backfillMemberActivities(
  userId: string,
  challengeId: string,
  challengeStartsAt: string,
  segmentIds: Set<number>
): Promise<void> {
  // Get user
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (userError || !user) {
    console.error(`User ${userId} not found`);
    return;
  }

  const userData = user as User;
  const startsAtUnix = Math.floor(new Date(challengeStartsAt).getTime() / 1000);
  const nowUnix = Math.floor(new Date().getTime() / 1000);

  let accessToken = userData.access_token;
  const decryptedAccessToken = decryptToken(accessToken);

  // Check if token needs refresh
  if (userData.token_expires_at) {
    const expiresAt = new Date(userData.token_expires_at).getTime();
    if (expiresAt <= Date.now()) {
      try {
        const decrypted = decryptToken(userData.refresh_token);
        const newTokens = await refreshStravaToken(decrypted);

        accessToken = encryptToken(newTokens.access_token);
        const encryptedRefreshToken = encryptToken(newTokens.refresh_token);

        await supabase
          .from('users')
          .update({
            access_token: accessToken,
            refresh_token: encryptedRefreshToken,
            token_expires_at: new Date(
              newTokens.expires_at * 1000
            ).toISOString(),
          })
          .eq('id', userId);
      } catch (error) {
        console.error(`Failed to refresh token for user ${userId}:`, error);
        return;
      }
    }
  }

  // Fetch activities from Strava
  try {
    const response = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?after=${startsAtUnix}&before=${nowUnix}&per_page=100`,
      {
        headers: {
          Authorization: `Bearer ${decryptToken(accessToken)}`,
        },
      }
    );

    if (!response.ok) {
      console.error(
        `Failed to fetch activities for user ${userId}:`,
        response.statusText
      );
      return;
    }

    const activities = (await response.json()) as any[];

    // For each activity, fetch details and check for matching segments
    const effortsToInsert: SegmentEffort[] = [];
    const now = new Date();

    for (const activity of activities) {
      try {
        const activityDetails = await getStravaActivity(
          activity.id,
          decryptToken(accessToken)
        );

        for (const effort of activityDetails.segment_efforts) {
          if (segmentIds.has(effort.segment.id)) {
            // Check if this effort already exists
            const { data: existing } = await supabase
              .from('segment_efforts')
              .select('id')
              .eq('strava_effort_id', effort.id)
              .single();

            if (!existing) {
              // Get challenge_segment ID
              const { data: challengeSegment } = await supabase
                .from('challenge_segments')
                .select('id')
                .eq('challenge_id', challengeId)
                .eq('strava_segment_id', effort.segment.id)
                .single();

              if (challengeSegment) {
                effortsToInsert.push({
                  id: crypto.randomUUID ? crypto.randomUUID() : '',
                  challenge_id: challengeId,
                  challenge_segment_id: challengeSegment.id,
                  user_id: userId,
                  strava_activity_id: activity.id,
                  strava_effort_id: effort.id,
                  elapsed_time: effort.elapsed_time,
                  moving_time: effort.moving_time,
                  start_date: effort.start_date,
                  distance: effort.distance,
                  elevation_gain: effort.elevation_gain,
                  average_watts: effort.average_watts,
                  average_cadence: effort.average_cadence,
                  created_at: now.toISOString(),
                });
              }
            }
          }
        }
      } catch (error) {
        console.error(`Failed to fetch activity ${activity.id}:`, error);
        continue;
      }
    }

    // Insert all efforts
    if (effortsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('segment_efforts')
        .insert(effortsToInsert);

      if (insertError) {
        console.error('Failed to insert backfilled efforts:', insertError);
      } else {
        console.log(
          `Backfilled ${effortsToInsert.length} efforts for user ${userId}`
        );
      }
    }
  } catch (error) {
    console.error(`Backfill failed for user ${userId}:`, error);
  }
}
