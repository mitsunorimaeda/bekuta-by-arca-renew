import React, { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from 'recharts';
import { getRiskColor } from '../lib/acwr';
import { Filter } from 'lucide-react';

interface TeamACWRData {
  date: string;
  averageACWR: number;
  athleteCount: number;
  riskLevel: string;

  // ✅ 追加（DBやhookで渡せるようになったら入る）
  // どっちの命名でも拾えるようにしておく（後方互換）
  averageRPE?: number | null;
  avg_rpe?: number | null;
  rpe_avg?: number | null;

  averageLoad?: number | null;
  avg_load?: number | null;
  load_avg?: number | null;
}

interface TeamACWRChartProps {
  data: TeamACWRData[];
  teamName: string;

  // ✅ StaffView のスイッチから渡す
  showAvgRPE?: boolean;
  showAvgLoad?: boolean;
}

const pickAvgRPE = (d: TeamACWRData) =>
  d.averageRPE ?? d.avg_rpe ?? d.rpe_avg ?? null;

const pickAvgLoad = (d: TeamACWRData) =>
  d.averageLoad ?? d.avg_load ?? d.load_avg ?? null;

export function TeamACWRChart({
  data,
  teamName,
  showAvgRPE = true,
  showAvgLoad = false,
}: TeamACWRChartProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'quarter' | 'all'>(
    'month'
  );

  // ✅ period filter
  const filteredData = useMemo(() => {
    if (data.length === 0) return [];

    const today = new Date();
    let startDate: Date;

    switch (selectedPeriod) {
      case 'week':
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 7);
        break;
      case 'month':
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 30);
        break;
      case 'quarter':
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 90);
        break;
      case 'all':
      default:
        return data;
    }

    return data.filter((item) => {
      const itemDate = new Date(item.date);
      return itemDate >= startDate && itemDate <= today;
    });
  }, [data, selectedPeriod]);

  // ✅ グラフ用に「平均RPE/Load」を正規化して持たせる（rechartsが参照する dataKey を固定）
  const chartData = useMemo(() => {
    return filteredData.map((d) => ({
      ...d,
      avgRPE: pickAvgRPE(d),
      avgLoad: pickAvgLoad(d),
    }));
  }, [filteredData]);

  const hasRPE = useMemo(() => chartData.some((d) => typeof d.avgRPE === 'number'), [chartData]);
  const hasLoad = useMemo(
    () => chartData.some((d) => typeof d.avgLoad === 'number'),
    [chartData]
  );

  const showRPELine = showAvgRPE && hasRPE;
  const showLoadLine = showAvgLoad && hasLoad;
  const showAuxAxis = showRPELine || showLoadLine;

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 sm:h-96 text-gray-500">
        <div className="text-center px-4">
          <p className="text-base sm:text-lg mb-2">データがありません</p>
          <p className="text-sm">選手の練習記録が蓄積されると平均ACWRが表示されます</p>
        </div>
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const formatDateWithDay = (dateStr: string) => {
    const date = new Date(dateStr);
    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    const dayOfWeek = dayNames[date.getDay()];
    return `${date.getMonth() + 1}/${date.getDate()}(${dayOfWeek})`;
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      // payload は複数Lineになるので、payload[0]に固定しない
      const row = payload?.[0]?.payload;
      const date = new Date(label);
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;

      const acwr = row?.averageACWR;
      const rpe = row?.avgRPE;
      const load = row?.avgLoad;

      return (
        <div className="bg-white p-3 sm:p-4 border border-gray-200 rounded-lg shadow-lg max-w-xs">
          <div className="flex items-center space-x-2 mb-2">
            <p className="font-medium text-gray-900 text-sm sm:text-base">
              {formatDateWithDay(label)}
            </p>
            {isWeekend && (
              <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded-full text-xs font-medium">
                週末
              </span>
            )}
          </div>

          <div className="space-y-1 text-xs sm:text-sm">
            <p className="flex justify-between">
              <span>平均ACWR:</span>
              <span className="font-semibold" style={{ color: getRiskColor(row?.riskLevel) }}>
                {acwr}
              </span>
            </p>

            {showRPELine && (
              <p className="flex justify-between">
                <span>平均RPE:</span>
                <span className="font-semibold">{typeof rpe === 'number' ? rpe.toFixed(2) : '-'}</span>
              </p>
            )}

            {showLoadLine && (
              <p className="flex justify-between">
                <span>平均Load:</span>
                <span className="font-semibold">
                  {typeof load === 'number' ? Math.round(load) : '-'}
                </span>
              </p>
            )}

            <p className="flex justify-between">
              <span>対象選手数:</span>
              <span className="font-semibold">{row?.athleteCount}名</span>
            </p>
            <p className="flex justify-between">
              <span>リスクレベル:</span>
              <span className="font-semibold" style={{ color: getRiskColor(row?.riskLevel) }}>
                {getRiskLabel(row?.riskLevel)}
              </span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  const CustomDot = (props: any) => {
    const { cx, cy, payload } = props;
    if (cx && cy && payload) {
      const date = new Date(payload.date);
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;

      return (
        <circle
          cx={cx}
          cy={cy}
          r={isWeekend ? 5 : 4}
          fill={getRiskColor(payload.riskLevel)}
          strokeWidth={2}
          stroke={isWeekend ? '#8B5CF6' : 'white'}
          opacity={isWeekend ? 0.9 : 1}
        />
      );
    }
    return null;
  };

  return (
    <div className="w-full">
      {/* ヘッダーと期間選択 */}
      <div className="mb-4 space-y-4">
        <div>
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">
            <span className="hidden sm:inline">{teamName} - </span>チーム平均ACWR推移
          </h3>
          <p className="text-xs sm:text-sm text-gray-600">
            左軸：ACWR{showAuxAxis ? ' / 右軸：RPE・Load' : ''}
          </p>
        </div>

        {/* 期間選択ボタン */}
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <div className="flex space-x-1">
            {[
              { value: 'week', label: '1週間' },
              { value: 'month', label: '1ヶ月' },
              { value: 'quarter', label: '3ヶ月' },
              { value: 'all', label: '全期間' },
            ].map((period) => (
              <button
                key={period.value}
                onClick={() => setSelectedPeriod(period.value as any)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  selectedPeriod === period.value
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {period.label}
              </button>
            ))}
          </div>
        </div>

        {/* データ期間情報 */}
        <div className="bg-purple-50 rounded-lg p-3">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-4">
              <div>
                <span className="text-purple-600 font-medium">表示期間:</span>
                <span className="text-purple-800 ml-1">
                  {selectedPeriod === 'week'
                    ? '過去7日間'
                    : selectedPeriod === 'month'
                    ? '過去30日間'
                    : selectedPeriod === 'quarter'
                    ? '過去90日間'
                    : '全期間'}
                </span>
              </div>
              <div>
                <span className="text-purple-600 font-medium">データ数:</span>
                <span className="text-purple-800 ml-1">{chartData.length}日</span>
              </div>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-purple-500 rounded-full border-2 border-purple-600"></div>
              <span className="text-xs text-purple-600">週末は紫の枠で強調</span>
            </div>
          </div>
        </div>

        {/* ✅ 列が無い場合の注意（開発中に便利） */}
        {(showAvgRPE && !hasRPE) || (showAvgLoad && !hasLoad) ? (
          <div className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2">
            表示ONの指標がデータに含まれていません（平均RPE/平均Loadの列が未取得の可能性）。
          </div>
        ) : null}
      </div>

      <div className="h-64 sm:h-96">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 20, right: 36, left: 20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />

            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              stroke="#6b7280"
              fontSize={10}
              interval="preserveStartEnd"
            />

            {/* ✅ 左：ACWR */}
            <YAxis
              yAxisId="acwr"
              domain={[0, 'dataMax + 0.5']}
              stroke="#6b7280"
              fontSize={10}
              width={40}
            />

            {/* ✅ 右：RPE/Load（必要な時だけ表示） */}
            <YAxis
              yAxisId="aux"
              orientation="right"
              domain={[0, 'auto']}
              stroke="#6b7280"
              fontSize={10}
              width={40}
              hide={!showAuxAxis}
            />

            <Tooltip content={<CustomTooltip />} />
            <Legend />

            {/* Reference lines for risk zones */}
            <ReferenceLine yAxisId="acwr" y={1.5} stroke="#EF4444" strokeDasharray="5 5" />
            <ReferenceLine yAxisId="acwr" y={1.3} stroke="#F59E0B" strokeDasharray="5 5" />
            <ReferenceLine yAxisId="acwr" y={0.8} stroke="#10B981" strokeDasharray="5 5" />

            {/* ACWR */}
            <Line
              type="monotone"
              dataKey="averageACWR"
              name="平均ACWR"
              yAxisId="acwr"
              stroke="#8B5CF6"
              strokeWidth={3}
              dot={<CustomDot />}
              activeDot={{ r: 6, stroke: '#8B5CF6', strokeWidth: 2, fill: 'white' }}
              connectNulls
            />

            {/* 平均RPE */}
            {showRPELine && (
              <Line
                type="monotone"
                dataKey="avgRPE"
                name="平均RPE"
                yAxisId="aux"
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            )}

            {/* 平均Load */}
            {showLoadLine && (
              <Line
                type="monotone"
                dataKey="avgLoad"
                name="平均Load"
                yAxisId="aux"
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            )}
            {showAvgRPE && (
              <Line
                type="monotone"
                dataKey="averageRPE"
                stroke="#0EA5E9"
                strokeWidth={2}
                dot={false}
              />
            )}

            {showAvgLoad && (
              <Line
                type="monotone"
                dataKey="averageLoad"
                stroke="#22C55E"
                strokeWidth={2}
                dot={false}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Legend - Centered at bottom */}
      <div className="mt-4 flex justify-center">
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:gap-4 text-xs">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
            <span>高リスク (&gt;1.5)</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></div>
            <span>注意 (1.3-1.5)</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
            <span>良好 (0.8-1.3)</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
            <span>低負荷 (&lt;0.8)</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function getRiskLabel(riskLevel: string): string {
  switch (riskLevel) {
    case 'high':
      return '高リスク';
    case 'caution':
      return '注意';
    case 'good':
      return '良好';
    case 'low':
      return '低負荷';
    default:
      return '不明';
  }
}