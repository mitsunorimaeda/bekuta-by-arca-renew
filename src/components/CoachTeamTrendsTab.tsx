// src/components/CoachTeamTrendsTab.tsx
import React, { Suspense, lazy } from 'react';
import { TeamACWRChart } from './TeamACWRChart';
import { ChartErrorBoundary } from './ChartErrorBoundary';

const TeamRadarChartLazy = lazy(() => import('./TeamRadarChart').then(m => ({ default: m.TeamRadarChart })));
const TeamPercentileMatrixLazy = lazy(() => import('./TeamPercentileMatrix').then(m => ({ default: m.TeamPercentileMatrix })));

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
  // Weekly cycle props kept for backward compat but not used
  cycleBaseDate?: string;
  onCycleBaseDateChange?: (date: string) => void;
  cycleLoading?: boolean;
  cycleError?: string | null;
  teamDaily?: any[];
  cycleWeekLabel?: string;
};

export function CoachTeamTrendsTab({
  teamId,
  teamName,
  teamACWRData,
  teamACWRLoading,
  showAvgRPE,
  showAvgLoad,
}: CoachTeamTrendsTabProps) {
  return (
    <div className="space-y-6">
      {/* チーム推移グラフ */}
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

      {/* チームレーダーチャート */}
      <Suspense fallback={<Spinner />}>
        <ChartErrorBoundary name="TeamRadarChart">
          <TeamRadarChartLazy teamId={teamId} />
        </ChartErrorBoundary>
      </Suspense>

      {/* 選手評価マトリクス */}
      <Suspense fallback={<Spinner />}>
        <ChartErrorBoundary name="TeamPercentileMatrix">
          <TeamPercentileMatrixLazy teamId={teamId} />
        </ChartErrorBoundary>
      </Suspense>
    </div>
  );
}
