import { useEffect, useState } from 'react';
import { User } from '@/types/index.js';

export function useUserProfile(jwt: string | null) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jwt) {
      setUser(null);
      return;
    }

    async function fetchUser() {
      setLoading(true);
      try {
        const response = await fetch('https://strava-challenges-extension.vercel.app/api/user/me', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${jwt}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch user: ${response.statusText}`);
        }

        const data = await response.json();
        setUser(data as User);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch user profile:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchUser();
  }, [jwt]);

  return { user, loading, error };
}
