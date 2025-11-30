import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface TutorialProgress {
  id?: string;
  user_id: string;
  role: 'athlete' | 'staff' | 'admin';
  completed_steps: string[];
  current_step: string | null;
  is_completed: boolean;
  skipped: boolean;
  last_updated?: string;
  created_at?: string;
}

export function useTutorial(userId: string, role: 'athlete' | 'staff' | 'admin') {
  const [progress, setProgress] = useState<TutorialProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProgress = useCallback(async () => {
    if (!userId || !role) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('tutorial_progress')
        .select('*')
        .eq('user_id', userId)
        .eq('role', role)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (data) {
        setProgress(data as TutorialProgress);
      } else {
        const newProgress: TutorialProgress = {
          user_id: userId,
          role,
          completed_steps: [],
          current_step: null,
          is_completed: false,
          skipped: false,
        };
        setProgress(newProgress);
      }
    } catch (err: any) {
      console.error('Error loading tutorial progress:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [userId, role]);

  useEffect(() => {
    loadProgress();
  }, [loadProgress]);

  const saveProgress = useCallback(async (updatedProgress: Partial<TutorialProgress>) => {
    if (!userId || !role) return;

    try {
      const progressToSave = {
        ...progress,
        ...updatedProgress,
        user_id: userId,
        role,
      };

      const { data, error: upsertError } = await supabase
        .from('tutorial_progress')
        .upsert(progressToSave, {
          onConflict: 'user_id,role',
        })
        .select()
        .single();

      if (upsertError) throw upsertError;

      setProgress(data as TutorialProgress);
      return data;
    } catch (err: any) {
      console.error('Error saving tutorial progress:', err);
      setError(err.message);
      throw err;
    }
  }, [userId, role, progress]);

  const completeStep = useCallback(async (stepId: string) => {
    if (!progress) return;

    const completedSteps = [...progress.completed_steps];
    if (!completedSteps.includes(stepId)) {
      completedSteps.push(stepId);
    }

    await saveProgress({
      completed_steps: completedSteps,
      current_step: stepId,
    });
  }, [progress, saveProgress]);

  const setCurrentStep = useCallback(async (stepId: string | null) => {
    await saveProgress({
      current_step: stepId,
    });
  }, [saveProgress]);

  const completeTutorial = useCallback(async () => {
    await saveProgress({
      is_completed: true,
      current_step: null,
    });
  }, [saveProgress]);

  const skipTutorial = useCallback(async () => {
    await saveProgress({
      skipped: true,
      current_step: null,
    });
  }, [saveProgress]);

  const resetTutorial = useCallback(async () => {
    await saveProgress({
      completed_steps: [],
      current_step: null,
      is_completed: false,
      skipped: false,
    });
  }, [saveProgress]);

  const shouldShowTutorial = useCallback(() => {
    if (!progress) return false;
    return !progress.is_completed && !progress.skipped;
  }, [progress]);

  return {
    progress,
    loading,
    error,
    completeStep,
    setCurrentStep,
    completeTutorial,
    skipTutorial,
    resetTutorial,
    shouldShowTutorial,
    refreshProgress: loadProgress,
  };
}
