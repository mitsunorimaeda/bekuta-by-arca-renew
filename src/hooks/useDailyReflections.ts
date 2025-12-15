import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export type DailyReflectionVisibility = 'private' | 'team' | 'staff';

export interface DailyReflection {
  id: string;
  user_id: string;
  reflection_date: string; // YYYY-MM-DD
  text: string;
  visibility: DailyReflectionVisibility;
  word_count?: number;
  created_at: string;
  updated_at: string;
}

function toISODate(d: Date) {
  // ローカル日付として YYYY-MM-DD を作る（UTCズレ対策）
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function useDailyReflections(userId: string) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedDate, setSelectedDate] = useState<string>(() => toISODate(new Date()));
  const [reflection, setReflection] = useState<DailyReflection | null>(null);

  const fetchByDate = useCallback(
    async (dateISO: string) => {
      if (!userId) return;
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase
          .from('daily_reflections')
          .select('*')
          .eq('user_id', userId)
          .eq('reflection_date', dateISO)
          .maybeSingle();

        if (error) throw error;
        setReflection(data ?? null);
      } catch (e: any) {
        console.error('[useDailyReflections] fetchByDate error', e);
        setError(e?.message ?? '振り返りの取得に失敗しました');
      } finally {
        setLoading(false);
      }
    },
    [userId],
  );

  useEffect(() => {
    if (!userId) return;
    fetchByDate(selectedDate);
  }, [userId, selectedDate, fetchByDate]);

  const save = useCallback(
    async (text: string, visibility: DailyReflectionVisibility = 'private') => {
      if (!userId) return false;
      setSaving(true);
      setError(null);
      try {
        // unique(user_id, reflection_date) 前提で upsert
        const { data, error } = await supabase
          .from('daily_reflections')
          .upsert(
            {
              user_id: userId,
              reflection_date: selectedDate,
              text,
              visibility,
            },
            { onConflict: 'user_id,reflection_date' },
          )
          .select('*')
          .single();

        if (error) throw error;
        setReflection(data);
        return true;
      } catch (e: any) {
        console.error('[useDailyReflections] save error', e);
        setError(e?.message ?? '振り返りの保存に失敗しました');
        return false;
      } finally {
        setSaving(false);
      }
    },
    [userId, selectedDate],
  );

  const remove = useCallback(async () => {
    if (!userId) return false;
    if (!reflection) return true;

    setSaving(true);
    setError(null);
    try {
      const { error } = await supabase
        .from('daily_reflections')
        .delete()
        .eq('id', reflection.id)
        .eq('user_id', userId);

      if (error) throw error;
      setReflection(null);
      return true;
    } catch (e: any) {
      console.error('[useDailyReflections] remove error', e);
      setError(e?.message ?? '振り返りの削除に失敗しました');
      return false;
    } finally {
      setSaving(false);
    }
  }, [userId, reflection]);

  return {
    selectedDate,
    setSelectedDate,
    reflection,
    loading,
    saving,
    error,
    fetchByDate,
    save,
    remove,
  };
}