import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';
import { Database } from '../lib/database.types';

type MotivationRecord = Database['public']['Tables']['motivation_records']['Row'];

interface MotivationChartProps {
  data: MotivationRecord[];
}

export function MotivationChart({ data }: MotivationChartProps) {
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
        motivation: record.motivation_level,
        energy: record.energy_level,
        stress: record.stress_level,
        displayDate: formatDate(record.date)
      }));
  }, [data]);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 sm:h-96 text-gray-500">
        <div className="text-center px-4">
          <p className="text-base sm:text-lg mb-2">データがありません</p>
          <p className="text-sm">モチベーション記録を追加してグラフを表示しましょう</p>
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
              <span className="w-3 h-3 bg-blue-500 rounded-full mr-2"></span>
              モチベーション: <span className="font-semibold ml-1">{data.motivation}/10</span>
            </p>
            <p className="flex items-center">
              <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
              エネルギー: <span className="font-semibold ml-1">{data.energy}/10</span>
            </p>
            <p className="flex items-center">
              <span className="w-3 h-3 bg-red-500 rounded-full mr-2"></span>
              ストレス: <span className="font-semibold ml-1">{data.stress}/10</span>
            </p>
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
            domain={[0, 10]}
            tick={{ fill: 'currentColor' }}
            className="text-gray-600 dark:text-gray-400"
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <ReferenceLine
            y={5}
            stroke="#94a3b8"
            strokeDasharray="3 3"
            label={{ value: '中間', position: 'right', fill: '#94a3b8' }}
          />
          <Line
            type="monotone"
            dataKey="motivation"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ fill: '#3b82f6', r: 3 }}
            name="モチベーション"
          />
          <Line
            type="monotone"
            dataKey="energy"
            stroke="#10b981"
            strokeWidth={2}
            dot={{ fill: '#10b981', r: 3 }}
            name="エネルギー"
          />
          <Line
            type="monotone"
            dataKey="stress"
            stroke="#ef4444"
            strokeWidth={2}
            dot={{ fill: '#ef4444', r: 3 }}
            name="ストレス"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
