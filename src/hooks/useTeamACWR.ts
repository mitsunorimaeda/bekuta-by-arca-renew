import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { calculateACWR } from '../lib/acwr';

interface TeamACWRData {
  date: string;
  averageACWR: number;
  athleteCount: number;
  riskLevel: string;
}

interface TrainingRecordRow {
  user_id: string;
  date: string;
  rpe: number | null;
  duration_min: number | null;
  load: number | null;
}

export function useTeamACWR(teamId: string | null) {
  const [teamACWRData, setTeamACWRData] = useState<TeamACWRData[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (teamId) {
      fetchTeamACWR(teamId);
    } else {
      setTeamACWRData([]);
    }
  }, [teamId]);

  const fetchTeamACWR = async (teamId: string) => {
    setLoading(true);
    try {
      // ① チーム所属選手を view から取得（★ここを users → view に変更）
      const { data: athletes, error: athletesError } = await supabase
        .from('staff_team_athletes_with_activity' as any)
        .select('id')
        .eq('team_id', teamId);

      if (athletesError) throw athletesError;

      if (!athletes || athletes.length === 0) {
        console.log('[useTeamACWR] No athletes for team', teamId);
        setTeamACWRData([]);
        return;
      }

      const athleteIds = athletes.map((a: any) => a.id as string);
      console.log('[useTeamACWR] athleteIds:', athleteIds);

      // ② training_records 取得（duration_min を正しいカラム名で）
      const { data: recordsRaw, error: recordsError } = await supabase
        .from('training_records')
        .select<TrainingRecordRow>('user_id, date, rpe, duration_min, load')
        .in('user_id', athleteIds)
        .order('date', { ascending: true });

      if (recordsError) throw recordsError;

      if (!recordsRaw || recordsRaw.length === 0) {
        console.log('[useTeamACWR] No training_records for team', teamId);
        setTeamACWRData([]);
        return;
      }

      console.log('[useTeamACWR] training_records count:', recordsRaw.length);

      // ③ ACWR 用に load を決定（なければ RPE × duration_min）
      const normalizedRecords = recordsRaw
        .map((r) => {
          let loadNum =
            typeof r.load === 'number'
              ? r.load
              : Number(r.load ?? NaN);

          if (
            (!loadNum || loadNum <= 0) &&
            r.rpe != null &&
            r.duration_min != null
          ) {
            const rpeNum =
              typeof r.rpe === 'number'
                ? r.rpe
                : Number(r.rpe ?? NaN);
            const durNum =
              typeof r.duration_min === 'number'
                ? r.duration_min
                : Number(r.duration_min ?? NaN);

            if (
              !Number.isNaN(rpeNum) &&
              !Number.isNaN(durNum) &&
              rpeNum > 0 &&
              durNum > 0
            ) {
              loadNum = rpeNum * durNum;
            }
          }

          if (!loadNum || Number.isNaN(loadNum) || loadNum <= 0) {
            return null;
          }

          return {
            user_id: r.user_id,
            date: r.date,
            load: loadNum,
          };
        })
        .filter(
          (r): r is { user_id: string; date: string; load: number } => !!r
        );

      console.log(
        '[useTeamACWR] normalizedRecords count:',
        normalizedRecords.length
      );

      if (normalizedRecords.length === 0) {
        setTeamACWRData([]);
        return;
      }

      // ④ アスリートごとに ACWR 計算
      const athleteACWRData: {
        [athleteId: string]: { date: string; acwr: number }[];
      } = {};

      for (const athleteId of athleteIds) {
        const athleteRecords = normalizedRecords.filter(
          (r) => r.user_id === athleteId
        );
        if (athleteRecords.length > 0) {
          const acwrSeries = calculateACWR(athleteRecords);
          athleteACWRData[athleteId] = acwrSeries;
        }
      }

      // ⑤ 全トレーニング日の集合
      const allDates = new Set<string>();
      normalizedRecords.forEach((r) => allDates.add(r.date));
      const sortedDates = Array.from(allDates).sort();

      // ⑥ 日ごとのチーム平均 ACWR
      const teamAverages: TeamACWRData[] = [];

      sortedDates.forEach((dateStr) => {
        const dailyACWRs: number[] = [];

        for (const athleteId of athleteIds) {
          const series = athleteACWRData[athleteId];
          if (!series) continue;

          const dayData = series.find((d) => d.date === dateStr);
          if (
            dayData &&
            typeof dayData.acwr === 'number' &&
            !Number.isNaN(dayData.acwr) &&
            dayData.acwr > 0
          ) {
            dailyACWRs.push(dayData.acwr);
          }
        }

        if (dailyACWRs.length > 0) {
          const sum = dailyACWRs.reduce((s, v) => s + v, 0);
          const avgRaw = sum / dailyACWRs.length;
          const averageACWR = Number(avgRaw.toFixed(2));

          let riskLevel: string;
          if (averageACWR > 1.5) riskLevel = 'high';
          else if (averageACWR >= 1.3) riskLevel = 'caution';
          else if (averageACWR >= 0.8) riskLevel = 'good';
          else riskLevel = 'low';

          teamAverages.push({
            date: dateStr,
            averageACWR,
            athleteCount: dailyACWRs.length,
            riskLevel,
          });
        }
      });

      console.log('[useTeamACWR] teamAverages:', teamAverages);
      setTeamACWRData(teamAverages);
    } catch (error) {
      console.error('Error fetching team ACWR data:', error);
      setTeamACWRData([]);
    } finally {
      setLoading(false);
    }
  };

  return {
    teamACWRData,
    loading,
  };
}