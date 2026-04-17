import { VercelRequest, VercelResponse } from '@vercel/node';

const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID || '';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  const redirectUri = `https://strava-challenges-dashboard.vercel.app/api/auth/callback`;

  const params = new URLSearchParams({
    client_id: STRAVA_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'activity:read_all',
  });

  const stravaAuthUrl = `https://www.strava.com/oauth/authorize?${params.toString()}`;
  res.redirect(stravaAuthUrl);
}
