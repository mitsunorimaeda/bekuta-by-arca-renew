import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';

interface MatrixRow {
  user_id: string;
  user_name: string;
  category_name: string;
  category_display_name: string;
  avg_percentile: number;
  test_count: number;
}

export interface MatrixAthlete {
  userId: string;
  name: string;
}

export interface MatrixCategory {
  name: string;
  displayName: string;
}

export function useTeamPercentileMatrix(teamId: string | null) {
  const [rows, setRows] = useState<MatrixRow[]>([]);
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
        const { data, error: rpcError } = await supabase.rpc('get_team_percentile_matrix', {
          p_team_id: teamId,
        });

        if (cancelled) return;
        if (rpcError) throw rpcError;

        setRows((data ?? []) as MatrixRow[]);
      } catch (e: any) {
        console.error('[useTeamPercentileMatrix error]', e);
        if (!cancelled) setError(e.message || 'マトリクスデータの取得に失敗しました');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [teamId]);

  const athletes = useMemo<MatrixAthlete[]>(() => {
    const seen = new Map<string, string>();
    for (const r of rows) {
      if (!seen.has(r.user_id)) {
        seen.set(r.user_id, r.user_name);
      }
    }
    return Array.from(seen.entries()).map(([userId, name]) => ({ userId, name }));
  }, [rows]);

  const categories = useMemo<MatrixCategory[]>(() => {
    const seen = new Map<string, string>();
    for (const r of rows) {
      if (!seen.has(r.category_name)) {
        seen.set(r.category_name, r.category_display_name);
      }
    }
    return Array.from(seen.entries()).map(([name, displayName]) => ({ name, displayName }));
  }, [rows]);

  // userId -> categoryName -> percentile
  const matrix = useMemo<Record<string, Record<string, number>>>(() => {
    const m: Record<string, Record<string, number>> = {};
    for (const r of rows) {
      if (!m[r.user_id]) m[r.user_id] = {};
      m[r.user_id][r.category_name] = r.avg_percentile;
    }
    return m;
  }, [rows]);

  return { athletes, categories, matrix, loading, error };
}
