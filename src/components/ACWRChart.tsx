import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { ACWRData, getRiskColor } from '../lib/acwr';
import { Calendar, Filter } from 'lucide-react';
import ACWRProgressIndicator from './ACWRProgressIndicator';

interface ACWRChartProps {
  data: ACWRData[];
  daysWithData?: number;
  isDarkMode?: boolean;
  teamAverageData?: ACWRData[];
  showTeamAverage?: boolean;
}

export function ACWRChart({ data, daysWithData = 0, isDarkMode = false, teamAverageData = [], showTeamAverage = false }: ACWRChartProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'quarter' | 'all'>('month');
  const [isTeamAverageVisible, setIsTeamAverageVisible] = useState(showTeamAverage);

  // データを期間でフィルタリング
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

    return data.filter(item => {
      const itemDate = new Date(item.date);
      return itemDate >= startDate && itemDate <= today;
    });
  }, [data, selectedPeriod]);

  // チーム平均データをフィルタリング
  const filteredTeamData = useMemo(() => {
    if (teamAverageData.length === 0) return [];

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
        return teamAverageData;
    }

    return teamAverageData.filter(item => {
      const itemDate = new Date(item.date);
      return itemDate >= startDate && itemDate <= today;
    });
  }, [teamAverageData, selectedPeriod]);

  const MINIMUM_DAYS = 21;
  const isDataSufficient = daysWithData >= MINIMUM_DAYS;

  if (data.length === 0) {
    return (
      <div className="space-y-4">
        {daysWithData > 0 && (
          <ACWRProgressIndicator daysWithData={daysWithData} isDarkMode={isDarkMode} />
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
    return (
      <div className="space-y-4">
        <ACWRProgressIndicator daysWithData={daysWithData} isDarkMode={isDarkMode} />
        <div className="flex items-center justify-center h-64 sm:h-96 text-gray-500 dark:text-gray-400 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
          <div className="text-center px-4">
            <p className="text-base sm:text-lg mb-2">ACWR分析準備中</p>
            <p className="text-sm">あと{MINIMUM_DAYS - daysWithData}日分のデータでACWR分析が始まります</p>
          </div>
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
      const data = payload[0].payload;
      const date = new Date(label);
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;

      // チーム平均データを探す
      const teamData = isTeamAverageVisible && filteredTeamData.find(td => td.date === label);

      return (
        <div className="bg-white p-3 sm:p-4 border border-gray-200 rounded-lg shadow-lg max-w-xs">
          <div className="flex items-center space-x-2 mb-2">
            <p className="font-medium text-gray-900 text-sm sm:text-base">
              {formatDateWithDay(label)}
            </p>
            {isWeekend && (
              <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs font-medium">
                週末
              </span>
            )}
          </div>
          <div className="space-y-1 text-xs sm:text-sm">
            <p className="flex justify-between">
              <span>個人 ACWR:</span>
              <span className="font-semibold" style={{ color: getRiskColor(data.riskLevel) }}>
                {data.acwr}
              </span>
            </p>
            {teamData && (
              <p className="flex justify-between">
                <span>チーム平均:</span>
                <span className="font-semibold text-purple-600">
                  {teamData.acwr}
                </span>
              </p>
            )}
            {teamData && (
              <p className="flex justify-between text-xs">
                <span>差:</span>
                <span className={`font-semibold ${(data.acwr - teamData.acwr) > 0.3 ? 'text-red-600' : 'text-gray-600'}`}>
                  {(data.acwr - teamData.acwr) > 0 ? '+' : ''}{(data.acwr - teamData.acwr).toFixed(2)}
                </span>
              </p>
            )}
            <p className="flex justify-between">
              <span>急性負荷:</span>
              <span className="font-semibold">{data.acuteLoad}</span>
            </p>
            <p className="flex justify-between">
              <span>慢性負荷:</span>
              <span className="font-semibold">{data.chronicLoad}</span>
            </p>
            <p className="flex justify-between">
              <span>リスク:</span>
              <span className="font-semibold" style={{ color: getRiskColor(data.riskLevel) }}>
                {getRiskLabel(data.riskLevel)}
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
          stroke={isWeekend ? "#3B82F6" : "white"}
          opacity={isWeekend ? 0.9 : 1}
        />
      );
    }
    return null;
  };

  return (
    <div className="w-full space-y-4">
      {daysWithData < 28 && (
        <ACWRProgressIndicator daysWithData={daysWithData} isDarkMode={isDarkMode} />
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
              { value: 'all', label: '全期間' }
            ].map(period => (
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
                  ({selectedPeriod === 'week' ? '過去7日間' :
                    selectedPeriod === 'month' ? '過去30日間' : '過去90日間'})
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
        {teamAverageData.length > 0 && (
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
              <span className="text-xs text-gray-600 dark:text-gray-400">
                紫色の点線がチーム平均です
              </span>
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
            <YAxis 
              domain={[0, 'dataMax + 0.5']}
              stroke="#6b7280"
              fontSize={10}
              width={40}
            />
            <Tooltip content={<CustomTooltip />} />
            
            {/* Reference lines for risk zones */}
            <ReferenceLine y={1.5} stroke="#EF4444" strokeDasharray="5 5" />
            <ReferenceLine y={1.3} stroke="#F59E0B" strokeDasharray="5 5" />
            <ReferenceLine y={0.8} stroke="#10B981" strokeDasharray="5 5" />
            
            <Line
              type="monotone"
              dataKey="acwr"
              stroke="#6366f1"
              strokeWidth={2}
              dot={<CustomDot />}
              activeDot={{ r: 6, stroke: "#6366f1", strokeWidth: 2, fill: "white" }}
              name="個人 ACWR"
            />
            {isTeamAverageVisible && filteredTeamData.length > 0 && (
              <Line
                type="monotone"
                data={filteredTeamData}
                dataKey="acwr"
                stroke="#9333ea"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ r: 3, fill: "#9333ea", stroke: "#9333ea" }}
                activeDot={{ r: 5, stroke: "#9333ea", strokeWidth: 2, fill: "white" }}
                name="チーム平均"
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
    case 'high': return '高リスク';
    case 'caution': return '注意';
    case 'good': return '良好';
    case 'low': return '低負荷';
    default: return '不明';
  }
}