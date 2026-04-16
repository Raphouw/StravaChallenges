-- Insert test user
INSERT INTO users (
  id,
  strava_id,
  name,
  profile_pic_url,
  access_token,
  refresh_token,
  token_expires_at,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  999999,
  'Test User',
  'https://dgalywyr863hv.cloudfront.net/pictures/athletes/999/999/999/999999/999999/12/avatar.jpg',
  'encrypted_test_access_token',
  'encrypted_test_refresh_token',
  '2025-12-31T23:59:59Z',
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET updated_at = NOW();

-- Insert test challenge
INSERT INTO challenges (
  id,
  slug,
  name,
  type,
  owner_id,
  starts_at,
  ends_at,
  invite_code,
  is_public,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000002',
  'test-challenge-001',
  'Test Challenge',
  'count',
  '00000000-0000-0000-0000-000000000001',
  NOW(),
  DATE_ADD(NOW(), INTERVAL 7 DAY),
  'TEST01',
  true,
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET updated_at = NOW();

-- Add test user as member of test challenge
INSERT INTO challenge_members (
  challenge_id,
  user_id,
  joined_at
) VALUES (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  NOW()
) ON CONFLICT (challenge_id, user_id) DO NOTHING;

-- Insert a test segment
INSERT INTO challenge_segments (
  id,
  challenge_id,
  strava_segment_id,
  segment_name,
  distance,
  elevation_gain,
  created_at
) VALUES (
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000002',
  228957,
  'Alpe d\'Huez',
  13630,
  1570,
  NOW()
) ON CONFLICT (id) DO NOTHING;

SELECT 'Test data inserted successfully!' as result;
