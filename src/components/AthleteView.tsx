// src/components/AthleteView.tsx
import React, { useState, useEffect, useMemo, useCallback, useRef, Suspense, lazy } from 'react';
import { getTodayJSTString } from '../lib/date';
import type { Database } from '../lib/database.types';
import { TrainingForm } from './TrainingForm';
import { ACWRChart } from './ACWRChart';
import { TrainingRecordsList } from './TrainingRecordsList';
import { AlertSummary } from './AlertSummary';
import { supabase } from '../lib/supabase';
import { WeightForm } from './WeightForm';
import { WeightChart } from './WeightChart';
import { WeightRecordsList } from './WeightRecordsList';
import { WeightACWRChart } from './WeightACWRChart';
import { InsightCard } from './InsightCard';
import { BMIDisplay } from './BMIDisplay';
import { ProfileEditForm } from './ProfileEditForm';
import { TutorialController } from './TutorialController';
import { PerformanceRecordForm } from './PerformanceRecordForm';
import { PerformanceRecordsList } from './PerformanceRecordsList';
import { PerformanceOverview } from './PerformanceOverview';
import { PersonalBestCelebration } from './PersonalBestCelebration';
import { useTrainingData } from '../hooks/useTrainingData';
import { useWeightData } from '../hooks/useWeightData';
import { usePerformanceData } from '../hooks/usePerformanceData';
import { useSleepData } from '../hooks/useSleepData';
import { useMotivationData } from '../hooks/useMotivationData';
import { useMenstrualCycleData } from '../hooks/useMenstrualCycleData';
import { useTutorialContext } from '../contexts/TutorialContext';
import { getTutorialSteps } from '../lib/tutorialContent';
import { SleepForm } from './SleepForm';
import { MotivationForm } from './MotivationForm';
import { SleepChart } from './SleepChart';
import { MotivationChart } from './MotivationChart';
import { ConditioningSummaryCard } from './ConditioningSummaryCard';
import { UnifiedDailyCheckIn } from './UnifiedDailyCheckIn';
import { ConsolidatedOverviewDashboard } from './ConsolidatedOverviewDashboard';
import { MultiMetricTimeline } from './MultiMetricTimeline';
import { FloatingActionButton } from './FloatingActionButton';
import { DailyReflectionCard } from './DailyReflectionCard';
import { ShareStatusButton } from './ShareStatusButton';
import { useAthleteDerivedValues } from '../hooks/useAthleteDerivedValues';
import { DerivedStatsBar } from './DerivedStatsBar';
import { getRiskLabel, getRiskColor } from '../lib/riskUtils';
import { useLastRecords } from '../hooks/useLastRecords';
import { useInbodyData } from '../hooks/useInbodyData';
import { InBodyLatestCard } from './InBodyLatestCard';
import { InBodyCharts } from './InBodyCharts';
import { getTodayEnergySummary } from '../lib/getTodayEnergySummary';
// ✅ 栄養カードはこれだけ残す
import { NutritionCard } from './NutritionCard';
import { useTodayNutritionTotals } from '../hooks/useTodayNutritionTotals';
import AthleteNutritionDashboardView from './views/AthleteNutritionDashboardView';
import NutritionOverview from "../components/NutritionOverview";
import { buildDailyTargets } from "../lib/nutritionCalc";

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
} from 'lucide-react';

import { useDarkMode } from '../hooks/useDarkMode';
import { MenstrualCycleForm } from './MenstrualCycleForm';
import { BasalBodyTemperatureForm } from './BasalBodyTemperatureForm';
import { MenstrualCycleChart } from './MenstrualCycleChart';
import { MenstrualCycleCalendar } from './MenstrualCycleCalendar';
import { CyclePerformanceCorrelation } from './CyclePerformanceCorrelation';
import { AthleteSettingsView } from './views/AthleteSettingsView';
import { upsertDailyEnergySnapshot } from '../lib/upsertDailyEnergySnapshot';

// Lazy load heavy components
const ExportPanel = lazy(() => import('./ExportPanel').then((m) => ({ default: m.ExportPanel })));
const GamificationView = lazy(() => import('./GamificationView').then((m) => ({ default: m.GamificationView })));
const MessagingPanel = lazy(() => import('./MessagingPanel').then((m) => ({ default: m.MessagingPanel })));

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
}: AthleteViewProps) {
  // =========================
  // ✅ DEVログは“必要な時だけ”
  // =========================
  const loggedOnceRef = useRef(false);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (loggedOnceRef.current) return;
    loggedOnceRef.current = true;

    console.log('[AthleteView] mounted', {
      id: user.id,
      role: user.role,
      gender: user.gender,
      team_id: user.team_id,
    });
  }, [user.id, user.role, user.gender, user.team_id]);

  if (import.meta.env.DEV) {
    console.count('[AthleteView] render');
  }

  const today = useMemo(() => getTodayJSTString(), []);
  const recordDate = today;

  const [snapshotToday, setSnapshotToday] = useState<DailyEnergySnapshotRow | null>(null);
  const [showExportPanel, setShowExportPanel] = useState(false);
  const [showUnifiedCheckIn, setShowUnifiedCheckIn] = useState(false);
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [cycleViewMode, setCycleViewMode] = useState<'calendar' | 'chart'>('calendar');
  const [menuOpen, setMenuOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<
    'unified' | 'overview' | 'weight' | 'insights' |'nutrition'| 'performance' | 'conditioning' | 'cycle' | 'gamification' | 'settings' | 'messages'
  >('unified');

  //② nutrition_enabled を見て表示制御
  const canUseNutrition = !!(user as any).nutrition_enabled;
  // ③ もし nutrition_enabled=false なのに nutrition タブへ行こうとしたら戻す
  useEffect(() => {
    if (!canUseNutrition && activeTab === 'nutrition') {
      setActiveTab('unified');
    }
  }, [canUseNutrition, activeTab])


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
  const normalizedGenderFull: 'female' | 'male' | 'other' | 'prefer_not_to_say' | null = useMemo(() => {
    return user.gender === 'female' || user.gender === 'male' || user.gender === 'other' || user.gender === 'prefer_not_to_say'
      ? user.gender
      : null;
  }, [user.gender]);

  const normalizedGenderBinary: 'female' | 'male' | null = useMemo(() => {
    return user.gender === 'female' || user.gender === 'male' ? user.gender : null;
  }, [user.gender]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    console.log('[gender check]', { raw: user.gender, binary: normalizedGenderBinary, full: normalizedGenderFull });
  }, [user.gender, normalizedGenderBinary, normalizedGenderFull]);

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
    acwrData,
  } = useTrainingData(user.id);

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

  const [performanceCategory, setPerformanceCategory] = useState<'jump' | 'endurance' | 'strength' | 'sprint' | 'agility'>('jump');

  const {
    testTypes: performanceTestTypes,
    records: performanceRecords,
    personalBests,
    loading: performanceLoading,
    addRecord: addPerformanceRecord,
    updateRecord: updatePerformanceRecord,
    checkExistingRecord,
    getRecordsByTestType,
    getPersonalBest,
  } = usePerformanceData(user.id, performanceCategory);

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
  } = useTodayNutritionTotals(user.id, today);

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
  // ✅ “最新値”系（useMemo）
  // =========================
  const latestACWR = useMemo(() => (acwrData.length > 0 ? acwrData[acwrData.length - 1] : null), [acwrData]);
  const latestWeight = useMemo(() => getLatestWeight(), [getLatestWeight]);

  const lastWeightRecord = useMemo(() => {
    if (weightRecords.length === 0) return null;
    return weightRecords.reduce((latest, r) => (!latest || new Date(r.date) > new Date(latest.date) ? r : latest), null as any);
  }, [weightRecords]);

  // =========================
  // ✅ handlers（useCallbackで参照固定）
  // =========================
  const handleTrainingSubmit = useCallback(
    async (data: { rpe: number; duration_min: number; date: string; arrow_score?: number; signal_score?: number }) => {
      await addTrainingRecord({
        rpe: data.rpe,
        duration_min: data.duration_min,
        date: data.date,
        arrow_score: data.arrow_score ?? 50,
        signal_score: data.signal_score ?? 50,
      } as any);

      await upsertDailyEnergySnapshot({
        userId: user.id,
        date: data.date,
        rpe: data.rpe,
        durationMin: data.duration_min,
      });
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
      await addTrainingRecord({
        rpe: data.rpe,
        duration_min: data.duration_min,
        date: data.date,
        arrow_score: data.arrow_score ?? 50,
        signal_score: data.signal_score ?? 50,
      } as any);
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

  const handlePerformanceUpdate = useCallback(
    async (
      recordId: string,
      updates: { date?: string; values?: Record<string, any>; notes?: string; is_official?: boolean; weather_conditions?: string }
    ) => {
      await updatePerformanceRecord(recordId, updates);
    },
    [updatePerformanceRecord]
  );

  const handlePerformanceRecordSubmit = useCallback(
    async (recordData: any) => {
      const result = await addPerformanceRecord(recordData);

      if (result?.isNewPersonalBest) {
        const testType = performanceTestTypes.find((t) => t.id === recordData.test_type_id);
        const previousBest = getPersonalBest(recordData.test_type_id);

        if (testType) {
          setCelebrationData({
            testName: testType.display_name,
            value: recordData.values.primary_value,
            unit: testType.unit,
            previousBest: previousBest?.value,
          });
        }
      }

      return result;
    },
    [addPerformanceRecord, performanceTestTypes, getPersonalBest]
  );

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
  // ✅ Map生成（useMemoで参照固定）
  // =========================
  const { lastPerformanceRecords, personalBestsMap } = useMemo(() => {
    const lastMap = new Map();
    const pbMap = new Map();

    performanceTestTypes.forEach((testType) => {
      const recs = getRecordsByTestType(testType.id);
      if (recs.length > 0) lastMap.set(testType.id, recs[0]);

      const pb = getPersonalBest(testType.id);
      if (pb) pbMap.set(testType.id, pb);
    });

    return { lastPerformanceRecords: lastMap, personalBestsMap: pbMap };
  }, [performanceTestTypes, getRecordsByTestType, getPersonalBest]);

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
              ? 'すべての記録を一目で確認'
              : activeTab === 'overview'
              ? '今日の練習データを記録'
              : activeTab === 'weight'
              ? '体重の変化を管理'
              : activeTab === 'insights'
              ? 'データから新しい発見を'
              : activeTab === 'performance'
              ? 'パフォーマンスを測定'
              : activeTab === 'conditioning'
              ? 'コンディション管理'
              : activeTab === 'cycle'
              ? '月経周期とコンディションを記録'
               : activeTab === 'nutrition'
              ? '栄養：AI下書き→あなたが確定'
              : activeTab === 'gamification'
              ? 'ストリーク、バッジ、目標を管理'
              : '設定とお知らせ'}
          </p>
        </div>
      </div>

      {/* Hamburger Menu Dropdown */}
      {menuOpen && (
        <div className="fixed inset-0 z-50" onClick={() => setMenuOpen(false)}>
          <div className="absolute inset-0 bg-black bg-opacity-50"></div>

          <div
            className="absolute top-20 right-4 bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-72 max-h-[calc(100vh-6rem)] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-2">
              {/* 🏠 ホーム */}
              <button
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

              {/* 体重管理 */}
              <button
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

              {/* コンディション管理 */}
              <button
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
                <span className="text-sm font-medium">コンディション管理</span>
              </button>

              {/* 女性のみ：月経周期 */}
              {normalizedGenderBinary === 'female' && (
                <button
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
              <button
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

              {canUseNutrition && (
                <button
                  onClick={() => {
                    setActiveTab('nutrition');
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

              {/* パフォーマンス */}
              <button
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

              {/* ゲーミフィケーション */}
              <button
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

              {/* 設定 */}
              <div className="border-t border-gray-200 dark:border-gray-700 my-2"></div>

              <button
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

              {/* 法的情報 */}
              <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>

              {onNavigateToHelp && (
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onNavigateToHelp();
                  }}
                  className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <HelpCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">ヘルプ・マニュアル</span>
                </button>
              )}

              {onNavigateToPrivacy && (
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onNavigateToPrivacy();
                  }}
                  className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <Shield className="w-4 h-4" />
                  <span className="text-sm font-medium">プライバシーポリシー</span>
                </button>
              )}

              {onNavigateToTerms && (
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onNavigateToTerms();
                  }}
                  className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <FileText className="w-4 h-4" />
                  <span className="text-sm font-medium">利用規約</span>
                </button>
              )}

              {onNavigateToCommercial && (
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onNavigateToCommercial();
                  }}
                  className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <Building2 className="w-4 h-4" />
                  <span className="text-sm font-medium">特定商取引法に基づく表記</span>
                </button>
              )}

              {onLogout && (
                <>
                  <div className="border-t border-gray-200 dark:border-gray-700 my-2"></div>
                  <button
                    onClick={async () => {
                      setMenuOpen(false);
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
            <ConsolidatedOverviewDashboard
              acwrData={acwrData}
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
                else if (section === 'cycle') setActiveTab('cycle');
              }}
              onQuickAdd={() => setShowUnifiedCheckIn(true)}
            />



          
            {/* ✅ 栄養：nutrition_enabled=false の人には表示しない */}
            {canUseNutrition && (
            <NutritionOverview
              totals={nutritionTotalsToday}
              targets={targets}          // buildDailyTargetsのtarget
              loading={nutritionLoading}
              subtitle={recordDate}
              />
            )} 



            {canUseNutrition && (
            <div className="mt-6">
              <NutritionCard
                user={user}
                latestInbody={latestInbody ?? null}
                date={today}
                trainingRecords={records}
                sleepRecords={sleepRecords}
                motivationRecords={motivationRecords}
                badgeText="栄養(β)"
                nutritionLogs={nutritionLogsToday}
                nutritionTotals={nutritionTotalsToday}
                nutritionLoading={nutritionLoading}
                nutritionError={nutritionError}
              />
            </div>
            )}

            <div className="mt-6">
              <DailyReflectionCard userId={user.id} />
            </div>

            {/* ✅ スタッフに共有ボタン */}
            <div className="mt-4">
              <ShareStatusButton userId={user.id} highlight={highPriorityAlerts.length > 0} />
            </div>

            <div className="mt-6">
              <MultiMetricTimeline
                acwrData={acwrData}
                weightRecords={weightRecords}
                sleepRecords={timelineSleepRecords}
                motivationRecords={motivationRecords}
              />
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
        ) : activeTab === 'nutrition' ? (
          canUseNutrition ? (
            <AthleteNutritionDashboardView
              user={user}
              date={today}
              nutritionLogs={nutritionLogsToday}
              nutritionTotals={nutritionTotalsToday}
              nutritionLoading={nutritionLoading}
              nutritionError={nutritionError}
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
                      <button onClick={() => setActiveTab('weight')} className="text-sm text-green-600 dark:text-green-400 hover:underline">
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
                        {latestACWR.acwr}
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
                    <ACWRChart data={acwrData} daysWithData={daysWithData} isDarkMode={isDarkMode} />
                  )}
                </div>
              </div>
            </div>

            {/* Training Records Section */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 sm:p-6 mt-6 transition-colors">
              <TrainingRecordsList
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
                        {latestACWR.acwr}
                      </p>
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">{getRiskLabel(latestACWR.riskLevel ?? 'unknown')}</p>
                    </div>
                    <button onClick={() => setActiveTab('overview')} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
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
                  <InBodyLatestCard latest={latestInbody} loading={inbodyLoading} error={inbodyError} />
                  <InBodyCharts records={inbodyRecords} gender={normalizedGenderBinary} />
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
                  <WeightChart data={weightRecords} />
                )}
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 sm:p-6 transition-colors">
                <WeightRecordsList records={weightRecords} onUpdate={updateWeightRecord} onDelete={deleteWeightRecord} loading={weightLoading} />
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
                <WeightACWRChart acwrData={acwrData} weightData={weightRecords} />
              )}
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 sm:p-6 transition-colors">
              <InsightCard acwrData={acwrData} weightData={weightRecords} />
            </div>
          </div>
        ) : activeTab === 'performance' ? (
          /* Performance Tab */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
            {/* Left Column - Performance Form */}
            <div className="lg:col-span-1 space-y-6">
              {/* Personal Bests Summary */}
              {personalBests.length > 0 && (
                <div className="bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-xl shadow-sm p-4 border-2 border-yellow-300 dark:border-yellow-700">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                    <Zap className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mr-2" />
                    パーソナルベスト
                  </h3>
                  <div className="space-y-2">
                    {personalBests.slice(0, 3).map((pb) => (
                      <div key={pb.test_type_id} className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-2">
                        <p className="text-xs text-gray-600 dark:text-gray-400">{pb.test_display_name}</p>
                        <p className="text-lg font-bold text-yellow-700 dark:text-yellow-300">
                          {pb.value.toFixed(pb.test_name.includes('rsi') ? 2 : 1)}{' '}
                          {performanceTestTypes.find((t) => t.id === pb.test_type_id)?.unit}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Category Selection */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden transition-colors">
                <div className="grid grid-cols-5 border-b border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => setPerformanceCategory('jump')}
                    className={`py-3 px-2 text-xs sm:text-sm font-medium transition-colors ${
                      performanceCategory === 'jump'
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-b-2 border-blue-500'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    ジャンプ
                  </button>
                  <button
                    onClick={() => setPerformanceCategory('sprint')}
                    className={`py-3 px-2 text-xs sm:text-sm font-medium transition-colors ${
                      performanceCategory === 'sprint'
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-b-2 border-blue-500'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    スプリント
                  </button>
                  <button
                    onClick={() => setPerformanceCategory('agility')}
                    className={`py-3 px-2 text-xs sm:text-sm font-medium transition-colors ${
                      performanceCategory === 'agility'
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-b-2 border-blue-500'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    アジリティ
                  </button>
                  <button
                    onClick={() => setPerformanceCategory('endurance')}
                    className={`py-3 px-2 text-xs sm:text-sm font-medium transition-colors ${
                      performanceCategory === 'endurance'
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-b-2 border-blue-500'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    持久力
                  </button>
                  <button
                    onClick={() => setPerformanceCategory('strength')}
                    className={`py-3 px-2 text-xs sm:text-sm font-medium transition-colors ${
                      performanceCategory === 'strength'
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-b-2 border-blue-500'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    筋力
                  </button>
                </div>
              </div>

              {/* Performance Form */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 sm:p-6 transition-colors">
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">{getCategoryDisplayName(performanceCategory)}</h2>
                  <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-500" />
                </div>
                <PerformanceRecordForm
                  userId={user.id}
                  userRole={user.role}
                  testTypes={performanceTestTypes}
                  onSubmit={handlePerformanceRecordSubmit}
                  onCheckExisting={checkExistingRecord}
                  onUpdate={handlePerformanceUpdate}
                  loading={performanceLoading}
                  lastRecords={lastPerformanceRecords}
                  personalBests={personalBestsMap}
                />
              </div>
            </div>

            {/* Right Column - Overview and Records */}
            <div className="lg:col-span-2 space-y-6">
              <PerformanceOverview
                testTypes={performanceTestTypes}
                records={performanceRecords}
                personalBests={personalBests}
                getRecordsByTestType={getRecordsByTestType}
                getPersonalBest={getPersonalBest}
              />

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 sm:p-6 transition-colors">
                <PerformanceRecordsList records={performanceRecords} personalBests={personalBests} loading={performanceLoading} />
              </div>
            </div>
          </div>
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
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                  </div>
                ) : (
                  <SleepChart data={sleepRecords} />
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
                  <MotivationChart data={motivationRecords} />
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
          normalizedGenderBinary === 'female' ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <MenstrualCycleForm userId={user.id} />
                <BasalBodyTemperatureForm userId={user.id} />
              </div>

              <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">周期の表示形式</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCycleViewMode('calendar')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      cycleViewMode === 'calendar'
                        ? 'bg-pink-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    カレンダー
                  </button>
                  <button
                    onClick={() => setCycleViewMode('chart')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      cycleViewMode === 'chart'
                        ? 'bg-pink-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    グラフ
                  </button>
                </div>
              </div>

              {cycleViewMode === 'calendar' ? <MenstrualCycleCalendar userId={user.id} /> : <MenstrualCycleChart userId={user.id} days={90} />}

              <CyclePerformanceCorrelation userId={user.id} />
            </div>
          ) : (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-6 text-center">
              <Droplets className="w-12 h-12 text-yellow-600 dark:text-yellow-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">この機能は女性ユーザー専用です</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                プロフィール設定で性別を「女性」に設定すると、月経周期トラッキング機能が利用できます。
              </p>
            </div>
          )
        ) : activeTab === 'gamification' ? (
          <Suspense
            fallback={
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            }
          >
            <GamificationView userId={user.id} userTeamId={user.team_id} />
          </Suspense>
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

      {/* Personal Best Celebration */}
      {celebrationData && (
        <PersonalBestCelebration
          testName={celebrationData.testName}
          value={celebrationData.value}
          unit={celebrationData.unit}
          previousBest={celebrationData.previousBest}
          onClose={() => setCelebrationData(null)}
        />
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

      {showUnifiedCheckIn && (
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

      {activeTab === 'unified' && (
        <FloatingActionButton
          onClick={() => {
            setShowUnifiedCheckIn(true);
          }}
        />
      )}
    </div>
  );
}