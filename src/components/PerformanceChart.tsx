import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { PerformanceRecordWithTest, PersonalBest } from '../hooks/usePerformanceData';

type TeamMonthlyPoint = {
  month_start: string; // 'YYYY-MM-DD'（RPCはdateで返る想定）
  team_n: number | null;
  team_avg: number | null;
};

interface PerformanceChartProps {
  records: PerformanceRecordWithTest[];
  personalBest?: PersonalBest;
  testTypeName?: string;

  // ★追加：チーム月次平均（latest-of-month）
  teamMonthly?: TeamMonthlyPoint[];
}

export const PerformanceChart = React.memo(function PerformanceChart({
  records,
  personalBest,
  testTypeName,
  teamMonthly = [],
}: PerformanceChartProps) {
  if (records.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
        データがありません
      </div>
    );
  }

  const sortedRecords = useMemo(
    () =>
      [...records].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      ),
    [records]
  );

  const testType = records[0]?.test_type;
  const higherIsBetter = testType?.higher_is_better ?? true;

  // 個人の点（その日）
  const athletePoints = useMemo(() => {
    return sortedRecords.map((record) => {
      const rawValue = record.values.primary_value;
      const numValue = typeof rawValue === 'string' ? parseFloat(rawValue) : rawValue;

      return {
        x: record.date, // ISOのまま保持（ソート・tooltipで楽）
        dateLabel: new Date(record.date).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }),
        value: Number.isFinite(numValue) ? numValue : null,
        team_avg: null,
        team_n: null,
        unit: record.test_type?.unit || '',
        notes: record.notes || '',
        kind: 'athlete' as const,
      };
    });
  }, [sortedRecords]);

  // チーム月次平均の点（月初）
  const teamPoints = useMemo(() => {
    return (teamMonthly ?? [])
      .filter((m) => m?.team_avg !== null && m?.team_avg !== undefined)
      .map((m) => {
        const iso = typeof m.month_start === 'string' ? m.month_start : String(m.month_start);
        return {
          x: iso,
          dateLabel: new Date(iso).toLocaleDateString('ja-JP', { year: 'numeric', month: 'short' }),
          value: null,
          team_avg: m.team_avg,
          team_n: m.team_n ?? null,
          unit: testType?.unit || '',
          notes: '',
          kind: 'team' as const,
        };
      });
  }, [teamMonthly, testType?.unit]);

  // マージして時系列に並べる
  const chartData = useMemo(() => {
    const merged = [...athletePoints, ...teamPoints].sort(
      (a, b) => new Date(a.x).getTime() - new Date(b.x).getTime()
    );

    // 表示用のx軸ラベル（同じ日に複数点があると重なるので、月次は月表示にして差を出す）
    return merged.map((d) => ({
      ...d,
      date: d.kind === 'team'
        ? d.dateLabel // 例：2026年1月
        : new Date(d.x).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }),
      fullDate: d.x,
    }));
  }, [athletePoints, teamPoints]);

  // Y軸レンジ：value / team_avg 両方から計算
  const numericValues = useMemo(() => {
    const arr: number[] = [];
    for (const d of chartData) {
      if (typeof d.value === 'number' && Number.isFinite(d.value)) arr.push(d.value);
      if (typeof d.team_avg === 'number' && Number.isFinite(d.team_avg)) arr.push(d.team_avg);
    }
    return arr.length ? arr : [0];
  }, [chartData]);

  const minValue = Math.min(...numericValues);
  const maxValue = Math.max(...numericValues);
  const valueRange = maxValue - minValue || 1;
  const yAxisMin = Math.max(0, minValue - valueRange * 0.1);
  const yAxisMax = maxValue + valueRange * 0.1;

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      // payloadに複数Lineが混ざるので、同じdataを拾う
      const data = payload[0].payload;

      return (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3">
          <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">
            {new Date(data.fullDate).toLocaleDateString('ja-JP', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>

          {data.value !== null && data.value !== undefined && (
            <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
              個人: {Number(data.value).toFixed(testType?.name.includes('rsi') ? 2 : 1)} {data.unit}
            </p>
          )}

          {data.team_avg !== null && data.team_avg !== undefined && (
            <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-300 mt-1">
              チーム月次平均: {Number(data.team_avg).toFixed(testType?.name.includes('rsi') ? 2 : 1)} {data.unit}
              {data.team_n ? (
                <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">(n={data.team_n})</span>
              ) : null}
            </p>
          )}

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
            <span className="font-semibold">パーソナルベスト:</span>{' '}
            {personalBest.value.toFixed(testType?.name.includes('rsi') ? 2 : 1)} {testType?.unit}
            <span className="text-xs ml-2">
              ({new Date(personalBest.date).toLocaleDateString('ja-JP')})
            </span>
          </p>
        </div>
      )}

      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
          <XAxis dataKey="date" className="text-xs" stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} />
          <YAxis
            domain={[yAxisMin, yAxisMax]}
            className="text-xs"
            stroke="#9CA3AF"
            tick={{ fill: '#9CA3AF' }}
            label={{
              value: testType?.unit || '',
              angle: -90,
              position: 'insideLeft',
              style: { fill: '#9CA3AF', fontSize: '12px' },
            }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="line" />

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
                fontWeight: 'bold',
              }}
            />
          )}

          {/* ★個人ライン */}
          <Line
            type="monotone"
            dataKey="value"
            name={testType?.display_name || '個人'}
            stroke="#3B82F6"
            strokeWidth={3}
            dot={{ r: 5, fill: '#3B82F6', strokeWidth: 2, stroke: '#fff' }}
            activeDot={{ r: 7, fill: '#2563EB', strokeWidth: 2, stroke: '#fff' }}
            connectNulls={false}
          />

          {/* ★追加：チーム月次平均ライン */}
          {teamMonthly?.length > 0 && (
            <Line
              type="monotone"
              dataKey="team_avg"
              name="チーム月次平均（最新）"
              stroke="#6366F1"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
              connectNulls={true}
              strokeDasharray="4 4"
            />
          )}
        </LineChart>
      </ResponsiveContainer>

      {chartData.filter((d: any) => d.value !== null).length > 1 && (
        <div className="mt-4 grid grid-cols-3 gap-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
            <p className="text-xs text-blue-600 dark:text-blue-400 mb-1">最新記録</p>
            <p className="text-lg font-bold text-blue-700 dark:text-blue-300">
              {Number(athletePoints[athletePoints.length - 1]?.value ?? 0).toFixed(testType?.name.includes('rsi') ? 2 : 1)}{' '}
              {testType?.unit}
            </p>
          </div>

          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
            <p className="text-xs text-green-600 dark:text-green-400 mb-1">
              {higherIsBetter ? '最高' : '最低'}記録
            </p>
            <p className="text-lg font-bold text-green-700 dark:text-green-300">
              {(() => {
                const vals = athletePoints.map((d) => (typeof d.value === 'number' ? d.value : null)).filter((v): v is number => v !== null);
                const v = higherIsBetter ? Math.max(...vals) : Math.min(...vals);
                return Number(v).toFixed(testType?.name.includes('rsi') ? 2 : 1);
              })()}{' '}
              {testType?.unit}
            </p>
          </div>

          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3">
            <p className="text-xs text-purple-600 dark:text-purple-400 mb-1">測定回数</p>
            <p className="text-lg font-bold text-purple-700 dark:text-purple-300">
              {athletePoints.length} 回
            </p>
          </div>
        </div>
      )}
    </div>
  );
});
