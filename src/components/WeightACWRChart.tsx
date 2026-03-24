import React, { useMemo, useState } from 'react';
import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { ACWRData } from '../lib/acwr';
import { Database } from '../lib/database.types';

type WeightRecord = Database['public']['Tables']['weight_records']['Row'];
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

interface WeightACWRChartProps {
  acwrData: ACWRData[];
  weightData: WeightRecord[];
}

export function WeightACWRChart({ acwrData, weightData }: WeightACWRChartProps) {
  const [period, setPeriod] = useState<Period>('1m');

  const combinedData = useMemo(() => {
    const days = periodToDays(period);
    const startDate = days ? getDaysAgo(days) : null;

    return acwrData
      .filter(a => !startDate || a.date >= startDate)
      .map(acwr => {
        const matchingWeight = weightData.find(w => w.date === acwr.date);
        return {
          date: acwr.date,
          displayDate: (() => {
            const d = new Date(acwr.date + 'T00:00:00');
            return `${d.getMonth() + 1}/${d.getDate()}`;
          })(),
          acwr: acwr.acwr != null ? Number(acwr.acwr) : null,
          weight: matchingWeight ? Number(matchingWeight.weight_kg) : null,
        };
      });
  }, [acwrData, weightData, period]);

  if (acwrData.length === 0 && weightData.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 sm:h-64 text-gray-400 dark:text-gray-500">
        <p className="text-sm">データがありません</p>
      </div>
    );
  }

  // Weight axis domain
  const weights = combinedData.map(d => d.weight).filter((w): w is number => w != null);
  const weightMin = weights.length > 0 ? Math.floor(Math.min(...weights) - 2) : 40;
  const weightMax = weights.length > 0 ? Math.ceil(Math.max(...weights) + 2) : 100;

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      return (
        <div className="bg-white dark:bg-gray-800 px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg text-xs">
          <p className="font-medium text-gray-900 dark:text-white mb-1">{d.displayDate}</p>
          {d.acwr != null && (
            <p className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-blue-500 rounded-full" />
              <span className="text-gray-600 dark:text-gray-300">ACWR: <span className="font-semibold">{d.acwr.toFixed(2)}</span></span>
            </p>
          )}
          {d.weight != null && (
            <p className="flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 bg-green-500 rounded-full" />
              <span className="text-gray-600 dark:text-gray-300">体重: <span className="font-semibold">{d.weight.toFixed(1)}kg</span></span>
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
      <div className="flex items-center justify-between mb-3">
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
          {combinedData.length}日分
        </span>
      </div>

      {/* Chart */}
      <div className="w-full h-48 sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={combinedData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
            <XAxis
              dataKey="displayDate"
              tick={{ fontSize: 10, fill: '#9ca3af' }}
              interval={combinedData.length > 14 ? Math.floor(combinedData.length / 7) : 0}
            />
            <YAxis
              yAxisId="left"
              domain={[0, 'auto']}
              tick={{ fontSize: 10, fill: '#3b82f6' }}
              tickCount={5}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              domain={[weightMin, weightMax]}
              tick={{ fontSize: 10, fill: '#10b981' }}
              tickCount={5}
            />
            <Tooltip content={<CustomTooltip />} />
            {/* ACWR reference lines */}
            <ReferenceLine yAxisId="left" y={1.3} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={1} />
            <ReferenceLine yAxisId="left" y={0.8} stroke="#10b981" strokeDasharray="4 4" strokeWidth={1} />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="acwr"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ fill: '#3b82f6', r: combinedData.length > 30 ? 0 : 3 }}
              activeDot={{ r: 5 }}
              connectNulls
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="weight"
              stroke="#10b981"
              strokeWidth={2}
              dot={{ fill: '#10b981', r: combinedData.length > 30 ? 0 : 3 }}
              activeDot={{ r: 5 }}
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-2 text-[10px] text-gray-400">
        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-blue-500 rounded-full" /> ACWR</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-green-500 rounded-full" /> 体重</span>
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-amber-500 inline-block" /> 注意 1.3</span>
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-green-500 inline-block" /> 安全 0.8</span>
      </div>
    </div>
  );
}
