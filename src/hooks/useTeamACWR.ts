// src/hooks/useTeamACWR.ts
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

type AthleteACWRRow = {
  user_id: string;
  team_id: string;
  date: string; // YYYY-MM-DD
  acwr: number | string | null;
  is_valid: boolean;
};

export type TeamACWRData = {
  date: string;
  averageACWR: number | null;
  athleteCount: number; // 平均に使った人数（valid）
  rosterCount: number; // 在籍人数（users.team_id）
  riskLevel: 'high' | 'caution' | 'good' | 'low' | 'unknown';
};

function getRiskLevelFromACWR(
  acwr: number
): 'high' | 'caution' | 'good' | 'low' | 'unknown' {
  if (!Number.isFinite(acwr)) return 'unknown';
  if (acwr > 1.5) return 'high';
  if (acwr >= 1.3) return 'caution';
  if (acwr >= 0.8) return 'good';
  return 'low';
} // ✅ ← これが抜けてた

function toNum(v: any): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export function useTeamACWR(teamId?: string | null) {
  const [data, setData] = useState<TeamACWRData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    if (!teamId) {
      setData([]);
      return;
    }

    const run = async () => {
      setLoading(true);
      setError(null);

      try {
        // ① 在籍人数（母数）
        const { count: rosterCount, error: rosterErr } = await supabase
          .from('users')
          .select('id', { count: 'exact', head: true })
          .eq('team_id', teamId);

        if (rosterErr) throw rosterErr;

        // ② チームのACWR日次（広めに取得）
        const { data: rows, error: acwrErr } = await supabase
          .from('athlete_acwr_daily')
          .select('user_id, team_id, date, acwr, is_valid')
          .eq('team_id', teamId)
          .order('date', { ascending: true });

        if (acwrErr) throw acwrErr;

        const safeRows = (rows ?? []) as AthleteACWRRow[];

        // ③ 日付ごとに「valid のみ」で平均を作る
        const byDate = new Map<string, { sum: number; cnt: number }>();

        for (const r of safeRows) {
          if (!byDate.has(r.date)) byDate.set(r.date, { sum: 0, cnt: 0 });

          const acwr = toNum(r.acwr);
          const isValidForAvg = r.is_valid === true && acwr !== null;

          if (isValidForAvg) {
            const bucket = byDate.get(r.date)!;
            bucket.sum += acwr!;
            bucket.cnt += 1;
          }
        }

        const next: TeamACWRData[] = Array.from(byDate.entries()).map(
          ([date, v]) => {
            const average =
              v.cnt > 0 ? Number((v.sum / v.cnt).toFixed(3)) : null;

            return {
              date,
              averageACWR: average,
              athleteCount: v.cnt,
              rosterCount: rosterCount ?? 0,
              riskLevel: average !== null ? getRiskLevelFromACWR(average) : 'unknown',
            };
          }
        );

        setData(next);
      } catch (e) {
        console.error('[useTeamACWR] error', e);
        setError(e);
        setData([]);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [teamId]);

  return { data, loading, error };
}