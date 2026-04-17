import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../_utils/supabase.js';
import { verifyJWT } from '../_utils/jwt.js';

function setCorsHeaders(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

async function handlePublicList(_req: VercelRequest, res: VercelResponse): Promise<void> {
  const { data: challenges, error } = await supabase
    .from('challenges')
    .select('id, slug, name, type, starts_at, ends_at, invite_code, is_public')
    .eq('is_public', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch challenges:', error);
    res.status(500).json({ error: 'Failed to fetch challenges' });
    return;
  }

  if (!challenges || challenges.length === 0) {
    res.status(200).json([]);
    return;
  }

  const challengeIds = challenges.map((c: any) => c.id);

  const [{ data: memberCounts }, { data: effortCounts }, { data: segments }] = await Promise.all([
    supabase.from('challenge_members').select('challenge_id').in('challenge_id', challengeIds),
    supabase.from('segment_efforts').select('challenge_id').in('challenge_id', challengeIds),
    supabase.from('challenge_segments')
      .select('challenge_id, strava_segment_id, segment_name, distance, elevation_gain')
      .in('challenge_id', challengeIds),
  ]);

  const memberCountMap = new Map<string, number>();
  memberCounts?.forEach((m: any) => {
    memberCountMap.set(m.challenge_id, (memberCountMap.get(m.challenge_id) || 0) + 1);
  });

  const effortCountMap = new Map<string, number>();
  effortCounts?.forEach((e: any) => {
    effortCountMap.set(e.challenge_id, (effortCountMap.get(e.challenge_id) || 0) + 1);
  });

  const segmentMap = new Map<string, any>();
  segments?.forEach((s: any) => {
    segmentMap.set(s.challenge_id, s);
  });

  const enrichedChallenges = challenges.map((c: any) => ({
    ...c,
    participant_count: memberCountMap.get(c.id) || 0,
    effort_count: effortCountMap.get(c.id) || 0,
    segment: segmentMap.get(c.id) || null,
  }));

  res.status(200).json(enrichedChallenges);
}

async function handleMineList(req: VercelRequest, res: VercelResponse): Promise<void> {
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
      .in('challenge_id', uniqueChallenges.map((c) => c.id));

    if (countError) {
      console.error('Failed to fetch member counts:', countError);
      res.status(500).json({ error: 'Failed to fetch challenges' });
      return;
    }

    const memberCountMap = new Map<string, number>();
    memberCounts?.forEach((mc) => {
      memberCountMap.set(mc.challenge_id, (memberCountMap.get(mc.challenge_id) || 0) + 1);
    });

    const challengesWithCounts = uniqueChallenges.map((challenge) => ({
      ...challenge,
      member_count: memberCountMap.get(challenge.id) || 0,
      is_owner: challenge.owner_id === payload.userId,
      is_member: memberChallengeIds.includes(challenge.id) || challenge.owner_id === payload.userId,
    }));

    res.status(200).json(challengesWithCounts);
  } catch (error) {
    console.error('Failed to fetch challenges:', error);
    res.status(401).json({ error: 'Invalid JWT token' });
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).end();
    return;
  }

  const scope = req.query.scope as string | undefined;

  if (scope === 'public') {
    return handlePublicList(req, res);
  }

  return handleMineList(req, res);
}
