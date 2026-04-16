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
  // Stub - will add full implementation
  res.status(501).json({ error: 'Consolidating challenge routes...' });
}

async function handleListPublic(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.status(501).json({ error: 'Consolidating challenge routes...' });
}

async function handleList(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.status(501).json({ error: 'Consolidating challenge routes...' });
}

async function handleJoin(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.status(501).json({ error: 'Consolidating challenge routes...' });
}

async function handleLeaderboard(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.status(501).json({ error: 'Consolidating challenge routes...' });
}

async function handlePublic(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.status(501).json({ error: 'Consolidating challenge routes...' });
}

async function handleBackfill(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.status(501).json({ error: 'Consolidating challenge routes...' });
}

async function handleDelete(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.status(501).json({ error: 'Consolidating challenge routes...' });
}

async function handleManualBackfill(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.status(501).json({ error: 'Consolidating challenge routes...' });
}
