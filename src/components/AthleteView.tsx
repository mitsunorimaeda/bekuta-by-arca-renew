import { useState, useEffect, Suspense, lazy } from 'react';
import { getTodayJSTString } from '../lib/date';
import { toJSTDateString } from '../lib/date';
import { User } from '../lib/supabase';
import { Alert } from '../lib/alerts';
import { TrainingForm } from './TrainingForm';
import { ACWRChart } from './ACWRChart';
import { TrainingRecordsList } from './TrainingRecordsList';
import { AlertSummary } from './AlertSummary';
// Lazy load heavy components
const TrendAnalysisView = lazy(() => import('./TrendAnalysisView').then(m => ({ default: m.TrendAnalysisView })));
const ExportPanel = lazy(() => import('./ExportPanel').then(m => ({ default: m.ExportPanel })));
import { WeightForm } from './WeightForm';
import { WeightChart } from './WeightChart';
import { WeightRecordsList } from './WeightRecordsList';
import { WeightACWRChart } from './WeightACWRChart';
import { InsightCard } from './InsightCard';
import { BMIDisplay } from './BMIDisplay';
import { EmailNotificationSettings } from './EmailNotificationSettings';
import { ProfileEditForm } from './ProfileEditForm';
import { TutorialController } from './TutorialController';
import { PerformanceRecordForm } from './PerformanceRecordForm';
import { PerformanceRecordsList } from './PerformanceRecordsList';
import { PerformanceOverview } from './PerformanceOverview';
import { PersonalBestCelebration } from './PersonalBestCelebration';
import { useTrainingData } from '../hooks/useTrainingData';
import { useTrendAnalysis } from '../hooks/useTrendAnalysis';
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
import {
  Activity,
  TrendingUp,
  Calendar,
  AlertTriangle,
  BarChart3,
  Download,
  Scale,
  LineChart,
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
  MessageSquare,
  Shield,
  FileText,
  Building2,
  Droplets
} from 'lucide-react';
import { useDarkMode } from '../hooks/useDarkMode';
const GamificationView = lazy(() => import('./GamificationView').then(m => ({ default: m.GamificationView })));
const MessagingPanel = lazy(() => import('./MessagingPanel').then(m => ({ default: m.MessagingPanel })));
import { MenstrualCycleForm } from './MenstrualCycleForm';
import { BasalBodyTemperatureForm } from './BasalBodyTemperatureForm';
import { MenstrualCycleChart } from './MenstrualCycleChart';
import { MenstrualCycleCalendar } from './MenstrualCycleCalendar';
import { CyclePerformanceCorrelation } from './CyclePerformanceCorrelation';
import { supabase } from '../lib/supabase';

type AthleteViewProps = {
  user: any; // 実際の型があればそれでOK
  alerts: any[];
  onLogout: () => void;
  onHome: () => void; // ← これを追加
  onNavigateToPrivacy: () => void;
  onNavigateToTerms: () => void;
  onNavigateToCommercial: () => void;
  onNavigateToHelp: () => void;
};

export function AthleteView({ user, alerts, onLogout, onHome, onNavigateToPrivacy, onNavigateToTerms, onNavigateToCommercial, onNavigateToHelp }: AthleteViewProps) {
  console.log('[AthleteView] User object:', user);
  console.log('[AthleteView] User gender:', user.gender);

  const {
    records,
    loading,
    checkExistingRecord: checkExistingTrainingRecord,
    addTrainingRecord,
    updateTrainingRecord,
    deleteTrainingRecord,
    acwrData
  } = useTrainingData(user.id);


  const { trendAnalysis, loading: trendLoading, error: trendError, refreshAnalysis } = useTrendAnalysis(user.id, 'user');

  const {
    records: weightRecords,
    loading: weightLoading,
    checkExistingRecord: checkExistingWeightRecord,
    addWeightRecord,
    updateWeightRecord,
    deleteWeightRecord,
    getLatestWeight,
    getWeightChange
  } = useWeightData(user.id);

  const {
    records: sleepRecords,
    loading: sleepLoading,
    checkExistingRecord: checkExistingSleepRecord,
    addSleepRecord,
    updateSleepRecord,
    getAverageSleepHours,
    getAverageSleepQuality,
    getLatestSleep
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
    getLatestMotivation
  } = useMotivationData(user.id);

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
    getPersonalBest
  } = usePerformanceData(user.id, performanceCategory);

  const { isActive, shouldShowTutorial, startTutorial, completeTutorial, skipTutorial, currentStepIndex, setCurrentStepIndex } = useTutorialContext();
  const { isDarkMode } = useDarkMode();

  const [, setShowAlertPanel] = useState(false);
  const [showExportPanel, setShowExportPanel] = useState(false);
  const [showUnifiedCheckIn, setShowUnifiedCheckIn] = useState(false);
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [, setProfileRefreshKey] = useState(0);
  const [cycleViewMode, setCycleViewMode] = useState<'calendar' | 'chart'>('calendar');
  const [activeTab, setActiveTab] = useState<
    'unified' | 'overview' | 'trends' | 'weight' | 'insights' | 'performance' | 'conditioning' | 'cycle' | 'gamification' | 'settings' | 'messages'
  >('unified');

  const [celebrationData, setCelebrationData] = useState<{
    testName: string;
    value: number;
    unit: string;
    previousBest?: number;
  } | null>(null);

  useEffect(() => {
    if (shouldShowTutorial() && !loading) {
      startTutorial();
    }
  }, [shouldShowTutorial, startTutorial, loading]);

  const latestACWR = acwrData.length > 0 ? acwrData[acwrData.length - 1] : null;
  const latestMotivation = getLatestMotivation();
  const latestWeight = getLatestWeight();

  // ★ 最新 sleep record（必ず一番新しい日付を選ぶ）
  const lastSleepRecord =
    sleepRecords.length > 0
      ? sleepRecords.reduce(
          (latest, r) =>
            !latest || new Date(r.date) > new Date(latest.date) ? r : latest,
          null as (typeof sleepRecords)[number] | null
        )
      : null;

  // ★ 最新 motivation record（必ず一番新しい日付を選ぶ）
  const lastMotivationRecord =
    motivationRecords.length > 0
      ? motivationRecords.reduce(
          (latest, r) =>
            !latest || new Date(r.date) > new Date(latest.date) ? r : latest,
          null as (typeof motivationRecords)[number] | null
        )
      : null;

  // gender をコンポーネント用に正規化
  const normalizedGenderFull: 'female' | 'male' | 'other' | 'prefer_not_to_say' | null =
    user.gender === 'female' || user.gender === 'male' || user.gender === 'other' || user.gender === 'prefer_not_to_say'
      ? user.gender
      : null;

  const normalizedGenderBinary: 'female' | 'male' | null =
    user.gender === 'female' || user.gender === 'male' ? user.gender : null;

  // sleep_quality を number に統一（null の場合は 0 とみなす）
  const normalizedSleepRecords = sleepRecords.map(r => ({
    ...r,
    sleep_quality: r.sleep_quality ?? 0
  }));

  // ユーザー固有のアラート
  const userAlerts = alerts.filter(alert => alert.user_id === user.id);
  const highPriorityAlerts = userAlerts.filter(alert => alert.priority === 'high');

  // 今日の日付（JST）
  const today = getTodayJSTString();
  const todayWeight = weightRecords.find(r => r.date === today);
  

  // Get last records for quick record suggestions
  const lastTrainingRecord =
  records.length > 0
    ? records.reduce((latest, r) =>
        !latest || new Date(r.date) > new Date(latest.date) ? r : latest
      , null as (typeof records)[number] | null)
    : null;
    const lastWeightRecord =
    weightRecords.length > 0
      ? weightRecords.reduce((latest, r) =>
          !latest || new Date(r.date) > new Date(latest.date) ? r : latest
        , null as (typeof weightRecords)[number] | null)
      : null;

  // Calculate weekly average for smart input
  const getWeeklyAverage = () => {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const recentRecords = records.filter(r => new Date(r.date) >= oneWeekAgo);

    if (recentRecords.length === 0) return null;

    const totalRpe = recentRecords.reduce((sum, r) => sum + r.rpe, 0);
    const totalDuration = recentRecords.reduce((sum, r) => sum + r.duration_min, 0);
    const totalLoad = recentRecords.reduce((sum, r) => sum + (r.load ?? 0), 0);

    return {
      rpe: totalRpe / recentRecords.length,
      duration: totalDuration / recentRecords.length,
      load: totalLoad / recentRecords.length
    };
  };

  const weeklyAverage = getWeeklyAverage();

  // Calculate days with data and consecutive days for ACWR progress
  const getDaysWithData = () => {
    const uniqueDates = new Set(records.map(r => r.date));
    return uniqueDates.size;
  };

  const getConsecutiveDays = () => {
    if (records.length === 0) return 0;

    const sortedDates = [...new Set(records.map(r => r.date))].sort();
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);

    let consecutive = 0;
    let currentDate = new Date(todayDate);

    for (let i = 0; i < 365; i++) {
      const dateStr = toJSTDateString(currentDate);
      if (sortedDates.includes(dateStr)) {
        consecutive++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else {
        break;
      }
    }

    return consecutive;
  };

  const daysWithData = getDaysWithData();
  const consecutiveDays = getConsecutiveDays();

  const handlePerformanceRecordSubmit = async (recordData: any) => {
    const result = await addPerformanceRecord(recordData);

    if (result.isNewPersonalBest) {
      const testType = performanceTestTypes.find(t => t.id === recordData.test_type_id);
      const previousBest = getPersonalBest(recordData.test_type_id);

      if (testType) {
        setCelebrationData({
          testName: testType.display_name,
          value: recordData.values.primary_value,
          unit: testType.unit,
          previousBest: previousBest?.value
        });
      }
    }

    return result;
  };

  // Training 更新用のラッパー（Promise<void> に揃える）
  const handleTrainingUpdate = async (
    recordId: string,
    recordData: { rpe: number; duration_min: number; date?: string }
  ) => {
    await updateTrainingRecord(recordId, recordData);
  };

  const handleTrainingUpdateForList = async (
    recordId: string,
    recordData: { rpe: number; duration_min: number }
  ) => {
    await updateTrainingRecord(recordId, recordData);
  };

  // ✅ UnifiedDailyCheckIn 用：training submit（矢印/電波も保存）
  const handleTrainingSubmitForCheckIn = async (data: {
    rpe: number;
    duration_min: number;
    date: string;
    arrow_score?: number;
    signal_score?: number;
  }) => {
    await addTrainingRecord({
      rpe: data.rpe,
      duration_min: data.duration_min,
      date: data.date,
      arrow_score: data.arrow_score ?? null,
      signal_score: data.signal_score ?? null,
    } as any);
  };

  // ✅ UnifiedDailyCheckIn 用：training update（矢印/電波も更新）
  const handleTrainingUpdateForCheckIn = async (
    recordId: string,
    recordData: {
      rpe: number;
      duration_min: number;
      arrow_score?: number;
      signal_score?: number;
    }
  ) => {
    await updateTrainingRecord(recordId, {
      rpe: recordData.rpe,
      duration_min: recordData.duration_min,
      arrow_score: recordData.arrow_score ?? null,
      signal_score: recordData.signal_score ?? null,
    } as any);
  };

  // Performance 更新用ラッパー
  const handlePerformanceUpdate = async (
    recordId: string,
    updates: {
      date?: string;
      values?: Record<string, any>;
      notes?: string;
      is_official?: boolean;
      weather_conditions?: string;
    }
  ) => {
    await updatePerformanceRecord(recordId, updates);
  };

  const lastPerformanceRecords = new Map();
  const personalBestsMap = new Map();

  performanceTestTypes.forEach(testType => {
    const recs = getRecordsByTestType(testType.id);
    if (recs.length > 0) {
      lastPerformanceRecords.set(testType.id, recs[0]);
    }

    const pb = getPersonalBest(testType.id);
    if (pb) {
      personalBestsMap.set(testType.id, pb);
    }
  });

  const getCategoryDisplayName = (category: string) => {
    switch (category) {
      case 'jump': return 'ジャンプ測定';
      case 'endurance': return '全身持久力測定';
      case 'strength': return '筋力測定';
      case 'sprint': return 'スプリント測定';
      case 'agility': return 'アジリティ測定';
      default: return 'パフォーマンス測定';
    }
  };

  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <header className="bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-700 dark:to-blue-800 shadow-lg transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();

                console.log('[AthleteView] Bekuta logo tapped → go home');

                // UI状態を閉じる（任意だけど事故りにくい）
                setMenuOpen(false);
                setShowUnifiedCheckIn(false);
                setShowExportPanel(false);
                setActiveTab('unified');

                // 親側も呼ぶ（親が何かしてるなら活かす）
                try {
                  onHome?.();
                } catch (err) {
                  console.error('[AthleteView] onHome error:', err);
                }

                // ✅ Netlifyのホームへ確実に戻す
                if (window.location.pathname !== '/') {
                  window.location.assign('/');
                } else {
                  // すでに / なのに表示が変なら、リロードで復帰
                  window.location.reload();
                }
              }}
              className="flex items-baseline space-x-2 transition-colors active:opacity-70 cursor-pointer"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              ...
            </button>
            </div>
          {/* 右側はそのまま */}
            <div className="flex items-center space-x-3" data-tutorial="alert-badge">
              <button
                onClick={startTutorial}
                className="text-white/80 hover:text-white transition-colors"
                title="チュートリアルを再表示"
              >
                <HelpCircle className="w-4 h-4" />
              </button>

              {/* メッセージアイコン */}
              <button
                onClick={() => setActiveTab('messages')}
                className="relative text-white/80 hover:text-white transition-colors"
                title="メッセージ"
              >
                <MessageSquare className="w-4 h-4" />
              </button>

              {/* ハンバーガーメニュー */}
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="bg-white/20 hover:bg-white/30 text白 p-2 rounded-lg transition-colors"
                aria-label="メニュー"
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
            {user.name}さん · {activeTab === 'unified' ? 'すべての記録を一目で確認' :
             activeTab === 'overview' ? '今日の練習データを記録' :
             activeTab === 'trends' ? 'ACWR傾向を分析' :
             activeTab === 'weight' ? '体重の変化を管理' :
             activeTab === 'insights' ? 'データから新しい発見を' :
             activeTab === 'performance' ? 'パフォーマンスを測定' :
             activeTab === 'conditioning' ? 'コンディション管理' :
             activeTab === 'cycle' ? '月経周期とコンディションを記録' :
             activeTab === 'gamification' ? 'ストリーク、バッジ、目標を管理' :
             '設定とお知らせ'}
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
              <button
                onClick={() => { setActiveTab('unified'); setMenuOpen(false); }}
                className={`w-full flex items-center space-x-2 px-3 py-2.5 rounded-lg transition-colors ${
                  activeTab === 'unified'
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span className="text-sm font-medium">統合ビュー</span>
              </button>
              <button
                onClick={() => { setActiveTab('overview'); setMenuOpen(false); }}
                className={`w-full flex items-center space-x-2 px-3 py-2.5 rounded-lg transition-colors ${
                  activeTab === 'overview'
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <Activity className="w-4 h-4" />
                <span className="text-sm font-medium">練習記録</span>
              </button>
              <button
                onClick={() => { setActiveTab('trends'); setMenuOpen(false); }}
                className={`w-full flex items-center space-x-2 px-3 py-2.5 rounded-lg transition-colors ${
                  activeTab === 'trends'
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                <span className="text-sm font-medium">傾向分析</span>
              </button>
              <button
                onClick={() => { setActiveTab('weight'); setMenuOpen(false); }}
                className={`w-full flex items-center space-x-2 px-3 py-2.5 rounded-lg transition-colors ${
                  activeTab === 'weight'
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <Scale className="w-4 h-4" />
                <span className="text-sm font-medium">体重管理</span>
              </button>
              <button
                onClick={() => { setActiveTab('insights'); setMenuOpen(false); }}
                className={`w-full flex items-center space-x-2 px-3 py-2.5 rounded-lg transition-colors ${
                  activeTab === 'insights'
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <LineChart className="w-4 h-4" />
                <span className="text-sm font-medium">相関分析</span>
              </button>
              <button
                onClick={() => { setActiveTab('performance'); setMenuOpen(false); }}
                className={`w-full flex items-center space-x-2 px-3 py-2.5 rounded-lg transition-colors ${
                  activeTab === 'performance'
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <Zap className="w-4 h-4" />
                <span className="text-sm font-medium">パフォーマンス</span>
              </button>
              <button
                onClick={() => { setActiveTab('conditioning'); setMenuOpen(false); }}
                className={`w-full flex items-center space-x-2 px-3 py-2.5 rounded-lg transition-colors ${
                  activeTab === 'conditioning'
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <Heart className="w-4 h-4" />
                <span className="text-sm font-medium">コンディション</span>
              </button>
              {user.gender === 'female' && (
                <button
                  onClick={() => { setActiveTab('cycle'); setMenuOpen(false); }}
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
              <button
                onClick={() => { setActiveTab('gamification'); setMenuOpen(false); }}
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
              <div className="border-t border-gray-200 dark:border-gray-700 my-2"></div>
              <button
                onClick={() => { setShowExportPanel(true); setMenuOpen(false); }}
                className="w-full flex items-center space-x-2 px-3 py-2.5 rounded-lg transition-colors text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <Download className="w-4 h-4" />
                <span className="text-sm font-medium">エクスポート</span>
              </button>
              <button
                onClick={() => { setActiveTab('settings'); setMenuOpen(false); }}
                className={`w-full flex items-center space-x-2 px-3 py-2.5 rounded-lg transition-colors ${
                  activeTab === 'messages' ||
                  activeTab === 'settings'
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <Settings className="w-4 h-4" />
                <span className="text-sm font-medium">設定</span>
              </button>
              <button
                onClick={() => setActiveTab('messages')}
                className={`w-full flex items-center space-x-2 px-3 py-2.5 rounded-lg transition-colors ${
                  activeTab === 'messages'
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                <span className="text-sm font-medium">メッセージ</span>
              </button>

              {/* 法的情報セクション */}
              <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
              <div className="px-3 py-1.5">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">法的情報</p>
              </div>
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
              onQuickAdd={() => {
                console.log('[AthleteView] Quick add button clicked, opening UnifiedDailyCheckIn');
                setShowUnifiedCheckIn(true);
              }}
            />

            <div className="mt-6">
              <DailyReflectionCard userId={user.id} />
            </div>

            <div className="mt-6">
              <MultiMetricTimeline
                acwrData={acwrData}
                weightRecords={weightRecords}
                sleepRecords={normalizedSleepRecords.map(r => ({
                  sleep_hours: r.sleep_hours,
                  sleep_quality: r.sleep_quality,
                  date: r.date
                }))}
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
        ) : activeTab === 'overview' ? (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
              {/* Left Column - Training Form and Alerts */}
              <div className="lg:col-span-1 space-y-6">
                {/* Alert Summary */}
                {userAlerts.length > 0 && (
                  <AlertSummary
                    alerts={userAlerts}
                    onViewAll={() => setShowAlertPanel(true)}
                  />
                )}

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
                        <p className="text-2xl font-bold text-green-700 dark:text-green-300">{Number(todayWeight.weight_kg).toFixed(1)} kg</p>
                      </div>
                      <button
                        onClick={() => setActiveTab('weight')}
                        className="text-sm text-green-600 dark:text-green-400 hover:underline"
                      >
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

                  <TrainingForm
                    userId={user.id}
                    onSubmit={addTrainingRecord}
                    onCheckExisting={checkExistingTrainingRecord}
                    onUpdate={handleTrainingUpdate}
                    loading={loading}
                    lastRecord={lastTrainingRecord}
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
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        {getRiskLabel(latestACWR.riskLevel)}
                      </div>
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

            {/* Training Records Section - Full Width */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 sm:p-6 mt-6 transition-colors">
              <TrainingRecordsList
                records={records}
                onUpdate={handleTrainingUpdateForList}
                onDelete={deleteTrainingRecord}
                loading={loading}
                allowEdit={true}
                allowDelete={true}
                allowDateEdit={false} // 日付編集は慎重に検討
                showLimited={true}
                limitCount={10}
              />
            </div>
            
          </>
        ) : activeTab === 'trends' ? (
          /* Trend Analysis Tab */
          <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>}>
            <TrendAnalysisView
              trendAnalysis={trendAnalysis}
              loading={trendLoading}
              error={trendError}
              onRefresh={refreshAnalysis}
            />
          </Suspense>
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
                      <p className="text-2xl font-bold" style={{ color: getRiskColor(latestACWR.riskLevel) }}>{latestACWR.acwr}</p>
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">{getRiskLabel(latestACWR.riskLevel)}</p>
                    </div>
                    <button
                      onClick={() => setActiveTab('overview')}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    >
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
                        ) : '-'}
                      </p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 transition-colors">
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">記録数</p>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">{weightRecords.length}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* BMI Display - Show only if height is set */}
              {user.height_cm && latestWeight && (
                <BMIDisplay
                  weightKg={latestWeight}
                  heightCm={user.height_cm}
                  dateOfBirth={user.date_of_birth}
                  gender={normalizedGenderFull}
                />
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
                  lastRecord={lastWeightRecord}   // ★ ここを追加
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

              {/* Weight Records List */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 sm:p-6 transition-colors">
                <WeightRecordsList
                  records={weightRecords}
                  onUpdate={updateWeightRecord}
                  onDelete={deleteWeightRecord}
                  loading={weightLoading}
                />
              </div>
            </div>
          </div>
        ) : activeTab === 'insights' ? (
          /* Correlation Analysis Tab */
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 sm:p-6 transition-colors">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-4 sm:mb-6">
                体重とACWRの相関グラフ
              </h2>
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
                          {pb.value.toFixed(pb.test_name.includes('rsi') ? 2 : 1)} {performanceTestTypes.find(t => t.id === pb.test_type_id)?.unit}
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
              {/* Performance Overview with Interactive Charts */}
              <PerformanceOverview
                testTypes={performanceTestTypes}
                records={performanceRecords}
                personalBests={personalBests}
                getRecordsByTestType={getRecordsByTestType}
                getPersonalBest={getPersonalBest}
              />

              {/* Performance Records List */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 sm:p-6 transition-colors">
                <PerformanceRecordsList
                  records={performanceRecords}
                  personalBests={personalBests}
                  loading={performanceLoading}
                />
              </div>
            </div>
          </div>
        ) : activeTab === 'conditioning' ? (
          /* Conditioning Tab */
          <div className="space-y-6">
            {/* Conditioning Summary Card */}
            <ConditioningSummaryCard
              latestACWR={latestACWR}
              sleepHours={getLatestSleep()?.sleep_hours ? Number(getLatestSleep()!.sleep_hours) : null}
              sleepQuality={getLatestSleep()?.sleep_quality ?? null}
              motivationLevel={getLatestMotivation()?.motivation_level ?? null}
              energyLevel={getLatestMotivation()?.energy_level ?? null}
              stressLevel={getLatestMotivation()?.stress_level ?? null}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                    lastRecord={lastSleepRecord}
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

                {/* Sleep Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 transition-colors">
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">7日平均睡眠時間</p>
                    <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                      {getAverageSleepHours(7)?.toFixed(1) || '-'}h
                    </p>
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
                    loading={motivationLoading}
                    lastRecord={
                      latestMotivation
                        ? {
                            date: latestMotivation.date,
                            motivation_level: latestMotivation.motivation_level,
                            energy_level: latestMotivation.energy_level,
                            stress_level: latestMotivation.stress_level,
                          }
                        : undefined
                    }
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

                {/* Motivation Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 transition-colors">
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">平均意欲</p>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {getAverageMotivation(7)?.toFixed(1) || '-'}/10
                    </p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 transition-colors">
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">平均体力</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {getAverageEnergy(7)?.toFixed(1) || '-'}/10
                    </p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 transition-colors">
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">平均ストレス</p>
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                      {getAverageStress(7)?.toFixed(1) || '-'}/10
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === 'cycle' ? (
          user.gender === 'female' ? (
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

              {cycleViewMode === 'calendar' ? (
                <MenstrualCycleCalendar userId={user.id} />
              ) : (
                <MenstrualCycleChart userId={user.id} days={90} />
              )}

              <CyclePerformanceCorrelation userId={user.id} />
            </div>
          ) : (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-6 text-center">
              <Droplets className="w-12 h-12 text-yellow-600 dark:text-yellow-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                この機能は女性ユーザー専用です
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                プロフィール設定で性別を「女性」に設定すると、月経周期トラッキング機能が利用できます。
              </p>
            </div>
          )
        ) : activeTab === 'gamification' ? (
          <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>}>
            <GamificationView userId={user.id} userTeamId={user.team_id} />
          </Suspense>
        ) : activeTab === 'messages' ? (
          <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>}>
            <MessagingPanel
              userId={user.id}
              userName={user.name}
              onClose={() => setActiveTab('unified')}
            />
          </Suspense>
        ) : activeTab === 'settings' ? (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 transition-colors">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">プロフィール設定</h2>
                <button
                  onClick={() => setShowProfileEdit(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  編集
                </button>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">名前</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">{user.name}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">メールアドレス</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">{user.email}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">性別</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                      {user.gender === 'male' ? '男性' :
                       user.gender === 'female' ? '女性' :
                       user.gender === 'other' ? 'その他' :
                       user.gender === 'prefer_not_to_say' ? '回答しない' :
                       '未設定'}
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">身長</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                      {user.height_cm ? `${user.height_cm} cm` : '未設定'}
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">生年月日</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                      {user.date_of_birth ? new Date(user.date_of_birth).toLocaleDateString('ja-JP') : '未設定'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 transition-colors">
              <EmailNotificationSettings userId={user.id} userEmail={user.email} />
            </div>
          </div>
        ) : null}
      </main>

      {/* Export Panel */}
      {showExportPanel && (
        <Suspense fallback={<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div></div>}>
          <ExportPanel
            user={user}
            trainingRecords={records}
            acwrData={acwrData}
            trendAnalysis={trendAnalysis || undefined}
            onClose={() => setShowExportPanel(false)}
          />
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
          onUpdate={() => {
            setProfileRefreshKey(prev => prev + 1);
            window.location.reload();
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
          onTrainingSubmit={handleTrainingSubmitForCheckIn}   // ← ここ
          onTrainingCheckExisting={checkExistingTrainingRecord}
          onTrainingUpdate={handleTrainingUpdateForCheckIn}   // ← ここ
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
          lastTrainingRecord={lastTrainingRecord}
          lastWeightRecord={lastWeightRecord}
          lastSleepRecord={lastSleepRecord}
          lastMotivationRecord={lastMotivationRecord}
        />
      )}

      {activeTab === 'unified' && (
        <FloatingActionButton onClick={() => {
          console.log('[AthleteView] Floating action button clicked, opening UnifiedDailyCheckIn');
          setShowUnifiedCheckIn(true);
        }} />
      )}
    </div>
  );
}

function getRiskColor(riskLevel: string): string {
  switch (riskLevel) {
    case 'high': return '#EF4444';
    case 'caution': return '#F59E0B';
    case 'good': return '#10B981';
    case 'low': return '#3B82F6';
    default: return '#6B7280';
  }
}

function getRiskLabel(riskLevel: string): string {
  switch (riskLevel) {
    case 'high': return '高リスク';
    case 'caution': return '注意';
    case 'good': return '良好';
    case 'low': return '低負荷';
    default: return '不明';
  }
}