// src/components/CoachTeamTrendsTab.tsx
import React, { Suspense, lazy } from 'react';
import { TeamACWRChart } from './TeamACWRChart';
import { ChartErrorBoundary } from './ChartErrorBoundary';
import { WeeklyGrowthCycleView } from './WeeklyGrowthCycleView';

const TeamAnalysisViewLazy = lazy(() => import('./TeamAnalysisView'));

const Spinner = () => (
  <div className="flex items-center justify-center py-10">
    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 dark:border-blue-400" />
  </div>
);

type CoachTeamTrendsTabProps = {
  teamId: string;
  teamName: string;
  teamACWRData: any[];
  teamACWRLoading: boolean;
  showAvgRPE: boolean;
  showAvgLoad: boolean;
  // Weekly cycle
  cycleBaseDate: string;
  onCycleBaseDateChange: (date: string) => void;
  cycleLoading: boolean;
  cycleError: string | null;
  teamDaily: any[];
  cycleWeekLabel: string;
};

export function CoachTeamTrendsTab({
  teamId,
  teamName,
  teamACWRData,
  teamACWRLoading,
  showAvgRPE,
  showAvgLoad,
  cycleBaseDate,
  onCycleBaseDateChange,
  cycleLoading,
  cycleError,
  teamDaily,
  cycleWeekLabel,
}: CoachTeamTrendsTabProps) {
  return (
    <div className="space-y-4">
      {/* ACWR Chart */}
      {teamACWRLoading ? (
        <Spinner />
      ) : (
        <ChartErrorBoundary name="TeamACWRChart">
          <TeamACWRChart
            data={teamACWRData}
            teamName={teamName}
            showAvgRPE={showAvgRPE}
            showAvgLoad={showAvgLoad}
          />
        </ChartErrorBoundary>
      )}

      {/* 週サイクル */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5 transition-colors">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-gray-900 dark:text-white">
              週サイクル表示（7日）
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              成長×理解の動き＋負荷の可視化
            </div>
          </div>
          <input
            type="date"
            value={cycleBaseDate}
            onChange={(e) => onCycleBaseDateChange(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600
              bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm transition-colors"
          />
        </div>
        {cycleLoading ? <Spinner /> : cycleError ? (
          <div className="text-sm text-red-600 dark:text-red-400">{cycleError}</div>
        ) : (
          <ChartErrorBoundary name="WeeklyGrowthCycleView">
            <WeeklyGrowthCycleView
              teamDaily={teamDaily}
              weekLabel={cycleWeekLabel}
            />
          </ChartErrorBoundary>
        )}
      </div>

      {/* チーム分析 */}
      <Suspense fallback={<Spinner />}>
        <ChartErrorBoundary name="TeamAnalysisView">
          <TeamAnalysisViewLazy teamId={teamId} />
        </ChartErrorBoundary>
      </Suspense>
    </div>
  );
}
