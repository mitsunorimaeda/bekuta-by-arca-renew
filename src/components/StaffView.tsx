import React, { useState, useEffect, Suspense, lazy, useMemo } from 'react';
import { User, Team, supabase } from '../lib/supabase';
import { Alert } from '../lib/alerts';
import { AthleteList } from './AthleteList';
import { AthleteDetailModal } from './AthleteDetailModal';
import { TeamACWRChart } from './TeamACWRChart';
const TrendAnalysisView = lazy(() =>
  import('./TrendAnalysisView').then((m) => ({ default: m.TrendAnalysisView }))
);
import { AlertPanel } from './AlertPanel';
const TeamExportPanel = lazy(() =>
  import('./TeamExportPanel').then((m) => ({ default: m.TeamExportPanel }))
);
const ReportView = lazy(() =>
  import('./ReportView').then((m) => ({ default: m.ReportView }))
);
import { TutorialController } from './TutorialController';
import { useTeamACWR } from '../hooks/useTeamACWR';
import { useTrendAnalysis } from '../hooks/useTrendAnalysis';
import { useTutorialContext } from '../contexts/TutorialContext';
import { getTutorialSteps } from '../lib/tutorialContent';
import {
  Users,
  BarChart3,
  TrendingUp,
  AlertTriangle,
  Activity,
  Download,
  HelpCircle,
  UserCog,
  UsersRound,
  MessageSquare,
  FileText,
  Menu,
  X,
  Shield,
  Building2,
  PieChart,
  Lock,
  Unlock,
  CheckCircle2,
} from 'lucide-react';
import { TeamInjuryRiskHeatmap } from './TeamInjuryRiskHeatmap';
import { TeamPerformanceComparison } from './TeamPerformanceComparison';
import { TeamTrendAnalysis } from './TeamTrendAnalysis';
const TeamAccessRequestManagement = lazy(() =>
  import('./TeamAccessRequestManagement').then((m) => ({
    default: m.TeamAccessRequestManagement,
  }))
);
const AthleteTransferManagement = lazy(() =>
  import('./AthleteTransferManagement').then((m) => ({
    default: m.AthleteTransferManagement,
  }))
);
const MessagingPanel = lazy(() =>
  import('./MessagingPanel').then((m) => ({ default: m.MessagingPanel }))
);
import { useOrganizations } from '../hooks/useOrganizations';

interface StaffViewProps {
  user: User;
  alerts: Alert[];
  onNavigateToPrivacy?: () => void;
  onNavigateToTerms?: () => void;
  onNavigateToCommercial?: () => void;
  onNavigateToHelp?: () => void;
}

// 既存の activity view 取得用（維持）
type StaffAthleteWithActivity = User & {
  training_days_28d: number | null;
  training_sessions_28d: number | null;
  last_training_date: string | null;
};

type CoachWeekAthleteCard = {
  team_id: string;
  athlete_user_id: string;
  athlete_name: string;

  week_duration_min: number;
  week_rpe_avg: number | null;
  week_load_sum: number;

  sleep_hours_avg: number | null;
  sleep_quality_avg: number | null;

  motivation_avg: number | null;
  energy_avg: number | null;
  stress_avg: number | null;

  wellness_shared: boolean;

  action_total: number;
  action_done: number;
  action_done_rate: number;

  is_sharing_active: boolean;
  allow_condition: boolean;
  allow_training: boolean;
  allow_body: boolean;
  allow_reflection: boolean;
  allow_free_note: boolean;
};

type TeamCauseTagRow = {
  team_id: string;
  tag: string;
  cnt: number;
};

const NO_DATA_DAYS_THRESHOLD = 14;

const toISODate = (d: Date) => d.toISOString().slice(0, 10);

const getThisWeekRange = () => {
  const now = new Date();
  const day = now.getDay(); // 0 Sun ... 6 Sat
  const diffToMon = (day + 6) % 7; // Mon=0
  const mon = new Date(now);
  mon.setDate(now.getDate() - diffToMon);
  mon.setHours(0, 0, 0, 0);

  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);

  return { start: toISODate(mon), end: toISODate(sun) };
};

export function StaffView({
  user,
  alerts,
  onNavigateToPrivacy,
  onNavigateToTerms,
  onNavigateToCommercial,
  onNavigateToHelp,
}: StaffViewProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);

  // 選手一覧/途切れカード用（既存の view を使う）
  const [athletes, setAthletes] = useState<StaffAthleteWithActivity[]>([]);
  const [loading, setLoading] = useState(true);

  // 週次サマリー（RPC）
  const [weekRange, setWeekRange] = useState(() => getThisWeekRange());
  const [weekCards, setWeekCards] = useState<CoachWeekAthleteCard[]>([]);
  const [weekCardsLoading, setWeekCardsLoading] = useState(false);
  const [teamCauseTags, setTeamCauseTags] = useState<TeamCauseTagRow[]>([]);
  const [weekLoading, setWeekLoading] = useState(false);

  // 選手詳細（既存モーダルは User 前提なので User を保持）
  const [selectedAthlete, setSelectedAthlete] = useState<User | null>(null);

  const [activeTab, setActiveTab] = useState<
    | 'athletes'
    | 'team-average'
    | 'trends'
    | 'team-analytics'
    | 'reports'
    | 'team-access'
    | 'transfers'
    | 'messages'
  >('athletes');

  const [showAlertPanel, setShowAlertPanel] = useState(false);
  const [showExportPanel, setShowExportPanel] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [alertDismissed, setAlertDismissed] = useState(false);

  // 🔔 練習記録なしカード用（今日だけ抑制）
  const todayKey = new Date().toISOString().slice(0, 10);
  const [noDataDismissedToday, setNoDataDismissedToday] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      const key = `noDataDismissed-${user.id}-${todayKey}`;
      return localStorage.getItem(key) === '1';
    } catch {
      return false;
    }
  });

  const {
    isActive,
    shouldShowTutorial,
    startTutorial,
    completeTutorial,
    skipTutorial,
    currentStepIndex,
    setCurrentStepIndex,
  } = useTutorialContext();

  const { organizations } = useOrganizations(user.id);
  const currentOrganizationId =
    selectedTeam?.organization_id || (organizations.length > 0 ? organizations[0].id : '');

  useEffect(() => {
    if (shouldShowTutorial() && !loading) {
      startTutorial();
    }
  }, [shouldShowTutorial, startTutorial, loading]);

  const { teamACWRData, athleteACWRMap, loading: teamACWRLoading } = useTeamACWR(
    selectedTeam?.id || null
  );

  const {
    trendAnalysis,
    loading: trendLoading,
    error: trendError,
    refreshAnalysis,
  } = useTrendAnalysis(selectedTeam?.id || null, 'team');

  // チーム関連のアラート
  const teamAthleteIds = athletes.map((athlete) => athlete.id);
  const teamAlerts = alerts.filter((alert) => teamAthleteIds.includes(alert.user_id));
  const highPriorityTeamAlerts = teamAlerts.filter((alert) => alert.priority === 'high');

  useEffect(() => {
    fetchStaffTeams();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  useEffect(() => {
    if (!selectedTeam?.id) return;

    // ① 選手一覧（途切れ検出維持）
    fetchTeamAthletesWithActivity(selectedTeam.id);

    // ② 週次サマリー
    fetchWeekSummary(selectedTeam.id, weekRange.start, weekRange.end);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTeam?.id, weekRange.start, weekRange.end]);

  // 今日が変わったら localStorage を更新
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const key = `noDataDismissed-${user.id}-${todayKey}`;
    setNoDataDismissedToday(localStorage.getItem(key) === '1');
  }, [user.id, todayKey]);

  const fetchStaffTeams = async () => {
    try {
      const { data: staffTeamLinks, error } = await supabase
        .from('staff_team_links')
        .select(
          `
          team_id,
          teams (
            id,
            name,
            created_at,
            organization_id
          )
        `
        )
        .eq('staff_user_id', user.id);

      if (error) throw error;

      const teamsData = (staffTeamLinks || [])
        .map((link: any) => link.teams)
        .filter(Boolean) as Team[];

      setTeams(teamsData || []);

      if (teamsData && teamsData.length > 0) {
        setSelectedTeam(teamsData[0]);
      }
    } catch (error) {
      console.error('Error fetching staff teams:', error);
    } finally {
      setLoading(false);
    }
  };

  // 既存：途切れ検出＋選手一覧（User互換）を維持するため残す
  const fetchTeamAthletesWithActivity = async (teamId: string) => {
    try {
      const { data, error } = await supabase
        .from('staff_team_athletes_with_activity' as any)
        .select('*')
        .eq('team_id', teamId);

      if (error) throw error;

      setAthletes((data || []) as StaffAthleteWithActivity[]);
    } catch (error) {
      console.error('Error fetching team athletes:', error);
    }
  };

  const fetchWeekSummary = async (teamId: string, startDate: string, endDate: string) => {
    try {
      setWeekLoading(true);
      setWeekCardsLoading(true);

      const { data, error } = await supabase.rpc('get_coach_week_athlete_cards', {
        p_team_id: teamId,
        p_start_date: startDate,
        p_end_date: endDate,
      });

      if (error) throw error;

      setWeekCards((data || []) as CoachWeekAthleteCard[]);
    } catch (e) {
      console.error('Failed to fetch week summary', e);
      setWeekCards([]);
    } finally {
      setWeekCardsLoading(false);
      setWeekLoading(false);
    }
  };

  // アラート関連（今は中身ダミーでもOK）
  const markAsRead = async (alertId: string) => {
    console.log('Mark as read:', alertId);
  };
  const dismissAlert = async (alertId: string) => {
    console.log('Dismiss alert:', alertId);
  };
  const markAllAsRead = async () => {
    console.log('Mark all as read');
  };

  const latestTeamACWR =
    teamACWRData.length > 0 ? teamACWRData[teamACWRData.length - 1] : null;

  const handleDismissAlert = () => {
    setAlertDismissed(true);
    setTimeout(() => setAlertDismissed(false), 30 * 60 * 1000);
  };

  // 🧮 「練習記録が途切れている選手」
  const noDataAthletes = useMemo(() => {
    const now = new Date();
    const msPerDay = 1000 * 60 * 60 * 24;
    return athletes
      .filter((a) => a.last_training_date)
      .map((a) => {
        const last = new Date(a.last_training_date as string);
        const days = Math.floor((now.getTime() - last.getTime()) / msPerDay);
        return { athlete: a, daysSinceLast: days };
      })
      .filter((x) => x.daysSinceLast >= NO_DATA_DAYS_THRESHOLD)
      .sort((a, b) => b.daysSinceLast - a.daysSinceLast);
  }, [athletes]);

  const handleDismissNoDataForToday = () => {
    if (typeof window !== 'undefined') {
      const key = `noDataDismissed-${user.id}-${todayKey}`;
      localStorage.setItem(key, '1');
    }
    setNoDataDismissedToday(true);
  };

  // 週次：原因タグTOP3（回数）
  const topCauseTags = useMemo(() => {
    return [...teamCauseTags].sort((a, b) => b.cnt - a.cnt).slice(0, 3);
  }, [teamCauseTags]);

  // 週次：共有🔓の人数
  const sharingCount = useMemo(() => {
    return weekCards.filter((c) => c.is_sharing_active).length;
  }, [weekCards]);

  // 週次：行動目標 完了率（チーム平均っぽく）
  const teamActionDoneRate = useMemo(() => {
    const rows = weekCards.filter((c) => c.action_total > 0);
    if (rows.length === 0) return null;
    const avg = rows.reduce((sum, r) => sum + (r.action_done_rate || 0), 0) / rows.length;
    return Math.round(avg);
  }, [weekCards]);

  // 週切替
  const goPrevWeek = () => {
    const start = new Date(weekRange.start);
    const end = new Date(weekRange.end);
    start.setDate(start.getDate() - 7);
    end.setDate(end.getDate() - 7);
    setWeekRange({ start: toISODate(start), end: toISODate(end) });
  };
  const goThisWeek = () => setWeekRange(getThisWeekRange());

  // ✅ 選手クリック：共有🔓以外はモーダルを開かない
  const handleAthleteSelect = (athlete: User) => {
    const card = weekCards.find((c) => c.athlete_user_id === athlete.id);
    if (!card?.is_sharing_active) {
      window.alert('この選手は現在、詳細データの共有がOFFです（🔒）');
      return;
    }
    setSelectedAthlete(athlete);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Top Bar */}
          <div className="flex items-center justify-between py-3">
            <h1 className="text-lg sm:text-xl font-bold text-gray-900">コーチダッシュボード</h1>
            <div className="flex items-center space-x-1">
              {/* 🔔 高リスクアラートがある時だけベル表示 */}
              {highPriorityTeamAlerts.length > 0 && (
                <button
                  onClick={() => setShowAlertPanel(true)}
                  className="p-2 text-gray-600 hover:text-red-600 transition-colors relative"
                  title="アラート"
                >
                  <AlertTriangle className="w-5 h-5" />
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">
                    {highPriorityTeamAlerts.length}
                  </span>
                </button>
              )}

              <button
                onClick={startTutorial}
                className="p-2 text-gray-600 hover:text-green-600 transition-colors"
                title="チュートリアル"
              >
                <HelpCircle className="w-5 h-5" />
              </button>

              <button
                onClick={() => setActiveTab('messages')}
                className="p-2 text-gray-600 hover:text-green-600 transition-colors"
                title="メッセージ"
              >
                <MessageSquare className="w-5 h-5" />
              </button>

              {/* Hamburger */}
              <div className="relative">
                <button
                  onClick={() => setShowMobileMenu(!showMobileMenu)}
                  className="p-2 text-gray-600 hover:text-green-600 transition-colors"
                  title="メニュー"
                >
                  {showMobileMenu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>

                {showMobileMenu && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50 max-h-[calc(100vh-6rem)] overflow-y-auto">
                    {selectedTeam && (
                      <button
                        onClick={() => {
                          setShowExportPanel(true);
                          setShowMobileMenu(false);
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                      >
                        <Download className="w-4 h-4" />
                        <span>チームエクスポート</span>
                      </button>
                    )}

                    {/* 法的情報 */}
                    <div className="border-t border-gray-200 my-1"></div>
                    <div className="px-3 py-1.5">
                      <p className="text-xs font-semibold text-gray-500">法的情報</p>
                    </div>
                    {onNavigateToHelp && (
                      <button
                        onClick={() => {
                          setShowMobileMenu(false);
                          onNavigateToHelp();
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                      >
                        <HelpCircle className="w-4 h-4" />
                        <span>ヘルプ・マニュアル</span>
                      </button>
                    )}
                    {onNavigateToPrivacy && (
                      <button
                        onClick={() => {
                          setShowMobileMenu(false);
                          onNavigateToPrivacy();
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                      >
                        <Shield className="w-4 h-4" />
                        <span>プライバシーポリシー</span>
                      </button>
                    )}
                    {onNavigateToTerms && (
                      <button
                        onClick={() => {
                          setShowMobileMenu(false);
                          onNavigateToTerms();
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                      >
                        <FileText className="w-4 h-4" />
                        <span>利用規約</span>
                      </button>
                    )}
                    {onNavigateToCommercial && (
                      <button
                        onClick={() => {
                          setShowMobileMenu(false);
                          onNavigateToCommercial();
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                      >
                        <Building2 className="w-4 h-4" />
                        <span>特定商取引法に基づく表記</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Team Selector */}
          {teams.length > 0 && (
            <div className="pb-3 border-t border-gray-100">
              <div className="flex items-center gap-3 pt-3">
                <Users className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <select
                  value={selectedTeam?.id || ''}
                  onChange={(e) => {
                    const team = teams.find((t) => t.id === e.target.value);
                    if (team) setSelectedTeam(team);
                  }}
                  className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                >
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* 週切替 */}
              <div className="flex items-center justify-between gap-2 pt-3">
                <div className="text-xs sm:text-sm text-gray-600">
                  対象週：{weekRange.start} 〜 {weekRange.end}
                </div>
                <div className="flex gap-2">
                  <button
                    className="px-3 py-1.5 rounded-lg border text-xs sm:text-sm hover:bg-gray-50"
                    onClick={goPrevWeek}
                    disabled={weekLoading}
                  >
                    先週
                  </button>
                  <button
                    className="px-3 py-1.5 rounded-lg border text-xs sm:text-sm hover:bg-gray-50"
                    onClick={goThisWeek}
                    disabled={weekLoading}
                  >
                    今週
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        {teams.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">担当チームがありません</h3>
            <p className="text-gray-600">管理者にチームの割り当てを依頼してください。</p>
          </div>
        ) : (
          <div className="space-y-6 sm:space-y-8">
            {/* High Priority Alert Banner */}
            {highPriorityTeamAlerts.length > 0 && !alertDismissed && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <div className="flex items-center">
                  <AlertTriangle className="w-6 h-6 text-red-600 mr-3 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-red-900">高リスクアラート</h3>
                    <p className="text-sm text-red-700">
                      {highPriorityTeamAlerts.length}名の選手に注意が必要です
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setAlertDismissed(true);
                      setTimeout(() => setAlertDismissed(false), 30 * 60 * 1000);
                    }}
                    className="ml-3 p-1 text-red-400 hover:text-red-600 transition-colors flex-shrink-0"
                    title="30分間非表示"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}

            {/* 🆕 練習記録が途切れている選手カード */}
            {noDataAthletes.length > 0 && !noDataDismissedToday && (
              <div className="bg-white rounded-xl shadow-sm border border-amber-200 p-4 sm:p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-1">
                      練習記録が途切れている選手
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-600">
                      最終記録日から一定期間、記録がない選手の一覧です
                    </p>
                  </div>
                  <button
                    onClick={handleDismissNoDataForToday}
                    className="text-xs sm:text-sm text-blue-600 hover:text-blue-700 font-medium px-2 py-1 rounded-lg hover:bg-blue-50"
                  >
                    今日分は既読にする
                  </button>
                </div>

                <ul className="space-y-1 sm:space-y-1.5 text-sm sm:text-base">
                  {noDataAthletes.map(({ athlete, daysSinceLast }) => (
                    <li
                      key={athlete.id}
                      className="flex items-baseline justify-between border-t border-gray-100 pt-1.5 first:border-t-0 first:pt-0"
                    >
                      <div className="font-medium text-gray-900 truncate mr-2">
                        {athlete.name || athlete.email}
                      </div>
                      <div className="text-xs sm:text-sm text-gray-600 whitespace-nowrap">
                        最終日 {athlete.last_training_date || '-'}（{daysSinceLast}日間）
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* ✅ 週次サマリー（共有🔓 / 行動目標 / 原因タグTOP） */}
            {selectedTeam && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* 共有状況 */}
                <div className="bg-white rounded-xl shadow-sm border p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-gray-900">共有状況（今週）</div>
                    {weekCardsLoading ? (
                      <div className="text-xs text-gray-500">取得中…</div>
                    ) : (
                      <div className="flex items-center gap-1 text-xs text-gray-600">
                        <Unlock className="w-4 h-4" />
                        <span>
                          {sharingCount} / {athletes.length}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="mt-3 text-xs text-gray-600">
                    🔓 共有ONの選手だけ、詳細モーダルを開けます
                  </div>
                </div>

                {/* 行動目標 */}
                <div className="bg-white rounded-xl shadow-sm border p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-gray-900">行動目標の達成（今週）</div>
                    {teamActionDoneRate == null ? (
                      <div className="text-xs text-gray-500">データなし</div>
                    ) : (
                      <div className="flex items-center gap-1 text-xs text-gray-700">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{teamActionDoneRate}%</span>
                      </div>
                    )}
                  </div>
                  <div className="mt-3 text-xs text-gray-600">
                    next_action_items の完了率（行動目標がある選手のみで平均）
                  </div>
                </div>

                {/* 原因タグTOP */}
                <div className="bg-white rounded-xl shadow-sm border p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-gray-900">原因タグTOP（今週）</div>
                    {weekCardsLoading && <div className="text-xs text-gray-500">取得中…</div>}
                  </div>

                  <div className="mt-3">
                    {topCauseTags.length === 0 ? (
                      <div className="text-xs text-gray-500">まだ振り返りデータがありません</div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {topCauseTags.map((t) => (
                          <span
                            key={t.tag}
                            className="px-3 py-1 rounded-full bg-gray-100 text-xs text-gray-800"
                          >
                            {t.tag} <span className="text-gray-500">×{t.cnt}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Team Overview（既存） */}
            {selectedTeam && (
              <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <h2 className="text-lg sm:text-xl font-semibold text-gray-900 truncate">
                    <span className="hidden sm:inline">{selectedTeam.name} - </span>
                    <span className="sm:hidden">チーム</span>概要
                  </h2>
                  <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-gray-400 ml-2" />
                </div>

                {teamACWRLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
                  </div>
                ) : !latestTeamACWR ? (
                  <div className="py-6 text-center text-sm text-gray-500">
                    まだACWRを計算できる十分なトレーニングデータがありません。
                    <br />
                    （選手のRPEと練習時間を入力すると表示されます）
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 sm:gap-6">
                    <div className="bg-purple-50 rounded-lg p-4 sm:p-6 text-center">
                      <div className="text-xl sm:text-2xl font-bold text-purple-600 mb-1">
                        {latestTeamACWR.averageACWR}
                      </div>
                      <div className="text-xs sm:text-sm text-purple-700">チーム平均ACWR</div>
                    </div>

                    <div className="bg-blue-50 rounded-lg p-4 sm:p-6 text-center">
                      <div className="text-xl sm:text-2xl font-bold text-blue-600 mb-1">
                        {latestTeamACWR.athleteCount}
                      </div>
                      <div className="text-xs sm:text-sm text-blue-700">データ有効選手数</div>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-4 sm:p-6 text-center">
                      <div className="text-xl sm:text-2xl font-bold text-gray-600 mb-1">
                        {athletes.length}
                      </div>
                      <div className="text-xs sm:text-sm text-gray-700">総選手数</div>
                    </div>

                    <div className="bg-red-50 rounded-lg p-4 sm:p-6 text-center">
                      <div className="text-xl sm:text-2xl font-bold text-red-600 mb-1">
                        {teamAlerts.filter((alert) => alert.priority === 'high').length}
                      </div>
                      <div className="text-xs sm:text-sm text-red-700">高リスク選手</div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tabs */}
            {selectedTeam && (
              <div className="bg-white rounded-xl shadow-sm">
                <div className="border-b border-gray-200">
                  {/* Desktop tabs */}
                  <nav className="hidden sm:flex px-4 sm:px-6 overflow-x-auto">
                    <button
                      onClick={() => setActiveTab('athletes')}
                      className={`py-3 sm:py-4 px-3 border-b-2 font-medium text-sm whitespace-nowrap ${
                        activeTab === 'athletes'
                          ? 'border-green-500 text-green-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                      data-tutorial="athletes-tab"
                    >
                      <div className="flex items-center">
                        <Activity className="w-4 h-4 mr-2" />
                        選手一覧
                      </div>
                    </button>

                    <button
                      onClick={() => setActiveTab('team-average')}
                      className={`py-3 sm:py-4 px-3 border-b-2 font-medium text-sm ml-6 whitespace-nowrap ${
                        activeTab === 'team-average'
                          ? 'border-green-500 text-green-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                      data-tutorial="team-average-tab"
                    >
                      <div className="flex items-center">
                        <BarChart3 className="w-4 h-4 mr-2" />
                        チーム平均ACWR
                      </div>
                    </button>

                    <button
                      onClick={() => setActiveTab('trends')}
                      className={`py-3 sm:py-4 px-3 border-b-2 font-medium text-sm ml-6 whitespace-nowrap ${
                        activeTab === 'trends'
                          ? 'border-green-500 text-green-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                      data-tutorial="trends-tab"
                    >
                      <div className="flex items-center">
                        <TrendingUp className="w-4 h-4 mr-2" />
                        傾向分析
                      </div>
                    </button>

                    <button
                      onClick={() => setActiveTab('team-analytics')}
                      className={`py-3 sm:py-4 px-3 border-b-2 font-medium text-sm ml-6 whitespace-nowrap ${
                        activeTab === 'team-analytics'
                          ? 'border-green-500 text-green-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center">
                        <PieChart className="w-4 h-4 mr-2" />
                        チーム分析
                      </div>
                    </button>

                    <button
                      onClick={() => setActiveTab('reports')}
                      className={`py-3 sm:py-4 px-3 border-b-2 font-medium text-sm ml-6 whitespace-nowrap ${
                        activeTab === 'reports'
                          ? 'border-green-500 text-green-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center">
                        <FileText className="w-4 h-4 mr-2" />
                        レポート
                      </div>
                    </button>

                    <button
                      onClick={() => setActiveTab('team-access')}
                      className={`py-3 sm:py-4 px-3 border-b-2 font-medium text-sm ml-6 whitespace-nowrap ${
                        activeTab === 'team-access'
                          ? 'border-green-500 text-green-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center">
                        <UsersRound className="w-4 h-4 mr-2" />
                        チームアクセス
                      </div>
                    </button>

                    <button
                      onClick={() => setActiveTab('transfers')}
                      className={`py-3 sm:py-4 px-3 border-b-2 font-medium text-sm ml-6 whitespace-nowrap ${
                        activeTab === 'transfers'
                          ? 'border-green-500 text-green-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center">
                        <UserCog className="w-4 h-4 mr-2" />
                        選手移籍
                      </div>
                    </button>

                    <button
                      onClick={() => setActiveTab('messages')}
                      className={`py-3 sm:py-4 px-3 border-b-2 font-medium text-sm ml-6 whitespace-nowrap ${
                        activeTab === 'messages'
                          ? 'border-green-500 text-green-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center">
                        <MessageSquare className="w-4 h-4 mr-2" />
                        メッセージ
                      </div>
                    </button>
                  </nav>

                  {/* Mobile dropdown */}
                  <div className="sm:hidden px-4 py-3">
                    <select
                      value={activeTab}
                      onChange={(e) => setActiveTab(e.target.value as typeof activeTab)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    >
                      <option value="athletes">選手一覧</option>
                      <option value="team-average">チーム平均ACWR</option>
                      <option value="trends">傾向分析</option>
                      <option value="reports">レポート</option>
                      <option value="team-access">チームアクセス</option>
                      <option value="transfers">選手移籍</option>
                      <option value="messages">メッセージ</option>
                    </select>
                  </div>
                </div>

                <div className="p-4 sm:p-6">
                  {activeTab === 'athletes' ? (
                    <div>
                      <div className="flex items-center justify-between mb-4 sm:mb-6">
                        <h3 className="text-base sm:text-lg font-semibold text-gray-900">
                          選手一覧
                        </h3>
                        <div className="flex items-center space-x-4">
                          <span className="bg-gray-100 text-gray-700 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm">
                            {athletes.length}名
                          </span>
                          <span className="bg-emerald-100 text-emerald-700 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm flex items-center gap-1">
                            <Unlock className="w-4 h-4" />
                            共有ON {sharingCount}
                          </span>
                          {teamAlerts.length > 0 && (
                            <span className="bg-red-100 text-red-700 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm">
                              アラート {teamAlerts.length}件
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-xs text-gray-600 mb-3 flex items-center gap-2">
                        <Lock className="w-4 h-4" />
                        共有OFF（🔒）の選手は、詳細モーダルを開けません
                      </div>

                      <AthleteList
                        athletes={athletes}
                        onAthleteSelect={handleAthleteSelect}
                        athleteACWRMap={athleteACWRMap}
                      />
                    </div>
                  ) : activeTab === 'team-average' ? (
                    <div>
                      {teamACWRLoading ? (
                        <div className="flex items-center justify-center py-12">
                          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                        </div>
                      ) : (
                        <TeamACWRChart data={teamACWRData} teamName={selectedTeam.name} />
                      )}
                    </div>
                  ) : activeTab === 'trends' ? (
                    <Suspense
                      fallback={
                        <div className="flex items-center justify-center h-64">
                          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                        </div>
                      }
                    >
                      <TrendAnalysisView
                        trendAnalysis={trendAnalysis}
                        loading={trendLoading}
                        error={trendError}
                        onRefresh={refreshAnalysis}
                      />
                    </Suspense>
                  ) : activeTab === 'team-analytics' ? (
                    <div className="space-y-6">
                      <TeamInjuryRiskHeatmap teamId={selectedTeam.id} />
                      <TeamPerformanceComparison teamId={selectedTeam.id} />
                      <TeamTrendAnalysis teamId={selectedTeam.id} />
                    </div>
                  ) : activeTab === 'reports' ? (
                    <Suspense
                      fallback={
                        <div className="flex items-center justify-center h-64">
                          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                        </div>
                      }
                    >
                      <ReportView team={selectedTeam} />
                    </Suspense>
                  ) : activeTab === 'team-access' ? (
                    currentOrganizationId ? (
                      <Suspense
                        fallback={
                          <div className="flex items-center justify-center h-64">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                          </div>
                        }
                      >
                        <TeamAccessRequestManagement
                          userId={user.id}
                          organizationId={currentOrganizationId}
                          isAdmin={false}
                        />
                      </Suspense>
                    ) : (
                      <div className="text-center py-12 text-gray-500">
                        組織に所属していないため、チームアクセスリクエストを利用できません。
                      </div>
                    )
                  ) : activeTab === 'transfers' ? (
                    currentOrganizationId ? (
                      <Suspense
                        fallback={
                          <div className="flex items-center justify-center h-64">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                          </div>
                        }
                      >
                        <AthleteTransferManagement
                          userId={user.id}
                          organizationId={currentOrganizationId}
                          isAdmin={false}
                        />
                      </Suspense>
                    ) : (
                      <div className="text-center py-12 text-gray-500">
                        組織に所属していないため、選手移籍機能を利用できません。
                      </div>
                    )
                  ) : activeTab === 'messages' ? (
                    <Suspense
                      fallback={
                        <div className="flex items-center justify-center h-64">
                          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                        </div>
                      }
                    >
                      <MessagingPanel
                        userId={user.id}
                        userName={user.name}
                        onClose={() => setActiveTab('athletes')}
                      />
                    </Suspense>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Athlete Detail Modal（共有ONのみ開く） */}
      {selectedAthlete && (
        <AthleteDetailModal athlete={selectedAthlete} onClose={() => setSelectedAthlete(null)} />
      )}

      {/* Alert Panel */}
      {showAlertPanel && (
        <AlertPanel
          alerts={teamAlerts}
          onMarkAsRead={markAsRead}
          onDismiss={dismissAlert}
          onMarkAllAsRead={markAllAsRead}
          onClose={() => setShowAlertPanel(false)}
          userRole={user.role}
        />
      )}

      {/* Team Export Panel */}
      {showExportPanel && selectedTeam && (
        <Suspense
          fallback={
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
            </div>
          }
        >
          <TeamExportPanel team={selectedTeam} onClose={() => setShowExportPanel(false)} />
        </Suspense>
      )}

      <TutorialController
        steps={getTutorialSteps('staff')}
        isActive={isActive}
        onComplete={completeTutorial}
        onSkip={skipTutorial}
        currentStepIndex={currentStepIndex}
        onStepChange={setCurrentStepIndex}
      />
    </div>
  );
}