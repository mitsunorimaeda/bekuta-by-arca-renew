// src/hooks/useTeamACWR.ts
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

type AthleteACWRRow = {
  user_id: string;
  team_id: string;
  date: string; // YYYY-MM-DD
  daily_load: number | string;
  acute_7d: number | string | null;
  chronic_28d: number | string | null;
  acwr: number | string | null;
  is_valid: boolean;
  updated_at: string;
};

export type TeamACWRData = {
  date: string;
  averageACWR: number | null;
  athleteCount: number;     // ←平均に使った人数（valid）
  rosterCount: number;      // ←在籍人数（users.team_id）
  riskLevel: string;
};

function getRiskLevelFromACWR(acwr: number): 'high' | 'caution' | 'good' | 'low' | 'unknown' {
  if (!Number.isFinite(acwr)) return 'unknown';
  if (acwr > 1.5) return 'high';
  if (acwr >= 1.3) return 'caution';
  if (acwr >= 0.8) return 'good';
  return 'low';


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
        // ① チーム在籍人数（母数表示用）※まずは users.team_id が一番安定
        const { count: rosterCount, error: rosterErr } = await supabase
          .from('users')
          .select('id', { count: 'exact', head: true })
          .eq('team_id', teamId);

        if (rosterErr) throw rosterErr;

        // ② athlete_acwr_daily を広めに取得（必要期間だけに絞ってもOK）
        const { data: rows, error: acwrErr } = await supabase
          .from('athlete_acwr_daily')
          .select('user_id, team_id, date, acwr, is_valid')
          .eq('team_id', teamId)
          .order('date', { ascending: true });

        if (acwrErr) throw acwrErr;

        const safeRows = (rows ?? []) as AthleteACWRRow[];

        // ③ フロントで「validのみ」を平均に採用
        const byDate = new Map<
          string,
          { sum: number; cnt: number; rosterCount: number }
        >();

        for (const r of safeRows) {
          const acwr = toNum(r.acwr);

          // ✅ 平均に使う条件（ここがキモ）
          const isValidForAvg = r.is_valid === true && acwr !== null;

          // date のバケツは作っておく（表示のため）
          if (!byDate.has(r.date)) {
            byDate.set(r.date, { sum: 0, cnt: 0, rosterCount: rosterCount ?? 0 });
          }

          if (isValidForAvg) {
            const bucket = byDate.get(r.date)!;
            bucket.sum += acwr!;
            bucket.cnt += 1;
          }
        }

        // ④ Chart 用配列に変換
        const next: TeamACWRData[] = Array.from(byDate.entries()).map(
          ([date, v]) => {
            const average =
              v.cnt > 0 ? Number((v.sum / v.cnt).toFixed(3)) : null;

            return {
              date,
              averageACWR: average,
              athleteCount: v.cnt,          // ✅平均に使った人数
              rosterCount: v.rosterCount,   // ✅在籍母数
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