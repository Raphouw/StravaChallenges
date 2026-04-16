import { useEffect, useState } from 'react';
import { User, AuthState } from '@/types/index.js';
import * as storage from '@/utils/storage.js';

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    jwt: null,
    user: null,
    loading: true,
    error: null,
  });

  // Load auth from storage on mount and listen for changes
  useEffect(() => {
    loadAuth();

    // Listen for storage changes from background service worker
    const listener = (changes: Record<string, chrome.storage.StorageChange>) => {
      if (changes.strava_challenge_jwt?.newValue) {
        setAuthState((prev) => ({
          ...prev,
          jwt: changes.strava_challenge_jwt.newValue,
        }));
      }
      if (changes.strava_challenge_user?.newValue) {
        try {
          const user = JSON.parse(changes.strava_challenge_user.newValue) as User;
          setAuthState((prev) => ({
            ...prev,
            user,
          }));
        } catch (e) {
          console.error('Failed to parse user from storage', e);
        }
      }
    };

    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  async function loadAuth() {
    try {
      const jwt = await storage.getAuthToken();
      const user = await storage.getUser();
      setAuthState({
        jwt,
        user: user as User | null,
        loading: false,
        error: null,
      });
    } catch (error) {
      setAuthState((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }

  async function setAuth(jwt: string, user: User) {
    try {
      await Promise.all([storage.setAuthToken(jwt), storage.setUser(user)]);
      setAuthState({
        jwt,
        user,
        loading: false,
        error: null,
      });
    } catch (error) {
      setAuthState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to save auth',
      }));
    }
  }

  async function logout() {
    try {
      await storage.clearAuth();
      setAuthState({
        jwt: null,
        user: null,
        loading: false,
        error: null,
      });
    } catch (error) {
      setAuthState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Logout failed',
      }));
    }
  }

  return {
    ...authState,
    setAuth,
    logout,
    reload: loadAuth,
  };
}
