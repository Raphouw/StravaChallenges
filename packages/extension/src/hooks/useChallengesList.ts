import { useEffect, useState } from 'react';
import { Challenge } from '@/types/index.js';

interface ChallengeWithMemberCount extends Challenge {
  member_count: number;
  is_owner: boolean;
}

export function useChallengesList(jwt: string | null, refetchKey: number = 0) {
  const [challenges, setChallenges] = useState<ChallengeWithMemberCount[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jwt) {
      setChallenges([]);
      return;
    }

    async function fetchChallenges() {
      setLoading(true);
      try {
        const response = await fetch('https://strava-challenges-extension.vercel.app/api/challenges/list', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${jwt}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch challenges: ${response.statusText}`);
        }

        const data = await response.json();
        setChallenges(data as ChallengeWithMemberCount[]);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch challenges list:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchChallenges();
  }, [jwt, refetchKey]);

  return { challenges, loading, error };
}
