import React, { useMemo, useState } from 'react';
import { X, Activity, Scale, BarChart2 } from 'lucide-react';
import { User } from '../lib/supabase';
import { useTrainingData } from '../hooks/useTrainingData';
import {
  ResponsiveContainer,
  LineChart,
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

// ===== RPE / 負荷 / ACWR 用カスタム Tooltip =====
const RpeAcwrTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || payload.length === 0) return null;

  const load = payload.find((p: any) => p.dataKey === 'load')?.value;
  const rpe = payload.find((p: any) => p.dataKey === 'rpe')?.value;
  const acwr = payload.find((p: any) => p.dataKey === 'acwr')?.value;

  return (
    <div className="bg-white/95 shadow-lg rounded-lg px-3 py-2 text-xs border border-gray-200">
      <p className="font-semibold text-gray-800 mb-1">{label}</p>
      {load != null && (
        <p className="text-blue-600">
          負荷: <span className="font-semibold">{Math.round(load)}</span>
        </p>
      )}
      {rpe != null && (
        <p className="text-orange-500">
          RPE: <span className="font-semibold">{rpe}</span>
        </p>
      )}
      {acwr != null && (
        <p className="text-purple-500">
          ACWR:{' '}
          <span className="font-semibold">
            {typeof acwr === 'number' ? acwr.toFixed(2) : acwr}
          </span>
        </p>
      )}
    </div>
  );
};

export function AthleteDetailModal({ athlete, onClose }: AthleteDetailModalProps) {
  const { records, weightRecords, acwrData, loading } = useTrainingData(athlete.id);

  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  const latestACWR = acwrData.length > 0 ? acwrData[acwrData.length - 1] : null;
  const recentRecords = records.slice(-7);

  // ===== 体重グラフ用データ =====
  const weightChartData = useMemo(() => {
    const source = Array.isArray(weightRecords) ? weightRecords : [];

    const mapped = source
      .map((r: any) => {
        const w = r.weight_kg ?? r.weight ?? r.body_weight ?? null;
        if (w == null || w === '' || Number.isNaN(Number(w))) return null;

        return {
          date: new Date(r.date).toLocaleDateString('ja-JP', {
            month: 'numeric',
            day: 'numeric',
          }),
          weight: Number(w),
        };
      })
      .filter((d) => d !== null) as { date: string; weight: number }[];

    return mapped;
  }, [weightRecords]);

  // ===== RPE / Load / ACWR 用データ =====
  const rpeLoadAcwrChartData = useMemo(() => {
    if (!Array.isArray(records) || records.length === 0) return [];

    try {
      // 日付 → ACWR のマップ
      const acwrMap: Record<string, number> = {};
      if (Array.isArray(acwrData)) {
        acwrData.forEach((d: any) => {
          const key = (d.date ?? '').split('T')[0];
          if (!key) return;
          const raw = d.acwr ?? d.ACWR ?? d.value ?? null;
          const v = raw != null ? Number(raw) : null;
          if (v != null && Number.isFinite(v)) {
            acwrMap[key] = v;
          }
        });
      }

      const result = records
        .map((r: any) => {
          const baseDate = (r.date ?? '').split('T')[0];

          const rpeValue = r.rpe ?? r.session_rpe ?? null;
          const durValue =
            r.duration_min ?? r.duration_minutes ?? r.duration ?? null;

          const rpe = rpeValue != null ? Number(rpeValue) : null;
          const duration = durValue != null ? Number(durValue) : null;

          let load: number | null = null;
          if (
            rpe != null &&
            duration != null &&
            Number.isFinite(rpe) &&
            Number.isFinite(duration)
          ) {
            load = rpe * duration;
          }

          const acwr =
            baseDate && acwrMap[baseDate] != null ? acwrMap[baseDate] : null;

          // どれも値がなければ除外
          if (load == null && acwr == null && rpe == null) return null;

          return {
            date: new Date(r.date).toLocaleDateString('ja-JP', {
              month: 'numeric',
              day: 'numeric',
            }),
            rpe: rpe != null && Number.isFinite(rpe) ? rpe : null,
            load,
            acwr,
          };
        })
        .filter((d) => d !== null) as {
        date: string;
        rpe: number | null;
        load: number | null;
        acwr: number | null;
      }[];

      console.log('[AthleteDetailModal] rpeLoadAcwrChartData sample:', result.slice(0, 5));
      return result;
    } catch (err) {
      console.error('🔥 rpeLoadAcwrChartData error:', err);
      return [];
    }
  }, [records, acwrData]);

  // Y軸スケールの目安を計算（右軸：RPE & ACWR）
  const { maxLoad, maxRight } = useMemo(() => {
    if (!rpeLoadAcwrChartData.length) {
      return { maxLoad: 0, maxRight: 0 };
    }
    let maxL = 0;
    let maxR = 0;
    rpeLoadAcwrChartData.forEach((d) => {
      if (d.load != null && d.load > maxL) maxL = d.load;
      if (d.rpe != null && d.rpe > maxR) maxR = d.rpe;
      if (d.acwr != null && d.acwr > maxR) maxR = d.acwr;
    });
    return { maxLoad: maxL, maxRight: maxR };
  }, [rpeLoadAcwrChartData]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
      </div>
    );
  }

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
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
          >
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
                    {latestACWR ? latestACWR.acwr?.toFixed(2) : '--'}
                  </p>
                  {latestACWR && (
                    <p className="text-xs text-blue-700 mt-1">
                      {new Date(latestACWR.date).toLocaleDateString('ja-JP')}
                    </p>
                  )}
                </div>
                <div className="bg-green-50 rounded-xl p-4">
                  <p className="text-xs text-green-700 mb-1">直近7日間の記録数</p>
                  <p className="text-2xl font-bold text-green-900">
                    {recentRecords.length}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs text-gray-700 mb-1">総セッション数</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {records.length}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* --- 体重タブ --- */}
          {activeTab === 'weight' && (
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <Scale className="w-4 h-4 text-green-500" />
                体重推移（weight_records ベース）
              </h3>

              {weightChartData.length === 0 ? (
                <p className="text-sm text-gray-500">
                  体重が登録された記録がまだありません。
                </p>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={weightChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis unit="kg" tick={{ fontSize: 12 }} domain={['auto', 'auto']} />
                      <Tooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="weight"
                        name="体重"
                        stroke="#22c55e"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* --- RPE / 負荷 / ACWR タブ --- */}
          {activeTab === 'rpe' && (
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-purple-500" />
                RPE・セッション負荷・ACWR
              </h3>

              <p className="text-xs text-gray-500">
                データ件数：{rpeLoadAcwrChartData.length} 件
              </p>

              {rpeLoadAcwrChartData.length === 0 ? (
                <p className="text-sm text-gray-500">
                  RPE または練習時間が記録されたデータがまだありません。
                </p>
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={rpeLoadAcwrChartData}
                      margin={{ top: 16, right: 32, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />

                      {/* 左Y軸：負荷 */}
                      <YAxis
                        yAxisId="left"
                        orientation="left"
                        tick={{ fontSize: 12 }}
                        domain={[0, maxLoad ? Math.ceil(maxLoad * 1.1) : 'auto']}
                        tickFormatter={(v: number) => `${v.toFixed(0)}`}
                      />

                      {/* 右Y軸：RPE & ACWR */}
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        tick={{ fontSize: 12 }}
                        domain={[0, maxRight ? Math.max(4, maxRight * 1.2) : 4]}
                      />

                      <Tooltip content={<RpeAcwrTooltip />} />
                      <Legend />

                      <Bar
                        yAxisId="left"
                        dataKey="load"
                        name="負荷（RPE×時間）"
                        fill="#60a5fa"
                        opacity={0.85}
                        barSize={16}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="rpe"
                        name="RPE"
                        stroke="#fb923c"
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

                      {/* ACWR 目安ライン 0.8 / 1.3 */}
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
                ・青い棒グラフ：負荷（RPE × 練習時間 or load カラム）
                <br />
                ・オレンジの線：RPE（主観的運動強度）
                <br />
                ・紫の線：ACWR（急性/慢性負荷比）
                <br />
                ※ いずれかの指標がない日はグラフに表示されません。
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}