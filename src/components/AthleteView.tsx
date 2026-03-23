// src/components/AthleteView.tsx
import React, { useState, useEffect, useMemo, useCallback, useRef, Suspense, lazy } from 'react';
import { getTodayJSTString } from '../lib/date';
import type { Database } from '../lib/database.types';
import { TrainingForm } from './TrainingForm';
import { AlertSummary } from './AlertSummary';
import { supabase } from '../lib/supabase';
import { WeightForm } from './WeightForm';
import { OfflineIndicator } from './OfflineIndicator';
import { OnboardingBanner } from './OnboardingBanner';

import { BMIDisplay } from './BMIDisplay';
import { ProfileEditForm } from './ProfileEditForm';
import { TutorialController } from './TutorialController';
import { useTrainingData } from '../hooks/useTrainingData';
import { useWeightData } from '../hooks/useWeightData';
import { useSleepData } from '../hooks/useSleepData';
import { useMotivationData } from '../hooks/useMotivationData';
import { useMenstrualCycleData } from '../hooks/useMenstrualCycleData';
import { useTutorialContext } from '../contexts/TutorialContext';
import { getTutorialSteps } from '../lib/tutorialContent';
import { SleepForm } from './SleepForm';
import { MotivationForm } from './MotivationForm';

import { ConditioningSummaryCard } from './ConditioningSummaryCard';
import { UnifiedDailyCheckIn } from './UnifiedDailyCheckIn';
import { FloatingActionButton } from './FloatingActionButton';
import { useAthleteDerivedValues } from '../hooks/useAthleteDerivedValues';
import { DerivedStatsBar } from './DerivedStatsBar';
import { getRiskLabel, getRiskColor } from '../lib/acwr';
import { useLastRecords } from '../hooks/useLastRecords';
import { useInbodyData } from '../hooks/useInbodyData';
import { getTodayEnergySummary } from '../lib/getTodayEnergySummary';
import { useTodayNutritionTotals } from '../hooks/useTodayNutritionTotals';
import NutritionOverview from "./NutritionOverview";
import { buildDailyTargets } from "../lib/nutritionCalc";
import { FTTCheck } from './FTTCheck';
import {AthleteGamificationView} from "./views/AthleteGamificationView";
import { AthleteCycleView } from "./views/AthleteCycleView";
import { getPhaseAdvice } from '../lib/phaseAdvice';
import { useEntryPopup } from "../hooks/useEntryPopup";
import { EntryPopup } from "./EntryPopup";
import { buildDailyAssistTexts } from "../lib/dailyOneWord";
import { SentryErrorButton } from "./SentryErrorButton";
import { NotificationInbox } from "./NotificationInbox";
// ✅ Sentry
import * as Sentry from "@sentry/react";

// ✅ Plan gating
import { usePlanLimits } from '../hooks/usePlanLimits';
import { UpgradeGate } from './UpgradeGate';
import { useOrganizations } from '../hooks/useOrganizations';

import { useDarkMode } from '../hooks/useDarkMode';
import { AthleteSettingsView } from './views/AthleteSettingsView';
import { upsertDailyEnergySnapshot } from '../lib/upsertDailyEnergySnapshot';

// ── 抽出した型 ──
import type { AthleteViewProps, ActiveTab, TeamPhaseRow, DailyEnergySnapshotRow } from '../types/athlete';

// ── 抽出したフック ──
import { useTeamPhase } from '../hooks/useTeamPhase';

// ── 抽出したコンポーネント ──
import { AthleteViewHeader } from './AthleteViewHeader';
import { UnifiedTabContent } from './tabs/UnifiedTabContent';
import { OverviewTabContent } from './tabs/OverviewTabContent';
import { WeightTabContent } from './tabs/WeightTabContent';
import { ConditioningTabContent } from './tabs/ConditioningTabContent';

const AthleteNutritionDashboardView = lazy(() =>
  import("./views/AthleteNutritionDashboardView").then((m) => ({
    default: m.default,
  }))
);

// Lazy load heavy components
const ExportPanel = lazy(() => import('./ExportPanel').then((m) => ({ default: m.ExportPanel })));
const GamificationView = lazy(() => import('./GamificationView').then((m) => ({ default: m.GamificationView })));
const MessagingPanel = lazy(() => import('./MessagingPanel').then((m) => ({ default: m.MessagingPanel })));

const AthletePerformanceView = lazy(() =>
  import("./views/AthletePerformanceView").then((m) => ({ default: m.default }))
);
const AthletePerformanceProfileLazy = lazy(() => import('./AthletePerformanceProfile'));
// =========================
// ✅ 추가：Lazy-load（タブ系・チャート系）
// =========================
const ConsolidatedOverviewDashboardLazy = lazy(() =>
  import("./ConsolidatedOverviewDashboard").then((m) => ({ default: m.ConsolidatedOverviewDashboard }))
);


const DailyReflectionCardLazy = lazy(() =>
  import("./DailyReflectionCard").then((m) => ({ default: m.DailyReflectionCard }))
);

// ✅ Rehab（いまは直importになっていたので、初回バンドルから外す）
const RehabQuestViewLazy = lazy(() => import('./RehabQuestView'));
const PrescriptionCardListLazy = lazy(() => import('./PrescriptionCardList'));

// ✅ Charts (recharts系は重くなりがちなので基本lazy)
const ACWRChartLazy = lazy(() => import('./ACWRChart').then((m) => ({ default: m.ACWRChart })));
const WeightChartLazy = lazy(() => import('./WeightChart').then((m) => ({ default: m.WeightChart })));
const WeightACWRChartLazy = lazy(() => import('./WeightACWRChart').then((m) => ({ default: m.WeightACWRChart })));
const SleepChartLazy = lazy(() => import('./SleepChart').then((m) => ({ default: m.SleepChart })));
const MotivationChartLazy = lazy(() => import('./MotivationChart').then((m) => ({ default: m.MotivationChart })));

// ✅ Lists
const TrainingRecordsListLazy = lazy(() => import('./TrainingRecordsList').then((m) => ({ default: m.TrainingRecordsList })));
const WeightRecordsListLazy = lazy(() => import('./WeightRecordsList').then((m) => ({ default: m.WeightRecordsList })));

// ✅ InBody（チャート含みがち）
const InBodyLatestCardLazy = lazy(() => import('./InBodyLatestCard').then((m) => ({ default: m.InBodyLatestCard })));
const InBodyChartsLazy = lazy(() => import('./InBodyCharts').then((m) => ({ default: m.InBodyCharts })));

// ✅ Unifiedの重いタイムライン（初回を軽くするため）
const MultiMetricTimelineLazy = lazy(() => import('./MultiMetricTimeline').then((m) => ({ default: m.MultiMetricTimeline })));
const InsightCardLazy = lazy(() => import('./InsightCard').then((m) => ({ default: m.InsightCard })));


// ✅ 共通フォールバック（高さ確保してCLSも抑える）
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

// ✅ CLS/LCP対策：高さ固定のセクション枠（中身は後から）
const SectionSkeleton = ({ minH = 220 }: { minH?: number }) => (
  <div
    className="w-full rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 animate-pulse"
    style={{ minHeight: minH }}
  />
);


export function AthleteView({
  user,
  alerts,
  onLogout,
  onHome,
  onNavigateToPrivacy,
  onNavigateToTerms,
  onNavigateToCommercial,
  onNavigateToHelp,
  onUserUpdated,
  readOnly = false,
}: AthleteViewProps) {
  // =========================
  // ✅ DEVログは"必要な時だけ"
  // =========================
  const loggedOnceRef = useRef(false);
  const renderLoggedRef = useRef(false);


  useEffect(() => {
    // ✅ Sentry：ログイン後にユーザー紐付け（本番でも実行）
    Sentry.setUser({
      id: user.id,
      email: (user as any)?.email ?? undefined,
      username: user.name ?? undefined,
    });

    // ✅ あると便利：チームやロールもタグに入れる（検索が楽）
    Sentry.setTags({
      role: String(user.role ?? ""),
      team_id: String((user as any)?.team_id ?? ""),
    });

    // ✅ DEVログは必要な時だけ
    if (!import.meta.env.DEV) return;
    if (loggedOnceRef.current) return;
    loggedOnceRef.current = true;

    console.log("[AthleteView] mounted", {
      id: user.id,
      role: user.role,
      gender: user.gender,
      team_id: user.team_id,
    });
  }, [user.id, user.name, (user as any)?.email, user.role, user.gender, (user as any)?.team_id]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (renderLoggedRef.current) return;

    console.log('[AthleteView] first render');
    renderLoggedRef.current = true;
  }, []);

  const today = useMemo(() => getTodayJSTString(), []);

  // ✅ 栄養：選択中の日付（デフォルトは今日）
  const [nutritionDate, setNutritionDate] = useState<string>(today);

  // ✅ 日付が変わった（0時跨ぎ等）とき、未選択なら追従したい場合
  useEffect(() => {
    setNutritionDate((prev) => (prev ? prev : today));
  }, [today]);


  // ★ 修正：リハビリ or パフォーマンスプログラムの有無チェック
  const [isRehabilitating, setIsRehabilitating] = useState(false);
  const [hasActivePrograms, setHasActivePrograms] = useState(false);
  const [activeProgramCount, setActiveProgramCount] = useState(0);
  const [selectedQuestPrescriptionId, setSelectedQuestPrescriptionId] = useState<string | null>(null);

  useEffect(() => {
    async function checkPrograms() {
      // 怪我チェック
      const { data: injuries } = await supabase
        .schema('rehab').from('injuries').select('id')
        .eq('athlete_user_id', user.id)
        .in('status', ['active', 'conditioning'])
        .limit(1);
      setIsRehabilitating(!!(injuries && injuries.length > 0));

      // active処方チェック（リハビリ+パフォーマンス+コンディショニング全て）
      const { data: prescriptions } = await supabase
        .schema('rehab').from('prescriptions').select('id')
        .eq('athlete_user_id', user.id)
        .in('status', ['active', 'conditioning'])
        .neq('type', 'template');
      const count = prescriptions?.length || 0;
      setActiveProgramCount(count);
      setHasActivePrograms(count > 0);
    }
    checkPrograms();
  }, [user.id]);

  // ── useTeamPhase（抽出したフック）──
  const {
    todayPhase,
    nextPhases,
    phaseLoading,
    phaseError,
    isPhaseEmpty,
    phaseLabel,
    toShortRange,
  } = useTeamPhase(user.team_id, today);


  const [snapshotToday, setSnapshotToday] = useState<DailyEnergySnapshotRow | null>(null);
  const [showExportPanel, setShowExportPanel] = useState(false);
  const [showUnifiedCheckIn, setShowUnifiedCheckIn] = useState(false);

  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab === 'messages') return 'messages';
    return 'unified';
  });

  // =========================
  // ✅ 未読メッセージ数（軽量ポーリング）
  // =========================
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  useEffect(() => {
    if (readOnly || !user.id) return;
    let cancelled = false;
    const fetchUnread = async () => {
      try {
        const { count, error } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('receiver_id', user.id)
          .eq('is_read', false);
        if (!error && !cancelled) setUnreadMessageCount(count ?? 0);
      } catch { /* ignore */ }
    };
    fetchUnread();
    const timer = setInterval(fetchUnread, 60000); // 60秒ごと
    return () => { cancelled = true; clearInterval(timer); };
  }, [user.id, readOnly]);

    // =========================
  // ✅ unified の重いセクションを "アイドル後" に表示（LCP改善）
  // =========================
  const [showUnifiedHeavy, setShowUnifiedHeavy] = useState(false);

  useEffect(() => {
    if (activeTab !== 'unified') return;
    if (showUnifiedHeavy) return;

    const conn = (navigator as any).connection;
    const saveData = !!conn?.saveData;
    const effectiveType = conn?.effectiveType as string | undefined;
    const isSlow =
      effectiveType === 'slow-2g' || effectiveType === '2g' || effectiveType === '3g';

    // 低速/節約モードは無理に重いのを先に出さない（ユーザー体験優先）
    const delayMs = saveData || isSlow ? 2200 : 1200;

    let cancelled = false;

    const reveal = () => {
      if (!cancelled) setShowUnifiedHeavy(true);
    };

    if ('requestIdleCallback' in window) {
      const id = (window as any).requestIdleCallback(reveal, { timeout: delayMs });
      return () => {
        cancelled = true;
        (window as any).cancelIdleCallback?.(id);
      };
    }

    const t = setTimeout(reveal, delayMs);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [activeTab, showUnifiedHeavy]);



  const canUseFTT = !!(user as any).ftt_enabled;
  const canUseNutrition = !!(user as any).nutrition_enabled;

  // ✅ Plan-based feature gating
  const { organizations: userOrgs } = useOrganizations(user.id);
  const userOrgId = userOrgs.length > 0 ? userOrgs[0].id : null;
  const planLimits = usePlanLimits(userOrgId);

  // ✅ performance chunk prefetch（回線が良い&アイドル時だけ / 初回のみ）
  useEffect(() => {
  const conn = (navigator as any).connection;
  const saveData = !!conn?.saveData;
  const effectiveType = conn?.effectiveType as string | undefined;
  const isSlow =
    effectiveType === "slow-2g" || effectiveType === "2g" || effectiveType === "3g";

  if (saveData || isSlow) return;

  let cancelled = false;

  const prefetch = () => {
    import("./views/AthletePerformanceView");
  };

  if ("requestIdleCallback" in window) {
    const id = (window as any).requestIdleCallback(
      () => {
        if (!cancelled) prefetch();
      },
      { timeout: 4000 }
    );

    return () => {
      cancelled = true;
      (window as any).cancelIdleCallback?.(id);
    };
  }

  const t = setTimeout(() => {
    if (!cancelled) prefetch();
  }, 2500);

  return () => {
    cancelled = true;
    clearTimeout(t);
  };
}, []);


  const safeSetActiveTab = useCallback(
    (tab: ActiveTab) => {
      if (tab === 'ftt' && !canUseFTT) return;
      if (tab === 'nutrition' && !canUseNutrition) return;
      if (tab === 'rehab' && !isRehabilitating && !hasActivePrograms) return; // ★ ガード追加
      setActiveTab(tab);
    },
    [canUseFTT, canUseNutrition, isRehabilitating, hasActivePrograms]
  );

  useEffect(() => {
    if (!canUseFTT && activeTab === 'ftt') {
      setActiveTab('unified');
    }
  }, [canUseFTT, activeTab]);


  //② nutrition_enabled を見て表示制御

  // ③ もし nutrition_enabled=false なのに nutrition タブへ行こうとしたら戻す
  useEffect(() => {
    if (!canUseNutrition && activeTab === 'nutrition') {
      setActiveTab('unified');
    }
  }, [canUseNutrition, activeTab])

  // ★ リハビリガード：怪我もプログラムもないのにリハビタブにいたら戻す
  useEffect(() => {
    if (!isRehabilitating && !hasActivePrograms && activeTab === 'rehab') {
      setActiveTab('unified');
    }
  }, [isRehabilitating, activeTab]);


  const [celebrationData, setCelebrationData] = useState<{
    testName: string;
    value: number;
    unit: string;
    previousBest?: number;
  } | null>(null);

  const [hasStartedTutorial, setHasStartedTutorial] = useState(false);

  // =========================
  // ✅ gender 正規化（useMemo）
  // =========================
  const normalizedGenderBinary: 'female' | 'male' | null = useMemo(() => {
    return user.gender === 'female' || user.gender === 'male' ? user.gender : null;
  }, [user.gender]);

  const normalizedGenderFull: 'female' | 'male' | 'other' | 'prefer_not_to_say' | null = useMemo(() => {
    return user.gender === 'female' || user.gender === 'male' || user.gender === 'other' || user.gender === 'prefer_not_to_say'
      ? user.gender
      : null;
  }, [user.gender]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    console.log('[gender check]', { raw: user.gender, binary: normalizedGenderBinary, full: normalizedGenderFull });
  }, [user.gender, normalizedGenderBinary, normalizedGenderFull]);

  // ✅ cycleタブガード（female以外は入れない）
  useEffect(() => {
    if (activeTab === 'cycle' && normalizedGenderBinary !== 'female') {
      setActiveTab('unified');
    }
  }, [activeTab, normalizedGenderBinary])

  // =========================
  // ✅ Hooks（データ）
  // =========================
  const {
    records,
    loading,
    checkExistingRecord: checkExistingTrainingRecord,
    addTrainingRecord,
    updateTrainingRecord,
    deleteTrainingRecord,
    acwrData = [],
  } = useTrainingData(user.id);

  // =========================
  // ✅ "最新ACWR"（phaseHintsで使うので先に定義）
  // =========================
  const latestACWR = useMemo(
    () => (acwrData && acwrData.length > 0 ? acwrData[acwrData.length - 1] : null),
    [acwrData]
  );
  // ✅ 表示用に必ず number に正規化（表示ブレ防止）
  const latestACWRValue = useMemo(() => {
    const v = latestACWR?.acwr;
    const n = v != null ? Number(v) : NaN;
    return Number.isFinite(n) ? n : null;
  }, [latestACWR?.acwr]);

  const currentACWR = latestACWRValue; // 今はこれでOK（=最新のACWR）




  const {
    records: weightRecords,
    loading: weightLoading,
    checkExistingRecord: checkExistingWeightRecord,
    addWeightRecord,
    updateWeightRecord,
    deleteWeightRecord,
    getLatestWeight,
    getWeightChange,
  } = useWeightData(user.id);

  const latestWeight = useMemo(() => getLatestWeight(), [getLatestWeight]);

  const lastWeightRecord = useMemo(() => {
    if (weightRecords.length === 0) return null;
    return weightRecords.reduce((latest, r) => (!latest || new Date(r.date) > new Date(latest.date) ? r : latest), null as any);
  }, [weightRecords]);

  const {
    records: sleepRecords,
    loading: sleepLoading,
    checkExistingRecord: checkExistingSleepRecord,
    addSleepRecord,
    updateSleepRecord,
    getAverageSleepHours,
    getAverageSleepQuality,
    getLatestSleep,
  } = useSleepData(user.id);

  // =========================
  // ✅ Sleep-based flag（睡眠が悪い日）
  // =========================
  const latestSleepForHint = useMemo(() => {
    // 直近の睡眠（記録が「今日」じゃなくても、直近を採用）
    return getLatestSleep?.() ?? null;
  }, [getLatestSleep]);

  const poorSleepFlag = useMemo(() => {
    const h = Number(latestSleepForHint?.sleep_hours ?? 0);
    const q = Number(latestSleepForHint?.sleep_quality ?? 0);

    // 目安：睡眠6h未満 or 質が2以下
    const poorByHours = h > 0 && h < 6;
    const poorByQuality = q > 0 && q <= 2;

    return {
      isPoor: poorByHours || poorByQuality,
      hours: h || null,
      quality: q || null,
    };
  }, [latestSleepForHint]);



  const {
    records: motivationRecords,
    loading: motivationLoading,
    checkExistingRecord: checkExistingMotivationRecord,
    addMotivationRecord,
    updateMotivationRecord,
    getAverageMotivation,
    getAverageEnergy,
    getAverageStress,
    getLatestMotivation,
  } = useMotivationData(user.id);

  const { records: inbodyRecords, latest: latestInbody, loading: inbodyLoading, error: inbodyError } = useInbodyData(user.id);
  const { cycles: menstrualCycles, addCycle: addMenstrualCycle, updateCycle: updateMenstrualCycle } = useMenstrualCycleData(user.id);


  const { isActive, shouldShowTutorial, startTutorial, completeTutorial, skipTutorial, currentStepIndex, setCurrentStepIndex } =
    useTutorialContext();

  const { isDarkMode } = useDarkMode();

  // =========================
  // ✅ 栄養（今日）
  // =========================
  const {
    logs: nutritionLogsToday,
    totals: nutritionTotalsToday,
    loading: nutritionLoading,
    error: nutritionError,
    refetch: refetchNutritionToday,
  } = useTodayNutritionTotals(user.id, nutritionDate);

  // ✅ ここに追加（この場所！）
  const normalizedNutritionTotalsToday = useMemo(() => {
    const t = nutritionTotalsToday ?? {};
    const cal =
      Number((t as any)?.cal ?? (t as any)?.kcal ?? (t as any)?.calories ?? (t as any)?.total_calories ?? 0) || 0;
    const p = Number((t as any)?.p ?? (t as any)?.protein_g ?? (t as any)?.protein ?? 0) || 0;
    const f = Number((t as any)?.f ?? (t as any)?.fat_g ?? (t as any)?.fat ?? 0) || 0;
    const c = Number((t as any)?.c ?? (t as any)?.carbs_g ?? (t as any)?.carbs ?? 0) || 0;
    return { cal, p, f, c };
  }, [nutritionTotalsToday]);

  // =========================
  // ✅ Derived（useMemoで参照安定化しやすい形へ）
  // =========================
  const derived = useAthleteDerivedValues({
    trainingRecords: records,
    weightRecords,
    sleepRecords,
    motivationRecords,
  });

  const daysWithData = derived.daysWithTrainingData;
  const consecutiveDays = derived.consecutiveTrainingDays;
  const weeklyAverage = derived.weeklyAverage;

  // ✅ lastRecord系は "直接" 渡す
  const {
    normalizedLastTrainingRecord,
    normalizedLastTrainingRecordForCheckIn,
    normalizedLastWeightRecord,
    normalizedLastSleepRecord,
    normalizedLastMotivationRecord,
  } = useLastRecords({
    lastTrainingRecord: derived.lastTrainingRecord,
    lastWeightRecord: derived.lastWeightRecord,
    lastSleepRecord: derived.lastSleepRecord,
    lastMotivationRecord: derived.lastMotivationRecord,
  });

  // =========================
  // ✅ sleepRecords 正規化（useMemo）
  // =========================
  const normalizedSleepRecords = useMemo(() => {
    return sleepRecords.map((r) => ({
      ...r,
      sleep_quality: r.sleep_quality ?? 0,
    }));
  }, [sleepRecords]);

  const timelineSleepRecords = useMemo(() => {
    return normalizedSleepRecords.map((r) => ({
      sleep_hours: r.sleep_hours,
      sleep_quality: r.sleep_quality,
      date: r.date,
    }));
  }, [normalizedSleepRecords]);

  // =========================
  // ✅ アラート（useMemo）
  // =========================
  const userAlerts = useMemo(() => alerts.filter((a) => a.user_id === user.id), [alerts, user.id]);
  const highPriorityAlerts = useMemo(() => userAlerts.filter((a) => a.priority === 'high'), [userAlerts]);

  const todayWeight = useMemo(() => weightRecords.find((r) => r.date === today), [weightRecords, today]);


// =========================
// ✅ Phase/Risk/Sleep を統一ロジックで生成（今日の一言 + 各ヒント）
// =========================
  const phaseHints = useMemo(() => {
  const assist = buildDailyAssistTexts({
    phase: todayPhase,
    poorSleep: poorSleepFlag, // isPoor含むオブジェクト丸ごと
    risk: {
      riskLevel: (latestACWR?.riskLevel ?? "unknown") as any,
      hasHighPriorityAlert: (highPriorityAlerts?.length ?? 0) > 0,
    },
  });

  return {
    base: assist.oneWord,
    training: assist.trainingHint,
    sleep: assist.sleepHint,
    nutrition: assist.nutritionHint,
  };
}, [todayPhase, poorSleepFlag, latestACWR?.riskLevel, highPriorityAlerts?.length]);



  // =========================
  // ✅ Entry POP（おかえり > 今日の一言）
  // =========================
  const entryPop = useEntryPopup({
    userId: user.id,
    keyPrefix: "athlete",
    thresholdDays: 3,
    enableDailyTip: true,
  });

  // ✅ unifiedタブ以外では出さない
  const shouldShowEntryPop = activeTab === "unified" && entryPop.open;

  // ✅ メッセージ
  const entryPopMessage = useMemo(() => {
    if (entryPop.mode === "welcome_back") {
      return `おかえり！\nまずは「今日の状態」を軽く記録して、無理なく再始動しよう。`;
    }
    return `${phaseHints.base}`;
  }, [entryPop.mode, phaseHints.base]);

  // =========================
  // ✅ 今日のスナップショット fetch（setStateでレンダー増えるのは正常）
  // =========================
  const targets = useMemo(() => {
    const weightKg =
      Number(latestInbody?.weight ?? latestInbody?.weight_kg) ||
      Number(user?.weight_kg) ||
      0;

    if (!weightKg || weightKg <= 0) return null;

    const bodyFatPercentRaw = Number(latestInbody?.body_fat_percent ?? latestInbody?.body_fat_perc);
    const bodyFatPercent = Number.isFinite(bodyFatPercentRaw) && bodyFatPercentRaw > 0 ? bodyFatPercentRaw : null;

    const heightCmRaw = Number(user?.height_cm);
    const heightCm = Number.isFinite(heightCmRaw) && heightCmRaw > 0 ? heightCmRaw : null;

    const res = buildDailyTargets({
      weightKg,
      bodyFatPercent,
      heightCm,
      age: null,
      sex: null,
      activityLevel: "moderate",
      goalType: "maintain",
    });

    return res?.target ?? null;
  }, [
    user?.weight_kg,
    user?.height_cm,
    latestInbody?.weight,
    latestInbody?.weight_kg,
    latestInbody?.body_fat_percent,
    latestInbody?.body_fat_perc,
  ]);

  // =========================
  // ✅ 今日の負荷（useMemo）
  // =========================
  const todayTrainingRecord = useMemo(() => records.find((r) => r.date === today) ?? null, [records, today]);

  const todayLoad = useMemo(() => {
    return todayTrainingRecord ? (todayTrainingRecord.rpe ?? 0) * (todayTrainingRecord.duration_min ?? 0) : 0;
  }, [todayTrainingRecord]);

  // =========================
  // ✅ エネルギーサマリー（useMemo）
  // =========================
  const intakeToday = 0;

  const energySummary = useMemo(() => {
    return getTodayEnergySummary({
      date: today,
      snapshot: snapshotToday
        ? {
            bmr: snapshotToday.bmr,
            tdee: snapshotToday.tdee,
            srpe: snapshotToday.srpe,
            activity_factor: Number(snapshotToday.activity_factor),
          }
        : null,
      intakeCalories: intakeToday,
      fallback: { todayLoad },
    });
  }, [today, snapshotToday, intakeToday, todayLoad]);

  // =========================
  // ✅ チュートリアル開始（必要時のみ）
  // =========================
  useEffect(() => {
    if (hasStartedTutorial) return;
    if (loading) return;

    if (shouldShowTutorial()) {
      startTutorial();
      setHasStartedTutorial(true);
    }
  }, [loading, hasStartedTutorial, shouldShowTutorial, startTutorial]);


  // =========================
  // ✅ handlers（useCallbackで参照固定）
  // =========================
  const handleTrainingSubmit = useCallback(
    async (data: { rpe: number; duration_min: number; date: string; arrow_score?: number; signal_score?: number }) => {
      const result = await addTrainingRecord({
        rpe: data.rpe,
        duration_min: data.duration_min,
        date: data.date,
        arrow_score: data.arrow_score ?? 50,
        signal_score: data.signal_score ?? 50,
      } as any);

      // オフラインキューに入った場合はエネルギースナップショットもスキップ
      if (!(result as any)?.queued) {
        await upsertDailyEnergySnapshot({
          userId: user.id,
          date: data.date,
          rpe: data.rpe,
          durationMin: data.duration_min,
        });
      }

      return result;
    },
    [addTrainingRecord, user.id]
  );

  const handleTrainingUpdate = useCallback(
    async (recordId: string, recordData: { rpe: number; duration_min: number; date?: string }) => {
      await updateTrainingRecord(recordId, recordData);
    },
    [updateTrainingRecord]
  );

  const handleTrainingUpdateForList = useCallback(
    async (recordId: string, recordData: { rpe: number; duration_min: number }) => {
      await updateTrainingRecord(recordId, recordData);
    },
    [updateTrainingRecord]
  );

  const handleTrainingSubmitForCheckIn = useCallback(
    async (data: { rpe: number; duration_min: number; date: string; arrow_score?: number; signal_score?: number }) => {
      const result = await addTrainingRecord({
        rpe: data.rpe,
        duration_min: data.duration_min,
        date: data.date,
        arrow_score: data.arrow_score ?? 50,
        signal_score: data.signal_score ?? 50,
      } as any);
      return result;
    },
    [addTrainingRecord]
  );

  const handleTrainingUpdateForCheckIn = useCallback(
    async (
      recordId: string,
      recordData: { rpe: number; duration_min: number; arrow_score?: number; signal_score?: number }
    ) => {
      await updateTrainingRecord(recordId, {
        rpe: recordData.rpe,
        duration_min: recordData.duration_min,
        arrow_score: recordData.arrow_score ?? 50,
        signal_score: recordData.signal_score ?? 50,
      } as any);
    },
    [updateTrainingRecord]
  );



  const recordDate = today; // ✅ subtitle用（recordDate未定義エラー回避）
  const galleryInputRef = useRef<HTMLInputElement | null>(null);


  // 📷 ファイル選択用（撮影 / ライブラリ）
  const libraryInputRef = useRef<HTMLInputElement | null>(null);
  // 📷 iOS対応：hidden を使わない file input 用クラス
  const fileInputClass =
  "absolute -left-[9999px] top-0 w-px h-px opacity-0";
  const handlePickPhoto = useCallback((file: File) => {
    setActiveTab("nutrition");
  }, []);

  const getCategoryDisplayName = useCallback((category: string) => {
    switch (category) {
      case 'jump':
        return 'ジャンプ測定';
      case 'endurance':
        return '全身持久力測定';
      case 'strength':
        return '筋力測定';
      case 'sprint':
        return 'スプリント測定';
      case 'agility':
        return 'アジリティ測定';
      default:
        return 'パフォーマンス測定';
    }
  }, []);

  // =========================
  // ✅ derived check ログもDEV限定
  // =========================
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    console.log('[derived check]', {
      lastTraining: derived.lastTrainingRecord?.date,
      lastSleep: derived.lastSleepRecord?.date,
      lastMotivation: derived.lastMotivationRecord?.date,
      days: derived.daysWithTrainingData,
      consecutive: derived.consecutiveTrainingDays,
    });
  }, [
    derived.lastTrainingRecord?.date,
    derived.lastSleepRecord?.date,
    derived.lastMotivationRecord?.date,
    derived.daysWithTrainingData,
    derived.consecutiveTrainingDays,
  ]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      {readOnly && (
        <div className="bg-blue-50 dark:bg-blue-900/30 border-b border-blue-200 dark:border-blue-800 px-4 py-3 text-center">
          <div className="text-sm font-medium text-blue-800 dark:text-blue-200">
            このアカウントは凍結されています。過去データの閲覧のみ可能です。
          </div>
        </div>
      )}

      {/* ── Header + Menu（抽出済み）── */}
      <AthleteViewHeader
        userName={user.name}
        userId={user.id}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        safeSetActiveTab={safeSetActiveTab}
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
        readOnly={readOnly}
        unreadMessageCount={unreadMessageCount}
        startTutorial={startTutorial}
        onHome={onHome}
        onLogout={onLogout}
        onNavigateToHelp={onNavigateToHelp}
        onNavigateToPrivacy={onNavigateToPrivacy}
        onNavigateToTerms={onNavigateToTerms}
        onNavigateToCommercial={onNavigateToCommercial}
        normalizedGenderBinary={normalizedGenderBinary}
        canUseFTT={canUseFTT}
        canUseNutrition={canUseNutrition}
        isRehabilitating={isRehabilitating}
        hasActivePrograms={hasActivePrograms}
        planLimits={planLimits}
        today={today}
        setNutritionDate={setNutritionDate}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-2 pb-4 sm:pt-4 sm:pb-8">
        {activeTab === 'unified' ? (
          <UnifiedTabContent
            user={user}
            readOnly={readOnly}
            setShowProfileEdit={setShowProfileEdit}
            isRehabilitating={isRehabilitating}
            hasActivePrograms={hasActivePrograms}
            activeProgramCount={activeProgramCount}
            setSelectedQuestPrescriptionId={setSelectedQuestPrescriptionId}
            setActiveTab={setActiveTab}
            todayPhase={todayPhase}
            nextPhases={nextPhases}
            phaseLoading={phaseLoading}
            phaseError={phaseError}
            phaseLabel={phaseLabel}
            toShortRange={toShortRange}
            phaseHints={phaseHints}
            currentACWR={currentACWR}
            acwrData={acwrData}
            weightRecords={weightRecords}
            normalizedSleepRecords={normalizedSleepRecords}
            motivationRecords={motivationRecords}
            records={records}
            menstrualCycles={menstrualCycles}
            normalizedGenderFull={normalizedGenderFull}
            normalizedGenderBinary={normalizedGenderBinary}
            setShowUnifiedCheckIn={setShowUnifiedCheckIn}
            canUseNutrition={canUseNutrition}
            nutritionLoading={nutritionLoading}
            nutritionTotalsToday={nutritionTotalsToday}
            targets={targets}
            recordDate={recordDate}
            showUnifiedHeavy={showUnifiedHeavy}
            timelineSleepRecords={timelineSleepRecords}
            highPriorityAlerts={highPriorityAlerts}
            userId={user.id}
          />


        ) : activeTab === "rehab" ? (
          /* ★ 追加：リハビリ・トレーニング用ビュー */
          <UpgradeGate allowed={planLimits.canUseRehab} featureName="トレーニング / リハビリ">
          <Suspense fallback={<div className="flex items-center justify-center h-64 animate-pulse text-indigo-500 font-black">修行の準備中...</div>}>
            {selectedQuestPrescriptionId ? (
              /* 個別クエスト画面 */
              <RehabQuestViewLazy
                userId={user.id}
                prescriptionId={selectedQuestPrescriptionId}
                onBackHome={() => {
                  setSelectedQuestPrescriptionId(null);
                  // 処方が1つだけの場合はホームに戻る
                  if (activeProgramCount <= 1) setActiveTab('unified');
                }}
              />
            ) : activeProgramCount > 1 ? (
              /* 複数処方 → カードリスト */
              <PrescriptionCardListLazy
                userId={user.id}
                onBackHome={() => setActiveTab('unified')}
                onOpenQuest={(presId) => setSelectedQuestPrescriptionId(presId)}
              />
            ) : (
              /* 処方が1つだけ → 直接クエスト画面 */
              <RehabQuestViewLazy userId={user.id} onBackHome={() => setActiveTab('unified')} />
            )}
          </Suspense>
          </UpgradeGate>

        ) : activeTab === "nutrition" ? (
          <UpgradeGate allowed={planLimits.canUseNutrition} featureName="栄養管理">
          {canUseNutrition ? (
            <Suspense
              fallback={
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
                </div>
              }
            >
              <AthleteNutritionDashboardView
                user={user}
                date={nutritionDate}
                nutritionLogs={nutritionLogsToday}
                nutritionTotals={normalizedNutritionTotalsToday}
                nutritionLoading={nutritionLoading}
                nutritionError={nutritionError}
                onBackHome={() => setActiveTab("unified")}
                latestInbody={latestInbody ?? null}
                trainingRecords={records ?? []}
                latestWeightKg={latestWeight ?? null}
                onRefreshNutrition={refetchNutritionToday}
                onChangeDate={(d) => setNutritionDate(d)}
              />
            </Suspense>
          ) : null}
          </UpgradeGate>

        ) : activeTab === 'ftt' ? (
          canUseFTT ? (
            <FTTCheck
              userId={user.id}
              onBackHome={() => setActiveTab('unified')}
            />
          ) : null

        ) : activeTab === 'overview' ? (
          <OverviewTabContent
            userId={user.id}
            userAlerts={userAlerts}
            highPriorityAlerts={highPriorityAlerts}
            todayWeight={todayWeight}
            setActiveTab={setActiveTab}
            records={records}
            loading={loading}
            handleTrainingSubmit={handleTrainingSubmit}
            checkExistingTrainingRecord={checkExistingTrainingRecord}
            handleTrainingUpdate={handleTrainingUpdate}
            handleTrainingUpdateForList={handleTrainingUpdateForList}
            deleteTrainingRecord={deleteTrainingRecord}
            normalizedLastTrainingRecord={normalizedLastTrainingRecord}
            daysWithData={daysWithData}
            consecutiveDays={consecutiveDays}
            weeklyAverage={weeklyAverage}
            latestACWR={latestACWR}
            latestACWRValue={latestACWRValue}
            acwrData={acwrData}
            isDarkMode={isDarkMode}
            phaseHints={phaseHints}
          />
        ) : activeTab === 'weight' ? (
          <WeightTabContent
            setActiveTab={setActiveTab}
            latestACWR={latestACWR}
            latestACWRValue={latestACWRValue}
            weightRecords={weightRecords}
            weightLoading={weightLoading}
            addWeightRecord={addWeightRecord}
            checkExistingWeightRecord={checkExistingWeightRecord}
            updateWeightRecord={updateWeightRecord}
            deleteWeightRecord={deleteWeightRecord}
            getLatestWeight={getLatestWeight}
            getWeightChange={getWeightChange}
            lastWeightRecord={lastWeightRecord}
            latestWeight={latestWeight}
            inbodyRecords={inbodyRecords}
            latestInbody={latestInbody}
            inbodyLoading={inbodyLoading}
            inbodyError={inbodyError}
            userHeightCm={user.height_cm}
            userDateOfBirth={user.date_of_birth}
            normalizedGenderFull={normalizedGenderFull}
            normalizedGenderBinary={normalizedGenderBinary}
            canUseInBody={planLimits.canUseInBody}
          />
        ) : activeTab === 'insights' ? (
          /* Correlation Analysis Tab */
          <UpgradeGate allowed={planLimits.canUseInsights} featureName="インサイト分析">
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 sm:p-6 transition-colors">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-4 sm:mb-6">体重とACWRの相関グラフ</h2>
              {loading || weightLoading ? (
                <div className="flex items-center justify-center h-96">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <Suspense fallback={<TabFallback label="分析グラフ読み込み中..." heightClass="h-96" />}>
                  <WeightACWRChartLazy acwrData={acwrData} weightData={weightRecords} />
                </Suspense>
              )}
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 sm:p-6 transition-colors">
            <Suspense fallback={<SkeletonBlock heightClass="h-40" />}>
              <InsightCardLazy acwrData={acwrData} weightData={weightRecords} />
            </Suspense>
            </div>
          </div>
          </UpgradeGate>
       ) : activeTab === 'performance' ? (
        <UpgradeGate allowed={planLimits.canUsePerformanceTesting} featureName="パフォーマンス測定">
        <Suspense
          fallback={
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
            </div>
          }
        >
          <AthletePerformanceView
            user={user}
            onBackHome={() => setActiveTab('unified')}
          />
        </Suspense>
        </UpgradeGate>
      ) : activeTab === 'profile' ? (
        <Suspense
          fallback={
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
            </div>
          }
        >
          <AthletePerformanceProfileLazy userId={user.id} />
        </Suspense>
      ) : activeTab === 'conditioning' ? (
          <ConditioningTabContent
            latestACWR={latestACWR}
            getLatestSleep={getLatestSleep}
            getLatestMotivation={getLatestMotivation}
            sleepRecords={sleepRecords}
            sleepLoading={sleepLoading}
            addSleepRecord={addSleepRecord}
            checkExistingSleepRecord={checkExistingSleepRecord}
            updateSleepRecord={updateSleepRecord}
            normalizedLastSleepRecord={normalizedLastSleepRecord}
            getAverageSleepHours={getAverageSleepHours}
            getAverageSleepQuality={getAverageSleepQuality}
            motivationRecords={motivationRecords}
            motivationLoading={motivationLoading}
            addMotivationRecord={addMotivationRecord}
            checkExistingMotivationRecord={checkExistingMotivationRecord}
            updateMotivationRecord={updateMotivationRecord}
            normalizedLastMotivationRecord={normalizedLastMotivationRecord}
            getAverageMotivation={getAverageMotivation}
            getAverageEnergy={getAverageEnergy}
            getAverageStress={getAverageStress}
            phaseHints={phaseHints}
          />
       ) : activeTab === 'cycle' ? (
        <AthleteCycleView userId={user.id} gender={normalizedGenderBinary} />

        ) : activeTab === 'gamification' ? (
            <AthleteGamificationView
            user={user}
          />

        ) : activeTab === 'messages' ? (
          <Suspense
            fallback={
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            }
          >
            <MessagingPanel userId={user.id} userName={user.name} onClose={() => setActiveTab('unified')} />
          </Suspense>
        ) : activeTab === 'settings' ? (
          <AthleteSettingsView user={user} onOpenProfileEdit={() => setShowProfileEdit(true)} />
        ) : null}
      </main>

      {/* Export Panel */}
      {showExportPanel && (
        <Suspense
          fallback={
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
            </div>
          }
        >
          <ExportPanel user={user} trainingRecords={records} acwrData={acwrData} onClose={() => setShowExportPanel(false)} />
        </Suspense>
      )}

      {/* Profile Edit Modal */}
      {showProfileEdit && (
        <ProfileEditForm
          user={user}
          onUpdate={async () => {
            await onUserUpdated?.();
          }}
          onClose={() => setShowProfileEdit(false)}
        />
      )}

      <TutorialController
        steps={getTutorialSteps('athlete')}
        isActive={isActive}
        onComplete={completeTutorial}
        onSkip={skipTutorial}
        currentStepIndex={currentStepIndex}
        onStepChange={setCurrentStepIndex}
      />

      {!readOnly && showUnifiedCheckIn && (
        <UnifiedDailyCheckIn
          userId={user.id}
          userGender={normalizedGenderBinary}
          onTrainingSubmit={handleTrainingSubmitForCheckIn}
          onTrainingCheckExisting={checkExistingTrainingRecord}
          onTrainingUpdate={handleTrainingUpdateForCheckIn}
          onWeightSubmit={addWeightRecord}
          onWeightCheckExisting={checkExistingWeightRecord}
          onWeightUpdate={updateWeightRecord}
          onSleepSubmit={addSleepRecord}
          onSleepCheckExisting={checkExistingSleepRecord}
          onSleepUpdate={updateSleepRecord}
          onMotivationSubmit={addMotivationRecord}
          onMotivationCheckExisting={checkExistingMotivationRecord}
          onMotivationUpdate={updateMotivationRecord}
          onCycleSubmit={addMenstrualCycle}
          onCycleUpdate={updateMenstrualCycle}
          onClose={() => setShowUnifiedCheckIn(false)}
          lastTrainingRecord={normalizedLastTrainingRecordForCheckIn ?? null}
          lastWeightRecord={
            normalizedLastWeightRecord ? { weight_kg: Number(normalizedLastWeightRecord.weight_kg), date: normalizedLastWeightRecord.date } : null
          }
          lastSleepRecord={normalizedLastSleepRecord ?? null}
          lastMotivationRecord={normalizedLastMotivationRecord ?? null}
        />
      )}

            {!readOnly && activeTab === 'unified' && (
           <FloatingActionButton
           onClick={() => setShowUnifiedCheckIn(true)}
           onCameraClick={canUseNutrition ? () => galleryInputRef.current?.click() : undefined}
         />
            )}

            {/* hidden input: photo picker */}
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              className={fileInputClass}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) handlePickPhoto(file);
              }}
            />
            {/* ✅ Entry Popup（おかえり / 今日の一言） */}
            {shouldShowEntryPop && entryPop.mode !== "none" && (
                <EntryPopup
                  open={shouldShowEntryPop}
                  mode={entryPop.mode}                 // ✅ "welcome_back" | "daily_one_word"
                  daysAway={entryPop.daysAway}
                  message={entryPopMessage}
                  onClose={() => entryPop.dismiss("close")}
                  onOk={() => {
                    entryPop.dismiss("ok");
                    setShowUnifiedCheckIn(true);
                  }}
                  okLabel="OK"
                  closeLabel="閉じる"
                />
              )}
              {!readOnly && <OfflineIndicator />}
              </div>
  );
}
