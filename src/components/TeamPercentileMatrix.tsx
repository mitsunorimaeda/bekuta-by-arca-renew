import React from 'react';
import { Users } from 'lucide-react';
import { useTeamPercentileMatrix } from '../hooks/useTeamPercentileMatrix';

function getGrade(percentile: number): { grade: string; cls: string } {
  if (percentile >= 90) return { grade: 'S', cls: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300' };
  if (percentile >= 75) return { grade: 'A', cls: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300' };
  if (percentile >= 60) return { grade: 'B', cls: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300' };
  if (percentile >= 40) return { grade: 'C', cls: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300' };
  if (percentile >= 20) return { grade: 'D', cls: 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300' };
  return { grade: 'E', cls: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300' };
}

function cellGrade(percentile: number | undefined): { grade: string; cls: string } {
  if (percentile === undefined) return { grade: '-', cls: 'bg-gray-50 dark:bg-gray-800 text-gray-400' };
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

  // Sort athletes by overall average descending
  const sortedAthletes = [...athletes].sort((a, b) => {
    const avgA = averagePercentile(matrix, a.userId, categories) ?? -1;
    const avgB = averagePercentile(matrix, b.userId, categories) ?? -1;
    return avgB - avgA;
  });

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
        選手評価マトリクス
        <span className="text-xs text-gray-400 dark:text-gray-500 ml-2 font-normal">
          全選手比較（カテゴリ平均）
        </span>
      </h3>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 sticky left-0 bg-white dark:bg-gray-800 z-10 min-w-[120px]">
                  選手名
                </th>
                {categories.map((cat) => (
                  <th
                    key={cat.name}
                    className="text-center px-3 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 min-w-[80px]"
                  >
                    {cat.displayName}
                  </th>
                ))}
                <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 min-w-[70px]">
                  総合
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {sortedAthletes.map((athlete) => {
                const avg = averagePercentile(matrix, athlete.userId, categories);
                return (
                  <tr key={athlete.userId} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-white sticky left-0 bg-white dark:bg-gray-800 z-10">
                      {athlete.name}
                    </td>
                    {categories.map((cat) => {
                      const val = matrix[athlete.userId]?.[cat.name];
                      const { grade, cls } = cellGrade(val);
                      return (
                        <td key={cat.name} className="px-3 py-2.5 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-md text-xs font-bold ${cls}`}
                          >
                            {grade}
                          </span>
                        </td>
                      );
                    })}
                    <td className="px-3 py-2.5 text-center">
                      {(() => {
                        const { grade, cls } = cellGrade(avg ?? undefined);
                        return (
                          <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-bold ${cls}`}>
                            {grade}
                          </span>
                        );
                      })()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-[10px] text-gray-400 px-1">
        <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-purple-100 dark:bg-purple-900/30" /> S トップ</span>
        <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-100 dark:bg-emerald-900/30" /> A 上位</span>
        <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-100 dark:bg-blue-900/30" /> B 平均以上</span>
        <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-100 dark:bg-yellow-900/30" /> C 平均</span>
        <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-100 dark:bg-orange-900/30" /> D 平均以下</span>
        <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-100 dark:bg-red-900/30" /> E 要改善</span>
      </div>
    </div>
  );
}

export default TeamPercentileMatrix;
