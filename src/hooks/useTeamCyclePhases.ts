import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import {
  getCurrentPhase,
  type CyclePhaseInfo,
  type CycleRecord,
} from '../lib/cyclePhaseUtils';

/**
 * コーチ用: チームの女性選手の現在フェーズを一括取得
 * プライバシー保護: フェーズ名のみ返す（生の日付・症状は返さない）
 */
export function useTeamCyclePhases(athleteIds: string[]) {
  const [cycleData, setCycleData] = useState<Record<string, CycleRecord[]>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (athleteIds.length === 0) return;
    fetchTeamCycles();
  }, [athleteIds.join(',')]);

  const fetchTeamCycles = async () => {
    try {
      setLoading(true);
      // RLSポリシーにより、コーチは所属チーム選手のデータのみ取得可能
      const { data, error } = await supabase
        .from('menstrual_cycles')
        .select('user_id, cycle_start_date, cycle_end_date, period_duration_days, cycle_length_days')
        .in('user_id', athleteIds)
        .order('cycle_start_date', { ascending: false });

      if (error) throw error;

      // ユーザーごとにグループ化
      const grouped: Record<string, CycleRecord[]> = {};
      for (const row of data || []) {
        if (!grouped[row.user_id]) grouped[row.user_id] = [];
        grouped[row.user_id].push(row);
      }
      setCycleData(grouped);
    } catch {
      // コーチがアクセス権限を持たない場合はサイレントに無視
      setCycleData({});
    } finally {
      setLoading(false);
    }
  };

  /** userId → CyclePhaseInfo | null のマップ */
  const phaseMap = useMemo(() => {
    const map: Record<string, CyclePhaseInfo | null> = {};
    for (const userId of athleteIds) {
      const cycles = cycleData[userId];
      if (!cycles || cycles.length === 0) {
        map[userId] = null;
        continue;
      }
      const result = getCurrentPhase(cycles);
      map[userId] = result?.phaseInfo || null;
    }
    return map;
  }, [cycleData, athleteIds]);

  return { phaseMap, loading };
}
