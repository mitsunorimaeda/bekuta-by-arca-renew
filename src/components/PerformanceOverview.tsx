import React, { useEffect, useMemo, useState } from 'react';
import { Trophy, TrendingUp, Calendar } from 'lucide-react';
import { PerformanceRecordWithTest, PersonalBest } from '../hooks/usePerformanceData';
import { PerformanceTestType } from '../lib/supabase';
import { PerformanceChart } from './PerformanceChart';
import { supabase } from '../lib/supabase';
import { getCalculatedUnit } from '../lib/performanceCalculations';

type TeamBenchmarkRow = {
  test_type_id: string;
  my_date: string | null;
  my_value: number | null;
  team_n: number | null;
  team_avg: number | null;
  team_sd: number | null;
  diff_vs_team_avg: number | null; // プラス=良い（RPC側で調整済み）
  team_rank: number | null;
  team_top_percent: number | null; // 0に近いほど上位（例: 12.5）
};

interface PerformanceOverviewProps {
  testTypes: PerformanceTestType[];
  records: PerformanceRecordWithTest[];
  personalBests: PersonalBest[];
  getRecordsByTestType: (testTypeId: string) => PerformanceRecordWithTest[];
  getPersonalBest: (testTypeId: string) => PersonalBest | undefined;
}

export function PerformanceOverview({
  testTypes,
  records,
  personalBests,
  getRecordsByTestType,
  getPersonalBest,
}: PerformanceOverviewProps) {
  const [selectedTestTypeId, setSelectedTestTypeId] = useState<string | null>(null);

  // ★追加：チームベンチマーク
  const [teamBenchmarksByTestId, setTeamBenchmarksByTestId] = useState<Record<string, TeamBenchmarkRow>>({});
  const [benchLoading, setBenchLoading] = useState(false);

  useEffect(() => {
    // recordsが0なら取る意味が薄いのでスキップ（不要なら外してOK）
    if (!records || records.length === 0) return;

    let cancelled = false;

    (async () => {
      try {
        setBenchLoading(true);
        const { data, error } = await supabase.rpc('get_my_team_benchmarks', { p_days: 90 });
        if (error) throw error;

        const map: Record<string, TeamBenchmarkRow> = {};
        (data ?? []).forEach((row: any) => {
          if (row?.test_type_id) map[row.test_type_id] = row as TeamBenchmarkRow;
        });

        if (!cancelled) setTeamBenchmarksByTestId(map);
      } catch (e) {
        console.warn('[get_my_team_benchmarks error]', e);
        // 失敗してもUIは通常表示でOK（ベンチだけ出ない）
        if (!cancelled) setTeamBenchmarksByTestId({});
      } finally {
        if (!cancelled) setBenchLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [records?.length]);

  const selectedTestType = useMemo(() => {
    return selectedTestTypeId ? testTypes.find((t) => t.id === selectedTestTypeId) : null;
  }, [selectedTestTypeId, testTypes]);

  const selectedRecords = useMemo(() => {
    return selectedTestTypeId ? getRecordsByTestType(selectedTestTypeId) : [];
  }, [selectedTestTypeId, getRecordsByTestType]);

  const selectedPB = useMemo(() => {
    return selectedTestTypeId ? getPersonalBest(selectedTestTypeId) : undefined;
  }, [selectedTestTypeId, getPersonalBest]);

  if (records.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-8 text-center transition-colors">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-full mb-4">
          <Trophy className="w-10 h-10 text-blue-600 dark:text-blue-400" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">測定を始めましょう！</h3>
        <p className="text-gray-600 dark:text-gray-400">
          最初のジャンプ測定を記録して、成長を追跡しましょう。
        </p>
      </div>
    );
  }

  const formatValue = (value: any, testTypeName: string) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (num === null || num === undefined || Number.isNaN(num)) return '-';
    return num.toFixed(testTypeName.includes('rsi') ? 2 : 1);
  };

  const unitFor = (testType: PerformanceTestType) => {
    return getCalculatedUnit(testType.name || '') || testType.unit;
  };

  return (
    <div className="space-y-6">
      {/* Personal Bests Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {testTypes.map((testType) => {
          const pb = getPersonalBest(testType.id);
          const testRecords = getRecordsByTestType(testType.id);
          const latestRecord = testRecords[0];

          const bench = teamBenchmarksByTestId[testType.id];
          const showBench = !!bench && !!bench.team_n && bench.team_n >= 2;

          return (
            <button
              key={testType.id}
              onClick={() => setSelectedTestTypeId(testType.id)}
              className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 text-left transition-all hover:shadow-md ${
                selectedTestTypeId === testType.id ? 'ring-2 ring-blue-500 dark:ring-blue-400' : ''
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <h4 className="font-semibold text-gray-900 dark:text-white text-sm">{testType.display_name}</h4>
                {pb && <Trophy className="w-5 h-5 text-yellow-500 flex-shrink-0" />}
              </div>

              {pb ? (
                <>
                  <div className="mb-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">パーソナルベスト</p>
                    <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                      {pb.value.toFixed(testType.name.includes('rsi') ? 2 : 1)}
                      <span className="text-sm ml-1 text-gray-600 dark:text-gray-400">{unitFor(testType)}</span>
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {new Date(pb.date).toLocaleDateString('ja-JP')}
                    </p>
                  </div>

                  {latestRecord && latestRecord.date !== pb.date && (
                    <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">最新記録</p>
                      <p className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                        {formatValue(latestRecord.values.primary_value, testType.name)}
                        <span className="text-xs ml-1 text-gray-600 dark:text-gray-400">{unitFor(testType)}</span>
                      </p>
                    </div>
                  )}
                </>
              ) : testRecords.length > 0 ? (
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">最新記録</p>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {formatValue(latestRecord.values.primary_value, testType.name)}
                    <span className="text-sm ml-1 text-gray-600 dark:text-gray-400">{unitFor(testType)}</span>
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {new Date(latestRecord.date).toLocaleDateString('ja-JP')}
                  </p>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-gray-400 dark:text-gray-500">未測定</p>
                </div>
              )}

              {/* ★追加：チーム比較（種目カード内に表示） */}
              {testRecords.length > 0 && (
                <div className="mt-3">
                  {showBench ? (
                    <div className="flex flex-wrap gap-2">
                      {/* 平均 */}
                      {bench.team_avg !== null && bench.team_avg !== undefined && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                          チーム平均 {Number(bench.team_avg).toFixed(testType.name.includes('rsi') ? 2 : 1)}
                        </span>
                      )}

                      {/* 平均差（プラス=良い） */}
                      {bench.diff_vs_team_avg !== null && bench.diff_vs_team_avg !== undefined && (
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-[11px] font-medium ${
                            bench.diff_vs_team_avg >= 0
                              ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-200'
                              : 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-200'
                          }`}
                        >
                          平均差 {bench.diff_vs_team_avg >= 0 ? '+' : ''}
                          {Number(bench.diff_vs_team_avg).toFixed(testType.name.includes('rsi') ? 2 : 1)}
                        </span>
                      )}

                      {/* 順位 */}
                      {bench.team_rank !== null && bench.team_rank !== undefined && bench.team_n && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-[11px] font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-200">
                          {bench.team_n}人中 {bench.team_rank}位
                        </span>
                      )}

                      {/* 上位% */}
                      {bench.team_top_percent !== null && bench.team_top_percent !== undefined && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-[11px] font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200">
                          上位 {Number(bench.team_top_percent).toFixed(1)}%
                        </span>
                      )}

                      {/* n少ない注意 */}
                      {bench.team_n && bench.team_n < 10 && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-[11px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                          参考（n少）
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="text-[11px] text-gray-500 dark:text-gray-400">
                      {benchLoading ? 'チーム比較を計算中…' : 'チーム比較はデータ不足（n<2）'}
                    </div>
                  )}
                </div>
              )}

              {testRecords.length > 0 && (
                <div className="mt-3 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span className="flex items-center">
                    <Calendar className="w-3 h-3 mr-1" />
                    {testRecords.length}回測定
                  </span>
                  {testRecords.length > 1 && (
                    <span className="flex items-center text-blue-600 dark:text-blue-400">
                      <TrendingUp className="w-3 h-3 mr-1" />
                      グラフを見る
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected Test Type Chart */}
      {selectedTestType && selectedRecords.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {selectedTestType.display_name} の成長グラフ
              </h3>

              {/* ★追加：選択中種目のチーム比較（見出し下に軽く） */}
              {teamBenchmarksByTestId[selectedTestType.id]?.team_n &&
                teamBenchmarksByTestId[selectedTestType.id].team_n! >= 2 && (
                  <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                    チーム平均:{' '}
                    {teamBenchmarksByTestId[selectedTestType.id].team_avg !== null &&
                    teamBenchmarksByTestId[selectedTestType.id].team_avg !== undefined
                      ? Number(teamBenchmarksByTestId[selectedTestType.id].team_avg).toFixed(
                          selectedTestType.name.includes('rsi') ? 2 : 1
                        )
                      : '-'}
                    {unitFor(selectedTestType)} / {teamBenchmarksByTestId[selectedTestType.id].team_n}人中{' '}
                    {teamBenchmarksByTestId[selectedTestType.id].team_rank ?? '-'}位（上位{' '}
                    {teamBenchmarksByTestId[selectedTestType.id].team_top_percent !== null &&
                    teamBenchmarksByTestId[selectedTestType.id].team_top_percent !== undefined
                      ? Number(teamBenchmarksByTestId[selectedTestType.id].team_top_percent).toFixed(1)
                      : '-'}
                    %）
                  </p>
                )}
            </div>

            <button
              onClick={() => setSelectedTestTypeId(null)}
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            >
              閉じる
            </button>
          </div>

          <PerformanceChart records={selectedRecords} personalBest={selectedPB} testTypeName={selectedTestType.display_name} />
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-700 dark:text-blue-300 mb-1">総測定回数</p>
              <p className="text-3xl font-bold text-blue-900 dark:text-blue-100">{records.length}</p>
            </div>
            <Calendar className="w-10 h-10 text-blue-600 dark:text-blue-400 opacity-50" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/30 dark:to-yellow-800/30 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-1">パーソナルベスト</p>
              <p className="text-3xl font-bold text-yellow-900 dark:text-yellow-100">{personalBests.length}</p>
            </div>
            <Trophy className="w-10 h-10 text-yellow-600 dark:text-yellow-400 opacity-50" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/30 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-700 dark:text-green-300 mb-1">測定種目</p>
              <p className="text-3xl font-bold text-green-900 dark:text-green-100">
                {testTypes.filter((t) => getRecordsByTestType(t.id).length > 0).length}
              </p>
              <p className="text-xs text-green-600 dark:text-green-400">/ {testTypes.length}</p>
            </div>
            <TrendingUp className="w-10 h-10 text-green-600 dark:text-green-400 opacity-50" />
          </div>
        </div>
      </div>
    </div>
  );
}
