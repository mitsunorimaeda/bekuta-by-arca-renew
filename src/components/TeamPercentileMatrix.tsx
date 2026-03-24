import React, { useState } from 'react';
import { Users, ChevronDown, ChevronUp, Trophy } from 'lucide-react';
import { useTeamPercentileMatrix } from '../hooks/useTeamPercentileMatrix';

function getGrade(percentile: number): { grade: string; cls: string; bg: string; ring: string } {
  if (percentile >= 90) return { grade: 'S', cls: 'text-purple-700 dark:text-purple-300', bg: 'bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-900/40 dark:to-purple-800/30', ring: 'ring-purple-300 dark:ring-purple-700' };
  if (percentile >= 75) return { grade: 'A', cls: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-gradient-to-br from-emerald-100 to-emerald-200 dark:from-emerald-900/40 dark:to-emerald-800/30', ring: 'ring-emerald-300 dark:ring-emerald-700' };
  if (percentile >= 60) return { grade: 'B', cls: 'text-blue-700 dark:text-blue-300', bg: 'bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/40 dark:to-blue-800/30', ring: 'ring-blue-300 dark:ring-blue-700' };
  if (percentile >= 40) return { grade: 'C', cls: 'text-amber-700 dark:text-amber-300', bg: 'bg-gradient-to-br from-amber-100 to-amber-200 dark:from-amber-900/40 dark:to-amber-800/30', ring: 'ring-amber-300 dark:ring-amber-700' };
  if (percentile >= 20) return { grade: 'D', cls: 'text-orange-700 dark:text-orange-300', bg: 'bg-gradient-to-br from-orange-100 to-orange-200 dark:from-orange-900/40 dark:to-orange-800/30', ring: 'ring-orange-300 dark:ring-orange-700' };
  return { grade: 'E', cls: 'text-red-700 dark:text-red-300', bg: 'bg-gradient-to-br from-red-100 to-red-200 dark:from-red-900/40 dark:to-red-800/30', ring: 'ring-red-300 dark:ring-red-700' };
}

function cellGrade(percentile: number | undefined) {
  if (percentile === undefined) return { grade: '-', cls: 'text-gray-300 dark:text-gray-600', bg: 'bg-gray-50 dark:bg-gray-800', ring: '' };
  return getGrade(percentile);
}

function averagePercentile(
  matrix: Record<string, Record<string, number>>,
  userId: string,
  categories: { name: string }[]
): number | null {
  const vals = categories
    .map((c) => matrix[userId]?.[c.name])
    .filter((v): v is number => v !== undefined);
  if (vals.length === 0) return null;
  return Math.round(vals.reduce((s, v) => s + v, 0) / vals.length);
}

interface TeamPercentileMatrixProps {
  teamId: string;
}

export function TeamPercentileMatrix({ teamId }: TeamPercentileMatrixProps) {
  const { athletes, categories, matrix, loading, error } = useTeamPercentileMatrix(teamId);
  const [sortAsc, setSortAsc] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
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

  if (athletes.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 p-8 text-center">
        <Users className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          パフォーマンスデータのある選手がいません
        </p>
      </div>
    );
  }

  const sortedAthletes = [...athletes].sort((a, b) => {
    const avgA = averagePercentile(matrix, a.userId, categories) ?? -1;
    const avgB = averagePercentile(matrix, b.userId, categories) ?? -1;
    return sortAsc ? avgA - avgB : avgB - avgA;
  });

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* ヘッダー */}
      <div className="px-4 sm:px-5 py-4 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              選手評価マトリクス
            </h3>
            <span className="text-xs text-gray-400 dark:text-gray-500 font-normal">
              {athletes.length}名
            </span>
          </div>
          <button
            onClick={() => setSortAsc(!sortAsc)}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
          >
            {sortAsc ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {sortAsc ? '昇順' : '降順'}
          </button>
        </div>
      </div>

      {/* テーブル */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-700">
              <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider sticky left-0 bg-white dark:bg-gray-800 z-10 min-w-[100px]">
                選手
              </th>
              {categories.map((cat) => (
                <th
                  key={cat.name}
                  className="text-center px-2 py-2.5 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider min-w-[56px]"
                >
                  {cat.displayName}
                </th>
              ))}
              <th className="text-center px-3 py-2.5 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider min-w-[56px] bg-gray-50 dark:bg-gray-750">
                総合
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedAthletes.map((athlete, idx) => {
              const avg = averagePercentile(matrix, athlete.userId, categories);
              const avgGrade = cellGrade(avg ?? undefined);
              const isTop3 = !sortAsc && idx < 3;

              return (
                <tr
                  key={athlete.userId}
                  className={`border-b border-gray-50 dark:border-gray-700/50 transition-colors hover:bg-gray-50/50 dark:hover:bg-gray-700/20 ${
                    isTop3 ? 'bg-amber-50/30 dark:bg-amber-900/5' : ''
                  }`}
                >
                  <td className="px-4 py-2 sticky left-0 bg-white dark:bg-gray-800 z-10">
                    <div className="flex items-center gap-2">
                      {isTop3 && (
                        <span className={`text-xs font-bold ${
                          idx === 0 ? 'text-amber-500' : idx === 1 ? 'text-gray-400' : 'text-amber-700'
                        }`}>
                          {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}
                        </span>
                      )}
                      <span className="text-xs font-medium text-gray-900 dark:text-white truncate max-w-[80px]">
                        {athlete.name}
                      </span>
                    </div>
                  </td>
                  {categories.map((cat) => {
                    const val = matrix[athlete.userId]?.[cat.name];
                    const { grade, cls, bg, ring } = cellGrade(val);
                    return (
                      <td key={cat.name} className="px-2 py-2 text-center">
                        <span
                          className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-xs font-bold ${bg} ${cls} ${ring ? `ring-1 ${ring}` : ''} transition-transform hover:scale-110`}
                          title={val !== undefined ? `${val}%` : 'データなし'}
                        >
                          {grade}
                        </span>
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-center bg-gray-50/50 dark:bg-gray-750/50">
                    <span
                      className={`inline-flex items-center justify-center w-9 h-9 rounded-xl text-sm font-extrabold ${avgGrade.bg} ${avgGrade.cls} ${avgGrade.ring ? `ring-2 ${avgGrade.ring}` : ''} shadow-sm`}
                    >
                      {avgGrade.grade}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 凡例 */}
      <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800">
        <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center">
          {[
            { grade: 'S', label: '90%+', color: 'bg-purple-200 dark:bg-purple-900/40' },
            { grade: 'A', label: '75%+', color: 'bg-emerald-200 dark:bg-emerald-900/40' },
            { grade: 'B', label: '60%+', color: 'bg-blue-200 dark:bg-blue-900/40' },
            { grade: 'C', label: '40%+', color: 'bg-amber-200 dark:bg-amber-900/40' },
            { grade: 'D', label: '20%+', color: 'bg-orange-200 dark:bg-orange-900/40' },
            { grade: 'E', label: '<20%', color: 'bg-red-200 dark:bg-red-900/40' },
          ].map(({ grade, label, color }) => (
            <span key={grade} className="inline-flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400">
              <span className={`w-5 h-5 rounded-md ${color} inline-flex items-center justify-center text-[10px] font-bold`}>
                {grade}
              </span>
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default TeamPercentileMatrix;
