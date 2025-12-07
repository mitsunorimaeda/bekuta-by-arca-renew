import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface WeeklyRanking {
  user_id: string;
  user_name: string;
  team_id: string | null;
  weekly_records: number;
  rank: number;
}

export interface PointsRanking {
  user_id: string;
  user_name: string;
  team_id: string | null;
  total_points: number;
  current_level: number;
  rank: number;
}

export function useRankings(userId: string, teamId: string | null) {
  const [weeklyRankings, setWeeklyRankings] = useState<WeeklyRanking[]>([]);
  const [pointsRankings, setPointsRankings] = useState<PointsRanking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!teamId) {
      setLoading(false);
      return;
    }

    fetchRankings();

    const interval = setInterval(() => {
      fetchRankings();
    }, 60000);

    return () => clearInterval(interval);
  }, [teamId]);

  const fetchRankings = async () => {
    if (!teamId) return;

    try {
      setLoading(true);

      const [weeklyResult, pointsResult] = await Promise.all([
        supabase
          .from('team_weekly_rankings')
          .select('*')
          .eq('team_id', teamId)
          .order('rank'),
        supabase
          .from('team_points_rankings')
          .select('*')
          .eq('team_id', teamId)
          .order('rank'),
      ]);

      if (weeklyResult.error) throw weeklyResult.error;
      if (pointsResult.error) throw pointsResult.error;

      setWeeklyRankings(weeklyResult.data || []);
      setPointsRankings(pointsResult.data || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching rankings:', err);
      setError(err instanceof Error ? err.message : 'ランキングの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const getMyWeeklyRank = () => {
    return weeklyRankings.find((r) => r.user_id === userId) || null;
  };

  const getMyPointsRank = () => {
    return pointsRankings.find((r) => r.user_id === userId) || null;
  };

  const getTop3Weekly = () => {
    return weeklyRankings.slice(0, 3);
  };

  const getTop3Points = () => {
    return pointsRankings.slice(0, 3);
  };

  const getMyWeeklyPosition = () => {
    const myRank = getMyWeeklyRank();
    return myRank ? myRank.rank : null;
  };

  const getMyPointsPosition = () => {
    const myRank = getMyPointsRank();
    return myRank ? myRank.rank : null;
  };

  return {
    weeklyRankings,
    pointsRankings,
    loading,
    error,
    getMyWeeklyRank,
    getMyPointsRank,
    getTop3Weekly,
    getTop3Points,
    getMyWeeklyPosition,
    getMyPointsPosition,
    refresh: fetchRankings,
  };
}
