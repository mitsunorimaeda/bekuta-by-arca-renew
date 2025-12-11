// src/hooks/useTeamACWR.ts
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { calculateACWR } from '../lib/acwr';

export interface TeamACWRData {
  date: string;
  averageACWR: number;
  athleteCount: number;
  riskLevel: string;
}

export interface AthleteACWRInfo {
  latestACWR: number | null;
  riskLevel: string; // 'high' | 'caution' | 'good' | 'low' | 'unknown'
}

export type AthleteACWRMap = Record<string, AthleteACWRInfo>;

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

      const athleteIds = athletes.map((athlete) => athlete.id);
      console.log('[useTeamACWR] athleteIds:', athleteIds);

      // 2) その選手たちの training_records 取得
      const { data: records, error: recordsError } = await supabase
        .from('training_records')
        .select('user_id,date,rpe,duration_min,load')
        .in('user_id', athleteIds)
        .order('date', { ascending: true });

      if (recordsError) throw recordsError;

      console.log(
        '[useTeamACWR] training_records count:',
        records ? records.length : 0
      );

      const normalizedRecords =
        (records || []).map((r) => ({
          ...r,
          // duration_min を duration にマッピング（calculateACWR が duration を期待している場合用）
          duration: r.duration_min,
          // load が無い場合は rpe × duration_min で計算
          load:
            r.load ??
            (r.rpe != null && r.duration_min != null
              ? r.rpe * r.duration_min
              : null),
        })) ?? [];

      console.log(
        '[useTeamACWR] normalizedRecords count:',
        normalizedRecords.length
      );

      // 3) 選手ごとの ACWR 時系列
      const athleteACWRData: { [athleteId: string]: any[] } = {};

      for (const athleteId of athleteIds) {
        const athleteRecords =
          normalizedRecords.filter((r) => r.user_id === athleteId) || [];
        if (athleteRecords.length > 0) {
          athleteACWRData[athleteId] = calculateACWR(athleteRecords);
        }
      }

      // 4) チーム平均 ACWR（既存ロジック）
      const teamAverages: TeamACWRData[] = [];

      const allDates = new Set<string>();
      normalizedRecords.forEach((record) => {
        allDates.add(record.date);
      });

      const sortedDates = Array.from(allDates).sort();

      sortedDates.forEach((dateStr) => {
        const dailyACWRs: number[] = [];

        for (const athleteId of athleteIds) {
          const athleteData = athleteACWRData[athleteId];
          if (athleteData) {
            const dayData = athleteData.find((d: any) => d.date === dateStr);
            if (dayData && dayData.acwr > 0) {
              dailyACWRs.push(dayData.acwr);
            }
          }
        }

        if (dailyACWRs.length > 0) {
          const averageACWR =
            dailyACWRs.reduce((sum, acwr) => sum + acwr, 0) /
            dailyACWRs.length;

          const riskLevel = evalRisk(averageACWR);

          teamAverages.push({
            date: dateStr,
            averageACWR: Number(averageACWR.toFixed(2)),
            athleteCount: dailyACWRs.length,
            riskLevel,
          });
        }
      });

      console.log('[useTeamACWR] teamAverages:', teamAverages);

      setTeamACWRData(teamAverages);

      // 5) 各選手の「最新ACWR & リスク」を map にまとめる
      const acwrMap: AthleteACWRMap = {};

      for (const athleteId of athleteIds) {
        const dataArr = athleteACWRData[athleteId];
        if (dataArr && dataArr.length > 0) {
          const latest = dataArr[dataArr.length - 1];
          const latestACWR =
            typeof latest.acwr === 'number' ? latest.acwr : null;
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

  return {
    teamACWRData,
    athleteACWRMap,
    loading,
  };
}