// src/components/CoachAthletePerformanceModal.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { X } from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { buildPerfInsight, inferDirection } from "../lib/perfInsight";

type MetricKey = 'primary_value' | 'relative_1rm';

type Props = {
  open: boolean;
  onClose: () => void;
  teamId: string;
  athleteUserId: string;
  athleteName: string;
  testTypeId: string;
  metricKey: MetricKey;
};

type Point = {
  date: string; // YYYY-MM-DD
  value: number;
};

type TestTypeInfo = {
  id: string;
  display_name: string;
  unit: string;
  is_strength: boolean;
};

type Benchmark = {
  avg_value: number | null;
  p10: number | null;
  p90: number | null;
};

// ✅ 単位ベースで表示桁を決める（秒は必ず2桁）
const digitsForByUnit = (unit?: string) => {
  const u = (unit || '').trim();

  // 秒は 1/100 まで表示
  if (u === '秒' || u === 's' || u === 'sec') return 2;

  // 整数にしたい単位
  const intUnits = new Set(['回', '点']);
  if (intUnits.has(u)) return 0;

  // デフォルトは2桁
  return 2;
};

// ✅ ISO -> M/D
const formatJP = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${m}/${d}`;
};

export default function CoachAthletePerformanceModal({
  open,
  onClose,
  teamId,
  athleteUserId,
  athleteName,
  testTypeId,
  metricKey,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [testType, setTestType] = useState<TestTypeInfo | null>(null);
  const [series, setSeries] = useState<Point[]>([]);
  const [benchmark, setBenchmark] = useState<Benchmark | null>(null);

  const isStrength = !!testType?.is_strength;

  const metricLabel = !isStrength
    ? ''
    : metricKey === 'relative_1rm'
      ? '相対1RM'
      : '推定1RM';

  const unitLabel = useMemo(() => {
    if (!testType) return '';
    if (metricKey === 'relative_1rm') return '×BW';
    return testType.unit || '';
  }, [testType, metricKey]);

  // ✅ 表示フォーマッタ（モーダル内はこれ1本に統一）
  const fmtValue = useMemo(() => {
    const d = digitsForByUnit(unitLabel);
    return (v: number | null | undefined) => {
      if (v == null) return '—';
      const n = Number(v);
      if (!Number.isFinite(n)) return '—';
      if (d === 0) return String(Math.round(n));
      return n.toFixed(d);
    };
  }, [unitLabel]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setErr(null);

        // ① 種目情報
        const tt = await supabase
          .from('performance_test_types')
          .select('id, display_name, unit, is_strength')
          .eq('id', testTypeId)
          .single();

        if (tt.error) throw tt.error;
        if (!cancelled) setTestType(tt.data as any);

        // ② 選手の時系列（RPC）
        const { data: ts, error: tsErr } = await supabase.rpc('get_athlete_test_timeseries', {
          p_team_id: teamId,
          p_user_id: athleteUserId,
          p_test_type_id: testTypeId,
          p_metric: metricKey,
          p_days: 730,
        });
        if (tsErr) throw tsErr;

        const points: Point[] = (ts ?? [])
          .map((r: any) => ({
            date: r.date,
            value: Number(r.value),
          }))
          .filter((p: any) => p.date && Number.isFinite(p.value))
          .sort((a, b) => a.date.localeCompare(b.date));

        if (!cancelled) setSeries(points);

        // ③ チームベンチ（任意）
        const { data: b, error: bErr } = await supabase.rpc('get_my_team_benchmarks', {
          p_days: 90,
          p_metric: metricKey,
        });

        if (!bErr && b) {
          const row = Array.isArray(b) ? b[0] : b;
          const bm: Benchmark = {
            avg_value: row?.avg_value ?? row?.avg ?? null,
            p10: row?.p10 ?? null,
            p90: row?.p90 ?? null,
          };
          if (!cancelled) setBenchmark(bm);
        } else {
          if (!cancelled) setBenchmark(null);
        }
      } catch (e: any) {
        console.error('[CoachAthletePerformanceModal] error', e);
        if (!cancelled) {
          setErr(e?.message ?? '取得に失敗しました');
          setSeries([]);
          setBenchmark(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, teamId, athleteUserId, testTypeId, metricKey]);

  const last = series.length ? series[series.length - 1] : null;

  const insight = buildPerfInsight({
    athleteName,
    testDisplayName: testType?.display_name || "種目",
    latestValue: last?.value ?? null,
    prevValue: series.length >= 2 ? series[series.length - 2].value : null,
    unitLabel,
    direction: inferDirection(testType?.display_name || ""),
    teamAvg: benchmark?.avg_value ?? null,
    p10: benchmark?.p10 ?? null,
    p90: benchmark?.p90 ?? null,
    teamRank: null,
    teamN: null,
    topPercent: null,
  });

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="px-5 py-4 border-b flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm text-gray-500">成長グラフ</div>
            <div className="text-lg font-bold text-gray-900 truncate">
              {athleteName} / {testType?.display_name || '種目'}{metricLabel ? `（${metricLabel}）` : ''}
            </div>
            <div className="text-xs text-gray-600 mt-1">
              最新：{last ? `${last.date} / ${fmtValue(last.value)} ${unitLabel}` : '—'}
            </div>
          </div>

          <button
            className="p-2 rounded-lg hover:bg-gray-100"
            onClick={onClose}
            aria-label="close"
            title="閉じる"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* body */}
        <div className="p-5 space-y-4">
          {err && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {err}
            </div>
          )}

          {/* ✅ 内部コメント（MVP） */}
          {insight && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div className="text-sm font-semibold text-gray-900">{insight.title}</div>

              <ul className="mt-2 space-y-1 text-sm text-gray-800 list-disc pl-5">
                {insight.bullets.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>

              {insight.nextActions.length > 0 && (
                <>
                  <div className="mt-3 text-xs font-semibold text-gray-700">次の一手</div>
                  <ul className="mt-1 space-y-1 text-sm text-gray-800 list-disc pl-5">
                    {insight.nextActions.map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                </>
              )}

              {insight.note && <div className="mt-2 text-xs text-gray-500">{insight.note}</div>}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
            </div>
          ) : series.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-500">この種目の記録がありません</div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickFormatter={formatJP} minTickGap={18} />
                  <YAxis />
                  <Tooltip
                    formatter={(v: any) => `${fmtValue(Number(v))} ${unitLabel}`}
                    labelFormatter={(l: any) => `日付: ${l}`}
                  />
                  {benchmark?.avg_value != null && (
                    <ReferenceLine
                      y={benchmark.avg_value}
                      strokeDasharray="6 4"
                      label={{ value: 'チーム平均', position: 'insideTopRight' }}
                    />
                  )}
                  {benchmark?.p10 != null && <ReferenceLine y={benchmark.p10} strokeDasharray="2 6" />}
                  {benchmark?.p90 != null && <ReferenceLine y={benchmark.p90} strokeDasharray="2 6" />}
                  <Line type="monotone" dataKey="value" strokeWidth={3} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* list */}
          {series.length > 0 && (
            <div className="border rounded-xl overflow-hidden">
              <div className="px-4 py-2 bg-gray-50 text-xs text-gray-600 flex justify-between">
                <span>日付</span>
                <span>値（{unitLabel || '-'}）</span>
              </div>
              <div className="max-h-48 overflow-auto divide-y">
                {series
                  .slice()
                  .reverse()
                  .map((p) => (
                    <div key={p.date} className="px-4 py-2 text-sm flex justify-between">
                      <span className="text-gray-700">{p.date}</span>
                      <span className="font-semibold text-gray-900">{fmtValue(p.value)}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

         
        </div>
      </div>
    </div>
  );
}