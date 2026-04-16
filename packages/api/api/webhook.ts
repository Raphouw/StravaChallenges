import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, SegmentEffort, ChallengeSegment, User } from './_utils/supabase.js';
import { getStravaActivity, refreshStravaToken } from './_utils/strava-client.js';
import { decryptToken, encryptToken } from './_utils/crypto.js';

const WEBHOOK_VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN || '';

interface WebhookBody {
  object_type: string;
  aspect_type: string;
  object_id: number;
  owner_id: number;
  subscription_id: number;
  event_time: number;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const pathParam = typeof req.query.__path === 'string' ? req.query.__path : Array.isArray(req.query.__path) ? req.query.__path[0] : '';
  const path = `/${pathParam}`;

  if (path === '/strava') {
    return handleStrava(req, res);
  }

  res.status(404).json({ error: 'Not found' });
}

async function handleStrava(req: VercelRequest, res: VercelResponse): Promise<void> {
  // Handle Strava webhook verification (GET request)
  if (req.method === 'GET') {
    const { 'hub.challenge': challenge, 'hub.verify_token': token } = req.query;

    if (token !== WEBHOOK_VERIFY_TOKEN) {
      res.status(403).json({ error: 'Invalid verify token' });
      return;
    }

    res.status(200).json({ 'hub.challenge': challenge });
    return;
  }

  // Handle webhook events (POST request)
  if (req.method === 'POST') {
    const body: WebhookBody = req.body;

    // Only process activity creation events
    if (body.object_type !== 'activity' || body.aspect_type !== 'create') {
      res.status(200).end();
      return;
    }

    try {
      // 1. Find user by Strava ID
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('strava_id', body.owner_id)
        .single();

      if (!userData) {
        res.status(200).end();
        return;
      }

      const user = userData as User;
      let accessToken = user.access_token;

      // 2. Check if token needs refresh
      if (user.token_expires_at) {
        const expiresAt = new Date(user.token_expires_at).getTime();
        if (expiresAt <= Date.now()) {
          try {
            const decrypted = decryptToken(user.refresh_token);
            const newTokens = await refreshStravaToken(decrypted);

            accessToken = encryptToken(newTokens.access_token);
            const encryptedRefreshToken = encryptToken(newTokens.refresh_token);

            await supabase
              .from('users')
              .update({
                access_token: accessToken,
                refresh_token: encryptedRefreshToken,
                token_expires_at: new Date(newTokens.expires_at * 1000).toISOString(),
              })
              .eq('id', user.id);
          } catch (error) {
            console.error('Failed to refresh token:', error);
            res.status(500).end();
            return;
          }
        }
      }

      // 3. Decrypt access token
      const decryptedAccessToken = decryptToken(accessToken);

      // 4. Fetch activity details
      let activity;
      try {
        activity = await getStravaActivity(body.object_id, decryptedAccessToken);
      } catch (error) {
        console.error('Failed to fetch activity:', error);
        res.status(500).end();
        return;
      }

      // 5. Get challenge segments
      const { data: challengeSegments } = await supabase
        .from('challenge_segments')
        .select(
          `
          id,
          challenge_id,
          strava_segment_id,
          segment_name,
          distance,
          elevation_gain,
          challenges!inner(
            id,
            starts_at,
            ends_at
          )
        `
        )
        .in(
          'strava_segment_id',
          activity.segment_efforts.map((e) => e.segment.id)
        );

      if (!challengeSegments || challengeSegments.length === 0) {
        res.status(200).end();
        return;
      }

      // 6. Create map of segment efforts
      const effortsBySegmentId = new Map(
        activity.segment_efforts.map((e) => [e.segment.id, e])
      );

      // 7. For each matching segment, create effort record
      const now = new Date();
      const effortsToInsert: SegmentEffort[] = [];

      for (const segment of challengeSegments) {
        const effort = effortsBySegmentId.get(segment.strava_segment_id);
        if (!effort) continue;

        const activityDate = new Date(effort.start_date);
        const challengeStart = new Date((segment.challenges as any).starts_at);
        const challengeEnd = new Date((segment.challenges as any).ends_at);

        if (activityDate < challengeStart || activityDate > challengeEnd) {
          continue;
        }

        effortsToInsert.push({
          id: crypto.randomUUID ? crypto.randomUUID() : '',
          challenge_id: segment.challenge_id,
          challenge_segment_id: segment.id,
          user_id: user.id,
          strava_activity_id: body.object_id,
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

      // 8. Insert efforts
      if (effortsToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('segment_efforts')
          .insert(effortsToInsert);

        if (insertError) {
          console.error('Failed to insert efforts:', insertError);
          res.status(500).end();
          return;
        }
      }

      res.status(200).end();
    } catch (error) {
      console.error('Webhook error:', error);
      res.status(500).end();
    }
  } else {
    res.status(405).end();
  }
}
