import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../_utils/supabase.js';
import { verifyJWT } from '../_utils/jwt.js';

export default async function handleJoin(req: VercelRequest, res: VercelResponse): Promise<void> {
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

    const { invite_code, code } = req.body as any;
    const challengeCode = (invite_code || code || '').toUpperCase();

    if (!challengeCode) {
      res.status(400).json({ error: 'Missing challenge code' });
      return;
    }

    const { data: challenge, error: findError } = await supabase
      .from('challenges')
      .select('id, owner_id')
      .eq('invite_code', challengeCode)
      .single();

    if (findError || !challenge) {
      res.status(404).json({ error: 'Challenge not found' });
      return;
    }

    if (challenge.owner_id === payload.userId) {
      res.status(400).json({ error: 'You cannot join your own challenge' });
      return;
    }

    const { data: existingMember } = await supabase
      .from('challenge_members')
      .select('id')
      .eq('challenge_id', challenge.id)
      .eq('user_id', payload.userId)
      .single();

    if (existingMember) {
      res.status(400).json({ error: 'You are already a member of this challenge' });
      return;
    }

    const { error: joinError } = await supabase
      .from('challenge_members')
      .insert({
        challenge_id: challenge.id,
        user_id: payload.userId,
        joined_at: new Date().toISOString(),
      });

    if (joinError) {
      console.error('Failed to join challenge:', joinError);
      res.status(500).json({ error: 'Failed to join challenge' });
      return;
    }

    res.status(200).json({
      id: challenge.id,
      message: 'Successfully joined challenge',
    });
  } catch (error) {
    console.error('Failed to join challenge:', error);
    res.status(401).json({ error: 'Invalid JWT token' });
  }
}
