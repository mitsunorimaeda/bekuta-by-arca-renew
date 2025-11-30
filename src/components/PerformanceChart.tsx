import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { PerformanceRecordWithTest, PersonalBest } from '../hooks/usePerformanceData';

interface PerformanceChartProps {
  records: PerformanceRecordWithTest[];
  personalBest?: PersonalBest;
  testTypeName?: string;
}

export const PerformanceChart = React.memo(function PerformanceChart({ records, personalBest, testTypeName }: PerformanceChartProps) {
  if (records.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
        データがありません
      </div>
    );
  }

  const sortedRecords = useMemo(() =>
    [...records].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    ),
    [records]
  );

  const chartData = useMemo(() => sortedRecords.map(record => {
    const rawValue = record.values.primary_value;
    const numValue = typeof rawValue === 'string' ? parseFloat(rawValue) : rawValue;

    return {
      date: new Date(record.date).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }),
      fullDate: record.date,
      value: numValue,
      unit: record.test_type?.unit || '',
      notes: record.notes || ''
    };
  }), [sortedRecords]);

  const testType = records[0]?.test_type;
  const higherIsBetter = testType?.higher_is_better ?? true;

  const minValue = Math.min(...chartData.map(d => d.value));
  const maxValue = Math.max(...chartData.map(d => d.value));
  const valueRange = maxValue - minValue;
  const yAxisMin = Math.max(0, minValue - valueRange * 0.1);
  const yAxisMax = maxValue + valueRange * 0.1;

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3">
          <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
            {new Date(data.fullDate).toLocaleDateString('ja-JP', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </p>
          <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
            {data.value.toFixed(testType?.name.includes('rsi') ? 2 : 1)} {data.unit}
          </p>
          {data.notes && (
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 max-w-xs">
              {data.notes}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full">
      {testTypeName && (
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {testTypeName} の推移
        </h3>
      )}

      {personalBest && (
        <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            <span className="font-semibold">パーソナルベスト:</span> {personalBest.value.toFixed(testType?.name.includes('rsi') ? 2 : 1)} {testType?.unit}
            <span className="text-xs ml-2">
              ({new Date(personalBest.date).toLocaleDateString('ja-JP')})
            </span>
          </p>
        </div>
      )}

      <ResponsiveContainer width="100%" height={400}>
        <LineChart
          data={chartData}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
          <XAxis
            dataKey="date"
            className="text-xs"
            stroke="#9CA3AF"
            tick={{ fill: '#9CA3AF' }}
          />
          <YAxis
            domain={[yAxisMin, yAxisMax]}
            className="text-xs"
            stroke="#9CA3AF"
            tick={{ fill: '#9CA3AF' }}
            label={{
              value: testType?.unit || '',
              angle: -90,
              position: 'insideLeft',
              style: { fill: '#9CA3AF', fontSize: '12px' }
            }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ paddingTop: '20px' }}
            iconType="line"
          />

          {personalBest && (
            <ReferenceLine
              y={personalBest.value}
              stroke="#F59E0B"
              strokeDasharray="5 5"
              label={{
                value: 'PB',
                position: 'right',
                fill: '#F59E0B',
                fontSize: 12,
                fontWeight: 'bold'
              }}
            />
          )}

          <Line
            type="monotone"
            dataKey="value"
            name={testType?.display_name || '測定値'}
            stroke="#3B82F6"
            strokeWidth={3}
            dot={{
              r: 5,
              fill: '#3B82F6',
              strokeWidth: 2,
              stroke: '#fff'
            }}
            activeDot={{
              r: 7,
              fill: '#2563EB',
              strokeWidth: 2,
              stroke: '#fff'
            }}
          />
        </LineChart>
      </ResponsiveContainer>

      {chartData.length > 1 && (
        <div className="mt-4 grid grid-cols-3 gap-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
            <p className="text-xs text-blue-600 dark:text-blue-400 mb-1">最新記録</p>
            <p className="text-lg font-bold text-blue-700 dark:text-blue-300">
              {chartData[chartData.length - 1].value.toFixed(testType?.name.includes('rsi') ? 2 : 1)} {testType?.unit}
            </p>
          </div>

          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
            <p className="text-xs text-green-600 dark:text-green-400 mb-1">
              {higherIsBetter ? '最高' : '最低'}記録
            </p>
            <p className="text-lg font-bold text-green-700 dark:text-green-300">
              {higherIsBetter ? maxValue.toFixed(testType?.name.includes('rsi') ? 2 : 1) : minValue.toFixed(testType?.name.includes('rsi') ? 2 : 1)} {testType?.unit}
            </p>
          </div>

          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3">
            <p className="text-xs text-purple-600 dark:text-purple-400 mb-1">測定回数</p>
            <p className="text-lg font-bold text-purple-700 dark:text-purple-300">
              {chartData.length} 回
            </p>
          </div>
        </div>
      )}
    </div>
  );
});
