import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, Challenge, SegmentEffort, ChallengeSegment, User } from './_utils/supabase.js';
import { verifyJWT } from './_utils/jwt.js';
import { decryptToken, encryptToken } from './_utils/crypto.js';
import { getStravaActivity, refreshStravaToken } from './_utils/strava-client.js';

interface CreateChallengeBody {
  name: string;
  type: 'count' | 'time' | 'elevation';
  segment_id: number;
  starts_at: string;
  ends_at: string;
}

interface StravaSegmentEffort {
  id: number;
  segment: {
    id: number;
    name: string;
    distance: number;
    elevation_gain: number;
  };
  elapsed_time: number;
  moving_time: number;
  start_date: string;
  distance: number;
  elevation_gain: number;
  average_watts?: number;
  average_cadence?: number;
}

interface StravaActivity {
  id: number;
  name: string;
  segment_efforts: StravaSegmentEffort[];
}

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

function setCorsHeaders(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const path = req.url?.split('?')[0];
  
  if (path?.startsWith('/api/challenges/') && req.method === 'OPTIONS') {
    setCorsHeaders(res);
    return res.status(200).end();
  }
  
  if (path?.includes('/challenges/create') && req.method === 'POST') return handleCreate(req, res);
  if (path?.includes('/challenges/list-public') && req.method === 'GET') { setCorsHeaders(res); return handleListPublic(req, res); }
  if (path?.includes('/challenges/list') && req.method === 'GET') return handleList(req, res);
  if (path?.includes('/challenges/join') && req.method === 'POST') return handleJoin(req, res);
  if (path?.includes('/challenges/leaderboard') && req.method === 'GET') { setCorsHeaders(res); return handleLeaderboard(req, res); }
  if (path?.includes('/challenges/public') && req.method === 'GET') { setCorsHeaders(res); return handlePublic(req, res); }
  if (path?.includes('/challenges/backfill') && req.method === 'POST') return handleBackfill(req, res);
  if (path?.includes('/challenges/delete') && req.method === 'DELETE') return handleDelete(req, res);
  if (path?.includes('/challenges/manual-backfill') && req.method === 'POST') return handleManualBackfill(req, res);
  
  res.status(404).json({ error: 'Not found' });
}

async function handleCreate(req: VercelRequest, res: VercelResponse): Promise<void> {
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

    const { name, type, segment_id, starts_at, ends_at } = req.body as CreateChallengeBody;

    if (!name || !type || !segment_id || !starts_at || !ends_at) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    if (!['count', 'time', 'elevation'].includes(type)) {
      res.status(400).json({ error: 'Invalid challenge type' });
      return;
    }

    const startDate = new Date(starts_at);
    const endDate = new Date(ends_at);

    if (startDate > endDate) {
      res.status(400).json({ error: 'End date must be after start date' });
      return;
    }

    const invite_code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      + '-' + Math.random().toString(36).substring(2, 7);

    const { data: challenge, error: createError } = await supabase
      .from('challenges')
      .insert({
        name,
        type,
        slug,
        invite_code,
        owner_id: payload.userId,
        starts_at,
        ends_at,
      })
      .select('id')
      .single();

    if (createError || !challenge) {
      console.error('Failed to create challenge:', createError);
      res.status(500).json({ error: 'Failed to create challenge' });
      return;
    }

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', payload.userId)
      .single();

    if (userError || !user) {
      console.error('Failed to fetch user:', userError);
      res.status(500).json({ error: 'Failed to fetch user data' });
      return;
    }

    let segmentName = '';
    let segmentDistance = 0;
    let segmentElevation = 0;

    try {
      const userData = user as User;
      let accessToken = userData.access_token;

      if (userData.token_expires_at) {
        const expiresAt = new Date(userData.token_expires_at).getTime();
        if (expiresAt <= Date.now()) {
          const decrypted = decryptToken(userData.refresh_token);
          const newTokens = await refreshStravaToken(decrypted);
          accessToken = encryptToken(newTokens.access_token);

          await supabase
            .from('users')
            .update({
              access_token: accessToken,
              refresh_token: encryptToken(newTokens.refresh_token),
              token_expires_at: new Date(
                newTokens.expires_at * 1000
              ).toISOString(),
            })
            .eq('id', payload.userId);
        }
      }

      const decryptedToken = decryptToken(accessToken);
      const segmentResponse = await fetch(
        `https://www.strava.com/api/v3/segments/${segment_id}`,
        {
          headers: {
            Authorization: `Bearer ${decryptedToken}`,
          },
        }
      );

      if (segmentResponse.ok) {
        const segmentData = await segmentResponse.json() as any;
        segmentName = segmentData.name || '';
        segmentDistance = segmentData.distance || 0;
        segmentElevation = segmentData.elevation_gain || 0;
      }
    } catch (error) {
      console.error('Failed to fetch segment details from Strava:', error);
    }

    const { error: segmentError } = await supabase
      .from('challenge_segments')
      .insert({
        challenge_id: challenge.id,
        strava_segment_id: segment_id,
        segment_name: segmentName,
        distance: segmentDistance,
        elevation_gain: segmentElevation,
      });

    if (segmentError) {
      console.error('Failed to add segment:', segmentError);
      res.status(500).json({ error: 'Failed to add segment to challenge' });
      return;
    }

    const { error: memberError } = await supabase
      .from('challenge_members')
      .insert({
        challenge_id: challenge.id,
        user_id: payload.userId,
        joined_at: new Date().toISOString(),
      });

    if (memberError) {
      console.error('Failed to add creator as member:', memberError);
      res.status(500).json({ error: 'Failed to add creator as member' });
      return;
    }

    const now = new Date();
    if (new Date(starts_at) < now) {
      triggerBackfill(challenge.id, jwt).catch((err) => {
        console.error('Backfill trigger failed:', err);
      });
    }

    res.status(201).json({
      id: challenge.id,
      invite_code,
      name,
      type,
      starts_at,
      ends_at,
    });
  } catch (error) {
    console.error('Failed to create challenge:', error);
    res.status(401).json({ error: 'Invalid JWT token' });
  }
}

async function handleListPublic(req: VercelRequest, res: VercelResponse): Promise<void> {
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

async function handleList(req: VercelRequest, res: VercelResponse): Promise<void> {
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

async function handleJoin(req: VercelRequest, res: VercelResponse): Promise<void> {
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

async function handleLeaderboard(req: VercelRequest, res: VercelResponse): Promise<void> {
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
    verifyJWT(jwt);

    const { id } = req.query;
    if (!id || typeof id !== 'string') {
      res.status(400).json({ error: 'Missing challenge ID' });
      return;
    }

    const { data: challenge, error: challengeError } = await supabase
      .from('challenges')
      .select('id, type, starts_at, ends_at')
      .eq('id', id)
      .single();

    if (challengeError || !challenge) {
      res.status(404).json({ error: 'Challenge not found' });
      return;
    }

    const { data: segments } = await supabase
      .from('challenge_segments')
      .select('id, segment_name, distance, elevation_gain, strava_segment_id')
      .eq('challenge_id', challenge.id)
      .limit(1);

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

    if (userIds.length === 0) {
      const response = {
        entries: [],
        totals: {
          total_attempts: 0,
          total_distance: 0,
          total_elevation: 0,
          active_participants: 0,
        },
      };
      if (segments && segments.length > 0) {
        (response as any).segment = {
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
          rank: 0,
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
          delta_from_leader: '',
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

    const response = {
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
      (response as any).segment = {
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

async function handlePublic(req: VercelRequest, res: VercelResponse): Promise<void> {
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
          total_distance: Math.round(stats.total_distance * 10) / 10,
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

async function handleBackfill(req: VercelRequest, res: VercelResponse): Promise<void> {
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
    verifyJWT(jwt);

    const { challengeId } = req.body;
    if (!challengeId || typeof challengeId !== 'string') {
      res.status(400).json({ error: 'Missing challengeId' });
      return;
    }

    const { data: challenge, error: challengeError } = await supabase
      .from('challenges')
      .select('id, starts_at, ends_at')
      .eq('id', challengeId)
      .single();

    if (challengeError || !challenge) {
      res.status(404).json({ error: 'Challenge not found' });
      return;
    }

    const { data: challengeSegments } = await supabase
      .from('challenge_segments')
      .select('id, strava_segment_id')
      .eq('challenge_id', challenge.id);

    if (!challengeSegments || challengeSegments.length === 0) {
      res.status(200).json({ success: true, message: 'No segments to backfill' });
      return;
    }

    const segmentIds = new Set(challengeSegments.map((s) => s.strava_segment_id));

    const { data: members } = await supabase
      .from('challenge_members')
      .select('user_id')
      .eq('challenge_id', challenge.id);

    const { data: owner } = await supabase
      .from('challenges')
      .select('owner_id')
      .eq('id', challenge.id)
      .single();

    const memberIds = [
      ...new Set([
        ...(members?.map((m) => m.user_id) || []),
        owner?.owner_id,
      ].filter(Boolean)),
    ];

    if (memberIds.length === 0) {
      res.status(200).json({ success: true, message: 'No members to backfill' });
      return;
    }

    memberIds.forEach((userId) => {
      backfillMemberActivities(
        userId as string,
        challenge.id,
        challenge.starts_at,
        segmentIds
      ).catch((err) => {
        console.error(`Backfill failed for user ${userId}:`, err);
      });
    });

    res.status(200).json({
      success: true,
      message: `Backfill started for ${memberIds.length} members`,
    });
  } catch (error) {
    console.error('Backfill error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleDelete(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'DELETE') {
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
      res.status(400).json({ error: 'Missing challengeId' });
      return;
    }

    const { data: challenge, error: challengeError } = await supabase
      .from('challenges')
      .select('id, owner_id')
      .eq('id', challengeId)
      .single();

    if (challengeError || !challenge) {
      res.status(404).json({ error: 'Challenge not found' });
      return;
    }

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', payload.userId)
      .single();

    const isOwner = challenge.owner_id === payload.userId;
    const isAdmin = user?.is_admin === true;

    if (!isOwner && !isAdmin) {
      res.status(403).json({ error: 'Only challenge owner or admin can delete' });
      return;
    }

    await supabase
      .from('challenge_members')
      .delete()
      .eq('challenge_id', challengeId);

    const { data: segments } = await supabase
      .from('challenge_segments')
      .select('id')
      .eq('challenge_id', challengeId);

    if (segments && segments.length > 0) {
      const segmentIds = segments.map((s) => s.id);
      await supabase
        .from('segment_efforts')
        .delete()
        .in('challenge_segment_id', segmentIds);
    }

    await supabase
      .from('challenge_segments')
      .delete()
      .eq('challenge_id', challengeId);

    const { error: deleteError } = await supabase
      .from('challenges')
      .delete()
      .eq('id', challengeId);

    if (deleteError) {
      console.error('Failed to delete challenge:', deleteError);
      res.status(500).json({ error: 'Failed to delete challenge' });
      return;
    }

    res.status(200).json({ success: true, message: 'Challenge deleted' });
  } catch (error) {
    console.error('Delete challenge error:', error);
    res.status(401).json({ error: 'Invalid JWT token' });
  }
}

async function handleManualBackfill(req: VercelRequest, res: VercelResponse): Promise<void> {
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

    const { data: challenge } = await supabase
      .from('challenges')
      .select('owner_id')
      .eq('id', challengeId)
      .single();

    if (!challenge || challenge.owner_id !== payload.userId) {
      res.status(403).json({ error: 'Only challenge owner can trigger backfill' });
      return;
    }

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

async function triggerBackfill(challengeId: string, jwt: string): Promise<void> {
  try {
    await fetch(
      `${process.env.API_URL || 'https://strava-challenges-extension.vercel.app'}/api/challenges/backfill`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ challengeId }),
      }
    );
  } catch (error) {
    console.error('Failed to trigger backfill:', error);
  }
}

async function backfillMemberActivities(
  userId: string,
  challengeId: string,
  challengeStartsAt: string,
  segmentIds: Set<number>
): Promise<void> {
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (userError || !user) {
    console.error(`User ${userId} not found`);
    return;
  }

  const userData = user as User;
  const startsAtUnix = Math.floor(new Date(challengeStartsAt).getTime() / 1000);
  const nowUnix = Math.floor(new Date().getTime() / 1000);

  let accessToken = userData.access_token;

  if (userData.token_expires_at) {
    const expiresAt = new Date(userData.token_expires_at).getTime();
    if (expiresAt <= Date.now()) {
      try {
        const decrypted = decryptToken(userData.refresh_token);
        const newTokens = await refreshStravaToken(decrypted);

        accessToken = encryptToken(newTokens.access_token);
        const encryptedRefreshToken = encryptToken(newTokens.refresh_token);

        await supabase
          .from('users')
          .update({
            access_token: accessToken,
            refresh_token: encryptedRefreshToken,
            token_expires_at: new Date(
              newTokens.expires_at * 1000
            ).toISOString(),
          })
          .eq('id', userId);
      } catch (error) {
        console.error(`Failed to refresh token for user ${userId}:`, error);
        return;
      }
    }
  }

  try {
    const response = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?after=${startsAtUnix}&before=${nowUnix}&per_page=100`,
      {
        headers: {
          Authorization: `Bearer ${decryptToken(accessToken)}`,
        },
      }
    );

    if (!response.ok) {
      console.error(
        `Failed to fetch activities for user ${userId}:`,
        response.statusText
      );
      return;
    }

    const activities = (await response.json()) as any[];

    const effortsToInsert: SegmentEffort[] = [];
    const now = new Date();

    for (const activity of activities) {
      try {
        const activityDetails = await getStravaActivity(
          activity.id,
          decryptToken(accessToken)
        );

        for (const effort of activityDetails.segment_efforts) {
          if (segmentIds.has(effort.segment.id)) {
            const { data: existing } = await supabase
              .from('segment_efforts')
              .select('id')
              .eq('strava_effort_id', effort.id)
              .single();

            if (!existing) {
              const { data: challengeSegment } = await supabase
                .from('challenge_segments')
                .select('id')
                .eq('challenge_id', challengeId)
                .eq('strava_segment_id', effort.segment.id)
                .single();

              if (challengeSegment) {
                effortsToInsert.push({
                  id: crypto.randomUUID ? crypto.randomUUID() : '',
                  challenge_id: challengeId,
                  challenge_segment_id: challengeSegment.id,
                  user_id: userId,
                  strava_activity_id: activity.id,
                  strava_effort_id: effort.id,
                  elapsed_time: effort.elapsed_time,
                  moving_time: effort.moving_time,
                  start_date: effort.start_date,
                  distance: effort.distance,
                  elevation_gain: effort.elevation_gain,
                  average_watts: effort.average_watts,
                  average_cadence: effort.average_cadence,
                  created_at: now.toISOString(),
                });
              }
            }
          }
        }
      } catch (error) {
        console.error(`Failed to fetch activity ${activity.id}:`, error);
        continue;
      }
    }

    if (effortsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('segment_efforts')
        .insert(effortsToInsert);

      if (insertError) {
        console.error('Failed to insert backfilled efforts:', insertError);
      } else {
        console.log(
          `Backfilled ${effortsToInsert.length} efforts for user ${userId}`
        );
      }
    }
  } catch (error) {
    console.error(`Backfill failed for user ${userId}:`, error);
  }
}
