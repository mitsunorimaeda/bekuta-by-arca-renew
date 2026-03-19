import React from 'react';
import {
  RadarChart,
  Radar,
  PolarAngleAxis,
  PolarRadiusAxis,
  PolarGrid,
  ResponsiveContainer,
} from 'recharts';
import { Activity } from 'lucide-react';
import { useTeamRadar } from '../hooks/useTeamRadar';

function getGrade(percentile: number): { grade: string; cls: string } {
  if (percentile >= 90) return { grade: 'S', cls: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' };
  if (percentile >= 75) return { grade: 'A', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' };
  if (percentile >= 60) return { grade: 'B', cls: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' };
  if (percentile >= 40) return { grade: 'C', cls: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' };
  if (percentile >= 20) return { grade: 'D', cls: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' };
  return { grade: 'E', cls: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' };
}

function GradeBadge({ percentile }: { percentile: number }) {
  const { grade, cls } = getGrade(percentile);
  return (
    <span className={`inline-flex items-center rounded-full font-bold text-xs px-2 py-1 ${cls}`}>
      {grade}
    </span>
  );
}

interface TeamRadarChartProps {
  teamId: string;
}

export function TeamRadarChart({ teamId }: TeamRadarChartProps) {
  const { categoryDetails, radarData, overallScore, loading, error } = useTeamRadar(teamId);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800 p-6 text-center">
        <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
      </div>
    );
  }

  if (radarData.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 p-8 text-center">
        <Activity className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          チームのパフォーマンスデータがまだありません
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with overall score */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          チーム能力バランス
          <span className="text-xs text-gray-400 dark:text-gray-500 ml-2 font-normal">
            全選手比較（チーム平均）
          </span>
        </h3>
        {overallScore !== null && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">総合:</span>
            <GradeBadge percentile={overallScore} />
          </div>
        )}
      </div>

      {/* Radar Chart */}
      {radarData.length >= 3 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="75%">
              <PolarGrid stroke="#E5E7EB" />
              <PolarAngleAxis
                dataKey="category"
                tick={{ fill: '#6B7280', fontSize: 12 }}
              />
              <PolarRadiusAxis
                angle={90}
                domain={[0, 100]}
                tick={{ fill: '#9CA3AF', fontSize: 10 }}
                tickCount={5}
              />
              <Radar
                name="チーム平均パーセンタイル"
                dataKey="percentile"
                stroke="#6366F1"
                fill="#6366F1"
                fillOpacity={0.25}
                strokeWidth={2}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Category summary */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
        {categoryDetails.map((cat) => (
          <div key={cat.categoryName} className="flex items-center justify-between px-4 py-3">
            <div>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {cat.categoryDisplayName}
              </span>
              <span className="text-xs text-gray-400 ml-2">
                {cat.athleteCount}名 / {cat.testCount}種目
              </span>
            </div>
            <GradeBadge percentile={cat.avgPercentile} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default TeamRadarChart;
