import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Activity, Scale, Moon, Heart, Zap } from 'lucide-react';
import { ACWRData } from '../lib/acwr';

interface MultiMetricTimelineProps {
  acwrData: ACWRData[];
  weightRecords: Array<{ weight_kg: number; date: string }>;
  sleepRecords: Array<{ sleep_hours: number; sleep_quality: number; date: string }>;
  motivationRecords: Array<{ motivation_level: number; energy_level: number; stress_level: number; date: string }>;
}

export function MultiMetricTimeline({
  acwrData,
  weightRecords,
  sleepRecords,
  motivationRecords
}: MultiMetricTimelineProps) {
  const [visibleMetrics, setVisibleMetrics] = useState({
    acwr: true,
    weight: true,
    sleep: true,
    motivation: true,
    energy: false
  });

  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');

  const getDaysAgo = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString().split('T')[0];
  };

  const filterByTimeRange = (dateString: string) => {
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
    return dateString >= getDaysAgo(days);
  };

  const mergeDataByDate = () => {
    const dataMap = new Map<string, any>();

    acwrData.filter(d => filterByTimeRange(d.date)).forEach(item => {
      if (!dataMap.has(item.date)) {
        dataMap.set(item.date, { date: item.date });
      }
      dataMap.get(item.date)!.acwr = item.acwr;
      dataMap.get(item.date)!.acuteLoad = item.acuteLoad;
    });

    weightRecords.filter(d => filterByTimeRange(d.date)).forEach(item => {
      if (!dataMap.has(item.date)) {
        dataMap.set(item.date, { date: item.date });
      }
      dataMap.get(item.date)!.weight = Number(item.weight_kg);
    });

    sleepRecords.filter(d => filterByTimeRange(d.date)).forEach(item => {
      if (!dataMap.has(item.date)) {
        dataMap.set(item.date, { date: item.date });
      }
      dataMap.get(item.date)!.sleep = Number(item.sleep_hours);
      dataMap.get(item.date)!.sleepQuality = item.sleep_quality;
    });

    motivationRecords.filter(d => filterByTimeRange(d.date)).forEach(item => {
      if (!dataMap.has(item.date)) {
        dataMap.set(item.date, { date: item.date });
      }
      dataMap.get(item.date)!.motivation = item.motivation_level;
      dataMap.get(item.date)!.energy = item.energy_level;
      dataMap.get(item.date)!.stress = item.stress_level;
    });

    return Array.from(dataMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  };

  const chartData = mergeDataByDate();

  const toggleMetric = (metric: keyof typeof visibleMetrics) => {
    setVisibleMetrics(prev => ({ ...prev, [metric]: !prev[metric] }));
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4">
        <p className="font-semibold text-gray-900 dark:text-white mb-2">
          {new Date(label).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
        </p>
        <div className="space-y-1">
          {payload.map((entry: any) => (
            <div key={entry.dataKey} className="flex items-center justify-between space-x-4">
              <span className="text-sm" style={{ color: entry.color }}>
                {entry.name}:
              </span>
              <span className="font-semibold text-sm" style={{ color: entry.color }}>
                {entry.value !== undefined ? entry.value.toFixed(1) : '-'}
                {entry.dataKey === 'weight' && 'kg'}
                {(entry.dataKey === 'sleep' || entry.dataKey === 'sleepHours') && 'h'}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 transition-colors">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 space-y-4 sm:space-y-0">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
            統合タイムライン
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            すべての指標を時系列で表示
          </p>
        </div>

        <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
          <button
            onClick={() => setTimeRange('7d')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              timeRange === '7d'
                ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            7日
          </button>
          <button
            onClick={() => setTimeRange('30d')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              timeRange === '30d'
                ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            30日
          </button>
          <button
            onClick={() => setTimeRange('90d')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              timeRange === '90d'
                ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            90日
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <button
          onClick={() => toggleMetric('acwr')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            visibleMetrics.acwr
              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-2 border-blue-500'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border-2 border-transparent'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>ACWR</span>
        </button>

        <button
          onClick={() => toggleMetric('weight')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            visibleMetrics.weight
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-2 border-green-500'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border-2 border-transparent'
          }`}
        >
          <Scale className="w-4 h-4" />
          <span>体重</span>
        </button>

        <button
          onClick={() => toggleMetric('sleep')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            visibleMetrics.sleep
              ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border-2 border-purple-500'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border-2 border-transparent'
          }`}
        >
          <Moon className="w-4 h-4" />
          <span>睡眠時間</span>
        </button>

        <button
          onClick={() => toggleMetric('motivation')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            visibleMetrics.motivation
              ? 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-400 border-2 border-pink-500'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border-2 border-transparent'
          }`}
        >
          <Heart className="w-4 h-4" />
          <span>モチベーション</span>
        </button>

        <button
          onClick={() => toggleMetric('energy')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            visibleMetrics.energy
              ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-2 border-orange-500'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border-2 border-transparent'
          }`}
        >
          <Zap className="w-4 h-4" />
          <span>エネルギー</span>
        </button>
      </div>

      {chartData.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-500 dark:text-gray-400">
          <Activity className="w-16 h-16 mb-4 opacity-20" />
          <p>選択した期間にデータがありません</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
            <XAxis
              dataKey="date"
              tickFormatter={(date) => {
                const d = new Date(date);
                return `${d.getMonth() + 1}/${d.getDate()}`;
              }}
              stroke="#9CA3AF"
              style={{ fontSize: '12px' }}
            />
            <YAxis stroke="#9CA3AF" style={{ fontSize: '12px' }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: '12px' }}
              iconType="line"
            />

            {visibleMetrics.acwr && (
              <Line
                type="monotone"
                dataKey="acwr"
                name="ACWR"
                stroke="#3B82F6"
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            )}

            {visibleMetrics.weight && (
              <Line
                type="monotone"
                dataKey="weight"
                name="体重 (kg)"
                stroke="#10B981"
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            )}

            {visibleMetrics.sleep && (
              <Line
                type="monotone"
                dataKey="sleep"
                name="睡眠 (h)"
                stroke="#8B5CF6"
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            )}

            {visibleMetrics.motivation && (
              <Line
                type="monotone"
                dataKey="motivation"
                name="意欲"
                stroke="#EC4899"
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            )}

            {visibleMetrics.energy && (
              <Line
                type="monotone"
                dataKey="energy"
                name="活力"
                stroke="#F59E0B"
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      )}

      <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
          <p className="text-xs text-blue-700 dark:text-blue-400 mb-1">記録数</p>
          <p className="text-2xl font-bold text-blue-900 dark:text-blue-300">{chartData.length}</p>
          <p className="text-xs text-blue-600 dark:text-blue-400">日分</p>
        </div>

        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
          <p className="text-xs text-green-700 dark:text-green-400 mb-1">平均ACWR</p>
          <p className="text-2xl font-bold text-green-900 dark:text-green-300">
            {chartData.filter(d => d.acwr).length > 0
              ? (chartData.reduce((sum, d) => sum + (d.acwr || 0), 0) / chartData.filter(d => d.acwr).length).toFixed(2)
              : '-'}
          </p>
        </div>

        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3">
          <p className="text-xs text-purple-700 dark:text-purple-400 mb-1">平均睡眠</p>
          <p className="text-2xl font-bold text-purple-900 dark:text-purple-300">
            {chartData.filter(d => d.sleep).length > 0
              ? (chartData.reduce((sum, d) => sum + (d.sleep || 0), 0) / chartData.filter(d => d.sleep).length).toFixed(1)
              : '-'}
          </p>
          <p className="text-xs text-purple-600 dark:text-purple-400">時間</p>
        </div>

        <div className="bg-pink-50 dark:bg-pink-900/20 rounded-lg p-3">
          <p className="text-xs text-pink-700 dark:text-pink-400 mb-1">平均意欲</p>
          <p className="text-2xl font-bold text-pink-900 dark:text-pink-300">
            {chartData.filter(d => d.motivation).length > 0
              ? (chartData.reduce((sum, d) => sum + (d.motivation || 0), 0) / chartData.filter(d => d.motivation).length).toFixed(1)
              : '-'}
          </p>
          <p className="text-xs text-pink-600 dark:text-pink-400">/10</p>
        </div>
      </div>
    </div>
  );
}
