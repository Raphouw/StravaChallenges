import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Supabase credentials are missing');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Type definitions for database tables
export interface User {
  id: string;
  strava_id: number;
  name: string;
  profile_pic_url?: string;
  access_token: string; // encrypted
  refresh_token: string; // encrypted
  token_expires_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Challenge {
  id: string;
  slug: string;
  name: string;
  type: 'count' | 'time' | 'elevation' | 'distance';
  owner_id: string;
  starts_at: string;
  ends_at: string;
  invite_code?: string;
  is_public: boolean;
  config?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ChallengeSegment {
  id: string;
  challenge_id: string;
  strava_segment_id: number;
  segment_name?: string;
  distance?: number;
  elevation_gain?: number;
  created_at: string;
}

export interface SegmentEffort {
  id: string;
  challenge_id: string;
  challenge_segment_id: string;
  user_id: string;
  strava_activity_id: number;
  strava_effort_id: number;
  elapsed_time: number;
  moving_time?: number;
  start_date: string;
  distance?: number;
  elevation_gain?: number;
  average_watts?: number;
  average_cadence?: number;
  created_at: string;
}
