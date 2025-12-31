import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

export type Reflection = {
  id: string;
  user_id: string;
  reflection_date: string; // YYYY-MM-DD
  did: string | null;
  didnt: string | null;
  cause_tags: string[];
  next_action: string | null;
  free_note: string | null;
  metadata: any;
  created_at: string;
  updated_at: string;
};

type UpsertParams = {
  reflection_date: string;
  did?: string | null;
  didnt?: string | null;
  cause_tags?: string[];
  next_action?: string | null;
  free_note?: string | null;
  metadata?: any;
  award?: boolean;
  award_points?: number;
};

// ローカル日付で YYYY-MM-DD
function toYmd(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function useReflections(userId: string) {
  const today = useMemo(() => toYmd(new Date()), []);
  const [weekReflections, setWeekReflections] = useState<Reflection[]>([]);
  const [loading, setLoading] = useState(true);

  /**
   * 直近7日分をまとめて取得（唯一の fetch）
   */
  const fetchWeek = useCallback(async () => {
    if (!userId) return;

    const start = new Date();
    start.setDate(start.getDate() - 6);
    const startYmd = toYmd(start);

    const { data, error } = await supabase
      .from('reflections')
      .select('*')
      .gte('reflection_date', startYmd)
      .lte('reflection_date', today)
      .order('reflection_date', { ascending: true });

    if (error) throw error;
    setWeekReflections(data ?? []);
  }, [userId, today]);

  /**
   * 初期ロード：fetch は1回だけ
   */
  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    let alive = true;

    (async () => {
      try {
        setLoading(true);
        await fetchWeek();
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [userId, fetchWeek]);

  /**
   * 今日の振り返りは week から派生
   */
  const todayReflection = useMemo(() => {
    return (
      weekReflections.find(
        (r) => r.reflection_date === today
      ) ?? null
    );
  }, [weekReflections, today]);

  /**
   * upsert → 週データ再取得
   */
  const upsertReflection = useCallback(
    async (params: UpsertParams) => {
      const { data, error } = await supabase.rpc('upsert_reflection', {
        p_reflection_date: params.reflection_date,
        p_did: params.did ?? null,
        p_didnt: params.didnt ?? null,
        p_cause_tags: params.cause_tags ?? [],
        p_next_action: params.next_action ?? null,
        p_free_note: params.free_note ?? null,
        p_metadata: params.metadata ?? {},
        p_award: params.award ?? true,
        p_award_points: params.award_points ?? 5,
      });

      if (error) throw error;

      // 保存後は週データだけ再取得
      await fetchWeek();

      return data as string; // reflection id
    },
    [fetchWeek]
  );

  return {
    today,
    todayReflection,
    weekReflections,
    loading,
    upsertReflection,
  };
}