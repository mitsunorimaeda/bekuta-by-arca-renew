// src/components/tabs/ConditioningTabContent.tsx
import React, { Suspense, lazy } from 'react';
import { Moon, Heart } from 'lucide-react';
import { ConditioningSummaryCard } from '../ConditioningSummaryCard';
import { SleepForm } from '../SleepForm';
import { MotivationForm } from '../MotivationForm';

// ── Lazy ──
const SleepChartLazy = lazy(() => import('../SleepChart').then((m) => ({ default: m.SleepChart })));
const MotivationChartLazy = lazy(() => import('../MotivationChart').then((m) => ({ default: m.MotivationChart })));

// ── Shared fallback ──
const TabFallback = ({ label = '読み込み中...', heightClass = 'h-64' }: { label?: string; heightClass?: string }) => (
  <div className={`flex items-center justify-center ${heightClass}`}>
    <div className="flex items-center gap-3 text-gray-500 dark:text-gray-300">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      <span className="text-sm">{label}</span>
    </div>
  </div>
);

export type ConditioningTabContentProps = {
  // summary card
  latestACWR: any;
  getLatestSleep: () => any;
  getLatestMotivation: () => any;
  // sleep
  sleepRecords: any[];
  sleepLoading: boolean;
  addSleepRecord: any;
  checkExistingSleepRecord: any;
  updateSleepRecord: any;
  normalizedLastSleepRecord: any;
  getAverageSleepHours: (days: number) => number | null;
  getAverageSleepQuality: (days: number) => number | null;
  // motivation
  motivationRecords: any[];
  motivationLoading: boolean;
  addMotivationRecord: any;
  checkExistingMotivationRecord: any;
  updateMotivationRecord: any;
  normalizedLastMotivationRecord: any;
  getAverageMotivation: (days: number) => number | null;
  getAverageEnergy: (days: number) => number | null;
  getAverageStress: (days: number) => number | null;
  // phase hints
  phaseHints: { base: string; training: string; sleep: string; nutrition: string };
};

export function ConditioningTabContent(props: ConditioningTabContentProps) {
  const {
    latestACWR,
    getLatestSleep,
    getLatestMotivation,
    sleepRecords,
    sleepLoading,
    addSleepRecord,
    checkExistingSleepRecord,
    updateSleepRecord,
    normalizedLastSleepRecord,
    getAverageSleepHours,
    getAverageSleepQuality,
    motivationRecords,
    motivationLoading,
    addMotivationRecord,
    checkExistingMotivationRecord,
    updateMotivationRecord,
    normalizedLastMotivationRecord,
    getAverageMotivation,
    getAverageEnergy,
    getAverageStress,
    phaseHints,
  } = props;

  return (
    /* Conditioning Tab */
    <div className="space-y-6">
      <ConditioningSummaryCard
        latestACWR={latestACWR}
        sleepHours={getLatestSleep()?.sleep_hours ? Number(getLatestSleep()!.sleep_hours) : null}
        sleepQuality={getLatestSleep()?.sleep_quality ?? null}
        motivationLevel={getLatestMotivation()?.motivation_level ?? null}
        energyLevel={getLatestMotivation()?.energy_level ?? null}
        stressLevel={getLatestMotivation()?.stress_level ?? null}
      />

      {/* Sleep Section */}
      <div className="space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 transition-colors">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">睡眠記録</h2>
            <Moon className="w-6 h-6 text-indigo-500" />
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
            {phaseHints.sleep}
          </p>

          <SleepForm
            onSubmit={addSleepRecord}
            onCheckExisting={checkExistingSleepRecord}
            onUpdate={updateSleepRecord}
            loading={sleepLoading}
            lastRecord={normalizedLastSleepRecord}
          />
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 transition-colors">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">睡眠推移グラフ</h3>
          {sleepLoading ? (
            <div className="flex items-center justify-center h-96">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <Suspense fallback={<TabFallback label="睡眠グラフ読み込み中..." heightClass="h-96" />}>
              <SleepChartLazy data={sleepRecords} />
            </Suspense>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 transition-colors">
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">7日平均睡眠時間</p>
            <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{getAverageSleepHours(7)?.toFixed(1) || '-'}h</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 transition-colors">
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">7日平均睡眠の質</p>
            <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
              {getAverageSleepQuality(7)?.toFixed(1) || '-'}/5
            </p>
          </div>
        </div>
      </div>

      {/* Motivation Section */}
      <div className="space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 transition-colors">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">モチベーション記録</h2>
            <Heart className="w-6 h-6 text-blue-500" />
          </div>

          <MotivationForm
            onSubmit={addMotivationRecord}
            onCheckExisting={checkExistingMotivationRecord}
            onUpdate={updateMotivationRecord}
            loading={motivationLoading}
            lastRecord={normalizedLastMotivationRecord ?? undefined}
          />
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 transition-colors">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">モチベーション推移グラフ</h3>
          {motivationLoading ? (
            <div className="flex items-center justify-center h-96">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <Suspense fallback={<TabFallback label="モチベーション推移読み込み中..." heightClass="h-96" />}>
              <MotivationChartLazy data={motivationRecords} />
            </Suspense>
          )}
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 transition-colors">
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">平均意欲</p>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{getAverageMotivation(7)?.toFixed(1) || '-'}/10</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 transition-colors">
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">平均体力</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{getAverageEnergy(7)?.toFixed(1) || '-'}/10</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 transition-colors">
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">平均ストレス</p>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">{getAverageStress(7)?.toFixed(1) || '-'}/10</p>
          </div>
        </div>
      </div>
    </div>
  );
}
