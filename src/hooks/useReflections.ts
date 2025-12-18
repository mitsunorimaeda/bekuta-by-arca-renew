// src/hooks/useReflections.ts
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export type Reflection = {
  id: string;
  user_id: string;
  reflection_date: string; // YYYY-MM-DD
  did: string | null;
  didnt: string | null;
  cause_tags: string[]; // text[]
  next_action: string | null;
  free_note: string | null;
  metadata: any;
  created_at: string;
  updated_at: string;
};

type UpsertParams = {
  reflection_date: string; // YYYY-MM-DD
  did?: string | null;
  didnt?: string | null;
  cause_tags?: string[];
  next_action?: string | null;
  free_note?: string | null;
  metadata?: any;
  award?: boolean;
  award_points?: number;
};

function toYmd(d: Date) {
  // ローカル日付で YYYY-MM-DD
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function useReflections(userId: string) {
  const [today, setToday] = useState(() => toYmd(new Date()));
  const [todayReflection, setTodayReflection] = useState<Reflection | null>(null);
  const [weekReflections, setWeekReflections] = useState<Reflection[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshToday = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from('reflections')
      .select('*')
      .eq('user_id', userId)
      .eq('reflection_date', today)
      .maybeSingle();

    if (error) throw error;
    setTodayReflection(data ?? null);
  }, [userId, today]);

  const refreshWeek = useCallback(async () => {
    if (!userId) return;

    // 直近7日（今日含む）
    const start = new Date();
    start.setDate(start.getDate() - 6);
    const startYmd = toYmd(start);

    const { data, error } = await supabase
      .from('reflections')
      .select('*')
      .eq('user_id', userId)
      .gte('reflection_date', startYmd)
      .lte('reflection_date', today)
      .order('reflection_date', { ascending: true });

    if (error) throw error;
    setWeekReflections(data ?? []);
  }, [userId, today]);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        setLoading(true);
        await refreshToday();
        await refreshWeek();
      } finally {
        setLoading(false);
      }
    })();
  }, [userId, refreshToday, refreshWeek]);

  const upsertReflection = useCallback(async (params: UpsertParams) => {
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

    // RPCはuuid返すので、画面は再取得で揃える（Realtimeに依存しない）
    await refreshToday();
    await refreshWeek();

    return data as string; // reflection id
  }, [refreshToday, refreshWeek]);

  return {
    today,
    setToday, // 必要ならUI側で手動更新
    todayReflection,
    weekReflections,
    loading,
    refreshToday,
    refreshWeek,
    upsertReflection,
  };
}