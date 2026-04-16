import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../_utils/supabase.js';

function setCorsHeaders(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  setCorsHeaders(res);

  if (req.method !== 'GET') {
    res.status(405).end();
    return;
  }

  try {
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
