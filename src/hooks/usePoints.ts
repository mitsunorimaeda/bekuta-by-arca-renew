import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

export interface UserPoints {
  id: string;
  user_id: string;
  total_points: number;
  current_level: number;
  points_to_next_level: number;
  rank_title: string;
  created_at: string;
  updated_at: string;
}

export interface PointTransaction {
  id: string;
  user_id: string;
  points: number;
  reason: string;
  category: 'record' | 'streak' | 'achievement' | 'goal' | 'social' | 'bonus';
  metadata: any;
  created_at: string;
}

const calcLevelInfo = (totalPoints: number) => {
  let level = 1;
  let nextLevelPoints = 100;

  while (totalPoints >= nextLevelPoints) {
    level += 1;
    nextLevelPoints += level * 50;
  }

  return { level, nextLevelPoints };
};

const calcLevelProgress = (totalPoints: number) => {
  const { level, nextLevelPoints } = calcLevelInfo(totalPoints);
  const currentLevelStartPoints = nextLevelPoints - level * 50;

  const into = totalPoints - currentLevelStartPoints;
  const span = nextLevelPoints - currentLevelStartPoints;

  const progress = span > 0 ? (into / span) * 100 : 0;
  return Math.min(100, Math.max(0, progress));
};

export function usePoints(userId: string) {
  const [userPoints, setUserPoints] = useState<UserPoints | null>(null);
  const [transactions, setTransactions] = useState<PointTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ✅ hookインスタンス固有ID（タブ内での衝突回避）
  const instanceIdRef = useRef(
    (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2))
  );

  // ✅ effect再実行ごとにユニークなrunIdを採番（subscribe二重呼びを構造的に防ぐ）
  const runSeqRef = useRef(0);

  // ✅ チャンネル参照（1本に統合）
  const channelRef = useRef<any>(null);

  const fetchUserPoints = useCallback(async () => {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from('user_points')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;

      setUserPoints(data ?? null);
      setError(null);
    } catch (err) {
      console.error('Error fetching user points:', err);
      setError(err instanceof Error ? err.message : 'ポイントの取得に失敗しました');
    }
  }, [userId]);

  const fetchTransactions = useCallback(async () => {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from('point_transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      setTransactions(data || []);
    } catch (err) {
      console.error('Error fetching transactions:', err);
    }
  }, [userId]);

  useEffect(() => {
    let cancelled = false;

    const setup = async () => {
      if (!userId) {
        setLoading(false);
        return;
      }

      setLoading(true);

      await Promise.all([fetchUserPoints(), fetchTransactions()]);
      if (cancelled) return;

      setLoading(false);

      // ✅ 既存チャンネルがあれば確実に閉じる（unsubscribe → remove）
      if (channelRef.current) {
        try {
          // unsubscribe は Promise を返すことがある
          await channelRef.current.unsubscribe?.();
        } catch (e) {
          // ここは握りつぶしてOK（removeで最終回収）
        }
        try {
          supabase.removeChannel(channelRef.current);
        } catch (e) {
          // noop
        }
        channelRef.current = null;
      }

      // ✅ 今回のrunId（毎回変わる）
      runSeqRef.current += 1;
      const runId = runSeqRef.current;

      // ✅ userId + instanceId + runId で「絶対に同名にならない」
      const chName = `points:${userId}:${instanceIdRef.current}:${runId}`;

      const ch = supabase
        .channel(chName)
        // user_points: INSERT/UPDATE/DELETE どれでも拾う
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'user_points', filter: `user_id=eq.${userId}` },
          () => {
            fetchUserPoints();
          }
        )
        // point_transactions: INSERTだけ拾う
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'point_transactions', filter: `user_id=eq.${userId}` },
          () => {
            fetchTransactions();
          }
        );

      channelRef.current = ch;

      // ✅ subscribe は必ず1回。状態もログできる
      ch.subscribe((status: string) => {
        // SUBSCRIBED / TIMED_OUT / CLOSED / CHANNEL_ERROR
        // console.log('[usePoints] channel status:', chName, status);
        if (status === 'CHANNEL_ERROR') {
          console.warn('[usePoints] Realtime channel error:', chName);
        }
      });
    };

    setup();

    return () => {
      cancelled = true;

      // cleanup時も回収（非同期でOK）
      const ch = channelRef.current;
      if (ch) {
        try {
          ch.unsubscribe?.();
        } catch (e) {
          // noop
        }
        try {
          supabase.removeChannel(ch);
        } catch (e) {
          // noop
        }
        channelRef.current = null;
      }
    };
  }, [userId, fetchUserPoints, fetchTransactions]);

  const awardPoints = async (
    points: number,
    reason: string,
    category: PointTransaction['category'],
    metadata: any = {}
  ) => {
    try {
      const { error } = await supabase.rpc('award_points', {
        p_user_id: userId,
        p_points: points,
        p_reason: reason,
        p_category: category,
        p_metadata: metadata,
      });

      if (error) throw error;

      await Promise.all([fetchUserPoints(), fetchTransactions()]);
      return true;
    } catch (err) {
      console.error('Error awarding points:', err);
      return false;
    }
  };

  const getLevelProgress = () => {
    if (!userPoints) return 0;
    return calcLevelProgress(userPoints.total_points);
  };

  const getRecentTransactions = (limit: number = 10) => transactions.slice(0, limit);

  const getTotalPointsByCategory = (category: PointTransaction['category']) => {
    return transactions
      .filter((t) => t.category === category)
      .reduce((sum, t) => sum + t.points, 0);
  };

  return {
    userPoints,
    transactions,
    loading,
    error,
    awardPoints,
    getLevelProgress,
    getRecentTransactions,
    getTotalPointsByCategory,
    refresh: fetchUserPoints,
  };
}