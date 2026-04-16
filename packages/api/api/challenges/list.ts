import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../_utils/supabase.js';
import { verifyJWT } from '../_utils/jwt.js';

export default async function handleList(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

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

    const { data: membershipData, error: membershipError } = await supabase
      .from('challenge_members')
      .select('challenge_id')
      .eq('user_id', payload.userId);

    if (membershipError) {
      console.error('Failed to fetch memberships:', membershipError);
      res.status(500).json({ error: 'Failed to fetch challenges' });
      return;
    }

    const memberChallengeIds = membershipData?.map((m) => m.challenge_id) || [];

    const { data: ownedChallenges, error: ownedError } = await supabase
      .from('challenges')
      .select('id')
      .eq('owner_id', payload.userId);

    if (ownedError) {
      console.error('Failed to fetch owned challenges:', ownedError);
      res.status(500).json({ error: 'Failed to fetch challenges' });
      return;
    }

    const ownedChallengeIds = ownedChallenges?.map((c) => c.id) || [];

    const allChallengeIds = Array.from(new Set([
      ...memberChallengeIds,
      ...ownedChallengeIds,
    ]));

    if (allChallengeIds.length === 0) {
      res.status(200).json([]);
      return;
    }

    const { data: uniqueChallenges, error: challengesError } = await supabase
      .from('challenges')
      .select('*')
      .in('id', allChallengeIds);

    if (challengesError || !uniqueChallenges) {
      console.error('Failed to fetch challenges:', challengesError);
      res.status(500).json({ error: 'Failed to fetch challenges' });
      return;
    }

    const { data: memberCounts, error: countError } = await supabase
      .from('challenge_members')
      .select('challenge_id')
      .in(
        'challenge_id',
        uniqueChallenges?.map((c) => c.id)
      );

    if (countError) {
      console.error('Failed to fetch member counts:', countError);
      res.status(500).json({ error: 'Failed to fetch challenges' });
      return;
    }

    const memberCountMap = new Map<string, number>();
    memberCounts?.forEach((mc) => {
      memberCountMap.set(
        mc.challenge_id,
        (memberCountMap.get(mc.challenge_id) || 0) + 1
      );
    });

    const challengesWithCounts = uniqueChallenges.map(
      (challenge) => {
        const isOwner = challenge.owner_id === payload.userId;
        const isMember = memberChallengeIds.includes(challenge.id);
        return {
          ...challenge,
          member_count: memberCountMap.get(challenge.id) || 0,
          is_owner: isOwner,
          is_member: isOwner || isMember,
        };
      }
    );

    res.status(200).json(challengesWithCounts);
  } catch (error) {
    console.error('Failed to fetch challenges:', error);
    res.status(401).json({ error: 'Invalid JWT token' });
  }
}
