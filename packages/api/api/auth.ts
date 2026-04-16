import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, User } from './_utils/supabase.js';
import { encryptToken, decryptToken } from './_utils/crypto.js';
import { generateJWT, verifyJWT } from './_utils/jwt.js';
import { refreshStravaToken } from './_utils/strava-client.js';

const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID || '';
const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET || '';

interface StravaTokenResponse {
  token_type: string;
  expires_at: number;
  expires_in: number;
  refresh_token: string;
  access_token: string;
  athlete: {
    id: number;
    firstname: string;
    lastname: string;
    profile_medium: string;
  };
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  const path = req.url?.split('?')[0];

  // /api/auth/strava - Login flow
  if (path?.endsWith('/strava') && req.method === 'GET') {
    return handleStrava(req, res);
  }

  // /api/auth/callback - OAuth callback
  if (path?.endsWith('/callback') && req.method === 'GET') {
    return handleCallback(req, res);
  }

  // /api/auth/refresh - Token refresh
  if (path?.endsWith('/refresh') && req.method === 'POST') {
    return handleRefresh(req, res);
  }

  res.status(405).end();
}

async function handleStrava(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  const redirectUri = `https://strava-challenges-extension.vercel.app/api/auth/callback`;

  const params = new URLSearchParams({
    client_id: STRAVA_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'activity:read_all',
  });

  const stravaAuthUrl = `https://www.strava.com/oauth/authorize?${params.toString()}`;
  return res.redirect(stravaAuthUrl);
}

async function handleCallback(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  const { code, error, error_description } = req.query;

  if (error) {
    const errorMessage = `${error}: ${error_description || 'Unknown error'}`;
    return res.redirect(
      `https://strava-challenges-extension.vercel.app/auth-error?message=${encodeURIComponent(errorMessage)}`
    );
  }

  if (!code) {
    res.status(400).json({ error: 'Missing authorization code' });
    return;
  }

  try {
    const tokenResponse = await fetch(
      'https://www.strava.com/api/v3/oauth/token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: STRAVA_CLIENT_ID,
          client_secret: STRAVA_CLIENT_SECRET,
          code: code as string,
          grant_type: 'authorization_code',
        }),
      }
    );

    if (!tokenResponse.ok) {
      console.error('Strava token exchange failed');
      res.status(400).json({ error: 'Token exchange failed' });
      return;
    }

    const tokenData = (await tokenResponse.json()) as StravaTokenResponse;

    const encryptedAccessToken = encryptToken(tokenData.access_token);
    const encryptedRefreshToken = encryptToken(tokenData.refresh_token);
    const tokenExpiresAt = new Date(tokenData.expires_at * 1000).toISOString();

    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('strava_id', tokenData.athlete.id)
      .single();

    let userId: string;

    if (existingUser) {
      await supabase
        .from('users')
        .update({
          access_token: encryptedAccessToken,
          refresh_token: encryptedRefreshToken,
          token_expires_at: tokenExpiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingUser.id);

      userId = existingUser.id;
    } else {
      const newUser: Omit<User, 'id' | 'created_at' | 'updated_at'> = {
        strava_id: tokenData.athlete.id,
        name: `${tokenData.athlete.firstname} ${tokenData.athlete.lastname}`,
        profile_pic_url: tokenData.athlete.profile_medium,
        access_token: encryptedAccessToken,
        refresh_token: encryptedRefreshToken,
        token_expires_at: tokenExpiresAt,
      };

      const { data: createdUser, error: createError } = await supabase
        .from('users')
        .insert([newUser])
        .select('id')
        .single();

      if (createError || !createdUser) {
        res.status(500).json({ error: 'Failed to create user' });
        return;
      }

      userId = createdUser.id;
    }

    const jwtToken = generateJWT(userId, tokenData.athlete.id);
    const userName = `${tokenData.athlete.firstname} ${tokenData.athlete.lastname}`;
    const redirectUrl = `https://strava-challenges-extension.vercel.app/auth-success?token=${encodeURIComponent(jwtToken)}&userId=${encodeURIComponent(userId)}&name=${encodeURIComponent(userName)}&profileUrl=${encodeURIComponent(tokenData.athlete.profile_medium)}&stravaId=${encodeURIComponent(tokenData.athlete.id.toString())}`;

    return res.redirect(redirectUrl);
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleRefresh(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  const { jwt } = req.body;

  if (!jwt) {
    res.status(400).json({ error: 'Missing JWT token' });
    return;
  }

  try {
    const payload = verifyJWT(jwt);

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', payload.userId)
      .single();

    if (userError || !user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    const userData = user as User;

    if (!userData.token_expires_at) {
      res.status(500).json({ error: 'Missing token expiration info' });
      return;
    }

    const expiresAt = new Date(userData.token_expires_at).getTime();

    // If token expires in more than 1 hour, return current access token
    if (expiresAt > Date.now() + 3600000) {
      const decryptedAccessToken = decryptToken(userData.access_token);
      res.status(200).json({
        access_token: decryptedAccessToken,
        expires_in: Math.floor((expiresAt - Date.now()) / 1000),
      });
      return;
    }

    try {
      const decryptedRefreshToken = decryptToken(userData.refresh_token);
      const newTokens = await refreshStravaToken(decryptedRefreshToken);

      const encryptedAccessToken = encryptToken(newTokens.access_token);
      const encryptedRefreshToken = encryptToken(newTokens.refresh_token);
      const newExpiresAt = new Date(newTokens.expires_at * 1000).toISOString();

      await supabase
        .from('users')
        .update({
          access_token: encryptedAccessToken,
          refresh_token: encryptedRefreshToken,
          token_expires_at: newExpiresAt,
        })
        .eq('id', userData.id);

      res.status(200).json({
        access_token: newTokens.access_token,
        expires_in: Math.floor((newTokens.expires_at * 1000 - Date.now()) / 1000),
      });
    } catch (refreshError) {
      console.error('Failed to refresh Strava token:', refreshError);
      res.status(401).json({ error: 'Failed to refresh Strava token' });
    }
  } catch (error) {
    console.error('JWT verification failed:', error);
    res.status(401).json({ error: 'Invalid JWT token' });
  }
}
