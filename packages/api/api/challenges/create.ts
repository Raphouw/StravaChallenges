import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, Challenge } from '../_utils/supabase.js';
import { verifyJWT } from '../_utils/jwt.js';

interface CreateChallengeBody {
  name: string;
  type: 'count' | 'time' | 'elevation';
  segment_id: number;
  starts_at: string;
  ends_at: string;
}

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
    // Verify JWT
    const payload = verifyJWT(jwt);

    const { name, type, segment_id, starts_at, ends_at } = req.body as CreateChallengeBody;

    // Validate input
    if (!name || !type || !segment_id || !starts_at || !ends_at) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    if (!['count', 'time', 'elevation'].includes(type)) {
      res.status(400).json({ error: 'Invalid challenge type' });
      return;
    }

    // Validate dates
    const startDate = new Date(starts_at);
    const endDate = new Date(ends_at);

    if (startDate > endDate) {
      res.status(400).json({ error: 'End date must be after start date' });
      return;
    }

    // Generate short invite_code (6 random alphanumeric chars)
    const invite_code = Math.random().toString(36).substring(2, 8).toUpperCase();

    // Generate slug from name
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      + '-' + Math.random().toString(36).substring(2, 7);

    // Create challenge
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

    // Add segment to challenge
    const { error: segmentError } = await supabase
      .from('challenge_segments')
      .insert({
        challenge_id: challenge.id,
        strava_segment_id: segment_id,
      });

    if (segmentError) {
      console.error('Failed to add segment:', segmentError);
      res.status(500).json({ error: 'Failed to add segment to challenge' });
      return;
    }

    // Add creator as member
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
