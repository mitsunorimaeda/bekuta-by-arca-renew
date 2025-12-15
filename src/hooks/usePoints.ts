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
  const currentLevelStartPoints = nextLevelPoints - (level * 50);

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

  // ✅ 多重subscribe防止（念のため）
  const channelsRef = useRef<{ points?: any; tx?: any }>({});

  const fetchUserPoints = useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);
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
    } finally {
      setLoading(false);
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
    if (!userId) {
      setLoading(false);
      return;
    }

    // 初回取得
    fetchUserPoints();
    fetchTransactions();

    // ✅ 既存があれば必ず remove（多重subscribe防止）
    if (channelsRef.current.points) {
      supabase.removeChannel(channelsRef.current.points);
      channelsRef.current.points = undefined;
    }
    if (channelsRef.current.tx) {
      supabase.removeChannel(channelsRef.current.tx);
      channelsRef.current.tx = undefined;
    }

    // ✅ userId を含めて channel をユニーク化
    const pointsChannel = supabase
      .channel(`user_points_changes:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_points', filter: `user_id=eq.${userId}` },
        () => {
          fetchUserPoints();
        }
      )
      .subscribe();

    const txChannel = supabase
      .channel(`point_transactions_changes:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'point_transactions', filter: `user_id=eq.${userId}` },
        () => {
          fetchTransactions();
        }
      )
      .subscribe();

    channelsRef.current.points = pointsChannel;
    channelsRef.current.tx = txChannel;

    return () => {
      // ✅ unsubscribe より removeChannel が安定
      if (channelsRef.current.points) {
        supabase.removeChannel(channelsRef.current.points);
        channelsRef.current.points = undefined;
      }
      if (channelsRef.current.tx) {
        supabase.removeChannel(channelsRef.current.tx);
        channelsRef.current.tx = undefined;
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

      await fetchUserPoints();
      await fetchTransactions();

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

  const getRecentTransactions = (limit: number = 10) => {
    return transactions.slice(0, limit);
  };

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