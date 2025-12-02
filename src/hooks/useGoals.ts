import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { normalizeGoalMetadata } from '../lib/goalMetadata';
import { getGoalProgress } from '../lib/goalUtils';

export interface Goal {
  id: string;
  user_id: string;
  goal_type: 'performance' | 'weight' | 'streak' | 'habit' | 'custom';
  title: string;
  description: string | null;
  target_value: number | null;
  current_value: number;
  unit: string | null;
  deadline: string | null;
  status: 'active' | 'completed' | 'failed' | 'abandoned';
  completed_at: string | null;
  metadata: any;
  created_at: string;
  updated_at: string;
}

export function useGoals(userId: string) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
  
    fetchGoals();
  
    const subscription = supabase
      .channel('goals_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_goals', filter: `user_id=eq.${userId}` },
        fetchGoals
      )
      .subscribe();
  
    return () => {
      subscription.unsubscribe();
    };
  }, [userId]);

  const fetchGoals = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('user_goals')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const normalized = (data || []).map(g => ({
        ...g,
        metadata: normalizeGoalMetadata(g.metadata),
      }));

      setGoals(normalized);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('目標の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const createGoal = async (goalData: Partial<Goal>) => {
    try {
      const { data, error } = await supabase
        .from('user_goals')
        .insert({
          user_id: userId,
          ...goalData,
          current_value: goalData.current_value ?? 0,
          status: 'active',
          metadata: normalizeGoalMetadata(goalData.metadata),
        })
        .select()
        .single();

      if (error) throw error;

      await fetchGoals();
      return { data, error: null };
    } catch (err) {
      console.error(err);
      return { data: null, error: '目標の作成に失敗しました' };
    }
  };

  const updateGoal = async (goalId: string, updates: Partial<Goal>) => {
    try {
      const { error } = await supabase
        .from('user_goals')
        .update({
          ...updates,
          metadata: updates.metadata ? normalizeGoalMetadata(updates.metadata) : undefined,
        })
        .eq('id', goalId)
        .eq('user_id', userId);

      if (error) throw error;

      await fetchGoals();
      return { error: null };
    } catch {
      return { error: '目標の更新に失敗しました' };
    }
  };

  const updateGoalProgress = async (goalId: string, currentValue: number) => {
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return { error: '目標が見つかりません' };

    const progress = getGoalProgress({ ...goal, current_value: currentValue });

    const updates: Partial<Goal> = {
      current_value: currentValue,
      ...(progress.is_completed
        ? {
            status: 'completed',
            completed_at: new Date().toISOString(),
          }
        : {}),
    };

    return await updateGoal(goalId, updates);
  };

  const deleteGoal = async (goalId: string) => {
    try {
      const { error } = await supabase
        .from('user_goals')
        .delete()
        .eq('id', goalId)
        .eq('user_id', userId);

      if (error) throw error;

      await fetchGoals();
      return { error: null };
    } catch {
      return { error: '目標の削除に失敗しました' };
    }
  };

    // 進行中の目標
  function getActiveGoals() {
    return goals.filter(g => g.status === 'active');
  }

  // 進捗計算（goalUtils のラッパー）
  function calculateGoalProgress(goal: Goal) {
    return getGoalProgress(goal);
  }

  // 締切までの日数
  function getDaysUntilDeadline(goal: Goal) {
    if (!goal.deadline) return null;
    const now = new Date();
    const deadline = new Date(goal.deadline);
    const diff = deadline.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  // 締切超過しているか
  function isGoalOverdue(goal: Goal) {
    if (!goal.deadline) return false;
    return new Date(goal.deadline) < new Date() && goal.status !== 'completed';
  }

  // 完了処理
  async function completeGoal(goalId: string) {
    return await updateGoal(goalId, {
      status: 'completed',
      completed_at: new Date().toISOString(),
    });
  }

return {
    goals,
    loading,
    error,
    createGoal,
    updateGoal,
    updateGoalProgress,
    deleteGoal,
    refresh: fetchGoals,
  
    // 🔥 GamificationView が必要とする関数
    getActiveGoals,
    getGoalProgress: calculateGoalProgress,
    getDaysUntilDeadline,
    isGoalOverdue,
    completeGoal,
  };
}