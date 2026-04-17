-- Fix double-division bug: multiply distance by 1000 for entries that were incorrectly divided
-- This converts km back to meters for all entries where distance is too small (< 1000)
UPDATE challenge_segments
SET distance = distance * 1000
WHERE distance < 1000 AND distance > 0;
