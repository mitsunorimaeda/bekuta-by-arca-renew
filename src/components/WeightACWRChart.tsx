import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ACWRData } from '../lib/acwr';
import { Database } from '../lib/database.types';

type WeightRecord = Database['public']['Tables']['weight_records']['Row'];

interface WeightACWRChartProps {
  acwrData: ACWRData[];
  weightData: WeightRecord[];
}

export function WeightACWRChart({ acwrData, weightData }: WeightACWRChartProps) {
  const combinedData = acwrData.map(acwr => {
    const matchingWeight = weightData.find(w => w.date === acwr.date);

    return {
      date: new Date(acwr.date).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' }),
      fullDate: acwr.date,
      acwr: Number(acwr.acwr),
      weight: matchingWeight ? Number(matchingWeight.weight_kg) : null,
    };
  });

  if (combinedData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
        データがありません
      </div>
    );
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
          <p className="font-semibold text-gray-900 dark:text-white mb-2">{data.fullDate}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.value !== null ? Number(entry.value).toFixed(2) : '-'}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-96">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={combinedData}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
          <XAxis
            dataKey="date"
            stroke="#6B7280"
            tick={{ fill: '#6B7280' }}
          />
          <YAxis
            yAxisId="left"
            stroke="#3B82F6"
            tick={{ fill: '#3B82F6' }}
            label={{ value: 'ACWR', angle: -90, position: 'insideLeft', fill: '#3B82F6' }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            stroke="#10B981"
            tick={{ fill: '#10B981' }}
            label={{ value: '体重 (kg)', angle: 90, position: 'insideRight', fill: '#10B981' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{
              paddingTop: '20px'
            }}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="acwr"
            stroke="#3B82F6"
            strokeWidth={2}
            dot={{ fill: '#3B82F6', r: 4 }}
            name="ACWR"
            connectNulls
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="weight"
            stroke="#10B981"
            strokeWidth={2}
            dot={{ fill: '#10B981', r: 4 }}
            name="体重 (kg)"
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
