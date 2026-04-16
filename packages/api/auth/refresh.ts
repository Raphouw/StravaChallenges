import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, User } from '../lib/supabase';
import { verifyJWT } from '../lib/jwt';
import { decryptToken, encryptToken } from '../lib/crypto';
import { refreshStravaToken } from '../lib/strava';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }

  const { jwt } = req.body;

  if (!jwt) {
    res.status(400).json({ error: 'Missing JWT token' });
    return;
  }

  try {
    // 1. Verify JWT token
    const payload = verifyJWT(jwt);

    // 2. Fetch user from database
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

    // 3. Check if token needs refresh
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

    // 4. Refresh token from Strava
    try {
      const decryptedRefreshToken = decryptToken(userData.refresh_token);
      const newTokens = await refreshStravaToken(decryptedRefreshToken);

      // 5. Update database with new tokens
      const encryptedAccessToken = encryptToken(newTokens.access_token);
      const encryptedRefreshToken = encryptToken(newTokens.refresh_token);
      const newExpiresAt = new Date(newTokens.expires_at * 1000).toISOString();

      const { error: updateError } = await supabase
        .from('users')
        .update({
          access_token: encryptedAccessToken,
          refresh_token: encryptedRefreshToken,
          token_expires_at: newExpiresAt,
        })
        .eq('id', userData.id);

      if (updateError) {
        console.error('Failed to update user tokens:', updateError);
        res.status(500).json({ error: 'Failed to update tokens' });
        return;
      }

      // 6. Return new access token
      res.status(200).json({
        access_token: newTokens.access_token,
        expires_in: newTokens.expires_at
          ? Math.floor((newTokens.expires_at * 1000 - Date.now()) / 1000)
          : 3600,
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
