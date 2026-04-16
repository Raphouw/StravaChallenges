import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../_utils/supabase.js';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).end();
    return;
  }

  try {
    // Get all challenges ordered by creation date
    const { data: challenges, error } = await supabase
      .from('challenges')
      .select('id, slug, name, type, starts_at, ends_at, invite_code')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch challenges:', error);
      res.status(500).json({ error: 'Failed to fetch challenges' });
      return;
    }

    res.status(200).json(challenges || []);
  } catch (error) {
    console.error('Failed to fetch challenges:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
