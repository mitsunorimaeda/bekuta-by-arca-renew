import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface Streak {
  id: string;
  user_id: string;
  streak_type: 'training' | 'weight' | 'sleep' | 'motivation' | 'all';
  current_streak: number;
  longest_streak: number;
  last_recorded_date: string | null;
  streak_freeze_count: number;
  total_records: number;
}

export function useStreaks(userId: string) {
  const [streaks, setStreaks] = useState<Streak[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const channelRef = useRef<any>(null);

  const fetchStreaks = useCallback(async () => {
    if (!userId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_streaks')
        .select('*')
        .eq('user_id', userId)
        .order('streak_type');

      if (error) throw error;

      setStreaks(data || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching streaks:', err);
      setError(err instanceof Error ? err.message : 'ストリークの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    fetchStreaks();

    // ✅ 既存があれば必ず破棄（同名channel再利用対策）
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    // ✅ userIdを含めてユニーク化
    const channel = supabase
      .channel(`user-streaks:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_streaks',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          fetchStreaks();
        }
      );

    channel.subscribe(); // ✅ 1回だけ

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [userId, fetchStreaks]);

  const getStreakByType = (type: Streak['streak_type']) =>
    streaks.find((s) => s.streak_type === type) || null;

  const getTotalStreak = () => streaks.find((s) => s.streak_type === 'all') || null;

  const updateStreak = async (type: Streak['streak_type'], recordDate: string) => {
    const { error } = await supabase.rpc('update_user_streak', {
      p_user_id: userId,
      p_streak_type: type,
      p_record_date: recordDate,
    });
    if (error) throw error;
    await fetchStreaks();
  };

  const isStreakAtRisk = (streak: Streak | null) => {
    if (!streak?.last_recorded_date) return false;
    const lastDate = new Date(streak.last_recorded_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    lastDate.setHours(0, 0, 0, 0);
    const daysDiff = Math.floor((today.getTime() - lastDate.getTime()) / 86400000);
    return daysDiff >= 1;
  };

  const getStreakStatus = (streak: Streak | null): 'safe' | 'at_risk' | 'broken' => {
    if (!streak?.last_recorded_date) return 'broken';
    const lastDate = new Date(streak.last_recorded_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    lastDate.setHours(0, 0, 0, 0);
    const daysDiff = Math.floor((today.getTime() - lastDate.getTime()) / 86400000);
    if (daysDiff === 0) return 'safe';
    if (daysDiff === 1) return 'at_risk';
    return 'broken';
  };

  return {
    streaks,
    loading,
    error,
    getStreakByType,
    getTotalStreak,
    updateStreak,
    isStreakAtRisk,
    getStreakStatus,
    refresh: fetchStreaks,
  };
}