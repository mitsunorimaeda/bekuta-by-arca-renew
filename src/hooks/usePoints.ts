import { useState, useEffect } from 'react';
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

export function usePoints(userId: string) {
  const [userPoints, setUserPoints] = useState<UserPoints | null>(null);
  const [transactions, setTransactions] = useState<PointTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    fetchUserPoints();
    fetchTransactions();

    const pointsSubscription = supabase
      .channel('user_points_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_points',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          fetchUserPoints();
        }
      )
      .subscribe();

    const transactionsSubscription = supabase
      .channel('point_transactions_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'point_transactions',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          fetchTransactions();
        }
      )
      .subscribe();

    return () => {
      pointsSubscription.unsubscribe();
      transactionsSubscription.unsubscribe();
    };
  }, [userId]);

  const fetchUserPoints = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_points')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;

      setUserPoints(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching user points:', err);
      setError(err instanceof Error ? err.message : 'ポイントの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async () => {
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
  };

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

    const totalPointsForCurrentLevel = userPoints.total_points;
    const pointsForNextLevel = totalPointsForCurrentLevel + userPoints.points_to_next_level;
    const pointsNeededForCurrentLevel = pointsForNextLevel - (userPoints.current_level * 50);

    const progress =
      ((totalPointsForCurrentLevel - pointsNeededForCurrentLevel) /
      (pointsForNextLevel - pointsNeededForCurrentLevel)) * 100;

    return Math.min(100, Math.max(0, progress));
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
