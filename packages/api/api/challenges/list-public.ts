import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../_utils/supabase.js';

function setCorsHeaders(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
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

    if (!challenges || challenges.length === 0) {
      res.status(200).json([]);
      return;
    }

    const challengeIds = challenges.map((c: any) => c.id);

    const { data: memberCounts } = await supabase
      .from('challenge_members')
      .select('challenge_id')
      .in('challenge_id', challengeIds);

    const { data: effortCounts } = await supabase
      .from('segment_efforts')
      .select('challenge_id')
      .in('challenge_id', challengeIds);

    const { data: segments } = await supabase
      .from('challenge_segments')
      .select('challenge_id, distance, elevation_gain')
      .in('challenge_id', challengeIds);

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
      segment: segmentMap.get(c.id) || null
    }));

    res.status(200).json(enrichedChallenges);
  } catch (error) {
    console.error('Failed to fetch challenges:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
