import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Extract path from multiple possible sources
  const url = req.url || '/';
  const path = url.split('?')[0];

  // Try to get route from req.query if path is just "/"
  // With rewrites, Vercel passes captured group in query['0']
  const routePath =
    path === '/' && req.query['0']
      ? '/' + (req.query['0'] as string)
      : path;

  console.log('Router - routePath:', routePath, 'url:', url, 'query:', req.query);

  // Auth routes
  if (routePath.includes('auth/strava')) {
    return (await import('./auth/strava.js')).default(req, res);
  }
  if (routePath.includes('auth/callback')) {
    return (await import('./auth/callback.js')).default(req, res);
  }
  if (routePath.includes('auth/refresh')) {
    return (await import('./auth/refresh.js')).default(req, res);
  }

  // User routes
  if (routePath.includes('user/me')) {
    return (await import('./user/me.js')).default(req, res);
  }

  // Challenge routes - order matters! Check longer paths first
  if (routePath.includes('challenges/list-public')) {
    return (await import('./challenges/list-public.js')).default(req, res);
  }
  if (routePath.includes('challenges/manual-backfill')) {
    return (await import('./challenges/manual-backfill.js')).default(req, res);
  }
  if (routePath.includes('challenges/leaderboard')) {
    return (await import('./challenges/leaderboard.js')).default(req, res);
  }
  if (routePath.includes('challenges/create')) {
    return (await import('./challenges/create.js')).default(req, res);
  }
  if (routePath.includes('challenges/list')) {
    return (await import('./challenges/list.js')).default(req, res);
  }
  if (routePath.includes('challenges/join')) {
    return (await import('./challenges/join.js')).default(req, res);
  }
  if (routePath.includes('challenges/public')) {
    return (await import('./challenges/public.js')).default(req, res);
  }
  if (routePath.includes('challenges/backfill')) {
    return (await import('./challenges/backfill.js')).default(req, res);
  }
  if (routePath.includes('challenges/delete')) {
    return (await import('./challenges/delete.js')).default(req, res);
  }

  // Webhook routes
  if (routePath.includes('webhook/strava')) {
    return (await import('./webhook/strava.js')).default(req, res);
  }

  // 404
  console.log('404 - no route matched for:', routePath);
  res.status(404).json({ error: 'Not found' });
}
