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
  score: number;
  best_time: number;
  avg_time: number;
  last_attempt: string;
  streak: number;
  delta_from_leader: string;
}

interface ApiResponse {
  entries: LeaderboardEntry[];
  totals: {
    total_attempts: number;
    total_distance: number;
    total_elevation: number;
    active_participants: number;
  };
  segment?: {
    name: string;
    distance: number;
    elevation_gain: number;
    strava_segment_id: number;
  };
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
    verifyJWT(jwt);

    // Get challenge ID from query
    const { id } = req.query;
    if (!id || typeof id !== 'string') {
      res.status(400).json({ error: 'Missing challenge ID' });
      return;
    }

    // Get challenge info
    const { data: challenge, error: challengeError } = await supabase
      .from('challenges')
      .select('id, type, starts_at, ends_at')
      .eq('id', id)
      .single();

    if (challengeError || !challenge) {
      res.status(404).json({ error: 'Challenge not found' });
      return;
    }

    // Get challenge segments (for segment info)
    const { data: segments } = await supabase
      .from('challenge_segments')
      .select('id, segment_name, distance, elevation_gain, strava_segment_id')
      .eq('challenge_id', challenge.id)
      .limit(1);

    // Get all segment efforts
    const now = new Date().toISOString();
    let query = supabase
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
      .eq('challenge_id', challenge.id);

    // Only filter by end date if challenge has already ended
    if (challenge.ends_at && challenge.ends_at < now) {
      query = query.lte('start_date', challenge.ends_at);
    }

    const { data: efforts, error: effortsError } = await query;

    if (effortsError) {
      console.error('Failed to fetch efforts:', effortsError);
      res.status(500).json({ error: 'Failed to fetch leaderboard' });
      return;
    }

    // Get user info
    const userIds = [...new Set((efforts || []).map((e) => e.user_id))];

    if (userIds.length === 0) {
      const response: ApiResponse = {
        entries: [],
        totals: {
          total_attempts: 0,
          total_distance: 0,
          total_elevation: 0,
          active_participants: 0,
        },
      };
      if (segments && segments.length > 0) {
        response.segment = {
          name: segments[0].segment_name,
          distance: segments[0].distance,
          elevation_gain: segments[0].elevation_gain,
          strava_segment_id: segments[0].strava_segment_id,
        };
      }
      res.status(200).json(response);
      return;
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

    // Aggregate stats by user
    const statsMap = new Map<
      string,
      {
        effort_count: number;
        total_distance: number;
        total_elevation: number;
        total_moving_time: number;
        score: number;
        efforts: any[];
      }
    >();

    for (const effort of efforts || []) {
      const current = statsMap.get(effort.user_id) || {
        effort_count: 0,
        total_distance: 0,
        total_elevation: 0,
        total_moving_time: 0,
        score: 0,
        efforts: [],
      };

      current.effort_count += 1;
      current.total_distance += effort.distance || 0;
      current.total_elevation += effort.elevation_gain || 0;
      current.total_moving_time += effort.moving_time || 0;
      current.efforts.push(effort);

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

    // Calculate streak and other per-user stats
    const calculateStreak = (efforts: any[]): number => {
      if (efforts.length === 0) return 0;

      const sortedEfforts = [...efforts].sort(
        (a, b) =>
          new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
      );

      let streak = 0;
      let currentDate = new Date(sortedEfforts[0].start_date);
      currentDate.setHours(0, 0, 0, 0);

      const effortsByDay = new Set(
        sortedEfforts.map((e) => {
          const d = new Date(e.start_date);
          return d.toISOString().split('T')[0];
        })
      );

      for (const dateStr of Array.from(effortsByDay).sort().reverse()) {
        const date = new Date(dateStr);
        if (
          Math.abs(
            currentDate.getTime() - date.getTime()
          ) / (1000 * 60 * 60 * 24) < 1.5
        ) {
          streak++;
          currentDate = date;
        } else {
          break;
        }
      }

      return streak;
    };

    // Build leaderboard with enhanced stats
    const leaderboard: LeaderboardEntry[] = Array.from(statsMap.entries())
      .map(([userId, stats]) => {
        const user = userMap.get(userId);
        const sortedEfforts = [...stats.efforts].sort(
          (a, b) =>
            new Date(a.moving_time).getTime() -
            new Date(b.moving_time).getTime()
        );

        const bestTime = sortedEfforts.length
          ? Math.min(...sortedEfforts.map((e) => e.moving_time))
          : 0;
        const avgTime = stats.effort_count
          ? Math.round(stats.total_moving_time / stats.effort_count)
          : 0;

        const lastAttempt = stats.efforts.length
          ? stats.efforts.reduce((latest, current) =>
              new Date(current.start_date) > new Date(latest.start_date)
                ? current
                : latest
            ).start_date
          : '';

        return {
          rank: 0, // Will be set after sorting
          user_id: userId,
          user_name: user?.name || 'Unknown',
          user_profile_pic: user?.profile_pic_url || '',
          effort_count: stats.effort_count,
          total_distance: Math.round(stats.total_distance * 10) / 10,
          total_elevation: Math.round(stats.total_elevation),
          total_moving_time: stats.total_moving_time,
          score: stats.score,
          best_time: bestTime,
          avg_time: avgTime,
          last_attempt: lastAttempt,
          streak: calculateStreak(stats.efforts),
          delta_from_leader: '', // Will be set after sorting
        };
      })
      .sort((a, b) => b.score - a.score)
      .map((entry, index) => {
        const leaderScore = index === 0 ? entry.score : 0;
        let deltaStr = '';

        if (index === 0) {
          deltaStr = '🏆 Leader';
        } else {
          const delta = leaderScore - entry.score;
          if (challenge.type === 'time') {
            deltaStr = `+${Math.floor(delta)}min`;
          } else if (challenge.type === 'elevation') {
            deltaStr = `+${Math.round(delta)}m`;
          } else {
            deltaStr = `-${delta} efforts`;
          }
        }

        return {
          ...entry,
          rank: index + 1,
          delta_from_leader: deltaStr,
        };
      });

    const response: ApiResponse = {
      entries: leaderboard,
      totals: {
        total_attempts: leaderboard.reduce((sum, e) => sum + e.effort_count, 0),
        total_distance: Math.round(
          leaderboard.reduce((sum, e) => sum + e.total_distance, 0) * 10
        ) / 10,
        total_elevation: Math.round(
          leaderboard.reduce((sum, e) => sum + e.total_elevation, 0)
        ),
        active_participants: leaderboard.length,
      },
    };

    if (segments && segments.length > 0) {
      response.segment = {
        name: segments[0].segment_name,
        distance: segments[0].distance,
        elevation_gain: segments[0].elevation_gain,
        strava_segment_id: segments[0].strava_segment_id,
      };
    }

    res.status(200).json(response);
  } catch (error) {
    console.error('Failed to fetch leaderboard:', error);
    res.status(401).json({ error: 'Invalid JWT token' });
  }
}
