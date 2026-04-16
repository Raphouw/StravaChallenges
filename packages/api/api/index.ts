import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { pathname } = new URL(req.url!, `https://${req.headers.host}`);

  // Auth routes
  if (pathname === '/api/auth/strava') {
    return (await import('./auth/strava.js')).default(req, res);
  }
  if (pathname === '/api/auth/callback') {
    return (await import('./auth/callback.js')).default(req, res);
  }
  if (pathname === '/api/auth/refresh') {
    return (await import('./auth/refresh.js')).default(req, res);
  }

  // User routes
  if (pathname === '/api/user/me') {
    return (await import('./user/me.js')).default(req, res);
  }

  // Challenge routes
  if (pathname === '/api/challenges/create') {
    return (await import('./challenges/create.js')).default(req, res);
  }
  if (pathname === '/api/challenges/list') {
    return (await import('./challenges/list.js')).default(req, res);
  }
  if (pathname === '/api/challenges/list-public') {
    return (await import('./challenges/list-public.js')).default(req, res);
  }
  if (pathname === '/api/challenges/join') {
    return (await import('./challenges/join.js')).default(req, res);
  }
  if (pathname === '/api/challenges/leaderboard') {
    return (await import('./challenges/leaderboard.js')).default(req, res);
  }
  if (pathname === '/api/challenges/public') {
    return (await import('./challenges/public.js')).default(req, res);
  }
  if (pathname === '/api/challenges/backfill') {
    return (await import('./challenges/backfill.js')).default(req, res);
  }
  if (pathname === '/api/challenges/delete') {
    return (await import('./challenges/delete.js')).default(req, res);
  }
  if (pathname === '/api/challenges/manual-backfill') {
    return (await import('./challenges/manual-backfill.js')).default(req, res);
  }

  // Webhook routes
  if (pathname === '/api/webhook/strava') {
    return (await import('./webhook/strava.js')).default(req, res);
  }

  // 404
  res.status(404).json({ error: 'Not found' });
}
