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

async function triggerBackfill(challengeId: string, jwt: string): Promise<void> {
  try {
    await fetch(
      `${process.env.API_URL || 'https://strava-challenges-extension.vercel.app'}/api/challenges/backfill`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ challengeId }),
      }
    );
  } catch (error) {
    console.error('Failed to trigger backfill:', error);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
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
        segmentDistance = (segmentData.distance || 0) / 1000;
        segmentElevation = segmentData.total_elevation_gain || 0;
        console.log(`Segment: ${segmentName}, Distance: ${segmentDistance}km, Elevation: ${segmentElevation}m`);
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
    if (new Date(starts_at) < now) {
      triggerBackfill(challenge.id, jwt).catch((err) => {
        console.error('Backfill trigger failed:', err);
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
