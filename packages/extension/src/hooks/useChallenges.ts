import { useEffect, useState } from 'react';
import { Challenge } from '@/types/index.js';
import { fetchAPI } from '@/utils/api.js';

interface UseChallengesState {
  challenges: Challenge[];
  loading: boolean;
  error: string | null;
}

export function useChallenges(jwt: string | null) {
  const [state, setState] = useState<UseChallengesState>({
    challenges: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!jwt) {
      setState({ challenges: [], loading: false, error: null });
      return;
    }

    fetchChallenges();
  }, [jwt]);

  async function fetchChallenges() {
    if (!jwt) return;

    try {
      setState({ challenges: [], loading: true, error: null });
      // TODO: Implement /api/challenges endpoint in Phase 2b
      // For now, return empty list
      setState({ challenges: [], loading: false, error: null });
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch challenges',
      }));
    }
  }

  return { ...state, refetch: fetchChallenges };
}
