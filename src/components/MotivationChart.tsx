import React, { useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Database } from '../lib/database.types';
import { Heart } from 'lucide-react';

type MotivationRecord = Database['public']['Tables']['motivation_records']['Row'];
type Period = '1w' | '2w' | '1m' | '3m' | 'all';

const PERIODS: { key: Period; label: string }[] = [
  { key: '1w', label: '1W' },
  { key: '2w', label: '2W' },
  { key: '1m', label: '1M' },
  { key: '3m', label: '3M' },
  { key: 'all', label: '全' },
];

type Metric = 'motivation' | 'energy' | 'stress';

const METRICS: { key: Metric; label: string; color: string }[] = [
  { key: 'motivation', label: '意欲', color: '#3b82f6' },
  { key: 'energy', label: '活力', color: '#10b981' },
  { key: 'stress', label: 'ストレス', color: '#ef4444' },
];

function getDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function periodToDays(period: Period): number | null {
  switch (period) {
    case '1w': return 7;
    case '2w': return 14;
    case '1m': return 30;
    case '3m': return 90;
    case 'all': return null;
  }
}

interface MotivationChartProps {
  data: MotivationRecord[];
}

export function MotivationChart({ data }: MotivationChartProps) {
  const [period, setPeriod] = useState<Period>('1m');
  const [activeMetrics, setActiveMetrics] = useState<Set<Metric>>(new Set(['motivation', 'energy', 'stress']));

  const toggleMetric = (metric: Metric) => {
    setActiveMetrics(prev => {
      const next = new Set(prev);
      if (next.has(metric)) {
        if (next.size <= 1) return prev;
        next.delete(metric);
      } else {
        next.add(metric);
      }
      return next;
    });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const chartData = useMemo(() => {
    const days = periodToDays(period);
    const startDate = days ? getDaysAgo(days) : null;

    return data
      .filter(r => !startDate || r.date >= startDate)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(record => ({
        date: record.date,
        motivation: record.motivation_level,
        energy: record.energy_level,
        stress: record.stress_level,
        displayDate: formatDate(record.date),
      }));
  }, [data, period]);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 sm:h-64 text-gray-400 dark:text-gray-500">
        <div className="text-center px-4">
          <Heart className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p className="text-sm">モチベーション記録を追加してグラフを表示しましょう</p>
        </div>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      return (
        <div className="bg-white dark:bg-gray-800 px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg text-xs">
          <p className="font-medium text-gray-900 dark:text-white mb-1">{d.displayDate}</p>
          {activeMetrics.has('motivation') && d.motivation != null && (
            <p className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-blue-500 rounded-full" />
              <span className="text-gray-600 dark:text-gray-300">意欲: <span className="font-semibold">{d.motivation}/10</span></span>
            </p>
          )}
          {activeMetrics.has('energy') && d.energy != null && (
            <p className="flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 bg-green-500 rounded-full" />
              <span className="text-gray-600 dark:text-gray-300">活力: <span className="font-semibold">{d.energy}/10</span></span>
            </p>
          )}
          {activeMetrics.has('stress') && d.stress != null && (
            <p className="flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 bg-red-500 rounded-full" />
              <span className="text-gray-600 dark:text-gray-300">ストレス: <span className="font-semibold">{d.stress}/10</span></span>
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div>
      {/* Period selector */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
          {PERIODS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setPeriod(key)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                period === key
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="text-xs text-gray-400 dark:text-gray-500">
          {chartData.length}日分
        </span>
      </div>

      {/* Metric chips */}
      <div className="flex gap-1.5 mb-3">
        {METRICS.map(({ key, label, color }) => (
          <button
            key={key}
            onClick={() => toggleMetric(key)}
            className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border transition-colors ${
              activeMetrics.has(key)
                ? 'border-current bg-opacity-10'
                : 'border-gray-200 dark:border-gray-600 text-gray-400 dark:text-gray-500'
            }`}
            style={activeMetrics.has(key) ? { color, borderColor: color, backgroundColor: `${color}15` } : {}}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: activeMetrics.has(key) ? color : '#d1d5db' }} />
            {label}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="w-full h-48 sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
            <XAxis
              dataKey="displayDate"
              tick={{ fontSize: 10, fill: '#9ca3af' }}
              interval={chartData.length > 14 ? Math.floor(chartData.length / 7) : 0}
            />
            <YAxis
              domain={[0, 10]}
              tick={{ fontSize: 10, fill: '#9ca3af' }}
              tickCount={6}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={5} stroke="#94a3b8" strokeDasharray="4 4" strokeWidth={1} />
            {activeMetrics.has('motivation') && (
              <Line
                type="monotone"
                dataKey="motivation"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ fill: '#3b82f6', r: chartData.length > 30 ? 0 : 3 }}
                activeDot={{ r: 5 }}
                connectNulls
              />
            )}
            {activeMetrics.has('energy') && (
              <Line
                type="monotone"
                dataKey="energy"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ fill: '#10b981', r: chartData.length > 30 ? 0 : 3 }}
                activeDot={{ r: 5 }}
                connectNulls
              />
            )}
            {activeMetrics.has('stress') && (
              <Line
                type="monotone"
                dataKey="stress"
                stroke="#ef4444"
                strokeWidth={2}
                dot={{ fill: '#ef4444', r: chartData.length > 30 ? 0 : 3 }}
                activeDot={{ r: 5 }}
                connectNulls
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
