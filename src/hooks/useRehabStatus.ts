// hooks/useRehabStatus.ts
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export function useRehabStatus(userId: string) {
  const [isRehabilitating, setIsRehabilitating] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkInjuryStatus() {
      try {
        const { data, error } = await supabase
          .schema('rehab')
          .from('injuries')
          .select('id')
          .eq('user_id', userId)
          .eq('status', 'active') // アクティブな怪我があるか
          .maybeSingle();

        setIsRehabilitating(!!data);
      } catch (e) {
        console.error("ステータス確認失敗:", e);
      } finally {
        setLoading(false);
      }
    }
    checkInjuryStatus();
  }, [userId]);

  return { isRehabilitating, loading };
}