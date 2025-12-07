import { Goal } from '../hooks/useGoals';
import { normalizeGoalMetadata } from './goalMetadata';

export interface GoalProgressInfo {
  progress_percent: number;
  remaining_diff: number | null;
  is_completed: boolean;
  display_unit?: string;
}

export function getGoalProgress(goal: Goal): GoalProgressInfo {
  const meta = normalizeGoalMetadata(goal.metadata);

  const target = goal.target_value;
  const current = goal.current_value;

  if (target == null || current == null) {
    return {
      progress_percent: 0,
      remaining_diff: null,
      is_completed: false,
      display_unit: meta.unit,
    };
  }

  const progress = Math.min(100, (current / target) * 100);
  const remaining = target - current;

  return {
    progress_percent: progress,
    remaining_diff: remaining,
    is_completed: progress >= 100,
    display_unit: meta.unit,
  };
}