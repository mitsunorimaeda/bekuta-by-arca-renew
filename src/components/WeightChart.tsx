import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Database } from '../lib/database.types';

type WeightRecord = Database['public']['Tables']['weight_records']['Row'];

interface WeightChartProps {
  data: WeightRecord[];
}

interface ChartDataPoint {
  date: string;
  weight: number;
  displayDate: string;
}

export function WeightChart({ data }: WeightChartProps) {
  const chartData: ChartDataPoint[] = data
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map(record => ({
      date: record.date,
      weight: Number(record.weight_kg),
      displayDate: new Date(record.date).toLocaleDateString('ja-JP', {
        month: 'short',
        day: 'numeric'
      })
    }));

  if (chartData.length === 0) {
    return (
      <div className="h-64 sm:h-80 flex items-center justify-center text-gray-500 dark:text-gray-400">
        体重データがありません
      </div>
    );
  }

  const weights = chartData.map(d => d.weight);
  const minWeight = Math.min(...weights);
  const maxWeight = Math.max(...weights);
  const range = maxWeight - minWeight;
  const yAxisMin = Math.max(0, minWeight - range * 0.1);
  const yAxisMax = maxWeight + range * 0.1;

  return (
    <div className="h-64 sm:h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-gray-700" />
          <XAxis
            dataKey="displayDate"
            stroke="#6b7280"
            style={{ fontSize: '12px' }}
            tick={{ fill: 'currentColor' }}
            className="dark:text-gray-400"
          />
          <YAxis
            stroke="#6b7280"
            style={{ fontSize: '12px' }}
            tick={{ fill: 'currentColor' }}
            className="dark:text-gray-400"
            domain={[yAxisMin, yAxisMax]}
            tickFormatter={(value) => `${value.toFixed(1)}`}
            label={{ value: '体重 (kg)', angle: -90, position: 'insideLeft', fill: '#6b7280' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '8px 12px'
            }}
            labelStyle={{ color: '#374151', fontWeight: 600 }}
            formatter={(value: number) => [`${value.toFixed(1)} kg`, '体重']}
            labelFormatter={(label) => {
              const record = chartData.find(d => d.displayDate === label);
              if (record) {
                return new Date(record.date).toLocaleDateString('ja-JP', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                });
              }
              return label;
            }}
          />
          <Legend
            wrapperStyle={{ paddingTop: '20px' }}
            iconType="line"
          />
          <Line
            type="monotone"
            dataKey="weight"
            stroke="#3b82f6"
            strokeWidth={3}
            dot={{ fill: '#3b82f6', r: 4 }}
            activeDot={{ r: 6 }}
            name="体重 (kg)"
          />
        </LineChart>
      </ResponsiveContainer>
      {chartData.length > 1 && (
        <div className="mt-4 flex items-center justify-center space-x-6 text-sm">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
            <span className="text-gray-600 dark:text-gray-400">
              最小: {minWeight.toFixed(1)} kg
            </span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
            <span className="text-gray-600 dark:text-gray-400">
              最大: {maxWeight.toFixed(1)} kg
            </span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
            <span className="text-gray-600 dark:text-gray-400">
              変化: {(maxWeight - minWeight).toFixed(1)} kg
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
