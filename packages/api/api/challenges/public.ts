import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../_utils/supabase.js';

export default async function handlePublic(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).end();
    return;
  }

  const { slug } = req.query;
  if (!slug || typeof slug !== 'string') {
    res.status(400).json({ error: 'Missing slug parameter' });
    return;
  }

  try {
    const { data: challenge, error: challengeError } = await supabase
      .from('challenges')
      .select('id, name, slug, type, starts_at, ends_at, invite_code')
      .eq('slug', slug)
      .single();

    if (challengeError || !challenge) {
      res.status(404).json({ error: 'Challenge not found' });
      return;
    }

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

    if (challenge.ends_at && challenge.ends_at < now) {
      query = query.lte('start_date', challenge.ends_at);
    }

    const { data: efforts, error: effortsError } = await query;

    if (effortsError) {
      console.error('Failed to fetch efforts:', effortsError);
      res.status(500).json({ error: 'Failed to fetch leaderboard' });
      return;
    }

    const userIds = [...new Set((efforts || []).map((e) => e.user_id))];

    let users: any[] = [];
    if (userIds.length > 0) {
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, name, profile_pic_url')
        .in('id', userIds);

      if (!usersError && usersData) {
        users = usersData;
      }
    }

    const userMap = new Map(users.map((u) => [u.id, u]));

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

      switch (challenge.type) {
        case 'count':
          current.score = current.effort_count;
          break;
        case 'time':
          current.score = Math.round(current.total_moving_time / 60);
          break;
        case 'elevation':
          current.score = Math.round(current.total_elevation);
          break;
      }

      statsMap.set(effort.user_id, current);
    }

    const leaderboard = Array.from(statsMap.entries())
      .map(([userId, stats]) => {
        const user = userMap.get(userId);
        return {
          rank: 0,
          user_id: userId,
          user_name: user?.name || 'Unknown',
          user_profile_pic: user?.profile_pic_url || '',
          effort_count: stats.effort_count,
          total_distance: Math.round(stats.total_distance / 1000 * 10) / 10,
          total_elevation: Math.round(stats.total_elevation),
          total_moving_time: stats.total_moving_time,
          score: stats.score,
        };
      })
      .sort((a, b) => b.score - a.score)
      .map((entry, index) => ({
        ...entry,
        rank: index + 1,
      }));

    const { data: segments } = await supabase
      .from('challenge_segments')
      .select('segment_name, distance, elevation_gain, strava_segment_id')
      .eq('challenge_id', challenge.id)
      .limit(1);

    const response: any = {
      id: challenge.id,
      name: challenge.name,
      slug: challenge.slug,
      type: challenge.type,
      starts_at: challenge.starts_at,
      ends_at: challenge.ends_at,
      invite_code: challenge.invite_code,
      leaderboard,
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
    console.error('Failed to fetch public challenge:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
