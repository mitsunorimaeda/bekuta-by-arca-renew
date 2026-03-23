// src/components/tabs/UnifiedTabContent.tsx
import React, { Suspense, lazy } from 'react';
import { AlertTriangle, Sword, ChevronRight } from 'lucide-react';
import { OnboardingBanner } from '../OnboardingBanner';
import NutritionOverview from '../NutritionOverview';
import { SentryErrorButton } from '../SentryErrorButton';
import type { TeamPhaseRow } from '../../types/athlete';

// ── Lazy ──
const ConsolidatedOverviewDashboardLazy = lazy(() =>
  import('../ConsolidatedOverviewDashboard').then((m) => ({ default: m.ConsolidatedOverviewDashboard }))
);
const DailyReflectionCardLazy = lazy(() =>
  import('../DailyReflectionCard').then((m) => ({ default: m.DailyReflectionCard }))
);
const MultiMetricTimelineLazy = lazy(() =>
  import('../MultiMetricTimeline').then((m) => ({ default: m.MultiMetricTimeline }))
);

// ── Shared fallbacks ──
const SkeletonBlock = ({ heightClass = 'h-40' }: { heightClass?: string }) => (
  <div className={`w-full ${heightClass} bg-gray-100 dark:bg-gray-700/40 rounded-xl animate-pulse`} />
);

const SectionSkeleton = ({ minH = 220 }: { minH?: number }) => (
  <div
    className="w-full rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 animate-pulse"
    style={{ minHeight: minH }}
  />
);

export type UnifiedTabContentProps = {
  user: { id: string; gender: string | null; height_cm: number | null; date_of_birth: string | null; name: string | null; weight_kg: number | null };
  readOnly: boolean;
  setShowProfileEdit: (v: boolean) => void;
  isRehabilitating: boolean;
  hasActivePrograms: boolean;
  activeProgramCount: number;
  setSelectedQuestPrescriptionId: (v: string | null) => void;
  setActiveTab: (tab: any) => void;
  // phase
  todayPhase: TeamPhaseRow | null;
  nextPhases: TeamPhaseRow[];
  phaseLoading: boolean;
  phaseError: string | null;
  phaseLabel: (t: TeamPhaseRow['phase_type']) => string;
  toShortRange: (s: string, e: string) => string;
  phaseHints: { base: string; training: string; sleep: string; nutrition: string };
  // data
  currentACWR: number | null;
  acwrData: any[];
  weightRecords: any[];
  normalizedSleepRecords: any[];
  motivationRecords: any[];
  records: any[];
  menstrualCycles: any[];
  normalizedGenderFull: 'female' | 'male' | 'other' | 'prefer_not_to_say' | null;
  normalizedGenderBinary: 'female' | 'male' | null;
  setShowUnifiedCheckIn: (v: boolean) => void;
  // nutrition
  canUseNutrition: boolean;
  nutritionLoading: boolean;
  nutritionTotalsToday: any;
  targets: any;
  recordDate: string;
  // heavy section
  showUnifiedHeavy: boolean;
  timelineSleepRecords: any[];
  // alerts
  highPriorityAlerts: any[];
  userId: string;
};

export function UnifiedTabContent(props: UnifiedTabContentProps) {
  const {
    user,
    readOnly,
    setShowProfileEdit,
    isRehabilitating,
    hasActivePrograms,
    activeProgramCount,
    setSelectedQuestPrescriptionId,
    setActiveTab,
    todayPhase,
    nextPhases,
    phaseLoading,
    phaseError,
    phaseLabel,
    toShortRange,
    phaseHints,
    currentACWR,
    acwrData,
    weightRecords,
    normalizedSleepRecords,
    motivationRecords,
    records,
    menstrualCycles,
    normalizedGenderFull,
    normalizedGenderBinary,
    setShowUnifiedCheckIn,
    canUseNutrition,
    nutritionLoading,
    nutritionTotalsToday,
    targets,
    recordDate,
    showUnifiedHeavy,
    timelineSleepRecords,
    highPriorityAlerts,
    userId,
  } = props;

  return (
    <>
      {/* ★ オンボーディングバナー */}
      {!readOnly && (
        <OnboardingBanner
          userId={user.id}
          gender={user.gender ?? null}
          heightCm={user.height_cm != null ? Number(user.height_cm) : null}
          dateOfBirth={user.date_of_birth ?? null}
          onOpenProfileEdit={() => setShowProfileEdit(true)}
        />
      )}

      {/* ★ 追加：プログラム開放カード（リハビリ or パフォーマンス処方がある選手） */}
      {(isRehabilitating || hasActivePrograms) && (
        <div className="mb-6 animate-in fade-in slide-in-from-top-4 duration-500">
          <button
            onClick={() => { setSelectedQuestPrescriptionId(null); setActiveTab('rehab'); }}
            className={`w-full rounded-2xl p-5 text-white shadow-xl flex items-center justify-between group active:scale-[0.98] transition-all ${
              isRehabilitating
                ? 'bg-gradient-to-r from-indigo-600 to-blue-600 shadow-indigo-200 dark:shadow-none'
                : 'bg-gradient-to-r from-blue-600 to-cyan-600 shadow-blue-200 dark:shadow-none'
            }`}
          >
            <div className="flex items-center gap-4">
              <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm group-hover:rotate-12 transition-transform">
                <Sword size={24} className="text-white" />
              </div>
              <div className="text-left">
                <h3 className="text-lg font-black italic tracking-tight uppercase">
                  Today's Program
                </h3>
                <p className="text-xs text-white/80 font-bold">
                  {`${activeProgramCount}つのプログラムが処方されています`}
                </p>
              </div>
            </div>
            <ChevronRight size={24} className="opacity-50 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      )}

      {/* ✅ チームフェーズ（薄め版：今日だけ表示） */}
      <div className="mb-4">
        <div
          className={[
            "bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors",
            !phaseLoading && !phaseError && !todayPhase ? "p-3 sm:p-4" : "p-4 sm:p-5",
          ].join(" ")}
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
              チームフェーズ
            </span>

            {/* 右上：期間 or 状態 */}
            {phaseLoading ? (
              <span className="text-xs text-gray-500 dark:text-gray-400">読み込み中…</span>
            ) : phaseError ? (
              <span className="text-xs text-red-600 dark:text-red-400">取得エラー</span>
            ) : todayPhase ? (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {toShortRange(todayPhase.start_date, todayPhase.end_date)}
              </span>
            ) : (
              <span className="text-xs text-gray-500 dark:text-gray-400">未設定</span>
            )}
          </div>

          {/* Body */}
          {phaseLoading ? (
            <div className="mt-3">
              <div className="h-7 w-28 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
              <div className="mt-3 flex gap-2">
                <div className="h-6 w-14 bg-gray-100 dark:bg-gray-700 rounded-full animate-pulse" />
                <div className="h-6 w-14 bg-gray-100 dark:bg-gray-700 rounded-full animate-pulse" />
                <div className="h-6 w-14 bg-gray-100 dark:bg-gray-700 rounded-full animate-pulse" />
              </div>
              <div className="mt-3 h-4 w-4/5 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
            </div>
          ) : phaseError ? (
            <div className="mt-3 text-sm text-red-700 dark:text-red-300">
              取得に失敗しました：{phaseError}
            </div>
          ) : todayPhase ? (
            <>
              {/* タイトル：日本語だけ（preなどは出さない） */}
              <h3 className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">
                {phaseLabel(todayPhase.phase_type)}
              </h3>

              {/* Tags（薄め） */}
              {Array.isArray(todayPhase.focus_tags) && todayPhase.focus_tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {todayPhase.focus_tags.slice(0, 6).map((tag, i) => (
                    <span
                      key={`${tag}-${i}`}
                      className="text-xs px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/15 text-blue-700 dark:text-blue-200"
                    >
                      {tag}
                    </span>
                  ))}
                  {todayPhase.focus_tags.length > 6 && (
                    <span className="text-xs px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
                      +{todayPhase.focus_tags.length - 6}
                    </span>
                  )}
                </div>
              )}

              {/* Note */}
              <p className="mt-3 text-sm text-gray-700 dark:text-gray-200 line-clamp-2">
                {phaseHints.base}
              </p>

              {/* Next（"薄い横チップ"だけ：タグ/メモは出さない） */}
              {Array.isArray(nextPhases) && nextPhases.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400">今後</p>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500">横スクロール</p>
                  </div>

                  <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                    {nextPhases.slice(0, 8).map((p, idx) => (
                      <div
                        key={`${p.start_date}-${p.end_date}-${idx}`}
                        className="min-w-[140px] rounded-lg border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                            {phaseLabel(p.phase_type)}
                          </div>
                          <div className="text-[11px] text-gray-500 dark:text-gray-400 whitespace-nowrap">
                            {toShortRange(p.start_date, p.end_date)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            // ✅ 未設定時は "高さ半分" のコンパクト表示
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                フェーズ未設定
              </p>
              <span className="text-[11px] px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-200 whitespace-nowrap">
                設定待ち
              </span>
            </div>
          )}
        </div>
      </div>

      <Suspense fallback={<SectionSkeleton minH={340} />}>
        <ConsolidatedOverviewDashboardLazy
          currentACWR={currentACWR}
          acwrData={acwrData ?? []}
          weightRecords={weightRecords}
          sleepRecords={normalizedSleepRecords}
          motivationRecords={motivationRecords}
          trainingRecords={records}
          menstrualCycles={menstrualCycles}
          userGender={normalizedGenderFull}
          onOpenDetailView={(section) => {
            if (section === 'training') setActiveTab('overview');
            else if (section === 'weight') setActiveTab('weight');
            else if (section === 'conditioning') setActiveTab('conditioning');
            else if (section === 'cycle') {
              if (normalizedGenderBinary === 'female') setActiveTab('cycle');
            }
          }}
          onQuickAdd={() => setShowUnifiedCheckIn(true)}
        />
      </Suspense>

      {/* ✅ 栄養：nutrition_enabled=true の人だけ表示 */}
      {canUseNutrition && (
        <div className="mt-6 min-h-[220px]">
          <button
            type="button"
            onClick={() => setActiveTab("nutrition")}
            className="w-full text-left"
            aria-label="栄養の詳細へ"
          >
            <div className="rounded-xl hover:opacity-95 active:opacity-90 transition">
              {nutritionLoading ? (
                <SkeletonBlock heightClass="h-[220px]" />
              ) : (
                <NutritionOverview
                  totals={nutritionTotalsToday}
                  targets={targets}
                  loading={nutritionLoading}
                  subtitle={`${recordDate} · ${phaseHints.nutrition}`}
                />
              )}
            </div>
          </button>
        </div>
      )}

      <div className="mt-6 min-h-[260px]">
        {showUnifiedHeavy ? (
          <Suspense fallback={<div className="min-h-[160px] rounded-xl bg-white dark:bg-gray-800 animate-pulse" />}>
            <DailyReflectionCardLazy userId={userId} />
          </Suspense>
        ) : (
          <SkeletonBlock heightClass="h-[260px]" />
        )}
      </div>

      {/* ✅ Sentry 動作確認（DEVのみ：確認が終わったら消す） */}
      {import.meta.env.DEV && (
        <div className="mt-6">
          <SentryErrorButton />
        </div>
      )}

      <div className="mt-6">
        <div className="mt-6 min-h-[320px]">
          {showUnifiedHeavy ? (
            <Suspense fallback={<SectionSkeleton minH={320} />}>
              <MultiMetricTimelineLazy
                acwrData={acwrData ?? []}
                weightRecords={weightRecords}
                sleepRecords={timelineSleepRecords}
                motivationRecords={motivationRecords}
              />
            </Suspense>
          ) : (
            <SkeletonBlock heightClass="h-[320px]" />
          )}
        </div>
      </div>

      {highPriorityAlerts.length > 0 && (
        <div className="mt-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6">
          <div className="flex items-center">
            <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400 mr-3" />
            <div className="flex-1">
              <h3 className="font-semibold text-red-900 dark:text-red-200">緊急注意</h3>
              <p className="text-sm text-red-700 dark:text-red-300">
                怪我のリスクが高まっています。練習強度の調整を検討してください。
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
