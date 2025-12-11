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
  duration: number | null; // 分 or 時間（スキーマに合わせて）
  load?: number | null;    // あれば使う
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
      // ① チームのアスリート取得
      const { data: athletes, error: athletesError } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'athlete')
        .eq('team_id', teamId);

      if (athletesError) throw athletesError;

      if (!athletes || athletes.length === 0) {
        setTeamACWRData([]);
        return;
      }

      const athleteIds = athletes.map((a) => a.id);

      // ② その選手たちの training_records を取得
      const { data: recordsRaw, error: recordsError } = await supabase
        .from('training_records')
        .select<TrainingRecordRow>('user_id, date, rpe, duration, load')
        .in('user_id', athleteIds)
        .order('date', { ascending: true });

      if (recordsError) throw recordsError;

      if (!recordsRaw || recordsRaw.length === 0) {
        setTeamACWRData([]);
        return;
      }

      // ③ calculateACWR に渡す形に整形（load を必ず作る）
      const normalizedRecords = recordsRaw
        .map((r) => {
          // 既に load カラムがあるならそれを優先
          let load: number;

          if (typeof r.load === 'number') {
            load = r.load;
          } else {
            const rpeNum =
              typeof r.rpe === 'number' ? r.rpe : Number(r.rpe ?? NaN);
            const durationNum =
              typeof r.duration === 'number'
                ? r.duration
                : Number(r.duration ?? NaN);

            if (
              Number.isNaN(rpeNum) ||
              Number.isNaN(durationNum) ||
              rpeNum <= 0 ||
              durationNum <= 0
            ) {
              return null; // 無効データは捨てる
            }

            // ここが「詳細モーダル側」と同じ計算になっていることが重要
            // もし useTrainingData 内で別の式を使っているなら、そちらに合わせてください
            load = rpeNum * durationNum;
          }

          return {
            user_id: r.user_id,
            date: r.date, // calculateACWR もこの date を使う想定
            load,
          };
        })
        .filter((r): r is { user_id: string; date: string; load: number } => !!r);

      if (normalizedRecords.length === 0) {
        setTeamACWRData([]);
        return;
      }

      // ④ アスリートごとに ACWR を計算
      const athleteACWRData: { [athleteId: string]: { date: string; acwr: number }[] } = {};

      for (const athleteId of athleteIds) {
        const athleteRecords = normalizedRecords.filter(
          (r) => r.user_id === athleteId
        );

        if (athleteRecords.length > 0) {
          // 👇 ここが詳細モーダルと同じ呼び方になっているのが大事
          const acwrSeries = calculateACWR(athleteRecords);
          athleteACWRData[athleteId] = acwrSeries;
        }
      }

      // ⑤ すべてのトレーニング日の集合を作成
      const allDates = new Set<string>();
      normalizedRecords.forEach((r) => allDates.add(r.date));
      const sortedDates = Array.from(allDates).sort();

      // ⑥ 日ごとにチーム平均を計算
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