import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../_utils/supabase.js';
import { verifyJWT } from '../_utils/jwt.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
    const payload = verifyJWT(jwt);

    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, strava_id, profile_pic_url, is_admin')
      .eq('id', payload.userId)
      .single();

    if (error || !user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.status(200).json({
      id: user.id,
      name: user.name,
      strava_id: user.strava_id,
      profile_pic_url: user.profile_pic_url,
      is_admin: user.is_admin || false,
    });
  } catch (error) {
    console.error('Failed to fetch user:', error);
    res.status(401).json({ error: 'Invalid JWT token' });
  }
}
