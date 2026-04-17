import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, User } from '../_utils/supabase.js';
import { verifyJWT } from '../_utils/jwt.js';
import { decryptToken, encryptToken } from '../_utils/crypto.js';
import { refreshStravaToken, getStravaSegment } from '../_utils/strava-client.js';

interface CreateChallengeBody {
  name: string;
  type: 'count' | 'time' | 'elevation';
  segment_id: number;
  starts_at: string;
  ends_at: string;
  is_public?: boolean;
}

async function runBackfill(
  challengeId: string,
  user: User,
  startDate: string
): Promise<void> {
  try {
    const userData = user as User;
    let accessToken = userData.access_token;

    if (userData.token_expires_at) {
      const expiresAt = new Date(userData.token_expires_at).getTime();
      if (expiresAt <= Date.now()) {
        const decrypted = decryptToken(userData.refresh_token);
        const newTokens = await refreshStravaToken(decrypted);
        accessToken = encryptToken(newTokens.access_token);
      }
    }

    const decryptedToken = decryptToken(accessToken);
    const unixTimestamp = Math.floor(new Date(startDate).getTime() / 1000);

    const activitiesResponse = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?after=${unixTimestamp}&per_page=50`,
      {
        headers: { Authorization: `Bearer ${decryptedToken}` },
      }
    );

    if (!activitiesResponse.ok) {
      console.error('Failed to fetch activities for backfill');
      return;
    }

    const activities = (await activitiesResponse.json()) as any[];

    const { data: segments } = await supabase
      .from('challenge_segments')
      .select('id, strava_segment_id')
      .eq('challenge_id', challengeId);

    if (!segments) {
      console.error('Failed to fetch segments for backfill');
      return;
    }

    const segmentMap = new Map(segments.map(s => [s.strava_segment_id, s.id]));

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

        if (activityDetail.segment_efforts && Array.isArray(activityDetail.segment_efforts)) {
          for (const effort of activityDetail.segment_efforts) {
            const challengeSegmentId = segmentMap.get(effort.segment.id);
            if (challengeSegmentId) {
              const { error: insertError } = await supabase
                .from('segment_efforts')
                .insert({
                  challenge_id: challengeId,
                  challenge_segment_id: challengeSegmentId,
                  user_id: userData.id,
                  strava_activity_id: activity.id,
                  strava_effort_id: effort.id,
                  elapsed_time: effort.elapsed_time,
                  moving_time: effort.moving_time,
                  start_date: effort.start_date,
                  distance: effort.distance,
                  elevation_gain: effort.elevation_gain || 0,
                });

              if (insertError && insertError.code !== '23505') {
                console.error(`Failed to insert effort ${effort.id}:`, insertError);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error processing activity for backfill:', error);
      }
    }

    console.log(`Backfill completed for challenge ${challengeId}`);
  } catch (error) {
    console.error('Backfill error:', error);
  }
}
// Keep runBackfill for potential internal use but primary path uses the backfill endpoint

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

    const { name, type, segment_id, starts_at, ends_at, is_public = true } = req.body as CreateChallengeBody;

    if (!name || !type || !segment_id || !starts_at || !ends_at) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    if (!['count', 'time', 'elevation'].includes(type)) {
      res.status(400).json({ error: 'Invalid challenge type' });
      return;
    }

    const startDate = new Date(starts_at);
    const endDate = new Date(ends_at);

    if (startDate > endDate) {
      res.status(400).json({ error: 'End date must be after start date' });
      return;
    }

    const invite_code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      + '-' + Math.random().toString(36).substring(2, 7);

    const { data: challenge, error: createError } = await supabase
      .from('challenges')
      .insert({
        name,
        type,
        slug,
        invite_code,
        owner_id: payload.userId,
        starts_at,
        ends_at,
        is_public,
      })
      .select('id')
      .single();

    if (createError || !challenge) {
      console.error('Failed to create challenge:', createError);
      res.status(500).json({ error: 'Failed to create challenge' });
      return;
    }

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', payload.userId)
      .single();

    if (userError || !user) {
      console.error('Failed to fetch user:', userError);
      res.status(500).json({ error: 'Failed to fetch user data' });
      return;
    }

    let segmentName = '';
    let segmentDistance = 0;
    let segmentElevation = 0;

    try {
      const userData = user as User;
      let accessToken = userData.access_token;

      if (userData.token_expires_at) {
        const expiresAt = new Date(userData.token_expires_at).getTime();
        if (expiresAt <= Date.now()) {
          const decrypted = decryptToken(userData.refresh_token);
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
            .eq('id', payload.userId);
        }
      }

      const decryptedToken = decryptToken(accessToken);
      const segmentData = await getStravaSegment(segment_id, decryptedToken);
      segmentName = segmentData.name || '';
      segmentDistance = segmentData.distance || 0;
      segmentElevation = segmentData.total_elevation_gain > 0
        ? segmentData.total_elevation_gain
        : Math.max(0, (segmentData.elevation_high ?? 0) - (segmentData.elevation_low ?? 0));
    } catch (error) {
      console.error('Failed to fetch segment details from Strava:', error);
    }

    const { error: segmentError } = await supabase
      .from('challenge_segments')
      .insert({
        challenge_id: challenge.id,
        strava_segment_id: segment_id,
        segment_name: segmentName,
        distance: segmentDistance,
        elevation_gain: segmentElevation,
      });

    if (segmentError) {
      console.error('Failed to add segment:', segmentError);
      res.status(500).json({ error: 'Failed to add segment to challenge' });
      return;
    }

    const { error: memberError } = await supabase
      .from('challenge_members')
      .insert({
        challenge_id: challenge.id,
        user_id: payload.userId,
        joined_at: new Date().toISOString(),
      });

    if (memberError) {
      console.error('Failed to add creator as member:', memberError);
      res.status(500).json({ error: 'Failed to add creator as member' });
      return;
    }

    const now = new Date();
    const needsBackfill = new Date(starts_at) < now;

    res.status(201).json({
      id: challenge.id,
      invite_code,
      name,
      type,
      starts_at,
      ends_at,
      slug,
      needs_backfill: needsBackfill,
    });
  } catch (error) {
    console.error('Failed to create challenge:', error);
    res.status(401).json({ error: 'Invalid JWT token' });
  }
}
