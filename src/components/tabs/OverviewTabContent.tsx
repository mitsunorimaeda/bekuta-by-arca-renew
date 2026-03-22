// src/components/tabs/OverviewTabContent.tsx
import React, { Suspense, lazy } from 'react';
import {
  Calendar,
  AlertTriangle,
  TrendingUp,
} from 'lucide-react';
import { TrainingForm } from '../TrainingForm';
import { AlertSummary } from '../AlertSummary';
import { DerivedStatsBar } from '../DerivedStatsBar';
import { ShareStatusButton } from '../ShareStatusButton';
import { getRiskLabel, getRiskColor } from '../../lib/acwr';
import type { ActiveTab } from '../../types/athlete';

// ── Lazy ──
const ACWRChartLazy = lazy(() => import('../ACWRChart').then((m) => ({ default: m.ACWRChart })));
const TrainingRecordsListLazy = lazy(() => import('../TrainingRecordsList').then((m) => ({ default: m.TrainingRecordsList })));

// ── Shared fallbacks ──
const TabFallback = ({ label = '読み込み中...', heightClass = 'h-64' }: { label?: string; heightClass?: string }) => (
  <div className={`flex items-center justify-center ${heightClass}`}>
    <div className="flex items-center gap-3 text-gray-500 dark:text-gray-300">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      <span className="text-sm">{label}</span>
    </div>
  </div>
);

export type OverviewTabContentProps = {
  userId: string;
  userAlerts: any[];
  highPriorityAlerts: any[];
  todayWeight: any;
  setActiveTab: (tab: ActiveTab) => void;
  // training
  records: any[];
  loading: boolean;
  handleTrainingSubmit: (data: any) => Promise<any>;
  checkExistingTrainingRecord: any;
  handleTrainingUpdate: (id: string, data: any) => Promise<void>;
  handleTrainingUpdateForList: (id: string, data: any) => Promise<void>;
  deleteTrainingRecord: any;
  normalizedLastTrainingRecord: any;
  // derived
  daysWithData: number;
  consecutiveDays: number;
  weeklyAverage: number;
  // ACWR
  latestACWR: any;
  latestACWRValue: number | null;
  acwrData: any[];
  isDarkMode: boolean;
  // phase hints
  phaseHints: { base: string; training: string; sleep: string; nutrition: string };
};

export function OverviewTabContent(props: OverviewTabContentProps) {
  const {
    userId,
    userAlerts,
    highPriorityAlerts,
    todayWeight,
    setActiveTab,
    records,
    loading,
    handleTrainingSubmit,
    checkExistingTrainingRecord,
    handleTrainingUpdate,
    handleTrainingUpdateForList,
    deleteTrainingRecord,
    normalizedLastTrainingRecord,
    daysWithData,
    consecutiveDays,
    weeklyAverage,
    latestACWR,
    latestACWRValue,
    acwrData,
    isDarkMode,
    phaseHints,
  } = props;

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        {/* Left Column - Training Form and Alerts */}
        <div className="lg:col-span-1 space-y-6">
          {/* Alert Summary */}
          {userAlerts.length > 0 && (
            <AlertSummary
              alerts={userAlerts}
              onViewAll={() => {
                // ここは表示先があるなら繋ぐ（今はnoopでもOK）
              }}
            />
          )}

          <div className="mt-3">
            <ShareStatusButton userId={userId} highlight={highPriorityAlerts.length > 0} />
          </div>

          {/* High Priority Alert Banner */}
          {highPriorityAlerts.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-center">
                <AlertTriangle className="w-6 h-6 text-red-600 mr-3" />
                <div className="flex-1">
                  <h3 className="font-semibold text-red-900">緊急注意</h3>
                  <p className="text-sm text-red-700">
                    怪我のリスクが高まっています。練習強度の調整を検討してください。
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Cross-tab reference: Today's weight */}
          {todayWeight && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-green-600 dark:text-green-400 mb-1">今日の体重</p>
                  <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                    {Number(todayWeight.weight_kg).toFixed(1)} kg
                  </p>
                </div>
                <button type="button" onClick={() => setActiveTab('weight')} className="text-sm text-green-600 dark:text-green-400 hover:underline">
                  体重管理へ →
                </button>
              </div>
            </div>
          )}

          {/* Training Form Section */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 sm:p-6 transition-colors" data-tutorial="training-form">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">練習記録</h2>
              <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-gray-400" />
            </div>

            <DerivedStatsBar daysWithData={daysWithData} consecutiveDays={consecutiveDays} weeklyAverage={weeklyAverage} />

            <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
              {phaseHints.training}
            </p>

            <TrainingForm
              userId={userId}
              onSubmit={handleTrainingSubmit}
              onCheckExisting={checkExistingTrainingRecord}
              onUpdate={handleTrainingUpdate}
              loading={loading}
              lastRecord={normalizedLastTrainingRecord}
              weeklyAverage={weeklyAverage}
              daysWithData={daysWithData}
              consecutiveDays={consecutiveDays}
            />
          </div>

          {/* ACWR Status Card */}
          {latestACWR && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 sm:p-6 transition-colors">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">現在のACWR</h3>
                <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-gray-400 dark:text-gray-500" />
              </div>
              <div className="text-center">
                <div className="text-2xl sm:text-3xl font-bold mb-2" style={{ color: getRiskColor(latestACWR.riskLevel) }}>
                  {latestACWRValue != null ? latestACWRValue.toFixed(2) : '--'}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">{getRiskLabel(latestACWR.riskLevel ?? 'unknown')}</div>
                <div className="grid grid-cols-2 gap-3 sm:gap-4 text-sm">
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 transition-colors">
                    <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm">急性負荷</p>
                    <p className="font-semibold text-sm sm:text-base dark:text-white">{latestACWR.acuteLoad}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 transition-colors">
                    <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm">慢性負荷</p>
                    <p className="font-semibold text-sm sm:text-base dark:text-white">{latestACWR.chronicLoad}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Chart Section */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 sm:p-6 transition-colors" data-tutorial="acwr-chart">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-4 sm:mb-6">ACWR推移グラフ</h2>
            {loading ? (
              <div className="flex items-center justify-center h-64 sm:h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <Suspense fallback={<TabFallback label="グラフ読み込み中..." heightClass="h-64 sm:h-96" />}>
                <ACWRChartLazy data={acwrData} daysWithData={daysWithData} isDarkMode={isDarkMode} />
              </Suspense>
            )}
          </div>
        </div>
      </div>

      {/* Training Records Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 sm:p-6 mt-6 transition-colors">
        <Suspense fallback={<TabFallback label="履歴読み込み中..." heightClass="h-40" />}>
          <TrainingRecordsListLazy
            records={records}
            onUpdate={handleTrainingUpdateForList}
            onDelete={deleteTrainingRecord}
            loading={loading}
            allowEdit={true}
            allowDelete={true}
            allowDateEdit={false}
            showLimited={true}
            limitCount={10}
          />
        </Suspense>
      </div>
    </>
  );
}
