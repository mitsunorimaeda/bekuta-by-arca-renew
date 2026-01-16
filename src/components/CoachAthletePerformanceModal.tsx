// src/components/CoachAthletePerformanceModal.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { X, TrendingUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { PerformanceChart } from './PerformanceChart';
import type { PersonalBest } from '../hooks/usePerformanceData';

type MetricKey = 'primary_value' | 'relative_1rm';

type TeamMonthlyPoint = {
  month_start: string; // 'YYYY-MM-DD'
  team_n: number | null;
  team_avg: number | null;
};

type TestTypeLite = {
  id: string;
  name: string;
  display_name: string;
  unit: string;
  higher_is_better: boolean | null;
};

type PerformanceRecordWithTestLite = {
  id: string;
  user_id: string;
  test_type_id: string;
  date: string;
  values: any;
  notes: string | null;
  test_type: TestTypeLite | null;
};

type Props = {
  open: boolean;
  onClose: () => void;

  teamId: string;
  athleteUserId: string;
  athleteName: string;

  testTypeId: string;
  testTypeDisplayName?: string;

  metricKey: MetricKey;
  unitLabel?: string;
};

const isFiniteNumber = (v: any) => typeof v === 'number' && Number.isFinite(v);

export function CoachAthletePerformanceModal({
  open,
  onClose,
  teamId,
  athleteUserId,
  athleteName,
  testTypeId,
  testTypeDisplayName,
  metricKey,
  unitLabel,
}: Props) {
  const [records, setRecords] = useState<PerformanceRecordWithTestLite[]>([]);
  const [teamMonthly, setTeamMonthly] = useState<TeamMonthlyPoint[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ----------------------------
  // Fetch: athlete records + team monthly (parallel)
  // ----------------------------
  useEffect(() => {
    if (!open) return;
    if (!athleteUserId || !testTypeId || !teamId) return;

    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const [recRes, teamRes] = await Promise.all([
          supabase
            .from('performance_records')
            .select(
              `
              id,
              user_id,
              test_type_id,
              date,
              values,
              notes,
              test_type:performance_test_types (
                id,
                name,
                display_name,
                unit,
                higher_is_better
              )
            `
            )
            .eq('user_id', athleteUserId)
            .eq('test_type_id', testTypeId)
            .order('date', { ascending: true }),

          supabase.rpc('get_team_monthly_latest', {
            p_team_id: teamId,
            p_test_type_id: testTypeId,
            p_metric: metricKey, // 'primary_value' | 'relative_1rm'
            p_months: 12,
          }),
        ]);

        if (recRes.error) throw recRes.error;
        if (teamRes.error) throw teamRes.error;

        if (cancelled) return;

        // records
        const rows = (recRes.data ?? []) as any[];
        const mapped: PerformanceRecordWithTestLite[] = rows.map((r) => ({
          id: r.id,
          user_id: r.user_id,
          test_type_id: r.test_type_id,
          date: r.date,
          values: r.values,
          notes: r.notes ?? '',
          test_type: r.test_type
            ? {
                id: r.test_type.id,
                name: r.test_type.name,
                display_name: r.test_type.display_name,
                unit: r.test_type.unit,
                higher_is_better: r.test_type.higher_is_better,
              }
            : null,
        }));
        setRecords(mapped);

        // team monthly
        const trows = (teamRes.data ?? []) as any[];
        const tMapped: TeamMonthlyPoint[] = trows.map((m) => ({
          month_start: String(m.month_start),
          team_n: m.team_n != null ? Number(m.team_n) : null,
          team_avg: m.team_avg != null ? Number(m.team_avg) : null,
        }));
        setTeamMonthly(tMapped);
      } catch (e: any) {
        console.error('[CoachAthletePerformanceModal] fetch error', e);
        if (!cancelled) setError(e?.message ?? '取得に失敗しました');
        if (!cancelled) {
          setRecords([]);
          setTeamMonthly([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, athleteUserId, testTypeId, teamId, metricKey]);

  // ----------------------------
  // Personal Best (computed locally)
  // ----------------------------
  const personalBest: PersonalBest | undefined = useMemo(() => {
    if (!records || records.length === 0) return undefined;

    const testType = records[0]?.test_type;
    const higherIsBetter = testType?.higher_is_better ?? true;

    const getMetric = (rec: PerformanceRecordWithTestLite): number | null => {
      const raw = metricKey === 'relative_1rm' ? rec.values?.relative_1rm : rec.values?.primary_value;
      const num = typeof raw === 'string' ? parseFloat(raw) : raw;
      return Number.isFinite(num) ? num : null;
    };

    let bestV: number | null = null;
    let bestDate: string | null = null;

    for (const r of records) {
      const v = getMetric(r);
      if (!isFiniteNumber(v)) continue;

      if (bestV == null) {
        bestV = v;
        bestDate = r.date;
        continue;
      }

      if (higherIsBetter ? v > bestV : v < bestV) {
        bestV = v;
        bestDate = r.date;
      }
    }

    if (bestV == null || !bestDate) return undefined;
    return { value: bestV, date: bestDate };
  }, [records, metricKey]);

  const title = testTypeDisplayName || records?.[0]?.test_type?.display_name || '推移';

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="absolute inset-0 flex items-center justify-center p-3 sm:p-6">
        <div className="w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl border border-gray-200">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                <div className="text-base sm:text-lg font-bold text-gray-900 truncate">
                  {athleteName || '選手'}：{title}
                </div>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                表示：{metricKey === 'relative_1rm' ? '相対（×BW）' : '通常'}
              </div>
            </div>

            <button
              onClick={onClose}
              className="shrink-0 inline-flex items-center justify-center rounded-lg border bg-white hover:bg-gray-50 w-10 h-10"
              aria-label="close"
              title="閉じる"
            >
              <X className="w-5 h-5 text-gray-700" />
            </button>
          </div>

          <div className="p-4 sm:p-6 overflow-y-auto max-h-[calc(90vh-72px)]">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
              </div>
            ) : error ? (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
                <div className="font-semibold mb-1">取得エラー</div>
                <div className="mb-3">{error}</div>
              </div>
            ) : (
              <PerformanceChart
                records={records as any}
                personalBest={personalBest}
                testTypeName={title}
                metricKey={metricKey}
                unitLabel={unitLabel}
                teamMonthly={teamMonthly}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default CoachAthletePerformanceModal;