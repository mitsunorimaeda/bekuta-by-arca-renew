// src/hooks/useTeamACWR.ts
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface TeamACWRData {
  date: string; // YYYY-MM-DD
  averageACWR: number;
  athleteCount: number;
  riskLevel: string;
}

// ✅ AthleteList 側に合わせて currentACWR に統一
export type RiskLevel = 'high' | 'caution' | 'good' | 'low' | 'unknown';

export interface AthleteACWRInfo {
  currentACWR: number | null;
  riskLevel: RiskLevel;
  daysOfData?: number | null;
}

export type AthleteACWRMap = Record<string, AthleteACWRInfo>;

const round2 = (n: number) => Math.round(n * 100) / 100;

const evalRisk = (acwr: number | null): RiskLevel => {
  if (acwr === null || acwr === undefined) return 'unknown';
  if (!Number.isFinite(acwr) || acwr <= 0) return 'unknown';
  if (acwr >= 1.5) return 'high';
  if (acwr >= 1.3) return 'caution';
  if (acwr >= 0.8) return 'good';
  return 'low';
};

// ✅ JSTのYYYY-MM-DD（DBの日付と合わせる用）
const getJSTDateKey = (d: Date) => {
  const jst = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  return jst.toISOString().slice(0, 10);
};

type AthleteACWRDailyRow = {
  user_id: string;
  date: string; // YYYY-MM-DD
  acwr: number | null;
};

const chunk = <T,>(arr: T[], size: number) => {
  const res: T[][] = [];
  for (let i = 0; i < arr.length; i += size) res.push(arr.slice(i, i + size));
  return res;
};

export function useTeamACWR(teamId: string | null) {
  const [teamACWRData, setTeamACWRData] = useState<TeamACWRData[]>([]);
  const [athleteACWRMap, setAthleteACWRMap] = useState<AthleteACWRMap>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!teamId) {
      setTeamACWRData([]);
      setAthleteACWRMap({});
      return;
    }
    fetchTeamACWR(teamId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  const fetchTeamACWR = async (teamIdStr: string) => {
    setLoading(true);

    try {
      // 1) チームのアスリート取得
      const { data: athletes, error: athletesError } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'athlete')
        .eq('team_id', teamIdStr);

      if (athletesError) throw athletesError;

      const athleteIds = (athletes || []).map((a: any) => a.id);
      if (athleteIds.length === 0) {
        setTeamACWRData([]);
        setAthleteACWRMap({});
        return;
      }

      // 2) athlete_acwr_daily から直近90日分を取得
      const today = new Date();
      const from = new Date(today);
      from.setDate(from.getDate() - 90);

      const fromKey = getJSTDateKey(from);
      const toKey = getJSTDateKey(today);

      const idChunks = chunk(athleteIds, 50);
      const allRows: AthleteACWRDailyRow[] = [];

      for (const ids of idChunks) {
        const { data, error } = await supabase
          .from('athlete_acwr_daily')
          .select('user_id,date,acwr')
          .in('user_id', ids)
          .gte('date', fromKey)
          .lte('date', toKey)
          .order('date', { ascending: true });

        if (error) throw error;
        allRows.push(...((data || []) as AthleteACWRDailyRow[]));
      }

      // 3) 日付ごとに平均ACWRを作る
      const byDate = new Map<string, { sum: number; cnt: number }>();

      for (const r of allRows) {
        const v = r.acwr;
        if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) continue;

        const key = r.date;
        const cur = byDate.get(key) ?? { sum: 0, cnt: 0 };
        cur.sum += v;
        cur.cnt += 1;
        byDate.set(key, cur);
      }

      const dates = Array.from(byDate.keys()).sort();
      const teamAverages: TeamACWRData[] = dates.map((d) => {
        const x = byDate.get(d)!;
        const avg = x.sum / x.cnt;
        return {
          date: d,
          averageACWR: round2(avg),
          athleteCount: x.cnt,
          riskLevel: evalRisk(avg),
        };
      });

      setTeamACWRData(teamAverages);

      // 4) 選手ごとの「最新ACWR」を作る（必要なら）
      //    ※ order asc なので後ろ勝ちで上書き
      const latestMap: AthleteACWRMap = {};
      for (const id of athleteIds) {
        latestMap[id] = { currentACWR: null, riskLevel: 'unknown', daysOfData: null };
      }

      for (const r of allRows) {
        const v = typeof r.acwr === 'number' && Number.isFinite(r.acwr) ? r.acwr : null;
        if (v != null && v > 0) {
          latestMap[r.user_id] = {
            currentACWR: round2(v),
            riskLevel: evalRisk(v),
            daysOfData: 28, // ここは必要なら days_of_data をDBから持つ
          };
        }
      }

      setAthleteACWRMap(latestMap);
    } catch (error) {
      console.error('Error fetching team ACWR data:', error);
      setTeamACWRData([]);
      setAthleteACWRMap({});
    } finally {
      setLoading(false);
    }
  };

  return { teamACWRData, athleteACWRMap, loading };
}