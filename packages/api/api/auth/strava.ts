import { VercelRequest, VercelResponse } from '@vercel/node';

const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID || '';
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).end();
    return;
  }

  const redirectUri = `${APP_URL}/api/auth/callback`;

  const params = new URLSearchParams({
    client_id: STRAVA_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'activity:read_all',
  });

  const stravaAuthUrl = `https://www.strava.com/oauth/authorize?${params.toString()}`;

  res.redirect(stravaAuthUrl);
}
