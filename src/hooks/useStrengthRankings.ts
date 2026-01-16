import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

export type StrengthRankingRow = {
  user_id: string;
  display_name: string;
  date: string; // ISO (date)
  absolute_1rm: number | null;
  relative_1rm: number | null;
  weight_at_test: number | null;
};

type Metric = 'absolute' | 'relative';

export function useStrengthRankings(testTypeId: string | null, limit = 50) {
  const [rows, setRows] = useState<StrengthRankingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function run() {
      if (!testTypeId) {
        setRows([]);
        return;
      }
      setLoading(true);
      setError(null);

      const { data, error } = await supabase.rpc('get_my_team_strength_rankings', {
        p_test_type_id: testTypeId,
        p_limit: limit,
      });

      if (!mounted) return;

      if (error) {
        console.error('[get_my_team_strength_rankings]', error);
        setError(error.message);
        setRows([]);
      } else {
        setRows((data ?? []).map((d: any) => ({
          user_id: d.user_id,
          display_name: d.display_name,
          date: d.date,
          absolute_1rm: d.absolute_1rm !== null && d.absolute_1rm !== undefined ? Number(d.absolute_1rm) : null,
          relative_1rm: d.relative_1rm !== null && d.relative_1rm !== undefined ? Number(d.relative_1rm) : null,
          weight_at_test: d.weight_at_test !== null && d.weight_at_test !== undefined ? Number(d.weight_at_test) : null,
        })));
      }

      setLoading(false);
    }
    run();
    return () => {
      mounted = false;
    };
  }, [testTypeId, limit]);

  const getSorted = (metric: Metric) =>
    [...rows].sort((a, b) => {
      const av = metric === 'absolute' ? a.absolute_1rm : a.relative_1rm;
      const bv = metric === 'absolute' ? b.absolute_1rm : b.relative_1rm;
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      return bv - av; // 高いほど上
    });

  const sortedAbsolute = useMemo(() => getSorted('absolute'), [rows]);
  const sortedRelative = useMemo(() => getSorted('relative'), [rows]);

  return { rows, sortedAbsolute, sortedRelative, loading, error };
}
