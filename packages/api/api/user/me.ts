import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, User } from '../_utils/supabase.js';
import { verifyJWT } from '../_utils/jwt.js';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method !== 'GET') {
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

    // Fetch user from database
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, name, profile_pic_url, strava_id')
      .eq('id', payload.userId)
      .single();

    if (userError || !user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.status(200).json({
      id: user.id,
      name: user.name,
      profile_pic_url: user.profile_pic_url,
      strava_id: user.strava_id,
    });
  } catch (error) {
    console.error('Failed to fetch user:', error);
    res.status(401).json({ error: 'Invalid JWT token' });
  }
}
