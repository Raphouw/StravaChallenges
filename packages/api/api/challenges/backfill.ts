import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, User } from '../_utils/supabase.js';
import { verifyJWT } from '../_utils/jwt.js';
import { decryptToken, encryptToken } from '../_utils/crypto.js';
import { refreshStravaToken } from '../_utils/strava-client.js';

interface BackfillRequest {
  challengeId: string;
}

async function fetchAllActivities(accessToken: string, since: Date): Promise<any[]> {
  const allActivities: any[] = [];
  let page = 1;
  const perPage = 200;

  while (true) {
    console.log(`[backfill] fetching activities page ${page}...`);
    const res = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?after=${Math.floor(since.getTime() / 1000)}&per_page=${perPage}&page=${page}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!res.ok) {
      console.error(`[backfill] page ${page} fetch failed: ${res.status}`);
      break;
    }

    const activities = (await res.json()) as any[];
    if (!Array.isArray(activities) || activities.length === 0) break;

    allActivities.push(...activities);
    console.log(`[backfill] page ${page}: ${activities.length} activities (total: ${allActivities.length})`);

    if (activities.length < perPage) break;
    page++;
  }

  return allActivities;
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

    console.log(`[backfill] fetching activities for user ${userId} since ${startDate.toISOString()}`);

    const activities = await fetchAllActivities(decryptedToken, startDate);
    console.log(`[backfill] found ${activities.length} total activities for user ${userId}`);

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
    console.log(`[backfill] found ${segments.length} challenge segments for user ${userId}`);

    let effortsInserted = 0;

    // Process each activity
    for (const activity of activities) {
      try {
        console.log(`[backfill] fetching detail for activity ${activity.id}`);
        const detailResponse = await fetch(
          `https://www.strava.com/api/v3/activities/${activity.id}`,
          {
            headers: { Authorization: `Bearer ${decryptedToken}` },
          }
        );

        if (!detailResponse.ok) {
          console.warn(`[backfill] activity ${activity.id} detail fetch failed`);
          continue;
        }

        const activityDetail = (await detailResponse.json()) as any;

        // Process segment efforts
        if (activityDetail.segment_efforts && Array.isArray(activityDetail.segment_efforts)) {
          const matchingEfforts = activityDetail.segment_efforts.filter((e: any) => segmentIds.has(e.segment.id));
          console.log(`[backfill] activity ${activity.id} has ${matchingEfforts.length} matching efforts`);

          for (const effort of matchingEfforts) {
            console.log('[backfill] effort raw fields:', {
              elapsed_time: effort.elapsed_time,
              moving_time: effort.moving_time,
              start_date: effort.start_date,
              distance: effort.distance,
              elevation_gain: effort.elevation_gain,
              total_elevation_gain: effort.total_elevation_gain,
              average_watts: effort.average_watts,
              average_cadence: effort.average_cadence,
            });

            const { data: segmentData } = await supabase
              .from('challenge_segments')
              .select('id')
              .eq('challenge_id', challengeId)
              .eq('strava_segment_id', effort.segment.id)
              .single();

            const { error: insertError } = await supabase
              .from('segment_efforts')
              .insert({
                challenge_id: challengeId,
                challenge_segment_id: segmentData?.id,
                user_id: userId,
                strava_activity_id: activity.id,
                strava_effort_id: effort.id,
                elapsed_time: effort.elapsed_time,
                moving_time: effort.moving_time,
                start_date: effort.start_date,
                distance: effort.distance,
                elevation_gain: effort.total_elevation_gain ?? effort.elevation_gain ?? 0,
                average_watts: effort.average_watts ?? null,
                average_cadence: effort.average_cadence ?? null,
              });

            if (insertError && insertError.code !== '23505') {
              // 23505 is unique constraint violation (duplicate)
              console.error(`[backfill] failed to insert effort ${effort.id}:`, insertError);
            } else if (!insertError) {
              effortsInserted++;
            }
          }
        }
      } catch (error) {
        console.error(`[backfill] failed to process activity ${activity.id}:`, error);
        continue;
      }
    }

    console.log(`[backfill] completed for user ${userId}, inserted ${effortsInserted} efforts`);
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

    console.log('[backfill] starting backfill for', members?.length || 0, 'members');

    let totalEffortsInserted = 0;

    // Process each member synchronously
    for (const member of members) {
      try {
        await backfillChallengeActivities(
          challengeId,
          member.user_id,
          jwt,
          challenge.starts_at
        );
        console.log(`[backfill] completed for member ${member.user_id}`);
      } catch (err) {
        console.error(`[backfill] failed for member ${member.user_id}:`, err);
      }
    }

    console.log('[backfill] all members processed');
    res.status(200).json({ message: 'Backfill complete', members_processed: members?.length || 0 });
  } catch (error) {
    console.error('Backfill handler error:', error);
    res.status(401).json({ error: 'Invalid JWT token' });
  }
}
