import { VercelRequest, VercelResponse } from '@vercel/node';

const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID || '';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  const redirectUri = `https://strava-challenges-extension.vercel.app/api/auth/callback`;
  const redirectUrl = (req.query.redirect_url as string) || '';

  const state = redirectUrl ? JSON.stringify({ redirect_url: redirectUrl }) : '';

  const params = new URLSearchParams({
    client_id: STRAVA_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'activity:read_all',
    ...(state && { state }),
  });

  const stravaAuthUrl = `https://www.strava.com/oauth/authorize?${params.toString()}`;
  res.redirect(stravaAuthUrl);
}
