export interface User {
  id: string;
  strava_id: number;
  name: string;
  profile_pic_url?: string;
  is_admin?: boolean;
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

export interface AuthState {
  jwt: string | null;
  user: User | null;
  loading: boolean;
  error: string | null;
}
