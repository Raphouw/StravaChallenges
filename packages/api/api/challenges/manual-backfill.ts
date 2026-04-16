import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../_utils/supabase.js';
import { verifyJWT } from '../_utils/jwt.js';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // CORS headers
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

    const { challengeId } = req.body;
    if (!challengeId || typeof challengeId !== 'string') {
      res.status(400).json({ error: 'Missing challengeId in body' });
      return;
    }

    // Verify user is the challenge owner
    const { data: challenge } = await supabase
      .from('challenges')
      .select('owner_id')
      .eq('id', challengeId)
      .single();

    if (!challenge || challenge.owner_id !== payload.userId) {
      res.status(403).json({ error: 'Only challenge owner can trigger backfill' });
      return;
    }

    // Trigger backfill via internal API call
    const apiUrl = `${process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : 'https://strava-challenges-extension.vercel.app'}/api/challenges/backfill`;

    fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ challengeId }),
    }).catch((err) => {
      console.error('Backfill trigger failed:', err);
    });

    res.status(202).json({
      success: true,
      message: 'Backfill triggered successfully',
    });
  } catch (error) {
    console.error('Manual backfill error:', error);
    res.status(401).json({ error: 'Invalid JWT token' });
  }
}
