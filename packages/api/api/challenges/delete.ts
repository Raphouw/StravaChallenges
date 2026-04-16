import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../_utils/supabase.js';
import { verifyJWT } from '../_utils/jwt.js';

const ADMIN_TOKEN = '465786453sd4fsdfsdfsdf456';

export default async function handleDelete(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'DELETE') {
    res.status(405).end();
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const token = authHeader.slice(7);
  const isAdminToken = token === ADMIN_TOKEN;

  const { challengeId } = req.body;

  if (!challengeId || typeof challengeId !== 'string') {
    res.status(400).json({ error: 'Missing challengeId' });
    return;
  }

  try {
    const { data: challenge, error: challengeError } = await supabase
      .from('challenges')
      .select('id, owner_id')
      .eq('id', challengeId)
      .single();

    if (challengeError || !challenge) {
      res.status(404).json({ error: 'Challenge not found' });
      return;
    }

    if (isAdminToken) {
      // Admin token bypass - skip JWT verification
    } else {
      // JWT verification for regular users
      const payload = verifyJWT(token);
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', payload.userId)
        .single();

      const isOwner = challenge.owner_id === payload.userId;
      const isAdmin = user?.is_admin === true;

      if (!isOwner && !isAdmin) {
        res.status(403).json({ error: 'Only challenge owner or admin can delete' });
        return;
      }
    }

    await supabase
      .from('challenge_members')
      .delete()
      .eq('challenge_id', challengeId);

    const { data: segments } = await supabase
      .from('challenge_segments')
      .select('id')
      .eq('challenge_id', challengeId);

    if (segments && segments.length > 0) {
      const segmentIds = segments.map((s) => s.id);
      await supabase
        .from('segment_efforts')
        .delete()
        .in('challenge_segment_id', segmentIds);
    }

    await supabase
      .from('challenge_segments')
      .delete()
      .eq('challenge_id', challengeId);

    const { error: deleteError } = await supabase
      .from('challenges')
      .delete()
      .eq('id', challengeId);

    if (deleteError) {
      console.error('Failed to delete challenge:', deleteError);
      res.status(500).json({ error: 'Failed to delete challenge' });
      return;
    }

    res.status(200).json({ success: true, message: 'Challenge deleted' });
  } catch (error) {
    console.error('Delete challenge error:', error);
    res.status(401).json({ error: 'Invalid JWT token' });
  }
}
