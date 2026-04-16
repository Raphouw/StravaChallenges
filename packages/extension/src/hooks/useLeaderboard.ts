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
}

export function useLeaderboard(challengeId: string | null, jwt: string | null) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!challengeId || !jwt) {
      setEntries([]);
      return;
    }

    async function fetchLeaderboard() {
      setLoading(true);
      console.log('Fetching leaderboard for challenge:', challengeId);
      try {
        const url = `https://strava-challenges-extension.vercel.app/api/challenges/leaderboard?id=${challengeId}`;
        console.log('Leaderboard API URL:', url);

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

        const data = await response.json();
        console.log('Leaderboard data received:', data);
        setEntries(data as LeaderboardEntry[]);
      } catch (err) {
        console.error('Failed to fetch leaderboard:', err);
        setEntries([]);
      } finally {
        setLoading(false);
      }
    }

    fetchLeaderboard();
  }, [challengeId, jwt]);

  return { entries, loading };
}
