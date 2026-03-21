import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';
import {
  getCyclePhaseForDate,
  getCurrentPhase,
  predictNextCycle,
  type CyclePhaseInfo,
  type CyclePrediction,
} from '../lib/cyclePhaseUtils';

type MenstrualCycle = Database['public']['Tables']['menstrual_cycles']['Row'];
type MenstrualCycleInsert = Database['public']['Tables']['menstrual_cycles']['Insert'];
type MenstrualCycleUpdate = Database['public']['Tables']['menstrual_cycles']['Update'];

export type { MenstrualCycle, MenstrualCycleInsert, MenstrualCycleUpdate };

export function useMenstrualCycleData(userId: string) {
  const [cycles, setCycles] = useState<MenstrualCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCycles();
  }, [userId]);

  const fetchCycles = async () => {
    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('menstrual_cycles')
        .select('*')
        .eq('user_id', userId)
        .order('cycle_start_date', { ascending: false });

      if (fetchError) throw fetchError;
      setCycles(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch menstrual cycles');
    } finally {
      setLoading(false);
    }
  };

  /** 組織IDを取得する内部ヘルパー（オフライン時はnull） */
  const getOrganizationId = async (): Promise<string | null> => {
    if (!navigator.onLine) return null;

    try {
      const { data: userProfile } = await supabase
        .from('users')
        .select('team_id')
        .eq('user_id', userId)
        .maybeSingle();

      if (userProfile?.team_id) {
        const { data: team } = await supabase
          .from('teams')
          .select('organization_id')
          .eq('id', userProfile.team_id)
          .maybeSingle();
        return team?.organization_id || null;
      }
      return null;
    } catch {
      return null; // ネットワークエラー時もnull
    }
  };

  const addCycle = async (cycle: Omit<MenstrualCycleInsert, 'user_id'>) => {
    try {
      const organizationId = await getOrganizationId();

      const insertPayload = {
        ...cycle,
        user_id: userId,
        organization_id: organizationId,
      };

      const { offlineMutation } = await import('../lib/offlineSupabase');
      const result = await offlineMutation({
        table: 'menstrual_cycles',
        operation: 'insert',
        payload: insertPayload,
      });

      if (result.queued) return { queued: true } as any;

      // オンライン成功時はデータ再取得
      const { data, error: fetchError } = await supabase
        .from('menstrual_cycles')
        .select('*')
        .eq('user_id', userId)
        .order('cycle_start_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!fetchError && data) {
        setCycles((prev) => [data, ...prev]);
      }
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add menstrual cycle');
      throw err;
    }
  };

  const updateCycle = async (id: string, updates: MenstrualCycleUpdate) => {
    try {
      const { data, error: updateError } = await supabase
        .from('menstrual_cycles')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (updateError) throw updateError;
      if (data) {
        setCycles((prev) =>
          prev.map((cycle) => (cycle.id === id ? data : cycle))
        );
      }
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update menstrual cycle');
      throw err;
    }
  };

  const deleteCycle = async (id: string) => {
    try {
      const { error: deleteError } = await supabase
        .from('menstrual_cycles')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;
      setCycles((prev) => prev.filter((cycle) => cycle.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete menstrual cycle');
      throw err;
    }
  };

  // ── クイックログ ──

  /** 1タップで生理開始を記録。過去の平均から cycle_length_days を自動入力 */
  const quickLogPeriodStart = useCallback(async (date?: string) => {
    const startDate = date || new Date().toISOString().slice(0, 10);

    // 同日に既に記録がある場合はスキップ（二重登録防止）
    const existingToday = cycles.find(c => c.cycle_start_date === startDate);
    if (existingToday) {
      return null; // 新規作成なしを示す
    }

    // 直前の周期を終了させる（cycle_end_dateが未設定の場合）
    const openCycle = cycles.find(c => !c.cycle_end_date);
    if (openCycle) {
      const endDate = new Date(startDate + 'T00:00:00');
      endDate.setDate(endDate.getDate() - 1);
      const endDateStr = endDate.toISOString().slice(0, 10);

      const cycleLengthDays = Math.floor(
        (new Date(startDate + 'T00:00:00').getTime() - new Date(openCycle.cycle_start_date + 'T00:00:00').getTime())
        / (1000 * 60 * 60 * 24)
      );

      // DB CHECK制約: cycle_length_days > 0 AND <= 60
      // 60日超は異常値（記録漏れ等）なのでnullにする
      await updateCycle(openCycle.id, {
        cycle_end_date: endDateStr,
        cycle_length_days: cycleLengthDays > 0 && cycleLengthDays <= 60 ? cycleLengthDays : null,
      });
    }

    // 過去データから平均を計算
    const prediction = predictNextCycle(cycles);

    const avgCycle = prediction?.averageCycleLength;
    const avgPeriod = prediction?.averagePeriodDuration;

    return addCycle({
      cycle_start_date: startDate,
      cycle_length_days: avgCycle && avgCycle <= 60 ? avgCycle : null,
      period_duration_days: avgPeriod && avgPeriod <= 14 ? avgPeriod : null,
    });
  }, [cycles]);

  /** 1タップで生理終了を記録 */
  const quickLogPeriodEnd = useCallback(async (date?: string) => {
    const endDate = date || new Date().toISOString().slice(0, 10);

    // 最新の未終了周期を探す
    const openCycle = cycles.find(c => !c.cycle_end_date);
    if (!openCycle) {
      throw new Error('終了させる生理記録がありません');
    }

    const durationDays = Math.floor(
      (new Date(endDate + 'T00:00:00').getTime() - new Date(openCycle.cycle_start_date + 'T00:00:00').getTime())
      / (1000 * 60 * 60 * 24)
    ) + 1;

    // DB CHECK制約: period_duration_days > 0 AND <= 14
    return updateCycle(openCycle.id, {
      period_duration_days: durationDays > 0 && durationDays <= 14 ? durationDays : null,
    });
  }, [cycles]);

  // ── フェーズ計算（cyclePhaseUtils に委譲） ──

  const getCyclePhase = (cycle: MenstrualCycle, targetDate: Date): string | null => {
    const info = getCyclePhaseForDate(cycle, targetDate);
    return info?.phase || null;
  };

  const getCurrentCyclePhase = (): { cycle: MenstrualCycle; phase: string } | null => {
    const result = getCurrentPhase(cycles);
    if (!result) return null;
    // cycles配列から一致するMenstrualCycleを見つけて返す
    const matchedCycle = cycles.find(
      c => c.cycle_start_date === result.cycle.cycle_start_date
    );
    if (!matchedCycle) return null;
    return { cycle: matchedCycle, phase: result.phaseInfo.phase };
  };

  const getCurrentPhaseInfo = (): CyclePhaseInfo | null => {
    const result = getCurrentPhase(cycles);
    return result?.phaseInfo || null;
  };

  const getPrediction = (): CyclePrediction | null => {
    return predictNextCycle(cycles);
  };

  return {
    cycles,
    loading,
    error,
    addCycle,
    updateCycle,
    deleteCycle,
    quickLogPeriodStart,
    quickLogPeriodEnd,
    getCyclePhase,
    getCurrentCyclePhase,
    getCurrentPhaseInfo,
    getPrediction,
    refetch: fetchCycles,
  };
}
