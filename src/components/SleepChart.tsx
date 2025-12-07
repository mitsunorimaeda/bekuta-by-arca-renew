import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from 'recharts';
import { Database } from '../lib/database.types';

type SleepRecord = Database['public']['Tables']['sleep_records']['Row'];

interface SleepChartProps {
  data: SleepRecord[];
}

export function SleepChart({ data }: SleepChartProps) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const chartData = useMemo(() => {
    return data
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-30)
      .map(record => ({
        date: record.date,
        sleepHours: Number(record.sleep_hours),
        sleepQuality: record.sleep_quality,
        displayDate: formatDate(record.date)
      }));
  }, [data]);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 sm:h-96 text-gray-500">
        <div className="text-center px-4">
          <p className="text-base sm:text-lg mb-2">データがありません</p>
          <p className="text-sm">睡眠記録を追加してグラフを表示しましょう</p>
        </div>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900 dark:text-white mb-2">
            {data.displayDate}
          </p>
          <div className="space-y-1 text-sm">
            <p className="flex items-center">
              <span className="w-3 h-3 bg-indigo-500 rounded-full mr-2"></span>
              睡眠時間: <span className="font-semibold ml-1">{data.sleepHours}時間</span>
            </p>
            {data.sleepQuality && (
              <p className="flex items-center">
                <span className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></span>
                睡眠の質: <span className="font-semibold ml-1">{data.sleepQuality}/5</span>
              </p>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-64 sm:h-96">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-300 dark:stroke-gray-700" />
          <XAxis
            dataKey="displayDate"
            tick={{ fill: 'currentColor' }}
            className="text-gray-600 dark:text-gray-400"
          />
          <YAxis
            label={{ value: '時間', angle: -90, position: 'insideLeft' }}
            tick={{ fill: 'currentColor' }}
            className="text-gray-600 dark:text-gray-400"
            domain={[0, 12]}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <ReferenceLine
            y={7}
            stroke="#10b981"
            strokeDasharray="3 3"
            label={{ value: '推奨最低', position: 'right', fill: '#10b981' }}
          />
          <ReferenceLine
            y={9}
            stroke="#3b82f6"
            strokeDasharray="3 3"
            label={{ value: '理想', position: 'right', fill: '#3b82f6' }}
          />
          <Line
            type="monotone"
            dataKey="sleepHours"
            stroke="#6366f1"
            strokeWidth={2}
            dot={{ fill: '#6366f1', r: 4 }}
            activeDot={{ r: 6 }}
            name="睡眠時間"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
