-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strava_id BIGINT UNIQUE NOT NULL,
  name VARCHAR NOT NULL,
  profile_pic_url VARCHAR,
  access_token TEXT,        -- chiffré AES-256
  refresh_token TEXT,       -- chiffré AES-256
  token_expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Create challenges table
CREATE TABLE IF NOT EXISTS challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR UNIQUE NOT NULL,
  name VARCHAR NOT NULL,
  type VARCHAR NOT NULL,          -- 'count' | 'time' | 'elevation' | 'distance'
  owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
  starts_at TIMESTAMP NOT NULL,
  ends_at TIMESTAMP NOT NULL,
  invite_code VARCHAR UNIQUE,
  is_public BOOLEAN DEFAULT true,
  config JSONB,                   -- type-specific config
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Create challenge_segments table
CREATE TABLE IF NOT EXISTS challenge_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE,
  strava_segment_id BIGINT NOT NULL,
  segment_name VARCHAR,
  distance FLOAT,
  elevation_gain FLOAT,
  created_at TIMESTAMP DEFAULT now()
);

-- Create challenge_members table
CREATE TABLE IF NOT EXISTS challenge_members (
  challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP DEFAULT now(),
  PRIMARY KEY (challenge_id, user_id)
);

-- Create segment_efforts table (activity tracking)
CREATE TABLE IF NOT EXISTS segment_efforts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE,
  challenge_segment_id UUID REFERENCES challenge_segments(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  strava_activity_id BIGINT NOT NULL,
  strava_effort_id BIGINT UNIQUE NOT NULL,
  elapsed_time INT NOT NULL,          -- secondes
  moving_time INT,
  start_date TIMESTAMP NOT NULL,
  distance FLOAT,
  elevation_gain FLOAT,
  average_watts FLOAT,
  average_cadence FLOAT,
  created_at TIMESTAMP DEFAULT now()
);

-- Create leaderboard view
CREATE OR REPLACE VIEW leaderboard AS
SELECT
  se.challenge_id,
  se.challenge_segment_id,
  se.user_id,
  u.name,
  u.profile_pic_url,
  COUNT(*) as attempt_count,
  MIN(se.elapsed_time) as best_time,
  MAX(se.elapsed_time) as worst_time,
  AVG(se.elapsed_time)::INT as avg_time,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY se.elapsed_time)::INT as median_time,
  SUM(se.distance)::FLOAT as total_distance,
  SUM(se.elevation_gain)::FLOAT as total_elevation,
  MAX(se.start_date) as last_attempt
FROM segment_efforts se
JOIN users u ON u.id = se.user_id
GROUP BY se.challenge_id, se.challenge_segment_id, se.user_id, u.name, u.profile_pic_url;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_strava_id ON users(strava_id);
CREATE INDEX IF NOT EXISTS idx_challenges_slug ON challenges(slug);
CREATE INDEX IF NOT EXISTS idx_challenges_owner_id ON challenges(owner_id);
CREATE INDEX IF NOT EXISTS idx_challenge_segments_challenge_id ON challenge_segments(challenge_id);
CREATE INDEX IF NOT EXISTS idx_challenge_segments_strava_id ON challenge_segments(strava_segment_id);
CREATE INDEX IF NOT EXISTS idx_challenge_members_user_id ON challenge_members(user_id);
CREATE INDEX IF NOT EXISTS idx_segment_efforts_challenge_id ON segment_efforts(challenge_id);
CREATE INDEX IF NOT EXISTS idx_segment_efforts_user_id ON segment_efforts(user_id);
CREATE INDEX IF NOT EXISTS idx_segment_efforts_strava_effort_id ON segment_efforts(strava_effort_id);

-- Enable Realtime on tables for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE challenges;
ALTER PUBLICATION supabase_realtime ADD TABLE segment_efforts;
ALTER PUBLICATION supabase_realtime ADD TABLE challenge_members;
