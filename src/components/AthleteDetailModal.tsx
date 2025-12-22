import React, { useMemo, useState } from 'react';
import { X, Activity, Scale, BarChart2 } from 'lucide-react';
import { User } from '../lib/supabase';
import { useTrainingData } from '../hooks/useTrainingData';
import {
  ResponsiveContainer,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ComposedChart,
} from 'recharts';

interface AthleteDetailModalProps {
  athlete: User;
  onClose: () => void;
}

type TabKey = 'overview' | 'weight' | 'rpe';

// ✅ YYYY-MM-DD を安全に取り出す（JSTズレ回避のため Date に通さない）
function toYMD(v: any): string {
  if (!v) return '';
  if (typeof v === 'string') {
    // "2025-12-22" or "2025-12-22T..." なら確実にYMD化
    const s = v.includes('T') ? v.split('T')[0] : v;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  }
  // どうしても timestamp/object などの場合のみ Date を使う（最後の手段）
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function formatMD(ymd: string): string {
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return ymd || '';
  const mm = Number(m[2]);
  const dd = Number(m[3]);
  if (!Number.isFinite(mm) || !Number.isFinite(dd)) return ymd;
  return `${mm}/${dd}`;
}

export function AthleteDetailModal({ athlete, onClose }: AthleteDetailModalProps) {
  const { records, weightRecords, acwrData, loading } = useTrainingData(athlete.id);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  const latestACWR = acwrData.length > 0 ? acwrData[acwrData.length - 1] : null;
  const recentRecords = records.slice(-7);

  // ===== 体重データ =====
  const weightChartData = useMemo(() => {
    const source = Array.isArray(weightRecords) ? weightRecords : [];

    return source
      .map((r: any) => {
        const w = r.weight_kg ?? r.weight ?? r.body_weight ?? null;
        const ymd = toYMD(r.date);
        if (!ymd) return null;

        const n = w != null ? Number(w) : null;
        if (n == null || !Number.isFinite(n)) return null;

        return {
          rawDate: ymd,         // YYYY-MM-DD（比較キー）
          date: formatMD(ymd),  // 表示用（MM/DD）
          weight: n,
        };
      })
      .filter(Boolean) as { rawDate: string; date: string; weight: number }[];
  }, [weightRecords]);

  // ===== RPE / Load / ACWR（training_records + acwrData） =====
  const rpeLoadAcwrChartData = useMemo(() => {
    if (!Array.isArray(records) || records.length === 0) return [];

    // 日付 → ACWR のマップ（キーはYYYY-MM-DDで統一）
    const acwrMap: Record<string, number> = {};
    if (Array.isArray(acwrData)) {
      acwrData.forEach((d: any) => {
        const key = toYMD(d?.date);
        if (!key) return;

        const raw = d.acwr ?? d.ACWR ?? d.value ?? null;
        const v = raw != null ? Number(raw) : null;
        if (v != null && Number.isFinite(v)) acwrMap[key] = v;
      });
    }

    const result = records
      .map((r: any) => {
        const ymd = toYMD(r.date);
        if (!ymd) return null;

        const rpeValue = r.rpe ?? r.session_rpe ?? null;
        const durValue = r.duration_min ?? r.duration_minutes ?? r.duration ?? null;

        const rpe = rpeValue != null ? Number(rpeValue) : null;
        const duration = durValue != null ? Number(durValue) : null;

        let load: number | null = null;
        if (rpe != null && duration != null && Number.isFinite(rpe) && Number.isFinite(duration)) {
          load = rpe * duration;
        }

        const acwr = acwrMap[ymd] != null ? acwrMap[ymd] : null;

        // どれも無いなら除外
        if (load == null && acwr == null && rpe == null) return null;

        return {
          rawDate: ymd,
          date: formatMD(ymd),
          rpe: rpe != null && Number.isFinite(rpe) ? rpe : null,
          load,
          acwr,
        };
      })
      .filter(Boolean) as {
      rawDate: string;
      date: string;
      rpe: number | null;
      load: number | null;
      acwr: number | null;
    }[];

    // 日付順にソート
    result.sort((a, b) => (a.rawDate < b.rawDate ? -1 : a.rawDate > b.rawDate ? 1 : 0));

    console.log('[AthleteDetailModal] rpeLoadAcwrChartData sample:', result.slice(0, 5));
    return result;
  }, [records, acwrData]);

  // ===== weightタブ用（負荷 + 体重）にマージ =====
  const loadWeightMergedData = useMemo(() => {
    const map = new Map<string, any>();

    // まず training 側
    for (const r of rpeLoadAcwrChartData) {
      map.set(r.rawDate, { ...r });
    }

    // weight を上書き合体
    for (const w of weightChartData) {
      const prev = map.get(w.rawDate) ?? { rawDate: w.rawDate, date: w.date };
      map.set(w.rawDate, { ...prev, weight: w.weight, date: prev.date ?? w.date });
    }

    const arr = Array.from(map.values());
    arr.sort((a, b) => (a.rawDate < b.rawDate ? -1 : a.rawDate > b.rawDate ? 1 : 0));
    return arr;
  }, [rpeLoadAcwrChartData, weightChartData]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
      </div>
    );
  }

  const latestACWRDateLabel = latestACWR ? formatMD(toYMD(latestACWR.date)) : '';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* ヘッダー */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Activity className="w-5 h-5" />
              {athlete.nickname || athlete.name || '選手'}
            </h2>
            <p className="text-sm text-blue-100 mt-1">{athlete.email}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* タブ */}
        <div className="border-b border-gray-200 px-6 pt-3">
          <div className="flex gap-4 overflow-x-auto text-sm">
            <button
              onClick={() => setActiveTab('overview')}
              className={`pb-3 border-b-2 ${
                activeTab === 'overview'
                  ? 'border-blue-500 text-blue-600 font-semibold'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              概要
            </button>
            <button
              onClick={() => setActiveTab('weight')}
              className={`pb-3 border-b-2 flex items-center gap-1 ${
                activeTab === 'weight'
                  ? 'border-green-500 text-green-600 font-semibold'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Scale className="w-4 h-4" />
              体重推移
            </button>
            <button
              onClick={() => setActiveTab('rpe')}
              className={`pb-3 border-b-2 flex items-center gap-1 ${
                activeTab === 'rpe'
                  ? 'border-purple-500 text-purple-600 font-semibold'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <BarChart2 className="w-4 h-4" />
              RPE / 負荷 / ACWR
            </button>
          </div>
        </div>

        {/* 本体 */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* --- 概要タブ --- */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-blue-50 rounded-xl p-4">
                  <p className="text-xs text-blue-700 mb-1">最新 ACWR</p>
                  <p className="text-2xl font-bold text-blue-900">
                    {latestACWR?.acwr != null ? Number(latestACWR.acwr).toFixed(2) : '--'}
                  </p>
                  {latestACWR && (
                    <p className="text-xs text-blue-700 mt-1">{latestACWRDateLabel}</p>
                  )}
                </div>

                <div className="bg-green-50 rounded-xl p-4">
                  <p className="text-xs text-green-700 mb-1">直近7日間の記録数</p>
                  <p className="text-2xl font-bold text-green-900">{recentRecords.length}</p>
                </div>

                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs text-gray-700 mb-1">総セッション数</p>
                  <p className="text-2xl font-bold text-gray-900">{records.length}</p>
                </div>
              </div>
            </div>
          )}

          {/* --- 体重タブ --- */}
          {activeTab === 'weight' && (
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <Scale className="w-4 h-4 text-green-500" />
                体重推移 ＋ 負荷（RPE×時間）
              </h3>

              <p className="text-xs text-gray-500">
                体重：{weightChartData.length}件 / トレーニング：{rpeLoadAcwrChartData.length}件
              </p>

              {loadWeightMergedData.length === 0 ? (
                <p className="text-sm text-gray-500">データがまだありません。</p>
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={loadWeightMergedData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />

                      {/* 左：負荷 */}
                      <YAxis
                        yAxisId="left"
                        orientation="left"
                        tick={{ fontSize: 12 }}
                        tickFormatter={(v: number) => `${Math.round(v)}`}
                      />
                      {/* 右：体重 */}
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        tick={{ fontSize: 12 }}
                        tickFormatter={(v: number) => `${v.toFixed(1)}`}
                      />

                      <Tooltip
                        formatter={(value: any, name: any) => {
                          if (typeof value !== 'number') return value;
                          if (name === '体重') return [value.toFixed(1), name];
                          return [Math.round(value), name]; // 負荷
                        }}
                      />
                      <Legend />

                      <Bar
                        yAxisId="left"
                        dataKey="load"
                        name="負荷（RPE×時間）"
                        fill="#60a5fa"
                        opacity={0.85}
                      />

                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="weight"
                        name="体重"
                        stroke="#22c55e"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                        connectNulls
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}

              <p className="text-xs text-gray-500 leading-relaxed">
                ・青い棒：負荷（RPE×時間 or loadカラム）
                <br />
                ・緑の線：体重（kg）
                <br />
                ※ 日付はYYYY-MM-DDを文字列処理しているので、JSTでもズレません。
              </p>
            </div>
          )}

          {/* --- RPE / 負荷 / ACWR タブ --- */}
          {activeTab === 'rpe' && (
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-purple-500" />
                RPE・セッション負荷・ACWR
              </h3>

              <p className="text-xs text-gray-500">データ件数：{rpeLoadAcwrChartData.length} 件</p>

              {rpeLoadAcwrChartData.length === 0 ? (
                <p className="text-sm text-gray-500">
                  RPE または練習時間が記録されたデータがまだありません。
                </p>
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={rpeLoadAcwrChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />

                      {/* 左：負荷 */}
                      <YAxis
                        yAxisId="left"
                        orientation="left"
                        tick={{ fontSize: 12 }}
                        tickFormatter={(v: number) => `${Math.round(v)}`}
                      />
                      {/* 右：RPE/ACWR */}
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        tick={{ fontSize: 12 }}
                        domain={[0, 10]}
                        tickFormatter={(v: number) => v.toFixed(1)}
                      />

                      <Tooltip
                        formatter={(value: any, name: any) => {
                          if (typeof value !== 'number') return value;
                          if (name === 'ACWR') return [value.toFixed(2), name];
                          if (name === 'RPE') return [value.toFixed(1), name];
                          return [Math.round(value), name];
                        }}
                      />
                      <Legend />

                      <Bar
                        yAxisId="left"
                        dataKey="load"
                        name="負荷（RPE×時間）"
                        fill="#60a5fa"
                        opacity={0.85}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="rpe"
                        name="RPE"
                        stroke="#f97316"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                        connectNulls
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="acwr"
                        name="ACWR"
                        stroke="#a855f7"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                        connectNulls
                      />

                      <ReferenceLine
                        yAxisId="right"
                        y={0.8}
                        stroke="#22c55e"
                        strokeDasharray="4 4"
                        ifOverflow="extendDomain"
                      />
                      <ReferenceLine
                        yAxisId="right"
                        y={1.3}
                        stroke="#f97316"
                        strokeDasharray="4 4"
                        ifOverflow="extendDomain"
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}

              <p className="text-xs text-gray-500 leading-relaxed">
                ・棒：負荷（RPE × 練習時間 or load）
                <br />
                ・オレンジ：RPE（右軸）
                <br />
                ・紫：ACWR（右軸）
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}