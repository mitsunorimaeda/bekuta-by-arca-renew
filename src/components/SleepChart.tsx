import React, { useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Database } from '../lib/database.types';
import { Moon } from 'lucide-react';

type SleepRecord = Database['public']['Tables']['sleep_records']['Row'];
type Period = '1w' | '2w' | '1m' | '3m' | 'all';

const PERIODS: { key: Period; label: string }[] = [
  { key: '1w', label: '1W' },
  { key: '2w', label: '2W' },
  { key: '1m', label: '1M' },
  { key: '3m', label: '3M' },
  { key: 'all', label: '全' },
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

interface SleepChartProps {
  data: SleepRecord[];
}

export function SleepChart({ data }: SleepChartProps) {
  const [period, setPeriod] = useState<Period>('1m');

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
        sleepHours: Number(record.sleep_hours),
        sleepQuality: record.sleep_quality,
        displayDate: formatDate(record.date),
      }));
  }, [data, period]);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 sm:h-64 text-gray-400 dark:text-gray-500">
        <div className="text-center px-4">
          <Moon className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p className="text-sm">睡眠記録を追加してグラフを表示しましょう</p>
        </div>
      </div>
    );
  }

  const avgSleep = chartData.length > 0
    ? (chartData.reduce((s, d) => s + d.sleepHours, 0) / chartData.length).toFixed(1)
    : '-';

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      return (
        <div className="bg-white dark:bg-gray-800 px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg text-xs">
          <p className="font-medium text-gray-900 dark:text-white mb-1">{d.displayDate}</p>
          <p className="flex items-center gap-1.5">
            <span className="w-2 h-2 bg-indigo-500 rounded-full" />
            <span className="text-gray-600 dark:text-gray-300">睡眠: <span className="font-semibold">{d.sleepHours}h</span></span>
          </p>
          {d.sleepQuality != null && (
            <p className="flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 bg-amber-500 rounded-full" />
              <span className="text-gray-600 dark:text-gray-300">質: <span className="font-semibold">{d.sleepQuality}/5</span></span>
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div>
      {/* Period selector + info */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
          {PERIODS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setPeriod(key)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                period === key
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="text-xs text-gray-400 dark:text-gray-500">
          平均 {avgSleep}h · {chartData.length}日分
        </span>
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
              domain={[0, 12]}
              tick={{ fontSize: 10, fill: '#9ca3af' }}
              tickCount={5}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={7} stroke="#10b981" strokeDasharray="4 4" strokeWidth={1} />
            <ReferenceLine y={9} stroke="#3b82f6" strokeDasharray="4 4" strokeWidth={1} />
            <Line
              type="monotone"
              dataKey="sleepHours"
              stroke="#6366f1"
              strokeWidth={2}
              dot={{ fill: '#6366f1', r: chartData.length > 30 ? 0 : 3 }}
              activeDot={{ r: 5, fill: '#6366f1' }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-2 text-[10px] text-gray-400">
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-green-500 inline-block" /> 推奨最低 7h</span>
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-blue-500 inline-block" /> 理想 9h</span>
      </div>
    </div>
  );
}
