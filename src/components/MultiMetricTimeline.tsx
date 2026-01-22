// src/components/MultiMetricTimeline.tsx
import React, { useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Activity, Scale, Moon, Heart, Zap } from 'lucide-react';
import { ACWRData } from '../lib/acwr';
import { formatDateJST } from '../lib/date';

type WeightRecord = { weight_kg: number; date: string };
type SleepRecord = { sleep_hours: number; sleep_quality: number; date: string };
type MotivationRecord = {
  motivation_level: number;
  energy_level: number;
  stress_level: number;
  date: string;
};

interface MultiMetricTimelineProps {
  // ✅ どのpropsも「未取得の瞬間」がありえるので optional + null 許容にして落ちないようにする
  acwrData?: ACWRData[] | null;
  weightRecords?: WeightRecord[] | null;
  sleepRecords?: SleepRecord[] | null;
  motivationRecords?: MotivationRecord[] | null;
}

export function MultiMetricTimeline({
  acwrData = [],
  weightRecords = [],
  sleepRecords = [],
  motivationRecords = [],
}: MultiMetricTimelineProps) {
  // ✅ 念のため「配列でなければ空配列」に正規化（呼び出し側が undefined/別型でも落ちない）
  const safeAcwrData = Array.isArray(acwrData) ? acwrData : [];
  const safeWeightRecords = Array.isArray(weightRecords) ? weightRecords : [];
  const safeSleepRecords = Array.isArray(sleepRecords) ? sleepRecords : [];
  const safeMotivationRecords = Array.isArray(motivationRecords) ? motivationRecords : [];

  const [visibleMetrics, setVisibleMetrics] = useState({
    acwr: true,
    weight: true,
    sleep: true,
    motivation: true,
    energy: false,
  });

  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');

  const getDaysAgo = (days: number): string => {
    const now = new Date();

    // JST に変換
    const jstTime = now.getTime() + 9 * 60 * 60 * 1000;
    const jst = new Date(jstTime);

    // JST 日付で days 日前に調整
    jst.setUTCDate(jst.getUTCDate() - days);

    return formatDateJST(jst);
  };

  const filterByTimeRange = (dateString: string) => {
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
    return dateString >= getDaysAgo(days);
  };

  const chartData = useMemo(() => {
    const dataMap = new Map<string, any>();

    safeAcwrData
      .filter((d: any) => d?.date && filterByTimeRange(d.date))
      .forEach((item: any) => {
        if (!dataMap.has(item.date)) dataMap.set(item.date, { date: item.date });
        dataMap.get(item.date)!.acwr =
          typeof item.acwr === 'number' && Number.isFinite(item.acwr) ? item.acwr : null;
        dataMap.get(item.date)!.acuteLoad =
          typeof item.acuteLoad === 'number' && Number.isFinite(item.acuteLoad) ? item.acuteLoad : null;
      });

    safeWeightRecords
      .filter((d: any) => d?.date && filterByTimeRange(d.date))
      .forEach((item: any) => {
        if (!dataMap.has(item.date)) dataMap.set(item.date, { date: item.date });
        const w = Number(item.weight_kg);
        dataMap.get(item.date)!.weight = Number.isFinite(w) ? w : null;
      });

    safeSleepRecords
      .filter((d: any) => d?.date && filterByTimeRange(d.date))
      .forEach((item: any) => {
        if (!dataMap.has(item.date)) dataMap.set(item.date, { date: item.date });
        const sh = Number(item.sleep_hours);
        dataMap.get(item.date)!.sleep = Number.isFinite(sh) ? sh : null;

        const sq = Number(item.sleep_quality);
        dataMap.get(item.date)!.sleepQuality = Number.isFinite(sq) ? sq : null;
      });

    safeMotivationRecords
      .filter((d: any) => d?.date && filterByTimeRange(d.date))
      .forEach((item: any) => {
        if (!dataMap.has(item.date)) dataMap.set(item.date, { date: item.date });

        const m = Number(item.motivation_level);
        const e = Number(item.energy_level);
        const s = Number(item.stress_level);

        dataMap.get(item.date)!.motivation = Number.isFinite(m) ? m : null;
        dataMap.get(item.date)!.energy = Number.isFinite(e) ? e : null;
        dataMap.get(item.date)!.stress = Number.isFinite(s) ? s : null;
      });

    return Array.from(dataMap.values()).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }, [safeAcwrData, safeWeightRecords, safeSleepRecords, safeMotivationRecords, timeRange]);

  const toggleMetric = (metric: keyof typeof visibleMetrics) => {
    setVisibleMetrics((prev) => ({ ...prev, [metric]: !prev[metric] }));
  };

  // ✅ "YYYY-MM-DD" を Date() に通すとTZでズレやすいので、基本は文字列から表示する
  const formatMMDD = (dateStr: string) => {
    const m = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
      const mm = Number(m[2]);
      const dd = Number(m[3]);
      if (Number.isFinite(mm) && Number.isFinite(dd)) return `${mm}/${dd}`;
    }
    // fallback
    try {
      const d = new Date(dateStr);
      if (!Number.isNaN(d.getTime())) return `${d.getMonth() + 1}/${d.getDate()}`;
    } catch {}
    return String(dateStr);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4">
        <p className="font-semibold text-gray-900 dark:text-white mb-2">{formatMMDD(label)}</p>
        <div className="space-y-1">
          {payload.map((entry: any) => (
            <div key={entry.dataKey} className="flex items-center justify-between space-x-4">
              <span className="text-sm" style={{ color: entry.color }}>
                {entry.name}:
              </span>
              <span className="font-semibold text-sm" style={{ color: entry.color }}>
                {entry.value !== undefined && entry.value !== null && Number.isFinite(entry.value)
                  ? Number(entry.value).toFixed(1)
                  : '-'}
                {entry.dataKey === 'weight' && 'kg'}
                {(entry.dataKey === 'sleep' || entry.dataKey === 'sleepHours') && 'h'}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ---- 集計（0 を落とさない）----
  const acwrVals = chartData
    .map((d) => d.acwr)
    .filter((v) => typeof v === 'number' && Number.isFinite(v)) as number[];
  const avgACWR = acwrVals.length > 0 ? (acwrVals.reduce((s, v) => s + v, 0) / acwrVals.length).toFixed(2) : '-';

  const sleepVals = chartData
    .map((d) => d.sleep)
    .filter((v) => typeof v === 'number' && Number.isFinite(v)) as number[];
  const avgSleep = sleepVals.length > 0 ? (sleepVals.reduce((s, v) => s + v, 0) / sleepVals.length).toFixed(1) : '-';

  const motVals = chartData
    .map((d) => d.motivation)
    .filter((v) => typeof v === 'number' && Number.isFinite(v)) as number[];
  const avgMot = motVals.length > 0 ? (motVals.reduce((s, v) => s + v, 0) / motVals.length).toFixed(1) : '-';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 transition-colors">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 space-y-4 sm:space-y-0">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">統合タイムライン</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">すべての指標を時系列で表示</p>
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
              tickFormatter={(date) => formatMMDD(date)}
              stroke="#9CA3AF"
              style={{ fontSize: '12px' }}
            />
            <YAxis stroke="#9CA3AF" style={{ fontSize: '12px' }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: '12px' }} iconType="line" />

            {visibleMetrics.acwr && (
              <Line type="monotone" dataKey="acwr" name="ACWR" stroke="#3B82F6" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
            )}

            {visibleMetrics.weight && (
              <Line type="monotone" dataKey="weight" name="体重 (kg)" stroke="#10B981" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
            )}

            {visibleMetrics.sleep && (
              <Line type="monotone" dataKey="sleep" name="睡眠 (h)" stroke="#8B5CF6" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
            )}

            {visibleMetrics.motivation && (
              <Line type="monotone" dataKey="motivation" name="意欲" stroke="#EC4899" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
            )}

            {visibleMetrics.energy && (
              <Line type="monotone" dataKey="energy" name="活力" stroke="#F59E0B" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
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
          <p className="text-2xl font-bold text-green-900 dark:text-green-300">{avgACWR}</p>
        </div>

        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3">
          <p className="text-xs text-purple-700 dark:text-purple-400 mb-1">平均睡眠</p>
          <p className="text-2xl font-bold text-purple-900 dark:text-blue-300">{avgSleep}</p>
          <p className="text-xs text-purple-600 dark:text-purple-400">時間</p>
        </div>

        <div className="bg-pink-50 dark:bg-pink-900/20 rounded-lg p-3">
          <p className="text-xs text-pink-700 dark:text-pink-400 mb-1">平均意欲</p>
          <p className="text-2xl font-bold text-pink-900 dark:text-pink-300">{avgMot}</p>
          <p className="text-xs text-pink-600 dark:text-pink-400">/10</p>
        </div>
      </div>
    </div>
  );
}

export default MultiMetricTimeline;