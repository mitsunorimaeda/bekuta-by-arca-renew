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
import { ShareStatusButton } from './ShareStatusButton';
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


import {
  Activity,
  TrendingUp,
  Calendar,
  AlertTriangle,
  Scale,
  Settings,
  HelpCircle,
  Zap,
  Moon,
  Heart,
  LayoutDashboard,
  Menu,
  X,
  LogOut,
  Trophy,
  Shield,
  FileText,
  Building2,
  Droplets,
  Flame,
  Sword, // ★ 追加
  ChevronRight, // ★ 追加
  ChevronDown,
  User,
  MessageCircle,
} from 'lucide-react';

import { useDarkMode } from '../hooks/useDarkMode';
import { AthleteSettingsView } from './views/AthleteSettingsView';
import { upsertDailyEnergySnapshot } from '../lib/upsertDailyEnergySnapshot';

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



type UserProfile = Database['public']['Tables']['users']['Row'];
type DailyEnergySnapshotRow = Database['public']['Tables']['daily_energy_snapshots']['Row'];

type AthleteViewProps = {
  user: UserProfile;
  alerts: any[];
  onLogout: () => void;
  onHome: () => void;
  onNavigateToPrivacy: () => void;
  onNavigateToTerms: () => void;
  onNavigateToCommercial: () => void;
  onNavigateToHelp: () => void;
  onUserUpdated?: () => Promise<void> | void;
  readOnly?: boolean;
};



// =========================
// ✅ Team Season Phase（今日＋3週間）
// =========================
type TeamPhaseRow = {
  phase_type: 'off' | 'pre' | 'in' | 'peak' | 'transition' | 'unknown';
  focus_tags: string[];
  note: string | null;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
};

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
  // ✅ DEVログは“必要な時だけ”
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

  
  const [todayPhase, setTodayPhase] = useState<TeamPhaseRow | null>(null);
  const [nextPhases, setNextPhases] = useState<TeamPhaseRow[]>([]);
  const [phaseLoading, setPhaseLoading] = useState(false);
  const [phaseError, setPhaseError] = useState<string | null>(null);
  const isPhaseEmpty =
  !phaseLoading && !phaseError && !todayPhase;


  const addDaysToDateString = (dateStr: string, addDays: number) => {
    // dateStr: 'YYYY-MM-DD'（JST）を想定
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
    dt.setDate(dt.getDate() + addDays);

    const yy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
  };

  useEffect(() => {
    const teamId = user.team_id;
    if (!teamId) {
      // team_id が無いユーザーは表示できない（staffなど）
      setTodayPhase(null);
      setNextPhases([]);
      return;
    }

    let cancelled = false;

    const run = async () => {
      setPhaseLoading(true);
      setPhaseError(null);

      try {
        // 今日のフェーズ
        const { data: d1, error: e1 } = await supabase.rpc('get_team_phase_on_date', {
          p_team_id: teamId,
          p_date: today,
        });

        if (e1) throw e1;

        // 3週間レンジ（今日〜21日後）
        const end = addDaysToDateString(today, 21);
        const { data: d2, error: e2 } = await supabase.rpc('get_team_phases_in_range', {
          p_team_id: teamId,
          p_start: today,
          p_end: end,
        });

        if (e2) throw e2;

        if (cancelled) return;

        const row1 = (Array.isArray(d1) ? d1[0] : d1) as TeamPhaseRow | null;
        setTodayPhase(row1 ?? null);
        
        const rows2 = (Array.isArray(d2) ? d2 : []) as TeamPhaseRow[];
        
        // ✅ 「今日」と同じフェーズは “今後” から除外
        const filtered = (rows2 ?? []).filter((p) => {
          if (!row1) return true;
          return !(
            p.phase_type === row1.phase_type &&
            p.start_date === row1.start_date &&
            p.end_date === row1.end_date
          );
        });
        
        // ✅ 念のため日付順に（関数側で並んでるなら不要だけど安全）
        filtered.sort((a, b) => (a.start_date > b.start_date ? 1 : a.start_date < b.start_date ? -1 : 0));
        
        setNextPhases(filtered);
      } catch (err: any) {
        if (cancelled) return;
        console.error('[team phase fetch error]', err);
        setPhaseError(err?.message ?? 'team phase fetch error');
        setTodayPhase(null);
        setNextPhases([]);
      } finally {
        if (!cancelled) setPhaseLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [user.team_id, today]);  
  
  
  const phaseLabel = (t: TeamPhaseRow['phase_type']) => {
    switch (t) {
      case 'off': return 'オフ';
      case 'pre': return 'プレ';
      case 'in': return 'イン';
      case 'peak': return 'ピーク';
      case 'transition': return '移行';
      default: return '未設定';
    }
  };

  const toShortRange = (s: string, e: string) => {
    // s,e: YYYY-MM-DD
    const sm = Number(s.slice(5, 7));
    const sd = Number(s.slice(8, 10));
    const em = Number(e.slice(5, 7));
    const ed = Number(e.slice(8, 10));
    if (!sm || !sd || !em || !ed) return `${s}〜${e}`;
    return `${sm}/${sd}–${em}/${ed}`;
  };





  const [snapshotToday, setSnapshotToday] = useState<DailyEnergySnapshotRow | null>(null);
  const [showExportPanel, setShowExportPanel] = useState(false);
  const [showUnifiedCheckIn, setShowUnifiedCheckIn] = useState(false);
 
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

    type ActiveTab =
    | 'unified'
    | 'overview'
    | 'weight'
    | 'insights'
    | 'nutrition'
    | 'ftt'
    | 'performance'
    | 'conditioning'
    | 'cycle'
    | 'gamification'
    | 'settings'
    | 'messages'
    | 'rehab'
    | 'profile';

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
  // ✅ unified の重いセクションを “アイドル後” に表示（LCP改善）
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
  // ✅ “最新ACWR”（phaseHintsで使うので先に定義）
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

  // ✅ lastRecord系は “直接” 渡す
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
      <header className="bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-700 dark:to-blue-800 shadow-lg transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            {/* 左：ロゴ */}
            <button
              type="button"
              onClick={onHome}
              className="flex items-baseline gap-2 active:opacity-70 cursor-pointer"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <span className="text-2xl sm:text-3xl font-bold text-white">Bekuta</span>
              <span className="text-xs font-medium text-blue-100 hidden sm:inline">by ARCA</span>
            </button>

            {/* 右：? と ハンバーガー */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={startTutorial}
                className="p-2 rounded-lg text-white/90 hover:bg-white/10 hover:text-white transition-colors"
                aria-label="チュートリアル"
                title="チュートリアル"
              >
                <HelpCircle className="w-5 h-5" />
              </button>

              {/* 通知ベルアイコン */}
              {!readOnly && <NotificationInbox userId={user.id} />}

              {/* メッセージアイコン */}
              <button
                type="button"
                onClick={() => { setActiveTab('messages'); setMenuOpen(false); }}
                className="relative p-2 rounded-lg text-white hover:bg-white/10 transition-colors"
                aria-label="メッセージ"
                title="メッセージ"
              >
                <MessageCircle className="w-5 h-5" />
                {unreadMessageCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                    {unreadMessageCount > 9 ? '9+' : unreadMessageCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="p-2 rounded-lg text-white hover:bg-white/10 transition-colors"
                aria-label="メニュー"
                title="メニュー"
              >
                {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* User Info Bar */}
      <div className="bg-gray-50 dark:bg-gray-900 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-2">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {user.name}さん ·{' '}
            {activeTab === 'unified'
              ? 'ホーム：総合ダッシュボード'
              : activeTab === 'overview'
              ? '今日の練習データを記録'
              : activeTab === 'weight'
              ? '体重の変化を管理'
              : activeTab === 'insights'
              ? 'データから新しい発見を'
              : activeTab === 'performance'
              ? 'パフォーマンスを測定'
              : activeTab === 'profile'
              ? 'マイプロフィール'
              : activeTab === 'conditioning'
              ? '体調・リカバリー'
              : activeTab === 'cycle'
              ? '月経周期とコンディションを記録'
               : activeTab === 'nutrition'
              ? '栄養：食事内容を記録_AI分析'
              : activeTab === 'gamification'
              ? 'ストリーク、バッジ、目標を管理'
              : activeTab === 'rehab' // ★ 追加
              ? 'トレーニング / リハビリ' // ★ 追加
              : activeTab === 'ftt' // ★ 追加
              ? '神経疲労チェック' // ★ 追加
              : '設定とお知らせ'}
          </p>
        </div>
      </div>

      {/* Hamburger Menu Dropdown */}
      {menuOpen && (
        <div className="fixed inset-0 z-50" onClick={() => setMenuOpen(false)}>
          <div className="absolute inset-0 bg-black bg-opacity-50"></div>

          <div
            className="absolute top-16 right-4 bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-72 max-h-[calc(100vh-5rem)] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-2">
              {/* ── 記録セクション ── */}
              <p className="px-3 pt-2 pb-1 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">記録</p>

              {/* 🏠 ホーム */}
              <button type="button"
                onClick={() => {
                  setActiveTab('unified');
                  setMenuOpen(false);
                }}
                className={`w-full flex items-center space-x-2 px-3 py-2.5 rounded-lg transition-colors ${
                  activeTab === 'unified'
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span className="text-sm font-medium">ホーム</span>
              </button>

              {/* ★ 追加：修行（リハビリ・トレーニング） */}
              {(isRehabilitating || hasActivePrograms) && (
                <button type="button"
                  onClick={() => {
                    setActiveTab('rehab');
                    setMenuOpen(false);
                  }}
                  className={`w-full flex items-center space-x-2 px-3 py-2.5 rounded-lg transition-colors ${
                    activeTab === 'rehab'
                      ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 font-bold italic'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <Sword className="w-4 h-4 text-indigo-500" />
                  <span className="text-sm font-medium">トレーニング / リハビリ</span>
                </button>
              )}

              {/* 体重管理 */}
              <button type="button"
                onClick={() => {
                  setActiveTab('weight');
                  setMenuOpen(false);
                }}
                className={`w-full flex items-center space-x-2 px-3 py-2.5 rounded-lg transition-colors ${
                  activeTab === 'weight'
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <Scale className="w-4 h-4" />
                <span className="text-sm font-medium">体重管理</span>
              </button>

              {/* 体調・リカバリー */}
              <button type="button"
                onClick={() => {
                  setActiveTab('conditioning');
                  setMenuOpen(false);
                }}
                className={`w-full flex items-center space-x-2 px-3 py-2.5 rounded-lg transition-colors ${
                  activeTab === 'conditioning'
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <Heart className="w-4 h-4" />
                <span className="text-sm font-medium">体調・リカバリー</span>
              </button>

              {/* 女性のみ：月経周期 */}
              {normalizedGenderBinary === 'female' && (
                <button type="button"
                  onClick={() => {
                    setActiveTab('cycle');
                    setMenuOpen(false);
                  }}
                  className={`w-full flex items-center space-x-2 px-3 py-2.5 rounded-lg transition-colors ${
                    activeTab === 'cycle'
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <Droplets className="w-4 h-4" />
                  <span className="text-sm font-medium">月経周期</span>
                </button>
              )}

              {/* 練習記録 */}
              <button type="button"
                onClick={() => {
                  setActiveTab('overview');
                  setMenuOpen(false);
                }}
                className={`w-full flex items-center space-x-2 px-3 py-2.5 rounded-lg transition-colors ${
                  activeTab === 'overview'
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <Activity className="w-4 h-4" />
                <span className="text-sm font-medium">練習記録</span>
              </button>

              {/*栄養*/}
              {canUseNutrition && (
                <button type="button"
                  onClick={() => {
                    setNutritionDate(today); // 今日の日付にリセット
                    safeSetActiveTab('nutrition');
                    setMenuOpen(false);
                  }}
                  className={`w-full flex items-center space-x-2 px-3 py-2.5 rounded-lg transition-colors ${
                    activeTab === 'nutrition'
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <Flame className="w-4 h-4" />
                  <span className="text-sm font-medium">栄養</span>
                </button>
              )}

              {/* ── 分析セクション ── */}
              <div className="border-t border-gray-200 dark:border-gray-700 my-2"></div>
              <p className="px-3 pt-1 pb-1 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">分析</p>

              {/* パフォーマンス */}
              <button type="button"
                onClick={() => {
                  setActiveTab('performance');
                  setMenuOpen(false);
                }}
                className={`w-full flex items-center space-x-2 px-3 py-2.5 rounded-lg transition-colors ${
                  activeTab === 'performance'
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <Zap className="w-4 h-4" />
                <span className="text-sm font-medium">パフォーマンス</span>
              </button>

              {/* マイプロフィール（パフォーマンス分析） */}
              <button type="button"
                onClick={() => {
                  setActiveTab('profile');
                  setMenuOpen(false);
                }}
                className={`w-full flex items-center space-x-2 px-3 py-2.5 rounded-lg transition-colors ${
                  activeTab === 'profile'
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <User className="w-4 h-4" />
                <span className="text-sm font-medium">マイプロフィール</span>
              </button>

              {/* ゲーミフィケーション */}
              <button type="button"
                onClick={() => {
                  setActiveTab('gamification');
                  setMenuOpen(false);
                }}
                className={`w-full flex items-center space-x-2 px-3 py-2.5 rounded-lg transition-colors ${
                  activeTab === 'gamification'
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                data-tutorial="gamification-tab"
              >
                <Trophy className="w-4 h-4" />
                <span className="text-sm font-medium">ゲーミフィケーション</span>
              </button>

              {/*FTT計測*/}
              {canUseFTT && (
                <button type="button"
                  onClick={() => {
                    safeSetActiveTab('ftt');
                    setMenuOpen(false);
                  }}
                  className={`w-full flex items-center space-x-2 px-3 py-2.5 rounded-lg transition-colors ${
                    activeTab === 'ftt'
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <Activity className="w-4 h-4" />
                  <span className="text-sm font-medium">ニューロチェック（10秒）</span>
                </button>
              )}

              {/* ── その他セクション ── */}
              <div className="border-t border-gray-200 dark:border-gray-700 my-2"></div>
              <p className="px-3 pt-1 pb-1 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">その他</p>

              {/* メッセージ */}
              <button type="button"
                onClick={() => {
                  setActiveTab('messages');
                  setMenuOpen(false);
                }}
                className={`w-full flex items-center space-x-2 px-3 py-2.5 rounded-lg transition-colors ${
                  activeTab === 'messages'
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <MessageCircle className="w-4 h-4" />
                <span className="text-sm font-medium">メッセージ</span>
              </button>

              <button type="button"
                onClick={() => {
                  setActiveTab('settings');
                  setMenuOpen(false);
                }}
                className={`w-full flex items-center space-x-2 px-3 py-2.5 rounded-lg transition-colors ${
                  activeTab === 'settings'
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <Settings className="w-4 h-4" />
                <span className="text-sm font-medium">設定</span>
              </button>

              {/* 法的情報（折りたたみ） */}
              {(onNavigateToHelp || onNavigateToPrivacy || onNavigateToTerms || onNavigateToCommercial) && (
                <details className="group">
                  <summary className="w-full flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer list-none text-xs">
                    <ChevronDown className="w-3 h-3 transition-transform group-open:rotate-180" />
                    <span>ヘルプ・法的情報</span>
                  </summary>
                  <div className="pl-4 space-y-0.5">
                    {onNavigateToHelp && (
                      <button type="button" onClick={() => { setMenuOpen(false); onNavigateToHelp(); }}
                        className="w-full flex items-center space-x-2 px-3 py-1.5 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 text-xs">
                        <HelpCircle className="w-3 h-3" /><span>ヘルプ</span>
                      </button>
                    )}
                    {onNavigateToPrivacy && (
                      <button type="button" onClick={() => { setMenuOpen(false); onNavigateToPrivacy(); }}
                        className="w-full flex items-center space-x-2 px-3 py-1.5 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 text-xs">
                        <Shield className="w-3 h-3" /><span>プライバシーポリシー</span>
                      </button>
                    )}
                    {onNavigateToTerms && (
                      <button type="button" onClick={() => { setMenuOpen(false); onNavigateToTerms(); }}
                        className="w-full flex items-center space-x-2 px-3 py-1.5 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 text-xs">
                        <FileText className="w-3 h-3" /><span>利用規約</span>
                      </button>
                    )}
                    {onNavigateToCommercial && (
                      <button type="button" onClick={() => { setMenuOpen(false); onNavigateToCommercial(); }}
                        className="w-full flex items-center space-x-2 px-3 py-1.5 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 text-xs">
                        <Building2 className="w-3 h-3" /><span>特定商取引法に基づく表記</span>
                      </button>
                    )}
                  </div>
                </details>
              )}

              {onLogout && (
                <>
                  <div className="border-t border-gray-200 dark:border-gray-700 my-2"></div>
                  <button type="button"
                    onClick={async () => {
                      setMenuOpen(false);

                      // ✅ Sentry：ログアウト時にユーザー情報を外す
                      Sentry.setUser(null);

                      await onLogout();
                    }}
                    className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="text-sm font-medium">ログアウト</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-2 pb-4 sm:pt-4 sm:pb-8">
        {activeTab === 'unified' ? (
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
            // ✅ 未設定時はコンパクトに
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

              {/* Next（“薄い横チップ”だけ：タグ/メモは出さない） */}
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
            // ✅ 未設定時は “高さ半分” のコンパクト表示
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
              <DailyReflectionCardLazy userId={user.id} />
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

            {/* ✅ スタッフに共有ボタン */}
            <div className="mt-4">
              <ShareStatusButton userId={user.id} highlight={highPriorityAlerts.length > 0} />
            </div>

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

  
        ) : activeTab === "rehab" ? (
          /* ★ 追加：リハビリ・トレーニング用ビュー */
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

        ) : activeTab === "nutrition" ? (
          canUseNutrition ? (
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
          ) : null

        ) : activeTab === 'ftt' ? (
          canUseFTT ? (
            <FTTCheck
              userId={user.id}
              onBackHome={() => setActiveTab('unified')}
            />
          ) : null




        ) : activeTab === 'overview' ? (
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
                  <ShareStatusButton userId={user.id} highlight={highPriorityAlerts.length > 0} />
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
                    userId={user.id}
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
        ) : activeTab === 'weight' ? (
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
              {user.height_cm && latestWeight && (
                <BMIDisplay weightKg={latestWeight} heightCm={user.height_cm} dateOfBirth={user.date_of_birth} gender={normalizedGenderFull} />
              )}

              {!user.height_cm && (
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
        ) : activeTab === 'insights' ? (
          /* Correlation Analysis Tab */
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
       ) : activeTab === 'performance' ? (
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