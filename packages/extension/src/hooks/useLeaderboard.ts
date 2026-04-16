import { useEffect, useState } from 'react';

export interface LeaderboardEntry {
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

export interface LeaderboardResponse {
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

export function useLeaderboard(challengeId: string | null, jwt: string | null) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [totals, setTotals] = useState<LeaderboardResponse['totals'] | null>(
    null
  );
  const [segment, setSegment] = useState<LeaderboardResponse['segment']>(
    undefined
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!challengeId || !jwt) {
      setEntries([]);
      setTotals(null);
      setSegment(undefined);
      return;
    }

    async function fetchLeaderboard() {
      setLoading(true);
      try {
        const url = `https://strava-challenges-extension.vercel.app/api/challenges/leaderboard?id=${challengeId}`;

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${jwt}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch leaderboard: ${response.statusText}`);
        }

        const data: LeaderboardResponse = await response.json();
        setEntries(data.entries);
        setTotals(data.totals);
        setSegment(data.segment);
      } catch (err) {
        console.error('Failed to fetch leaderboard:', err);
        setEntries([]);
        setTotals(null);
        setSegment(undefined);
      } finally {
        setLoading(false);
      }
    }

    fetchLeaderboard();
  }, [challengeId, jwt]);

  return { entries, totals, segment, loading };
}
