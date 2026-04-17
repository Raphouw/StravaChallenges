import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, User } from '../_utils/supabase.js';
import { verifyJWT } from '../_utils/jwt.js';
import { decryptToken, encryptToken } from '../_utils/crypto.js';
import { refreshStravaToken } from '../_utils/strava-client.js';

interface CreateChallengeBody {
  name: string;
  type: 'count' | 'time' | 'elevation';
  segment_id: number;
  starts_at: string;
  ends_at: string;
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
      .select('strava_segment_id')
      .eq('challenge_id', challengeId);

    if (!segments) {
      console.error('Failed to fetch segments for backfill');
      return;
    }

    const segmentIds = new Set(segments.map(s => s.strava_segment_id));

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
            if (segmentIds.has(effort.segment.id)) {
              const { error: insertError } = await supabase
                .from('segment_efforts')
                .insert({
                  challenge_id: challengeId,
                  user_id: userData.id,
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

    const { name, type, segment_id, starts_at, ends_at } = req.body as CreateChallengeBody;

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
      const segmentResponse = await fetch(
        `https://www.strava.com/api/v3/segments/${segment_id}`,
        {
          headers: {
            Authorization: `Bearer ${decryptedToken}`,
          },
        }
      );

      if (segmentResponse.ok) {
        const segmentData = await segmentResponse.json() as any;
        console.log('Strava segment raw:', JSON.stringify(segmentData));
        segmentName = segmentData.name || '';
        segmentDistance = segmentData.distance || 0;
        segmentElevation = segmentData.total_elevation_gain || 0;
        console.log('distance meters:', segmentDistance);
        console.log('elevation gain:', segmentElevation);
      }
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
    console.log('starts_at:', starts_at);
    console.log('now:', now.toISOString());
    console.log('should backfill:', new Date(starts_at) < now);
    if (new Date(starts_at) < now) {
      console.log('Running backfill for challenge', challenge.id);
      await runBackfill(challenge.id, user as User, starts_at).catch((err: any) => {
        console.error('Backfill failed:', err);
      });
    }

    res.status(201).json({
      id: challenge.id,
      invite_code,
      name,
      type,
      starts_at,
      ends_at,
    });
  } catch (error) {
    console.error('Failed to create challenge:', error);
    res.status(401).json({ error: 'Invalid JWT token' });
  }
}
