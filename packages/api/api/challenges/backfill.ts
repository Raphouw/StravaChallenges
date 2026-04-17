import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, User } from '../_utils/supabase.js';
import { verifyJWT } from '../_utils/jwt.js';
import { decryptToken, encryptToken } from '../_utils/crypto.js';
import { refreshStravaToken } from '../_utils/strava-client.js';

interface BackfillRequest {
  challengeId: string;
}

async function backfillChallengeActivities(
  challengeId: string,
  userId: string,
  userToken: string,
  startsAt: string
): Promise<void> {
  try {
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('access_token, refresh_token, token_expires_at')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      console.error(`Failed to fetch user ${userId}:`, userError);
      return;
    }

    let accessToken = user.access_token;

    // Refresh token if expired
    if (user.token_expires_at) {
      const expiresAt = new Date(user.token_expires_at).getTime();
      if (expiresAt <= Date.now()) {
        const decrypted = decryptToken(user.refresh_token);
        const newTokens = await refreshStravaToken(decrypted);
        accessToken = encryptToken(newTokens.access_token);

        await supabase
          .from('users')
          .update({
            access_token: accessToken,
            refresh_token: encryptToken(newTokens.refresh_token),
            token_expires_at: new Date(
              newTokens.expires_at * 1000
            ).toISOString(),
          })
          .eq('id', userId);
      }
    }

    const decryptedToken = decryptToken(accessToken);
    const startDate = new Date(startsAt);
    const unixTimestamp = Math.floor(startDate.getTime() / 1000);

    console.log(`[backfill] fetching activities for user ${userId} since ${new Date(unixTimestamp * 1000).toISOString()}`);

    // Fetch all activities since challenge start
    const activitiesResponse = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?after=${unixTimestamp}&per_page=100`,
      {
        headers: { Authorization: `Bearer ${decryptedToken}` },
      }
    );

    if (!activitiesResponse.ok) {
      console.error(`[backfill] failed to fetch activities for user ${userId}`);
      return;
    }

    const activities = (await activitiesResponse.json()) as any[];
    console.log(`[backfill] found ${activities.length} activities for user ${userId}`);

    // Get challenge segments
    const { data: segments, error: segmentError } = await supabase
      .from('challenge_segments')
      .select('strava_segment_id')
      .eq('challenge_id', challengeId);

    if (segmentError || !segments) {
      console.error(`Failed to fetch segments for challenge ${challengeId}`);
      return;
    }

    const segmentIds = new Set(segments.map(s => s.strava_segment_id));

    // Process each activity
    for (const activity of activities) {
      try {
        const detailResponse = await fetch(
          `https://www.strava.com/api/v3/activities/${activity.id}`,
          {
            headers: { Authorization: `Bearer ${decryptedToken}` },
          }
        );

        if (!detailResponse.ok) continue;

        const activityDetail = (await detailResponse.json()) as any;

        // Process segment efforts
        if (activityDetail.segment_efforts && Array.isArray(activityDetail.segment_efforts)) {
          for (const effort of activityDetail.segment_efforts) {
            if (segmentIds.has(effort.segment.id)) {
              const { error: insertError } = await supabase
                .from('segment_efforts')
                .insert({
                  challenge_id: challengeId,
                  user_id: userId,
                  strava_effort_id: effort.id,
                  elapsed_time: effort.elapsed_time,
                  moving_time: effort.moving_time,
                  distance: effort.distance,
                  elevation_gain: effort.elevation_gain,
                  start_date: effort.start_date,
                  start_date_local: effort.start_date_local,
                  pr_rank: effort.pr_rank,
                  kom_rank: effort.kom_rank,
                });

              if (insertError && insertError.code !== '23505') {
                // 23505 is unique constraint violation (duplicate)
                console.error(`Failed to insert effort ${effort.id}:`, insertError);
              }
            }
          }
        }
      } catch (error) {
        console.error(`Failed to process activity ${activity.id}:`, error);
        continue;
      }
    }

    console.log(`Backfill completed for user ${userId} in challenge ${challengeId}`);
  } catch (error) {
    console.error(`Backfill error for user ${userId}:`, error);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

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
    const payload = verifyJWT(jwt);
    const { challengeId } = req.body as BackfillRequest;

    console.log('[backfill] called for challenge:', challengeId);

    if (!challengeId) {
      res.status(400).json({ error: 'Missing challengeId' });
      return;
    }

    // Get challenge info
    const { data: challenge, error: challengeError } = await supabase
      .from('challenges')
      .select('id, starts_at')
      .eq('id', challengeId)
      .single();

    console.log('[backfill] challenge found:', challenge?.id);

    if (challengeError || !challenge) {
      res.status(404).json({ error: 'Challenge not found' });
      return;
    }

    // Get all members
    const { data: members, error: membersError } = await supabase
      .from('challenge_members')
      .select('user_id')
      .eq('challenge_id', challengeId);

    if (membersError || !members) {
      res.status(500).json({ error: 'Failed to fetch members' });
      return;
    }

    // Fire and forget - respond immediately
    res.status(202).json({ message: 'Backfill started' });

    console.log('[backfill] starting background tasks for', members?.length || 0, 'members');

    // Process each member in background
    for (const member of members) {
      backfillChallengeActivities(
        challengeId,
        member.user_id,
        jwt,
        challenge.starts_at
      ).catch((err) => {
        console.error(`[backfill] failed for member ${member.user_id}:`, err);
      });
    }
  } catch (error) {
    console.error('Backfill handler error:', error);
    res.status(401).json({ error: 'Invalid JWT token' });
  }
}
