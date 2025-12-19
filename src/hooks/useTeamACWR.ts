// src/hooks/useTeamACWR.ts
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { calculateACWR } from '../lib/acwr';

export interface TeamACWRData {
  date: string; // YYYY-MM-DD
  averageACWR: number;
  athleteCount: number;
  riskLevel: string;
}

export interface AthleteACWRInfo {
  latestACWR: number | null;
  riskLevel: string; // 'high' | 'caution' | 'good' | 'low' | 'unknown'
}

export type AthleteACWRMap = Record<string, AthleteACWRInfo>;

function toNumber(v: any): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function toISODateString(v: any): string | null {
  if (!v) return null;

  // すでに YYYY-MM-DD っぽいならそのまま
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;

  const d = new Date(v);
  if (isNaN(d.getTime())) return null;

  // UTCで日付統一（ここはチーム運用により local にしたければ調整）
  return d.toISOString().slice(0, 10);
}

export function useTeamACWR(teamId: string | null) {
  const [teamACWRData, setTeamACWRData] = useState<TeamACWRData[]>([]);
  const [athleteACWRMap, setAthleteACWRMap] = useState<AthleteACWRMap>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (teamId) {
      fetchTeamACWR(teamId);
    } else {
      setTeamACWRData([]);
      setAthleteACWRMap({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  const evalRisk = (acwr: number | null): string => {
    if (!acwr || acwr <= 0) return 'unknown';
    if (acwr > 1.5) return 'high';
    if (acwr >= 1.3) return 'caution';
    if (acwr >= 0.8) return 'good';
    return 'low';
  };

  const fetchTeamACWR = async (teamId: string) => {
    setLoading(true);
    try {
      // 1) チームのアスリート取得
      const { data: athletes, error: athletesError } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'athlete')
        .eq('team_id', teamId);

      if (athletesError) throw athletesError;

      if (!athletes || athletes.length === 0) {
        setTeamACWRData([]);
        setAthleteACWRMap({});
        return;
      }

      const athleteIds = athletes.map((a) => a.id);
      console.log('[useTeamACWR] athleteIds:', athleteIds.length);

      // 2) training_records 取得
      const { data: records, error: recordsError } = await supabase
        .from('training_records')
        .select('user_id,date,rpe,duration_min,load')
        .in('user_id', athleteIds)
        .order('date', { ascending: true });

      if (recordsError) throw recordsError;

      console.log('[useTeamACWR] training_records count:', records?.length ?? 0);
      if (records && records.length > 0) {
        console.log('[useTeamACWR] sample record:', records[0]);
      }

      // 2.5) 正規化（dateをYYYY-MM-DDへ / 数値をnumberへ / load算出）
      const normalizedRecords =
        (records || [])
          .map((r) => {
            const date = toISODateString(r.date);
            const rpe = toNumber(r.rpe);
            const duration = toNumber(r.duration_min);
            const loadRaw = toNumber(r.load);

            const load =
              loadRaw ??
              (rpe != null && duration != null ? rpe * duration : null);

            if (!date) return null;

            return {
              ...r,
              date,       // YYYY-MM-DD
              rpe,        // number|null
              duration,   // number|null (calculateACWRがdurationを期待)
              load,       // number|null
            };
          })
          .filter(Boolean) ?? [];

      console.log('[useTeamACWR] normalizedRecords count:', normalizedRecords.length);
      if (normalizedRecords.length > 0) {
        console.log('[useTeamACWR] sample normalized:', normalizedRecords[0]);
      }

      // 3) 選手別にまとめる（filter連発より高速）
      const byAthlete: Record<string, any[]> = {};
      for (const r of normalizedRecords) {
        const id = r.user_id;
        if (!byAthlete[id]) byAthlete[id] = [];
        byAthlete[id].push(r);
      }

      // データ多い選手TOPを出す（ACWR確認用）
      const top10 = Object.entries(byAthlete)
        .map(([id, arr]) => [id, arr.length] as const)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
      console.log('[useTeamACWR] records per athlete TOP10:', top10);

      // 4) 選手ごとの ACWR 時系列
      const athleteACWRData: { [athleteId: string]: any[] } = {};

      for (const athleteId of athleteIds) {
        const athleteRecords = byAthlete[athleteId] || [];
        if (athleteRecords.length > 0) {
          const acwrArr = calculateACWR(athleteRecords);

          // 返ってくる date も YYYY-MM-DD に統一（ここがズレると team average が死ぬ）
          athleteACWRData[athleteId] = (acwrArr || [])
            .map((d: any) => ({
              ...d,
              date: toISODateString(d.date) ?? d.date,
            }))
            .filter((d: any) => d.date);

          if (athleteACWRData[athleteId].length > 0 && athleteId === top10?.[0]?.[0]) {
            console.log('[useTeamACWR] TOP1 athlete ACWR sample:', athleteACWRData[athleteId].slice(-5));
          }
        }
      }

      // 5) チーム平均 ACWR（日付一致が命）
      const teamAverages: TeamACWRData[] = [];

      const allDates = new Set<string>();
      normalizedRecords.forEach((r) => allDates.add(r.date));
      const sortedDates = Array.from(allDates).sort();

      for (const dateStr of sortedDates) {
        const dailyACWRs: number[] = [];

        for (const athleteId of athleteIds) {
          const athleteData = athleteACWRData[athleteId];
          if (!athleteData) continue;

          const dayData = athleteData.find((d: any) => d.date === dateStr);
          if (dayData && typeof dayData.acwr === 'number' && dayData.acwr > 0) {
            dailyACWRs.push(dayData.acwr);
          }
        }

        if (dailyACWRs.length > 0) {
          const averageACWR =
            dailyACWRs.reduce((sum, a) => sum + a, 0) / dailyACWRs.length;

          teamAverages.push({
            date: dateStr,
            averageACWR: Number(averageACWR.toFixed(2)),
            athleteCount: dailyACWRs.length,
            riskLevel: evalRisk(averageACWR),
          });
        }
      }

      console.log('[useTeamACWR] teamAverages points:', teamAverages.length);
      console.log('[useTeamACWR] teamAverages sample:', teamAverages.slice(-10));

      setTeamACWRData(teamAverages);

      // 6) 各選手の最新ACWR
      const acwrMap: AthleteACWRMap = {};
      for (const athleteId of athleteIds) {
        const dataArr = athleteACWRData[athleteId];
        if (dataArr && dataArr.length > 0) {
          const latest = dataArr[dataArr.length - 1];
          const latestACWR = typeof latest.acwr === 'number' ? latest.acwr : null;
          acwrMap[athleteId] = {
            latestACWR,
            riskLevel: evalRisk(latestACWR),
          };
        } else {
          acwrMap[athleteId] = {
            latestACWR: null,
            riskLevel: 'unknown',
          };
        }
      }
      setAthleteACWRMap(acwrMap);
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