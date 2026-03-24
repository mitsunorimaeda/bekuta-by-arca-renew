// src/components/TeamACWRChart.tsx
import React, { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
  Bar,
  ComposedChart,
} from 'recharts';
import { getRiskColor } from '../lib/acwr';

interface TeamACWRData {
  date: string;
  averageACWR: number;
  athleteCount: number;
  riskLevel: string;
  averageRPE?: number | null;
  avg_rpe?: number | null;
  rpe_avg?: number | null;
  averageLoad?: number | null;
  avg_load?: number | null;
  load_avg?: number | null;
  rosterCount?: number | null;
}

interface TeamACWRChartProps {
  data: TeamACWRData[];
  teamName: string;
  showAvgRPE?: boolean;
  showAvgLoad?: boolean;
}

type TrendPeriod = '1w' | '2w' | '1m' | '3m' | 'all';
type TrendMetric = 'acwr' | 'rpe' | 'load' | 'duration' | 'arrow' | 'signal';

const pickAvgRPE = (d: TeamACWRData) => d.averageRPE ?? d.avg_rpe ?? d.rpe_avg ?? null;
const pickAvgLoad = (d: TeamACWRData) => d.averageLoad ?? d.avg_load ?? d.load_avg ?? null;

export function TeamACWRChart({
  data,
  teamName,
  showAvgRPE = true,
  showAvgLoad = false,
}: TeamACWRChartProps) {
  const [period, setPeriod] = useState<TrendPeriod>('1m');
  const [metrics, setMetrics] = useState<Set<TrendMetric>>(() => {
    const initial = new Set<TrendMetric>(['acwr']);
    if (showAvgRPE) initial.add('rpe');
    if (showAvgLoad) initial.add('load');
    return initial;
  });

  const toggleMetric = (metric: TrendMetric) => {
    setMetrics(prev => {
      const next = new Set(prev);
      if (next.has(metric)) {
        if (next.size <= 1) return prev;
        next.delete(metric);
      } else {
        if (next.size >= 3) return prev;
        next.add(metric);
      }
      return next;
    });
  };

  // 期間フィルタ
  const filteredData = useMemo(() => {
    if (!data || data.length === 0) return [];
    if (period === 'all') return data;

    const daysMap: Record<string, number> = { '1w': 7, '2w': 14, '1m': 30, '3m': 90 };
    const days = daysMap[period] || 30;
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days);

    return data.filter((item) => new Date(item.date) >= startDate);
  }, [data, period]);

  // chartData正規化
  const chartData = useMemo(() => {
    return (filteredData || [])
      .filter((d: any) => d && typeof d.date === 'string' && typeof d.averageACWR === 'number' && Number.isFinite(d.averageACWR))
      .map((d) => {
        const safeNum = (v: any) => typeof v === 'number' && Number.isFinite(v) ? v : null;
        return {
          ...d,
          averageACWR: Math.max(0, d.averageACWR),
          avgRPE: safeNum(pickAvgRPE(d)),
          avgLoad: safeNum(pickAvgLoad(d)),
          avgDuration: safeNum((d as any).averageDuration),
          avgArrow: safeNum((d as any).averageArrowScore),
          avgSignal: safeNum((d as any).averageSignalScore),
        };
      });
  }, [filteredData]);

  const hasRPE = useMemo(() => chartData.some((d: any) => typeof d.avgRPE === 'number'), [chartData]);
  const hasLoad = useMemo(() => chartData.some((d: any) => typeof d.avgLoad === 'number'), [chartData]);
  const hasDuration = useMemo(() => chartData.some((d: any) => typeof d.avgDuration === 'number'), [chartData]);
  const hasArrow = useMemo(() => chartData.some((d: any) => typeof d.avgArrow === 'number'), [chartData]);
  const hasSignal = useMemo(() => chartData.some((d: any) => typeof d.avgSignal === 'number'), [chartData]);

  // 軸グループ:
  // 左軸 = ACWR, RPE, 成長実感, 理解度（0-10スケール）
  // 右軸 = 負荷, 時間（大きい数値）
  const hasLeftMetrics = metrics.has('acwr') || metrics.has('rpe') || metrics.has('arrow') || metrics.has('signal');
  const hasRightMetrics = metrics.has('load') || metrics.has('duration');

  const axisDomains = useMemo(() => {
    let leftMax = 2;
    if (metrics.has('acwr')) {
      const maxA = Math.max(0, ...chartData.map((d: any) => d.averageACWR ?? 0));
      leftMax = Math.max(leftMax, maxA);
    }
    if (metrics.has('rpe') || metrics.has('arrow') || metrics.has('signal')) leftMax = Math.max(leftMax, 10);

    let rightMax = 100;
    if (metrics.has('load')) rightMax = Math.max(rightMax, ...chartData.map((d: any) => d.avgLoad ?? 0));
    if (metrics.has('duration')) rightMax = Math.max(rightMax, ...chartData.map((d: any) => d.avgDuration ?? 0));

    return {
      leftDomain: [0, Math.ceil(leftMax * 1.2)] as [number, number],
      rightDomain: [0, Math.ceil(rightMax * 1.1)] as [number, number],
    };
  }, [chartData, metrics]);

  if (!data || data.length === 0 || chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <div className="text-center px-4">
          <p className="text-base mb-2">データがありません</p>
          <p className="text-sm">選手の練習記録が蓄積されると表示されます</p>
        </div>
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const formatDateWithDay = (dateStr: string) => {
    const date = new Date(dateStr);
    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    return `${date.getMonth() + 1}/${date.getDate()}(${dayNames[date.getDay()]})`;
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const row = payload?.[0]?.payload;
      const date = new Date(label);
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;

      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg max-w-xs">
          <div className="flex items-center gap-2 mb-2">
            <p className="font-medium text-gray-900 text-sm">{formatDateWithDay(label)}</p>
            {isWeekend && (
              <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full text-xs font-medium">週末</span>
            )}
          </div>
          <div className="space-y-1 text-xs">
            {metrics.has('acwr') && (
              <p className="flex justify-between gap-4">
                <span>平均ACWR:</span>
                <span className="font-semibold" style={{ color: getRiskColor(row?.riskLevel) }}>
                  {typeof row?.averageACWR === 'number' ? row.averageACWR.toFixed(2) : '-'}
                </span>
              </p>
            )}
            {metrics.has('rpe') && (
              <p className="flex justify-between gap-4">
                <span>平均RPE:</span>
                <span className="font-semibold">{typeof row?.avgRPE === 'number' ? row.avgRPE.toFixed(1) : '-'}</span>
              </p>
            )}
            {metrics.has('load') && (
              <p className="flex justify-between gap-4">
                <span>平均負荷:</span>
                <span className="font-semibold">{typeof row?.avgLoad === 'number' ? Math.round(row.avgLoad) : '-'}</span>
              </p>
            )}
            {metrics.has('duration') && (
              <p className="flex justify-between gap-4">
                <span>平均時間:</span>
                <span className="font-semibold">{typeof row?.avgDuration === 'number' ? `${Math.round(row.avgDuration)}分` : '-'}</span>
              </p>
            )}
            {metrics.has('arrow') && (
              <p className="flex justify-between gap-4">
                <span>成長実感:</span>
                <span className="font-semibold">{typeof row?.avgArrow === 'number' ? row.avgArrow.toFixed(1) : '-'}</span>
              </p>
            )}
            {metrics.has('signal') && (
              <p className="flex justify-between gap-4">
                <span>理解度:</span>
                <span className="font-semibold">{typeof row?.avgSignal === 'number' ? row.avgSignal.toFixed(1) : '-'}</span>
              </p>
            )}
            <p className="flex justify-between gap-4">
              <span>対象:</span>
              <span className="font-semibold">{row?.athleteCount}{row?.rosterCount ? ` / ${row.rosterCount}` : ''}名</span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  const CustomDot = (props: any) => {
    const { cx, cy, payload } = props;
    if (cx && cy && payload) {
      const date = new Date(payload.date);
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      return (
        <circle
          cx={cx} cy={cy}
          r={isWeekend ? 5 : 4}
          fill={getRiskColor(payload.riskLevel)}
          strokeWidth={2}
          stroke={isWeekend ? '#8B5CF6' : 'white'}
          opacity={isWeekend ? 0.9 : 1}
        />
      );
    }
    return null;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5">
      {/* ヘッダー */}
      <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white mb-3">
        <span className="hidden sm:inline">{teamName} - </span>チーム推移
      </h3>

      {/* 期間セレクター（セグメントコントロール） */}
      <div className="flex rounded-lg bg-gray-100 dark:bg-gray-700 p-0.5 mb-3">
        {([
          { key: '1w' as TrendPeriod, label: '1W' },
          { key: '2w' as TrendPeriod, label: '2W' },
          { key: '1m' as TrendPeriod, label: '1M' },
          { key: '3m' as TrendPeriod, label: '3M' },
          { key: 'all' as TrendPeriod, label: '全' },
        ]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setPeriod(key)}
            className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-all ${
              period === key
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 指標トグルチップ */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {([
          { key: 'acwr' as TrendMetric, label: 'ACWR', color: '#8B5CF6', bgA: 'bg-purple-100', textA: 'text-purple-700', borderA: 'border-purple-300', available: true },
          { key: 'rpe' as TrendMetric, label: 'RPE', color: '#0EA5E9', bgA: 'bg-sky-100', textA: 'text-sky-700', borderA: 'border-sky-300', available: hasRPE },
          { key: 'load' as TrendMetric, label: '負荷', color: '#22C55E', bgA: 'bg-green-100', textA: 'text-green-700', borderA: 'border-green-300', available: hasLoad },
          { key: 'duration' as TrendMetric, label: '時間', color: '#06b6d4', bgA: 'bg-cyan-100', textA: 'text-cyan-700', borderA: 'border-cyan-300', available: hasDuration },
          { key: 'arrow' as TrendMetric, label: '成長実感', color: '#f59e0b', bgA: 'bg-amber-100', textA: 'text-amber-700', borderA: 'border-amber-300', available: hasArrow },
          { key: 'signal' as TrendMetric, label: '理解度', color: '#ec4899', bgA: 'bg-pink-100', textA: 'text-pink-700', borderA: 'border-pink-300', available: hasSignal },
        ]).map(({ key, label, color, bgA, textA, borderA, available }) => {
          const isActive = metrics.has(key);
          return (
            <button
              key={key}
              onClick={() => available && toggleMetric(key)}
              disabled={!available}
              className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border transition-all ${
                !available
                  ? 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed'
                  : isActive
                  ? `${bgA} ${textA} ${borderA} font-medium`
                  : 'bg-white dark:bg-gray-700 text-gray-400 border-gray-200 dark:border-gray-600 hover:border-gray-300'
              }`}
            >
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: available && isActive ? color : '#d1d5db' }} />
              {label}
            </button>
          );
        })}
      </div>

      {/* グラフ */}
      <div className="h-64 sm:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 5, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" opacity={0.5} />
            <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 10 }} interval="preserveStartEnd" />

            {/* 左軸: ACWR + RPE（小さい数値 0-10） */}
            <YAxis
              yAxisId="left"
              orientation="left"
              tick={{ fontSize: 10 }}
              domain={hasLeftMetrics ? axisDomains.leftDomain : [0, 10]}
              tickFormatter={(v: number) => v >= 10 ? `${Math.round(v)}` : v.toFixed(1)}
              width={35}
              hide={!hasLeftMetrics}
            />

            {/* 右軸: Load（大きい数値） */}
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 10 }}
              domain={hasRightMetrics ? axisDomains.rightDomain : [0, 100]}
              tickFormatter={(v: number) => `${Math.round(v)}`}
              width={40}
              hide={!hasRightMetrics}
            />

            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 10 }} />

            {/* ACWR リファレンスライン */}
            {metrics.has('acwr') && (
              <>
                <ReferenceLine yAxisId="left" y={1.5} stroke="#EF4444" strokeDasharray="4 4" strokeWidth={1} />
                <ReferenceLine yAxisId="left" y={1.3} stroke="#F59E0B" strokeDasharray="4 4" strokeWidth={1} />
                <ReferenceLine yAxisId="left" y={0.8} stroke="#10B981" strokeDasharray="4 4" strokeWidth={1} />
              </>
            )}

            {/* ACWR → 左軸 */}
            {metrics.has('acwr') && (
              <Line
                type="monotone"
                dataKey="averageACWR"
                name="ACWR"
                yAxisId="left"
                stroke="#8B5CF6"
                strokeWidth={2.5}
                dot={<CustomDot />}
                activeDot={{ r: 6, stroke: '#8B5CF6', strokeWidth: 2, fill: 'white' }}
                connectNulls
              />
            )}

            {/* RPE → 左軸（ACWRと同スケール 0-10） */}
            {metrics.has('rpe') && hasRPE && (
              <Line
                type="monotone"
                dataKey="avgRPE"
                name="RPE"
                yAxisId="left"
                stroke="#0EA5E9"
                strokeWidth={2}
                dot={{ r: 2, fill: '#0EA5E9' }}
                activeDot={{ r: 4 }}
                connectNulls
              />
            )}

            {/* 負荷 → 右軸（大きい数値） */}
            {metrics.has('load') && hasLoad && (
              <Bar
                dataKey="avgLoad"
                name="負荷"
                yAxisId="right"
                fill="#22C55E"
                opacity={0.5}
                radius={[2, 2, 0, 0]}
              />
            )}

            {/* 時間 → 右軸（大きい数値） */}
            {metrics.has('duration') && hasDuration && (
              <Line
                type="monotone"
                dataKey="avgDuration"
                name="時間"
                yAxisId="right"
                stroke="#06b6d4"
                strokeWidth={2}
                dot={{ r: 2, fill: '#06b6d4' }}
                activeDot={{ r: 4 }}
                connectNulls
              />
            )}

            {/* 成長実感 → 左軸（0-10スケール） */}
            {metrics.has('arrow') && hasArrow && (
              <Line
                type="monotone"
                dataKey="avgArrow"
                name="成長実感"
                yAxisId="left"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={{ r: 2, fill: '#f59e0b' }}
                activeDot={{ r: 4 }}
                connectNulls
              />
            )}

            {/* 理解度 → 左軸（0-10スケール） */}
            {metrics.has('signal') && hasSignal && (
              <Line
                type="monotone"
                dataKey="avgSignal"
                name="理解度"
                yAxisId="left"
                stroke="#ec4899"
                strokeWidth={2}
                dot={{ r: 2, fill: '#ec4899' }}
                activeDot={{ r: 4 }}
                connectNulls
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* データ情報 + 凡例 */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-gray-400">{chartData.length}日分 | {metrics.size}項目選択中</p>
        <div className="flex flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 bg-red-500 rounded-full" /> &gt;1.5
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 bg-yellow-500 rounded-full" /> 1.3-1.5
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 bg-green-500 rounded-full" /> 0.8-1.3
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 bg-blue-500 rounded-full" /> &lt;0.8
          </div>
        </div>
      </div>
    </div>
  );
}
