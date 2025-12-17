import { supabase } from '../lib/supabase';

export async function earnBadge(userId: string, badgeName: string, metadata: any = {}) {
  if (!userId) return { ok: false, error: 'no userId' };

  const { data, error } = await supabase.rpc('earn_badge', {
    p_user_id: userId,
    p_badge_name: badgeName,
    p_metadata: metadata,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: !!data, error: null }; // data=trueなら新規付与
}