import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../_utils/supabase.js';
import { verifyJWT } from '../_utils/jwt.js';

interface JoinChallengeBody {
  invite_code: string;
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

    const { invite_code } = req.body as JoinChallengeBody;

    if (!invite_code) {
      res.status(400).json({ error: 'Missing challenge invite_code' });
      return;
    }

    // Find challenge by invite_code
    const { data: challenge, error: findError } = await supabase
      .from('challenges')
      .select('id')
      .eq('invite_code', invite_code.toUpperCase())
      .single();

    if (findError || !challenge) {
      res.status(404).json({ error: 'Challenge not found' });
      return;
    }

    // Check if user is already a member
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

    // Add user as member
    const { error: joinError } = await supabase
      .from('challenge_members')
      .insert({
        challenge_id: challenge.id,
        user_id: payload.userId,
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
