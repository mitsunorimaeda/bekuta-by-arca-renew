import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';

interface RadarRow {
  category_name: string;
  category_display_name: string;
  avg_percentile: number;
  athlete_count: number;
  test_count: number;
}

export interface TeamCategoryDetail {
  categoryName: string;
  categoryDisplayName: string;
  avgPercentile: number;
  athleteCount: number;
  testCount: number;
}

export interface TeamRadarDataPoint {
  category: string;
  percentile: number;
  fullMark: 100;
}

export function useTeamRadar(teamId: string | null) {
  const [rows, setRows] = useState<RadarRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!teamId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error: rpcError } = await supabase.rpc('get_team_radar_percentiles', {
          p_team_id: teamId,
        });

        if (cancelled) return;
        if (rpcError) throw rpcError;

        setRows((data ?? []) as RadarRow[]);
      } catch (e: any) {
        console.error('[useTeamRadar error]', e);
        if (!cancelled) setError(e.message || 'チームレーダーデータの取得に失敗しました');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [teamId]);

  const categoryDetails = useMemo<TeamCategoryDetail[]>(() => {
    return rows.map((r) => ({
      categoryName: r.category_name,
      categoryDisplayName: r.category_display_name,
      avgPercentile: r.avg_percentile,
      athleteCount: r.athlete_count,
      testCount: r.test_count,
    }));
  }, [rows]);

  const radarData = useMemo<TeamRadarDataPoint[]>(() => {
    return rows.map((r) => ({
      category: r.category_display_name,
      percentile: r.avg_percentile,
      fullMark: 100 as const,
    }));
  }, [rows]);

  const overallScore = useMemo(() => {
    if (rows.length === 0) return null;
    const sum = rows.reduce((s, r) => s + r.avg_percentile, 0);
    return Math.round(sum / rows.length);
  }, [rows]);

  return { categoryDetails, radarData, overallScore, loading, error };
}
