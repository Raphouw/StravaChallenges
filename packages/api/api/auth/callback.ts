import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, User } from '../_utils/supabase.js';
import { encryptToken } from '../_utils/crypto.js';
import { generateJWT } from '../_utils/jwt.js';

const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID || '';
const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET || '';
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

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
  if (req.method !== 'GET') {
    res.status(405).end();
    return;
  }

  const { code, error, error_description } = req.query;

  // Handle Strava OAuth errors
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
    // 1. Exchange authorization code for tokens
    const tokenResponse = await fetch(
      'https://www.strava.com/api/v3/oauth/token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: STRAVA_CLIENT_ID,
          client_secret: STRAVA_CLIENT_SECRET,
          code: code as string,
          grant_type: 'authorization_code',
        }),
      }
    );

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('Strava token exchange failed:', errorData);
      res.status(400).json({ error: 'Token exchange failed' });
      return;
    }

    const tokenData = (await tokenResponse.json()) as StravaTokenResponse;

    // 2. Encrypt tokens before storing
    const encryptedAccessToken = encryptToken(tokenData.access_token);
    const encryptedRefreshToken = encryptToken(tokenData.refresh_token);
    const tokenExpiresAt = new Date(tokenData.expires_at * 1000).toISOString();

    // 3. Check if user already exists
    const { data: existingUser, error: findError } = await supabase
      .from('users')
      .select('*')
      .eq('strava_id', tokenData.athlete.id)
      .single();

    let userId: string;

    if (existingUser) {
      // Update existing user
      const { error: updateError } = await supabase
        .from('users')
        .update({
          access_token: encryptedAccessToken,
          refresh_token: encryptedRefreshToken,
          token_expires_at: tokenExpiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingUser.id);

      if (updateError) {
        console.error('Failed to update user:', updateError);
        res.status(500).json({ error: 'Failed to update user' });
        return;
      }

      userId = existingUser.id;
    } else {
      // Create new user
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
        console.error('Failed to create user:', createError);
        res.status(500).json({ error: 'Failed to create user' });
        return;
      }

      userId = createdUser.id;
    }

    // 4. Generate JWT token for extension
    const jwtToken = generateJWT(userId, tokenData.athlete.id);

    // 5. Redirect back with JWT token and user data
    const userName = `${tokenData.athlete.firstname} ${tokenData.athlete.lastname}`;
    const userProfileUrl = tokenData.athlete.profile_medium;
    const stravaId = tokenData.athlete.id;

    console.log('JWT généré:', jwtToken);
    const redirectUrl = `https://strava-challenges-extension.vercel.app/auth-success?token=${encodeURIComponent(jwtToken)}&userId=${encodeURIComponent(userId)}&name=${encodeURIComponent(userName)}&profileUrl=${encodeURIComponent(userProfileUrl)}&stravaId=${encodeURIComponent(stravaId.toString())}`;
    console.log('Redirection vers:', redirectUrl);

    return res.redirect(redirectUrl);
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}
