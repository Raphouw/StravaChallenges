import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../_utils/supabase.js';
import { verifyJWT } from '../_utils/jwt.js';

interface LeaderboardEntry {
  rank: number;
  user_id: string;
  user_name: string;
  user_profile_pic: string;
  effort_count: number;
  total_distance: number;
  total_elevation: number;
  total_moving_time: number;
}

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

    // Get challenge ID from query
    const { id } = req.query;
    if (!id || typeof id !== 'string') {
      res.status(400).json({ error: 'Missing challenge ID' });
      return;
    }

    // Get challenge info to check dates
    const { data: challenge, error: challengeError } = await supabase
      .from('challenges')
      .select('id, type, starts_at, ends_at')
      .eq('id', id)
      .single();

    if (challengeError || !challenge) {
      res.status(404).json({ error: 'Challenge not found' });
      return;
    }

    // Get all segment efforts for this challenge within the date range
    const { data: efforts, error: effortsError } = await supabase
      .from('segment_efforts')
      .select(
        `
        id,
        user_id,
        elapsed_time,
        moving_time,
        distance,
        elevation_gain,
        start_date
      `
      )
      .eq('challenge_id', challenge.id)
      .gte('start_date', challenge.starts_at)
      .lte('start_date', challenge.ends_at);

    if (effortsError) {
      console.error('Failed to fetch efforts:', effortsError);
      res.status(500).json({ error: 'Failed to fetch leaderboard' });
      return;
    }

    // Get user info for all participants
    const userIds = [...new Set((efforts || []).map((e) => e.user_id))];

    if (userIds.length === 0) {
      return res.status(200).json([]);
    }

    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, name, profile_pic_url')
      .in('id', userIds);

    if (usersError) {
      console.error('Failed to fetch users:', usersError);
      res.status(500).json({ error: 'Failed to fetch leaderboard' });
      return;
    }

    const userMap = new Map(users?.map((u) => [u.id, u]) || []);

    // Aggregate stats by user based on challenge type
    const statsMap = new Map<
      string,
      {
        effort_count: number;
        total_distance: number;
        total_elevation: number;
        total_moving_time: number;
        score: number;
      }
    >();

    for (const effort of efforts || []) {
      const current = statsMap.get(effort.user_id) || {
        effort_count: 0,
        total_distance: 0,
        total_elevation: 0,
        total_moving_time: 0,
        score: 0,
      };

      current.effort_count += 1;
      current.total_distance += effort.distance || 0;
      current.total_elevation += effort.elevation_gain || 0;
      current.total_moving_time += effort.moving_time || 0;

      // Calculate score based on challenge type
      switch (challenge.type) {
        case 'count':
          current.score = current.effort_count;
          break;
        case 'time':
          current.score = Math.round(current.total_moving_time / 60); // minutes
          break;
        case 'elevation':
          current.score = Math.round(current.total_elevation);
          break;
      }

      statsMap.set(effort.user_id, current);
    }

    // Build leaderboard and sort by score
    const leaderboard: LeaderboardEntry[] = Array.from(statsMap.entries())
      .map(([userId, stats]) => {
        const user = userMap.get(userId);
        return {
          rank: 0, // Will be set after sorting
          user_id: userId,
          user_name: user?.name || 'Unknown',
          user_profile_pic: user?.profile_pic_url || '',
          ...stats,
        };
      })
      .sort((a, b) => b.score - a.score)
      .map((entry, index) => ({
        ...entry,
        rank: index + 1,
      }));

    res.status(200).json(leaderboard);
  } catch (error) {
    console.error('Failed to fetch leaderboard:', error);
    res.status(401).json({ error: 'Invalid JWT token' });
  }
}
