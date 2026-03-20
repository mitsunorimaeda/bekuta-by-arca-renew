// src/components/CoachAthletesTab.tsx
import React from 'react';
import { Lock, Users } from 'lucide-react';
import { AthleteList } from './AthleteList';
import type { User } from '../lib/supabase';
import type { AthleteRisk } from '../lib/riskUtils';

type AthleteACWRInfo = {
  currentACWR: number | null;
  acute7d?: number | null;
  chronicLoad?: number | null;
  dailyLoad?: number | null;
  riskLevel?: string;
  daysOfData?: number | null;
  lastDate?: string | null;
};

type CoachWeekAthleteCard = {
  athlete_user_id: string;
  is_sharing_active: boolean;
  [key: string]: any;
};

type CoachAthletesTabProps = {
  athletes: User[];
  athletesLoading: boolean;
  athletesError: string | null;
  acwrLoading: boolean;
  athleteACWRMap: Record<string, AthleteACWRInfo>;
  weekCardMap: Record<string, CoachWeekAthleteCard>;
  athleteRiskMap: Record<string, AthleteRisk>;
  onAthleteSelect: (athlete: User) => void;
  onRetry: () => void;
};

export function CoachAthletesTab({
  athletes,
  athletesLoading,
  athletesError,
  acwrLoading,
  athleteACWRMap,
  weekCardMap,
  athleteRiskMap,
  onAthleteSelect,
  onRetry,
}: CoachAthletesTabProps) {
  if (athletesLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 dark:border-blue-400" />
      </div>
    );
  }

  if (athletesError) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-sm text-red-700 dark:text-red-400">
        <div className="font-semibold mb-1">選手一覧の取得に失敗しました</div>
        <div className="mb-3">{athletesError}</div>
        <button
          className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
          onClick={onRetry}
        >
          再取得
        </button>
      </div>
    );
  }

  if (athletes.length === 0) {
    return (
      <div className="py-12 text-center">
        <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-3">
          <Users className="w-6 h-6 text-gray-400" />
        </div>
        <div className="font-semibold text-gray-900 dark:text-white mb-1">選手がまだいません</div>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          チームに選手が所属しているか確認してください
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="text-xs text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-2">
        <Lock className="w-3.5 h-3.5" />
        共有OFFの選手は詳細を開けません
        {acwrLoading && <span className="ml-1 text-blue-500 dark:text-blue-400">(ACWR取得中...)</span>}
      </div>
      <AthleteList
        athletes={athletes}
        onAthleteSelect={onAthleteSelect}
        athleteACWRMap={athleteACWRMap}
        weekCardMap={weekCardMap}
        athleteRiskMap={athleteRiskMap}
      />
    </div>
  );
}
