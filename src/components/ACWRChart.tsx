// src/components/ACWRChart.tsx
import React, { useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { ACWRData, getRiskColor } from '../lib/acwr';
import { Calendar, Filter } from 'lucide-react';
import ACWRProgressIndicator from './ACWRProgressIndicator';

interface ACWRChartProps {
  // ✅ ここを optional + null 許容にして “取得前のundefined” で落ちないようにする
  data?: ACWRData[] | null;
  daysWithData?: number | null;
  isDarkMode?: boolean;
  teamAverageData?: ACWRData[] | null;
  showTeamAverage?: boolean;
}

// ✅ JST の "YYYY-MM-DD" を作る（比較用）
const getJSTDateKey = (d: Date) => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d); // "YYYY-MM-DD"
};

// ✅ JST基準で「N日前」の dateKey
const getDaysAgoKeyJST = (days: number) => {
  const now = new Date();
  const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  jstNow.setUTCDate(jstNow.getUTCDate() - days);
  return getJSTDateKey(jstNow);
};

const safeNumber = (v: any) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export function ACWRChart({
  data = [],
  daysWithData = 0,
  isDarkMode = false,
  teamAverageData = [],
  showTeamAverage = false,
}: ACWRChartProps) {
  // ✅ まずここで “絶対に配列” に正規化
  const safeData = Array.isArray(data) ? data : [];
  const safeTeamData = Array.isArray(teamAverageData) ? teamAverageData : [];

  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'quarter' | 'all'>('month');
  const [isTeamAverageVisible, setIsTeamAverageVisible] = useState(!!showTeamAverage);

  const MINIMUM_DAYS = 21;
  const safeDaysWithData =
    typeof daysWithData === 'number' && Number.isFinite(daysWithData) ? daysWithData : 0;
  const isDataSufficient = safeDaysWithData >= MINIMUM_DAYS;

  // ✅ 期間の開始キー（JST）を先に作る
  const startKey = useMemo(() => {
    if (selectedPeriod === 'all') return null;
    if (selectedPeriod === 'week') return getDaysAgoKeyJST(7);
    if (selectedPeriod === 'month') return getDaysAgoKeyJST(30);
    return getDaysAgoKeyJST(90);
  }, [selectedPeriod]);

  const todayKey = useMemo(() => getJSTDateKey(new Date()), []);

  // ✅ データを期間でフィルタリング（JSTの "YYYY-MM-DD" 文字列比較で安定）
  const filteredData = useMemo(() => {
    if (safeData.length === 0) return [];
    if (!startKey) return safeData;

    return safeData.filter((item) => {
      const key = String(item?.date ?? '');
      // "YYYY-MM-DD" 前提で文字列比較が成立
      return key >= startKey && key <= todayKey;
    });
  }, [safeData, startKey, todayKey]);

  const filteredTeamData = useMemo(() => {
    if (safeTeamData.length === 0) return [];
    if (!startKey) return safeTeamData;

    return safeTeamData.filter((item) => {
      const key = String(item?.date ?? '');
      return key >= startKey && key <= todayKey;
    });
  }, [safeTeamData, startKey, todayKey]);

  // ✅ data が無い / undefined でも落ちない
  if (safeData.length === 0) {
    return (
      <div className="space-y-4">
        {safeDaysWithData > 0 && (
          <ACWRProgressIndicator daysWithData={safeDaysWithData} isDarkMode={isDarkMode} />
        )}
        <div className="flex items-center justify-center h-64 sm:h-96 text-gray-500 dark:text-gray-400">
          <div className="text-center px-4">
            <p className="text-base sm:text-lg mb-2">データがありません</p>
            <p className="text-sm">練習記録を追加してACWRグラフを表示しましょう</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isDataSufficient) {
    const remaining = Math.max(0, MINIMUM_DAYS - safeDaysWithData);
    return (
      <div className="space-y-4">
        <ACWRProgressIndicator daysWithData={safeDaysWithData} isDarkMode={isDarkMode} />
        <div className="flex items-center justify-center h-64 sm:h-96 text-gray-500 dark:text-gray-400 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
          <div className="text-center px-4">
            <p className="text-base sm:text-lg mb-2">ACWR分析準備中</p>
            <p className="text-sm">あと{remaining}日分のデータでACWR分析が始まります</p>
          </div>
        </div>
      </div>
    );
  }

  // "YYYY-MM-DD" を表示用に
  const formatDate = (dateStr: string) => {
    const m = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return `${Number(m[2])}/${Number(m[3])}`;
    const d = new Date(dateStr);
    if (!Number.isNaN(d.getTime())) return `${d.getMonth() + 1}/${d.getDate()}`;
    return String(dateStr);
  };

  const formatDateWithDay = (dateStr: string) => {
    const d = new Date(dateStr);
    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    if (!Number.isNaN(d.getTime())) {
      return `${d.getMonth() + 1}/${d.getDate()}(${dayNames[d.getDay()]})`;
    }
    return String(dateStr);
  };

  const getRiskLabel = (riskLevel: any): string => {
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
  };

  // ✅ Tooltip: payload順序に依存しない＋riskLevelが無い行も耐える
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) return null;

    const personalEntry =
      payload.find((p: any) => p?.name === '個人 ACWR') ||
      payload.find((p: any) => p?.dataKey === 'acwr');

    const personalRow = personalEntry?.payload;

    if (!personalRow) return null;

    const personalACWR = safeNumber(personalEntry?.value) ?? safeNumber(personalRow?.acwr);

    const dateObj = new Date(label);
    const isWeekend = !Number.isNaN(dateObj.getTime()) && (dateObj.getDay() === 0 || dateObj.getDay() === 6);

    // チーム平均は “同日マッチ” を優先
    const teamRow = isTeamAverageVisible ? filteredTeamData.find((td) => td.date === label) : null;
    const teamACWR = safeNumber(teamRow?.acwr);

    const diff =
      typeof personalACWR === 'number' && typeof teamACWR === 'number' ? personalACWR - teamACWR : null;

    const riskLevel = personalRow?.riskLevel ?? personalRow?.risk_level ?? 'unknown';

    return (
      <div className="bg-white p-3 sm:p-4 border border-gray-200 rounded-lg shadow-lg max-w-xs">
        <div className="flex items-center space-x-2 mb-2">
          <p className="font-medium text-gray-900 text-sm sm:text-base">{formatDateWithDay(label)}</p>
          {isWeekend && (
            <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs font-medium">
              週末
            </span>
          )}
        </div>

        <div className="space-y-1 text-xs sm:text-sm">
          <p className="flex justify-between">
            <span>個人 ACWR:</span>
            <span className="font-semibold" style={{ color: getRiskColor(riskLevel) }}>
              {typeof personalACWR === 'number' ? personalACWR.toFixed(2) : '-'}
            </span>
          </p>

          {isTeamAverageVisible && typeof teamACWR === 'number' && (
            <p className="flex justify-between">
              <span>チーム平均:</span>
              <span className="font-semibold text-purple-600">{teamACWR.toFixed(2)}</span>
            </p>
          )}

          {isTeamAverageVisible && diff != null && (
            <p className="flex justify-between text-xs">
              <span>差:</span>
              <span className={`font-semibold ${diff > 0.3 ? 'text-red-600' : 'text-gray-600'}`}>
                {diff > 0 ? '+' : ''}
                {diff.toFixed(2)}
              </span>
            </p>
          )}

          <p className="flex justify-between">
            <span>急性負荷:</span>
            <span className="font-semibold">{personalRow?.acuteLoad ?? personalRow?.acute_load ?? '-'}</span>
          </p>
          <p className="flex justify-between">
            <span>慢性負荷:</span>
            <span className="font-semibold">{personalRow?.chronicLoad ?? personalRow?.chronic_load ?? '-'}</span>
          </p>
          <p className="flex justify-between">
            <span>リスク:</span>
            <span className="font-semibold" style={{ color: getRiskColor(riskLevel) }}>
              {getRiskLabel(riskLevel)}
            </span>
          </p>
        </div>
      </div>
    );
  };

  const CustomDot = (props: any) => {
    const { cx, cy, payload } = props;
    if (!cx || !cy || !payload) return null;

    const d = new Date(payload.date);
    const isWeekend = !Number.isNaN(d.getTime()) && (d.getDay() === 0 || d.getDay() === 6);

    const riskLevel = payload?.riskLevel ?? payload?.risk_level ?? 'unknown';

    return (
      <circle
        cx={cx}
        cy={cy}
        r={isWeekend ? 5 : 4}
        fill={getRiskColor(riskLevel)}
        strokeWidth={2}
        stroke={isWeekend ? '#3B82F6' : 'white'}
        opacity={isWeekend ? 0.9 : 1}
      />
    );
  };

  return (
    <div className="w-full space-y-4">
      {safeDaysWithData < 28 && (
        <ACWRProgressIndicator daysWithData={safeDaysWithData} isDarkMode={isDarkMode} />
      )}

      {/* 期間選択コントロール */}
      <div className="mb-4 space-y-3">
        <div className="flex items-center space-x-2">
          <Calendar className="w-5 h-5 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">表示期間</span>
        </div>

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
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {period.label}
              </button>
            ))}
          </div>
        </div>

        {/* データ情報 */}
        <div className="bg-blue-50 rounded-lg p-3">
          <div className="flex items-center justify-between text-sm text-blue-700">
            <div>
              <span className="font-medium">表示中:</span> {filteredData.length}日分のデータ
              {selectedPeriod !== 'all' && (
                <span className="ml-2">
                  ({selectedPeriod === 'week'
                    ? '過去7日間'
                    : selectedPeriod === 'month'
                    ? '過去30日間'
                    : '過去90日間'})
                </span>
              )}
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-blue-500 rounded-full border-2 border-blue-600"></div>
              <span className="text-xs">週末は青い枠で強調</span>
            </div>
          </div>
        </div>

        {/* チーム平均比較トグル */}
        {safeTeamData.length > 0 && (
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsTeamAverageVisible(!isTeamAverageVisible)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isTeamAverageVisible
                  ? 'bg-purple-600 text-white hover:bg-purple-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {isTeamAverageVisible ? 'チーム平均を非表示' : 'チーム平均と比較'}
            </button>
            {isTeamAverageVisible && (
              <span className="text-xs text-gray-600 dark:text-gray-400">紫色の点線がチーム平均です</span>
            )}
          </div>
        )}
      </div>

      <div className="h-64 sm:h-96">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={filteredData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />

            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              stroke="#6b7280"
              fontSize={10}
              interval="preserveStartEnd"
            />
            <YAxis domain={[0, 'dataMax + 0.5']} stroke="#6b7280" fontSize={10} width={40} />
            <Tooltip content={<CustomTooltip />} />

            {/* risk zones */}
            <ReferenceLine y={1.5} stroke="#EF4444" strokeDasharray="5 5" />
            <ReferenceLine y={1.3} stroke="#F59E0B" strokeDasharray="5 5" />
            <ReferenceLine y={0.8} stroke="#10B981" strokeDasharray="5 5" />

            <Line
              type="monotone"
              dataKey="acwr"
              stroke="#6366f1"
              strokeWidth={2}
              dot={<CustomDot />}
              activeDot={{ r: 6, stroke: '#6366f1', strokeWidth: 2, fill: 'white' }}
              name="個人 ACWR"
            />

            {/* ✅ チーム平均は “別LineChart data” を渡せないので、同一dataにしないとズレやすい
                ただ現状は "data" props を Line に渡してるので、落ちないように維持しつつ、
                Tooltipは同日参照で正しく出す。 */}
            {isTeamAverageVisible && filteredTeamData.length > 0 && (
              <Line
                type="monotone"
                data={filteredTeamData as any}
                dataKey="acwr"
                stroke="#9333ea"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ r: 3, fill: '#9333ea', stroke: '#9333ea' }}
                activeDot={{ r: 5, stroke: '#9333ea', strokeWidth: 2, fill: 'white' }}
                name="チーム平均"
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
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

export default ACWRChart;