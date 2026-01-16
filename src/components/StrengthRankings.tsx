import React, { useMemo, useState } from 'react';
import { Trophy, Users, Weight, ArrowUpDown } from 'lucide-react';
import { useStrengthRankings } from '../hooks/useStrengthRankings';

type Props = {
  testTypeId: string | null;
  testTypeDisplayName?: string;
  limit?: number;
};

export function StrengthRankings({ testTypeId, testTypeDisplayName, limit = 50 }: Props) {
  const [metric, setMetric] = useState<'absolute' | 'relative'>('absolute');
  const { sortedAbsolute, sortedRelative, loading, error } = useStrengthRankings(testTypeId, limit);

  const rows = metric === 'absolute' ? sortedAbsolute : sortedRelative;

  const title = useMemo(() => {
    const base = testTypeDisplayName ? `${testTypeDisplayName}` : '筋力';
    return metric === 'absolute' ? `${base}｜推定1RMランキング` : `${base}｜相対1RMランキング`;
  }, [metric, testTypeDisplayName]);

  if (!testTypeId) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
        <p className="text-sm text-gray-600 dark:text-gray-400">種目を選択してください</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
            <Trophy className="w-5 h-5 mr-2 text-yellow-500" />
            {title}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            最新記録（1人1件）で集計 / 測定回数が多い子に偏らない
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setMetric('absolute')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              metric === 'absolute'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200'
            }`}
          >
            推定1RM
          </button>
          <button
            onClick={() => setMetric('relative')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              metric === 'relative'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200'
            }`}
          >
            相対1RM
          </button>
        </div>
      </div>

      <div className="p-5">
        {loading && (
          <div className="flex items-center justify-center py-10">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
          </div>
        )}

        {!loading && error && (
          <div className="text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {!loading && !error && rows.length === 0 && (
          <div className="text-center py-10 text-gray-600 dark:text-gray-400">
            まだ記録がありません
          </div>
        )}

        {!loading && !error && rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  <th className="py-2 pr-3 w-14">順位</th>
                  <th className="py-2 pr-3">選手</th>
                  <th className="py-2 pr-3">
                    <span className="inline-flex items-center gap-1">
                      <ArrowUpDown className="w-4 h-4" />
                      推定1RM
                    </span>
                  </th>
                  <th className="py-2 pr-3">
                    <span className="inline-flex items-center gap-1">
                      <Weight className="w-4 h-4" />
                      相対1RM
                    </span>
                  </th>
                  <th className="py-2 pr-3">体重</th>
                  <th className="py-2 pr-3">測定日</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {rows.map((r, idx) => {
                  const rank = idx + 1;

                  const abs = r.absolute_1rm !== null ? r.absolute_1rm.toFixed(1) : '-';
                  const rel = r.relative_1rm !== null ? r.relative_1rm.toFixed(2) : '-';
                  const bw = r.weight_at_test !== null ? r.weight_at_test.toFixed(1) : '-';

                  const highlight =
                    metric === 'absolute'
                      ? r.absolute_1rm !== null && idx === 0
                      : r.relative_1rm !== null && idx === 0;

                  return (
                    <tr
                      key={r.user_id}
                      className={highlight ? 'bg-yellow-50 dark:bg-yellow-900/10' : ''}
                    >
                      <td className="py-3 pr-3 font-semibold text-gray-900 dark:text-white">
                        {rank}
                      </td>
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-gray-400" />
                          <span className="font-medium text-gray-900 dark:text-white">
                            {r.display_name}
                          </span>
                        </div>
                      </td>

                      <td className={`py-3 pr-3 font-semibold ${metric === 'absolute' ? 'text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-200'}`}>
                        {abs} kg
                      </td>

                      <td className={`py-3 pr-3 font-semibold ${metric === 'relative' ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-700 dark:text-gray-200'}`}>
                        {rel}
                      </td>

                      <td className="py-3 pr-3 text-gray-700 dark:text-gray-200">
                        {bw !== '-' ? `${bw} kg` : '-'}
                      </td>

                      <td className="py-3 pr-3 text-gray-600 dark:text-gray-400">
                        {new Date(r.date).toLocaleDateString('ja-JP')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
              ※相対1RM = 推定1RM ÷ 体重（測定時の体重） / 体重が未保存の場合は表示されません
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
