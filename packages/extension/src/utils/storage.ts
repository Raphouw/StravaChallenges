import { User } from '@/types/index.js';

const AUTH_TOKEN_KEY = 'strava_challenge_jwt';
const USER_KEY = 'strava_challenge_user';

export async function getAuthToken(): Promise<string | null> {
  const result = await chrome.storage.local.get(AUTH_TOKEN_KEY);
  return result[AUTH_TOKEN_KEY] || null;
}

export async function setAuthToken(token: string): Promise<void> {
  await chrome.storage.local.set({ [AUTH_TOKEN_KEY]: token });
}

export async function clearAuthToken(): Promise<void> {
  await chrome.storage.local.remove(AUTH_TOKEN_KEY);
}

export async function getUser(): Promise<User | null> {
  const result = await chrome.storage.local.get(USER_KEY);
  const user = result[USER_KEY];
  return user ? (JSON.parse(user) as User) : null;
}

export async function setUser(user: User): Promise<void> {
  await chrome.storage.local.set({ [USER_KEY]: JSON.stringify(user) });
}

export async function clearUser(): Promise<void> {
  await chrome.storage.local.remove(USER_KEY);
}

export async function clearAuth(): Promise<void> {
  await chrome.storage.local.remove([AUTH_TOKEN_KEY, USER_KEY]);
}
