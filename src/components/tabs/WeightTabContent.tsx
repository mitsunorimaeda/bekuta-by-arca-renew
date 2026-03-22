// src/components/tabs/WeightTabContent.tsx
import React, { Suspense, lazy } from 'react';
import { Scale } from 'lucide-react';
import { WeightForm } from '../WeightForm';
import { BMIDisplay } from '../BMIDisplay';
import { getRiskLabel, getRiskColor } from '../../lib/acwr';
import type { ActiveTab } from '../../types/athlete';

// ── Lazy ──
const WeightChartLazy = lazy(() => import('../WeightChart').then((m) => ({ default: m.WeightChart })));
const WeightRecordsListLazy = lazy(() => import('../WeightRecordsList').then((m) => ({ default: m.WeightRecordsList })));
const InBodyLatestCardLazy = lazy(() => import('../InBodyLatestCard').then((m) => ({ default: m.InBodyLatestCard })));
const InBodyChartsLazy = lazy(() => import('../InBodyCharts').then((m) => ({ default: m.InBodyCharts })));

// ── Shared fallbacks ──
const TabFallback = ({ label = '読み込み中...', heightClass = 'h-64' }: { label?: string; heightClass?: string }) => (
  <div className={`flex items-center justify-center ${heightClass}`}>
    <div className="flex items-center gap-3 text-gray-500 dark:text-gray-300">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      <span className="text-sm">{label}</span>
    </div>
  </div>
);

const SkeletonBlock = ({ heightClass = 'h-40' }: { heightClass?: string }) => (
  <div className={`w-full ${heightClass} bg-gray-100 dark:bg-gray-700/40 rounded-xl animate-pulse`} />
);

export type WeightTabContentProps = {
  setActiveTab: (tab: ActiveTab) => void;
  // ACWR cross-reference
  latestACWR: any;
  latestACWRValue: number | null;
  // weight
  weightRecords: any[];
  weightLoading: boolean;
  addWeightRecord: any;
  checkExistingWeightRecord: any;
  updateWeightRecord: any;
  deleteWeightRecord: any;
  getLatestWeight: () => number | null;
  getWeightChange: (days: number) => number | null;
  lastWeightRecord: any;
  latestWeight: number | null;
  // InBody
  inbodyRecords: any[];
  latestInbody: any;
  inbodyLoading: boolean;
  inbodyError: string | null;
  // BMI
  userHeightCm: number | null;
  userDateOfBirth: string | null;
  normalizedGenderFull: 'female' | 'male' | 'other' | 'prefer_not_to_say' | null;
  normalizedGenderBinary: 'female' | 'male' | null;
};

export function WeightTabContent(props: WeightTabContentProps) {
  const {
    setActiveTab,
    latestACWR,
    latestACWRValue,
    weightRecords,
    weightLoading,
    addWeightRecord,
    checkExistingWeightRecord,
    updateWeightRecord,
    deleteWeightRecord,
    getLatestWeight,
    getWeightChange,
    lastWeightRecord,
    latestWeight,
    inbodyRecords,
    latestInbody,
    inbodyLoading,
    inbodyError,
    userHeightCm,
    userDateOfBirth,
    normalizedGenderFull,
    normalizedGenderBinary,
  } = props;

  return (
    /* Weight Management Tab */
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
      {/* Left Column - Weight Form and Stats */}
      <div className="lg:col-span-1 space-y-6">
        {/* Cross-tab reference: Latest ACWR */}
        {latestACWR && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-blue-600 dark:text-blue-400 mb-1">現在のACWR</p>
                <p className="text-2xl font-bold" style={{ color: getRiskColor(latestACWR.riskLevel) }}>
                  {latestACWRValue != null ? latestACWRValue.toFixed(2) : '--'}
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">{getRiskLabel(latestACWR.riskLevel ?? 'unknown')}</p>
              </div>
              <button type="button" onClick={() => setActiveTab('overview')} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
                練習記録へ →
              </button>
            </div>
          </div>
        )}

        {/* Weight Stats Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 sm:p-6 transition-colors">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">体重サマリー</h3>
          <div className="space-y-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-xs text-blue-600 mb-1">現在の体重</p>
              <p className="text-2xl font-bold text-blue-700">
                {getLatestWeight() !== null ? `${getLatestWeight()!.toFixed(1)} kg` : '未記録'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 transition-colors">
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">30日変化</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {getWeightChange(30) !== null ? (
                    <>
                      {getWeightChange(30)! > 0 ? '+' : ''}
                      {getWeightChange(30)!.toFixed(1)} kg
                    </>
                  ) : (
                    '-'
                  )}
                </p>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 transition-colors">
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">記録数</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{weightRecords.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* InBody Latest */}
        {inbodyLoading ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 sm:p-6 transition-colors">
            <div className="flex items-center justify-center h-24">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          </div>
        ) : inbodyError ? (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
            <p className="text-sm text-red-700 dark:text-red-300">InBodyデータの取得でエラーが発生しました：{inbodyError}</p>
          </div>
        ) : latestInbody ? (
          <div className="space-y-6">
            <Suspense fallback={<SkeletonBlock heightClass="h-28" />}>
              <InBodyLatestCardLazy latest={latestInbody} loading={inbodyLoading} error={inbodyError} />
            </Suspense>

            <Suspense fallback={<SkeletonBlock heightClass="h-72" />}>
              <InBodyChartsLazy records={inbodyRecords} gender={normalizedGenderBinary} />
            </Suspense>
          </div>
        ) : (
          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">InBodyデータはまだ登録されていません</p>
          </div>
        )}

        {/* BMI Display - Show only if height is set */}
        {userHeightCm && latestWeight && (
          <BMIDisplay weightKg={latestWeight} heightCm={userHeightCm} dateOfBirth={userDateOfBirth} gender={normalizedGenderFull} />
        )}

        {!userHeightCm && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4 transition-colors">
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              身長を設定するとBMIが表示されます。設定タブからプロフィールを編集してください。
            </p>
          </div>
        )}

        {/* Weight Form */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 sm:p-6 transition-colors">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">体重記録</h2>
            <Scale className="w-5 h-5 sm:w-6 sm:h-6 text-gray-400" />
          </div>
          <WeightForm
            onSubmit={addWeightRecord}
            onCheckExisting={checkExistingWeightRecord}
            onUpdate={updateWeightRecord}
            loading={weightLoading}
            lastRecord={lastWeightRecord}
          />
        </div>
      </div>

      {/* Right Column - Chart */}
      <div className="lg:col-span-2">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 sm:p-6 mb-6 transition-colors">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-4 sm:mb-6">体重推移グラフ</h2>
          {weightLoading ? (
            <div className="flex items-center justify-center h-64 sm:h-80">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <Suspense fallback={<TabFallback label="グラフ読み込み中..." heightClass="h-64 sm:h-80" />}>
              <WeightChartLazy data={weightRecords} />
            </Suspense>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 sm:p-6 transition-colors">
          <Suspense fallback={<TabFallback label="履歴読み込み中..." heightClass="h-40" />}>
            <WeightRecordsListLazy
              records={weightRecords}
              onUpdate={updateWeightRecord}
              onDelete={deleteWeightRecord}
              loading={weightLoading}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
