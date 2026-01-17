import React from 'react';
import {
  Trophy,
  Calendar,
  FileText,
  TrendingUp,
  TrendingDown,
  Shield,
} from 'lucide-react';
import { PerformanceRecordWithTest, PersonalBest } from '../hooks/usePerformanceData';
import {
  getCalculatedUnit,
  formatCalculatedValue,
} from '../lib/performanceCalculations';

interface PerformanceRecordsListProps {
  records: PerformanceRecordWithTest[];
  personalBests: PersonalBest[];
  loading: boolean;
}

export function PerformanceRecordsList({
  records,
  personalBests,
  loading
}: PerformanceRecordsListProps) {

  // ✅ 文字列/数値どちらでも安全に数値化
  const toNumber = (v: any): number | null => {
    if (v === null || v === undefined || v === '') return null;
    const n = typeof v === 'string' ? parseFloat(v) : Number(v);
    return Number.isFinite(n) ? n : null;
  };

  // ✅ 種目名から単位を統一取得
  const getUnit = (record: PerformanceRecordWithTest): string => {
    const name = record.test_type?.name || '';
    return getCalculatedUnit(name) || record.test_type?.unit || '';
  };

  // ✅ PB判定：小数丸め/誤差で外れないように、表示丸め後の値で比較する
  const isPersonalBest = (record: PerformanceRecordWithTest): boolean => {
    const pb = personalBests.find(pb => pb.test_type_id === record.test_type_id);
    if (!pb) return false;

    const name = record.test_type?.name || '';
    const recordPV = toNumber(record.values?.primary_value);
    const pbVal = toNumber(pb.value);

    if (recordPV === null || pbVal === null) return false;

    // date一致 + 表示丸め一致（"2.50" と "2.5" 問題を潰す）
    const recordFmt = formatCalculatedValue(name, recordPV);
    const pbFmt = formatCalculatedValue(name, pbVal);

    return pb.date === record.date && recordFmt === pbFmt;
  };

  const getImprovementFromPrevious = (record: PerformanceRecordWithTest): number | null => {
    if (!record.test_type) return null;

    const sameTestPrev = records
      .filter(r => r.test_type_id === record.test_type_id)
      .filter(r => new Date(r.date) < new Date(record.date))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

    if (!sameTestPrev) return null;

    const cur = toNumber(record.values?.primary_value);
    const prev = toNumber(sameTestPrev.values?.primary_value);

    if (cur === null || prev === null || prev === 0) return null;

    // ✅ 変化率（previousが負のことは基本想定しないが、念のためabs）
    return ((cur - prev) / Math.abs(prev)) * 100;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full mb-4">
          <Trophy className="w-8 h-8 text-gray-400" />
        </div>
        <p className="text-gray-600 dark:text-gray-400">まだ測定記録がありません</p>
        <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
          最初の記録を追加して、成長を追跡しましょう！
        </p>
      </div>
    );
  }

  const groupedRecords = records.reduce((acc, record) => {
    if (!record.test_type) return acc;

    const displayName = record.test_type.display_name;
    if (!acc[displayName]) acc[displayName] = [];
    acc[displayName].push(record);
    return acc;
  }, {} as Record<string, PerformanceRecordWithTest[]>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          測定記録履歴
        </h3>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          全 {records.length} 件
        </span>
      </div>

      {Object.entries(groupedRecords).map(([testName, testRecords]) => {
        const first = testRecords[0];
        const unit = getUnit(first);
        const higherIsBetter = !!first.test_type?.higher_is_better;

        return (
          <div key={testName} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden transition-colors">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white">{testName}</h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    {unit} - {higherIsBetter ? '高い方が良い' : '低い方が良い'}
                  </p>
                </div>

                {first.test_type?.user_can_input === false && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300">
                    <Shield className="w-3 h-3 mr-1" />
                    専門業者測定
                  </span>
                )}
              </div>
            </div>

            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {testRecords.map((record) => {
                const isPB = isPersonalBest(record);
                const improvement = getImprovementFromPrevious(record);
                const name = record.test_type?.name || '';
                const unitEach = getUnit(record);

                const rawPV = toNumber(record.values?.primary_value);
                const displayPV = formatCalculatedValue(name, rawPV);

                const goodDirection =
                  improvement !== null &&
                  (
                    (improvement > 0 && record.test_type?.higher_is_better) ||
                    (improvement < 0 && !record.test_type?.higher_is_better)
                  );

                const relative1rm = toNumber(record.values?.relative_1rm);
                const weightAtTest = toNumber(record.values?.weight_at_test);

                return (
                  <div
                    key={record.id}
                    className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                      isPB ? 'bg-yellow-50 dark:bg-yellow-900/10 border-l-4 border-yellow-400' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {new Date(record.date).toLocaleDateString('ja-JP', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </span>
                          {isPB && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300">
                              <Trophy className="w-3 h-3 mr-1" />
                              PB
                            </span>
                          )}
                        </div>

                        <div className="flex items-baseline space-x-2 mb-2">
                          <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                            {displayPV}
                          </span>
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            {unitEach}
                          </span>

                          {improvement !== null && (
                            <span
                              className={`text-sm font-medium flex items-center ${
                                goodDirection
                                  ? 'text-green-600 dark:text-green-400'
                                  : 'text-red-600 dark:text-red-400'
                              }`}
                            >
                              {goodDirection ? (
                                <TrendingUp className="w-4 h-4 mr-1" />
                              ) : (
                                <TrendingDown className="w-4 h-4 mr-1" />
                              )}
                              {Math.abs(improvement).toFixed(1)}%
                            </span>
                          )}
                        </div>

                        {/* ✅ 筋力測定の場合、相対1RMを表示（表示も統一） */}
                        {record.test_type &&
                          ['bench_press', 'back_squat', 'deadlift', 'bulgarian_squat_r', 'bulgarian_squat_l'].includes(record.test_type.name) &&
                          relative1rm !== null && (
                            <div className="mb-2 inline-flex items-center px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
                              <span className="text-xs font-medium text-purple-700 dark:text-purple-300 mr-2">
                                相対1RM:
                              </span>
                              <span className="text-lg font-bold text-purple-600 dark:text-purple-400">
                                {relative1rm.toFixed(2)}
                              </span>
                              {weightAtTest !== null && (
                                <span className="text-xs text-purple-600 dark:text-purple-400 ml-2">
                                  (体重 {weightAtTest.toFixed(1)} kg)
                                </span>
                              )}
                            </div>
                          )}

                        {record.test_type && Array.isArray(record.test_type.fields) && (
                          <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-400">
                            {record.test_type.fields.map((field: any) => {
                              const value = record.values?.[field.name];
                              if (value === undefined || value === null || value === '') return null;

                              return (
                                <div key={field.name}>
                                  <span className="font-medium">{field.label}:</span> {value} {field.unit}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {record.notes && (
                          <div className="mt-2 flex items-start space-x-2">
                            <FileText className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                            <p className="text-sm text-gray-600 dark:text-gray-400">{record.notes}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}