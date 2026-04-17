import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, User } from '../_utils/supabase.js';
import { encryptToken } from '../_utils/crypto.js';
import { generateJWT } from '../_utils/jwt.js';

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
  const { code, error, error_description, state } = req.query;

  let redirectUrl = 'https://strava-challenges-extension.vercel.app/auth-success';

  if (state && typeof state === 'string') {
    try {
      const stateData = JSON.parse(state);
      if (stateData.redirect_url) {
        redirectUrl = stateData.redirect_url;
      }
    } catch (e) {
      console.error('Failed to parse state:', e);
    }
  }

  if (error) {
    const errorMessage = `${error}: ${error_description || 'Unknown error'}`;
    const errorRedirectUrl = redirectUrl.includes('dashboard')
      ? `${redirectUrl.split('?')[0]}/auth-error?message=${encodeURIComponent(errorMessage)}`
      : `https://strava-challenges-extension.vercel.app/auth-error?message=${encodeURIComponent(errorMessage)}`;
    res.redirect(errorRedirectUrl);
    return;
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
    const successUrl = `${redirectUrl}?token=${encodeURIComponent(jwtToken)}&userId=${encodeURIComponent(userId)}&name=${encodeURIComponent(userName)}&profileUrl=${encodeURIComponent(tokenData.athlete.profile_medium)}&stravaId=${encodeURIComponent(tokenData.athlete.id.toString())}`;

    res.redirect(successUrl);
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
