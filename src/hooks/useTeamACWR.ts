// src/hooks/useTeamACWR.ts
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

export type RiskLevel = 'high' | 'caution' | 'good' | 'low' | 'unknown';

export interface TeamACWRData {
  date: string; // YYYY-MM-DD
  averageACWR: number;
  athleteCount: number;
  riskLevel: RiskLevel;

  // team_training_daily（view）から
  averageRPE?: number | null;
  averageLoad?: number | null;
}

export interface AthleteACWRInfo {
  currentACWR: number | null;
  riskLevel: RiskLevel;
  daysOfData?: number | null;
}
export type AthleteACWRMap = Record<string, AthleteACWRInfo>;

const round2 = (n: number) => Math.round(n * 100) / 100;

const toNum = (v: any): number | null => {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

const evalRisk = (acwr: number | null): RiskLevel => {
  if (acwr === null || acwr === undefined) return 'unknown';
  if (!Number.isFinite(acwr) || acwr <= 0) return 'unknown';
  if (acwr >= 1.5) return 'high';
  if (acwr >= 1.3) return 'caution';
  if (acwr >= 0.8) return 'good';
  return 'low';
};

// ✅ JSTのYYYY-MM-DD（DBの日付と合わせる）
// 「toISOString」はUTC基準なので、そのままだと日付がズレることがある。
// いったん "Asia/Tokyo" の時刻文字列に変換 → Date化 → ISO化 することで、JST日付キーを安定させる。
const getJSTDateKey = (d: Date) => {
  const jst = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  return jst.toISOString().slice(0, 10);
};

type TeamACWRDailyRow = {
  team_id: string;
  date: string; // YYYY-MM-DD
  average_acwr: number | string | null; // numericがstringで返ることがある
  athlete_count: number | string | null;
};

type TeamTrainingDailyRow = {
  team_id: string;
  date: string;
  average_rpe: number | string | null;
  average_load: number | string | null;
  athlete_count: number | string | null;
};

export function useTeamACWR(teamId: string | null) {
  const [teamACWRData, setTeamACWRData] = useState<TeamACWRData[]>([]);
  const [athleteACWRMap, setAthleteACWRMap] = useState<AthleteACWRMap>({});
  const [loading, setLoading] = useState(false);

  // ✅ 古いfetch結果を捨てるための「通し番号」
  const reqSeqRef = useRef(0);

  useEffect(() => {
    // teamIdが無いなら全部リセット
    if (!teamId) {
      setTeamACWRData([]);
      setAthleteACWRMap({});
      setLoading(false);
      return;
    }

    const mySeq = ++reqSeqRef.current;
    setLoading(true);

    // teamIdが変わった瞬間に一度クリア（“前チームの残像”防止）
    setTeamACWRData([]);
    setAthleteACWRMap({});

    (async () => {
      try {
        // 直近90日（必要ならここを30/180に変更OK）
        const today = new Date();
        const from = new Date(today);
        from.setDate(from.getDate() - 90);

        const fromKey = getJSTDateKey(from);
        const toKey = getJSTDateKey(today);

        // ----------------------------
        // 1) チーム平均ACWR（view: team_acwr_daily）をそのまま取得
        //    ※ここが “一番崩れづらい” 中核
        // ----------------------------
        const { data: acwrRows, error: acwrErr } = await supabase
          .from('team_acwr_daily')
          .select('team_id,date,average_acwr,athlete_count')
          .eq('team_id', teamId)
          .gte('date', fromKey)
          .lte('date', toKey)
          .order('date', { ascending: true });

        if (acwrErr) throw acwrErr;

        // ✅ 古いリクエストなら破棄
        if (reqSeqRef.current !== mySeq) return;

        const base: TeamACWRData[] = (acwrRows || [])
          .map((r: any) => {
            const avg = toNum((r as TeamACWRDailyRow).average_acwr);
            const cnt = toNum((r as TeamACWRDailyRow).athlete_count);
            return {
              date: r.date,
              averageACWR: avg != null ? round2(avg) : NaN,
              athleteCount: cnt != null ? Math.max(0, Math.round(cnt)) : 0,
              riskLevel: evalRisk(avg),
              averageRPE: null,
              averageLoad: null,
            };
          })
          // ✅ 変な行を除外（NaNなど）
          .filter((x) => Number.isFinite(x.averageACWR));

        // ----------------------------
        // 2) 平均RPE/Load（view: team_training_daily）をマージ（あれば）
        // ----------------------------
        let merged = base;

        try {
          const { data: dailyRows, error: dailyErr } = await supabase
            .from('team_training_daily')
            .select('team_id,date,average_rpe,average_load,athlete_count')
            .eq('team_id', teamId)
            .gte('date', fromKey)
            .lte('date', toKey)
            .order('date', { ascending: true });

          if (dailyErr) throw dailyErr;

          if (reqSeqRef.current !== mySeq) return;

          const mapDaily = new Map<string, TeamTrainingDailyRow>();
          (dailyRows || []).forEach((r: any) => mapDaily.set(r.date, r));

          merged = base.map((row) => {
            const add = mapDaily.get(row.date);
            return {
              ...row,
              averageRPE: toNum(add?.average_rpe) ?? null,
              averageLoad: toNum(add?.average_load) ?? null,
            };
          });
        } catch {
          // ここは失敗してもACWRグラフは出す
          merged = base;
        }

        if (reqSeqRef.current !== mySeq) return;
        setTeamACWRData(merged);

        // ----------------------------
        // 3) 選手ごとの最新ACWR（必要なら残す）
        //    ※チーム平均グラフの安定には不要なので、軽量化したいなら削除可
        // ----------------------------
        // いまのStaffViewは別ロジックで選手ACWRを取っているので、
        // ここで何かをしなくてもOK。空のままでも問題なし。
        setAthleteACWRMap({});
      } catch (e) {
        console.error('[useTeamACWR] fetch failed', e);
        if (reqSeqRef.current === mySeq) {
          setTeamACWRData([]);
          setAthleteACWRMap({});
        }
      } finally {
        if (reqSeqRef.current === mySeq) setLoading(false);
      }
    })();
  }, [teamId]);

  return { teamACWRData, athleteACWRMap, loading };
}