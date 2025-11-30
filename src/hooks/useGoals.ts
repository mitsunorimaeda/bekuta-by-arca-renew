import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

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
    if (!userId) {
      setLoading(false);
      return;
    }

    fetchGoals();

    const subscription = supabase
      .channel('user_goals_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_goals',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          fetchGoals();
        }
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

      setGoals(data || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching goals:', err);
      setError(err instanceof Error ? err.message : '目標の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const createGoal = async (goalData: Omit<Goal, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'completed_at' | 'current_value' | 'status'>) => {
    try {
      const { data, error } = await supabase
        .from('user_goals')
        .insert({
          user_id: userId,
          ...goalData,
          current_value: 0,
          status: 'active',
        })
        .select()
        .single();

      if (error) throw error;

      await fetchGoals();
      return { data, error: null };
    } catch (err) {
      console.error('Error creating goal:', err);
      return {
        data: null,
        error: err instanceof Error ? err.message : '目標の作成に失敗しました',
      };
    }
  };

  const updateGoal = async (goalId: string, updates: Partial<Goal>) => {
    try {
      const { error } = await supabase
        .from('user_goals')
        .update(updates)
        .eq('id', goalId)
        .eq('user_id', userId);

      if (error) throw error;

      await fetchGoals();
      return { error: null };
    } catch (err) {
      console.error('Error updating goal:', err);
      return {
        error: err instanceof Error ? err.message : '目標の更新に失敗しました',
      };
    }
  };

  const updateGoalProgress = async (goalId: string, currentValue: number) => {
    try {
      const goal = goals.find((g) => g.id === goalId);
      if (!goal) return { error: '目標が見つかりません' };

      const updates: Partial<Goal> = {
        current_value: currentValue,
      };

      if (goal.target_value && currentValue >= goal.target_value) {
        updates.status = 'completed';
        updates.completed_at = new Date().toISOString();
      }

      return await updateGoal(goalId, updates);
    } catch (err) {
      console.error('Error updating goal progress:', err);
      return {
        error: err instanceof Error ? err.message : '進捗の更新に失敗しました',
      };
    }
  };

  const completeGoal = async (goalId: string) => {
    return await updateGoal(goalId, {
      status: 'completed',
      completed_at: new Date().toISOString(),
    });
  };

  const abandonGoal = async (goalId: string) => {
    return await updateGoal(goalId, {
      status: 'abandoned',
    });
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
    } catch (err) {
      console.error('Error deleting goal:', err);
      return {
        error: err instanceof Error ? err.message : '目標の削除に失敗しました',
      };
    }
  };

  const getActiveGoals = () => {
    return goals.filter((g) => g.status === 'active');
  };

  const getCompletedGoals = () => {
    return goals.filter((g) => g.status === 'completed');
  };

  const getGoalsByType = (type: Goal['goal_type']) => {
    return goals.filter((g) => g.goal_type === type && g.status === 'active');
  };

  const getGoalProgress = (goal: Goal) => {
    if (!goal.target_value) return 0;
    return Math.min(100, (goal.current_value / goal.target_value) * 100);
  };

  const isGoalOverdue = (goal: Goal) => {
    if (!goal.deadline || goal.status !== 'active') return false;
    return new Date(goal.deadline) < new Date();
  };

  const getDaysUntilDeadline = (goal: Goal) => {
    if (!goal.deadline) return null;
    const deadline = new Date(goal.deadline);
    const today = new Date();
    const diffTime = deadline.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return {
    goals,
    loading,
    error,
    createGoal,
    updateGoal,
    updateGoalProgress,
    completeGoal,
    abandonGoal,
    deleteGoal,
    getActiveGoals,
    getCompletedGoals,
    getGoalsByType,
    getGoalProgress,
    isGoalOverdue,
    getDaysUntilDeadline,
    refresh: fetchGoals,
  };
}
