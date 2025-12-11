import React, { useState, useEffect, Suspense, lazy } from 'react';
import { User, Team, supabase } from '../lib/supabase';
import { Alert } from '../lib/alerts';
import { CoachNoDataAlertCard } from './CoachNoDataAlertCard';
import { TeamSelector } from './TeamSelector';
import { AthleteList } from './AthleteList';
import { AthleteDetailModal } from './AthleteDetailModal';
import { TeamACWRChart } from './TeamACWRChart';
const TrendAnalysisView = lazy(() => import('./TrendAnalysisView').then(m => ({ default: m.TrendAnalysisView })));
import { AlertSummary } from './AlertSummary';
import { AlertPanel } from './AlertPanel';
const TeamExportPanel = lazy(() => import('./TeamExportPanel').then(m => ({ default: m.TeamExportPanel })));
const ReportView = lazy(() => import('./ReportView').then(m => ({ default: m.ReportView })));
import { TutorialController } from './TutorialController';
// 変更前
// import { useTeamACWR } from '../hooks/useTeamACWR';

// 変更後
import {
  useTeamACWR,
  AthleteACWRMap,
} from '../hooks/useTeamACWR';
import { useTrendAnalysis } from '../hooks/useTrendAnalysis';
import { useTutorialContext } from '../contexts/TutorialContext';
import { getTutorialSteps } from '../lib/tutorialContent';
import { Users, BarChart3, TrendingUp, AlertTriangle, Activity, Download, HelpCircle, UserCog, UsersRound, MessageSquare, FileText, Menu, X, Shield, Building2, PieChart } from 'lucide-react';
import { TeamInjuryRiskHeatmap } from './TeamInjuryRiskHeatmap';
import { TeamPerformanceComparison } from './TeamPerformanceComparison';
import { TeamTrendAnalysis } from './TeamTrendAnalysis';
const TeamAccessRequestManagement = lazy(() => import('./TeamAccessRequestManagement').then(m => ({ default: m.TeamAccessRequestManagement })));
const AthleteTransferManagement = lazy(() => import('./AthleteTransferManagement').then(m => ({ default: m.AthleteTransferManagement })));
const MessagingPanel = lazy(() => import('./MessagingPanel').then(m => ({ default: m.MessagingPanel })));
import { useOrganizations } from '../hooks/useOrganizations';

interface StaffViewProps {
  user: User;
  alerts: Alert[];
  onNavigateToPrivacy?: () => void;
  onNavigateToTerms?: () => void;
  onNavigateToCommercial?: () => void;
  onNavigateToHelp?: () => void;
}

  // 追加：ビューの行型（User に + α なイメージ）
  type StaffAthleteWithActivity = User & {
    training_days_28d: number | null;
    training_sessions_28d: number | null;
    last_training_date: string | null;
  };


export function StaffView({ user, alerts, onNavigateToPrivacy, onNavigateToTerms, onNavigateToCommercial, onNavigateToHelp }: StaffViewProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [selectedAthlete, setSelectedAthlete] = useState<User | null>(null);
  // 元：const [athletes, setAthletes] = useState<User[]>([]);
  const [athletes, setAthletes] = useState<StaffAthleteWithActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'athletes' | 'team-average' | 'trends' | 'team-analytics' | 'reports' | 'team-access' | 'transfers' | 'messages'>('athletes');
  const [showAlertPanel, setShowAlertPanel] = useState(false);
  const [showExportPanel, setShowExportPanel] = useState(false);
  const [showMessagingPanel, setShowMessagingPanel] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [alertDismissed, setAlertDismissed] = useState(false);
  const { isActive, shouldShowTutorial, startTutorial, completeTutorial, skipTutorial, currentStepIndex, setCurrentStepIndex } = useTutorialContext();
  const { organizations } = useOrganizations(user.id);
  const currentOrganizationId = selectedTeam?.organization_id || (organizations.length > 0 ? organizations[0].id : '');

  useEffect(() => {
    if (shouldShowTutorial() && !loading) {
      startTutorial();
    }
  }, [shouldShowTutorial, startTutorial, loading]);

  const { teamACWRData, athleteACWRMap, loading: teamACWRLoading } =
  useTeamACWR(selectedTeam?.id || null);
  const { trendAnalysis, loading: trendLoading, error: trendError, refreshAnalysis } = useTrendAnalysis(
    selectedTeam?.id || null, 
    'team'
  );

  // チーム関連のアラート
  const teamAthleteIds = athletes.map(athlete => athlete.id);
  const teamAlerts = alerts.filter(alert => teamAthleteIds.includes(alert.user_id));
  const highPriorityTeamAlerts = teamAlerts.filter(alert => alert.priority === 'high');

  useEffect(() => {
    fetchStaffTeams();
  }, [user.id]);

  useEffect(() => {
    if (selectedTeam) {
      fetchTeamAthletes(selectedTeam.id);
    }
  }, [selectedTeam]);

  const fetchStaffTeams = async () => {
    try {
      const { data: staffTeamLinks, error } = await supabase
        .from('staff_team_links')
        .select(`
          team_id,
          teams (
            id,
            name,
            created_at
          )
        `)
        .eq('staff_user_id', user.id);

      if (error) throw error;

      const teamsData = staffTeamLinks?.map(link => link.teams).filter(Boolean) as Team[];
      setTeams(teamsData || []);
      
      // Select first team by default
      if (teamsData && teamsData.length > 0) {
        setSelectedTeam(teamsData[0]);
      }
    } catch (error) {
      console.error('Error fetching staff teams:', error);
    } finally {
      setLoading(false);
    }
  };



const fetchTeamAthletes = async (teamId: string) => {
  try {
    const { data, error } = await supabase
      // ★ ここを users → view 名に変更 ＋ as any で型チェック回避
      .from('staff_team_athletes_with_activity' as any)
      .select('*')
      .eq('team_id', teamId);

    if (error) throw error;

    setAthletes((data || []) as StaffAthleteWithActivity[]);
  } catch (error) {
    console.error('Error fetching team athletes:', error);
  }
};

  // アラート関連のヘルパー関数
  const markAsRead = async (alertId: string) => {
    // アラートを既読にする処理（実装は useAlerts フックに依存）
    console.log('Mark as read:', alertId);
  };

  const dismissAlert = async (alertId: string) => {
    // アラートを非表示にする処理（実装は useAlerts フックに依存）
    console.log('Dismiss alert:', alertId);
  };

  const markAllAsRead = async () => {
    // 全てのアラートを既読にする処理（実装は useAlerts フックに依存）
    console.log('Mark all as read');
  };

  const latestTeamACWR = teamACWRData.length > 0 ? teamACWRData[teamACWRData.length - 1] : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const handleDismissAlert = () => {
    setAlertDismissed(true);
    setTimeout(() => setAlertDismissed(false), 30 * 60 * 1000); // 30分後に再表示
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Top Bar */}
          <div className="flex items-center justify-between py-3">
            <h1 className="text-lg sm:text-xl font-bold text-gray-900">コーチダッシュボード</h1>
            <div className="flex items-center space-x-1">
              {highPriorityTeamAlerts.length > 0 && (
                <button
                  onClick={() => setShowAlertPanel(true)}
                  className="p-2 text-gray-600 hover:text-red-600 transition-colors relative"
                  title="アラート"
                >
                  <AlertTriangle className="w-5 h-5" />
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
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

              {/* ハンバーガーメニュー */}
              <div className="relative">
                <button
                  onClick={() => setShowMobileMenu(!showMobileMenu)}
                  className="p-2 text-gray-600 hover:text-green-600 transition-colors"
                  title="メニュー"
                >
                  {showMobileMenu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>

                {showMobileMenu && (
                  <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50 max-h-[calc(100vh-6rem)] overflow-y-auto">
                    {selectedTeam && (
                      <button
                        onClick={() => {
                          setShowExportPanel(true);
                          setShowMobileMenu(false);
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2"
                      >
                        <Download className="w-4 h-4" />
                        <span>チームエクスポート</span>
                      </button>
                    )}

                    {/* 法的情報セクション */}
                    <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
                    <div className="px-3 py-1.5">
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">法的情報</p>
                    </div>
                    {onNavigateToHelp && (
                      <button
                        onClick={() => {
                          setShowMobileMenu(false);
                          onNavigateToHelp();
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2"
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
                        className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2"
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
                        className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2"
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
                        className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2"
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

          {/* Team Selector Bar */}
          {teams.length > 0 && (
            <div className="pb-3 border-t border-gray-100">
              <div className="flex items-center gap-3 pt-3">
                <Users className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <select
                  value={selectedTeam?.id || ''}
                  onChange={(e) => {
                    const team = teams.find(t => t.id === e.target.value);
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
                    onClick={handleDismissAlert}
                    className="ml-3 p-1 text-red-400 hover:text-red-600 transition-colors flex-shrink-0"
                    title="30分間非表示"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}

            {/* No Training Summary Alert */}
              <CoachNoDataAlertCard alerts={alerts} />

                        {/* Team Overview */}
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
                  // 読み込み中
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
                  </div>
                ) : !latestTeamACWR ? (
                  // データなし
                  <div className="py-6 text-center text-sm text-gray-500">
                    まだACWRを計算できる十分なトレーニングデータがありません。
                    <br />
                    （選手のRPEと練習時間を入力すると表示されます）
                  </div>
                ) : (
                  // データあり
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
                        {teamAlerts.filter(alert => alert.priority === 'high').length}
                      </div>
                      <div className="text-xs sm:text-sm text-red-700">高リスク選手</div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab Navigation */}
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
                      onChange={(e) => setActiveTab(e.target.value as any)}
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
                        <h3 className="text-base sm:text-lg font-semibold text-gray-900">選手一覧</h3>
                        <div className="flex items-center space-x-4">
                          <span className="bg-gray-100 text-gray-700 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm">
                            {athletes.length}名
                          </span>
                          {teamAlerts.length > 0 && (
                            <span className="bg-red-100 text-red-700 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm">
                              アラート {teamAlerts.length}件
                            </span>
                          )}
                        </div>
                      </div>
                      <div data-tutorial="athlete-list">
                      <AthleteList
                        athletes={athletes}
                        onAthleteSelect={setSelectedAthlete}
                        athleteACWRMap={athleteACWRMap}
                        />
                      </div>
                    </div>
                  ) : activeTab === 'team-average' ? (
                    <div>
                      {teamACWRLoading ? (
                        <div className="flex items-center justify-center py-12">
                          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                        </div>
                      ) : (
                        <TeamACWRChart 
                          data={teamACWRData} 
                          teamName={selectedTeam.name}
                        />
                      )}
                    </div>
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
                  ) : activeTab === 'team-analytics' ? (
                    /* Team Analytics Tab */
                    <div className="space-y-6">
                      <TeamInjuryRiskHeatmap teamId={selectedTeam.id} />
                      <TeamPerformanceComparison teamId={selectedTeam.id} />
                      <TeamTrendAnalysis teamId={selectedTeam.id} />
                    </div>
                  ) : activeTab === 'reports' ? (
                    /* Reports Tab */
                    <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>}>
                      <ReportView team={selectedTeam} />
                    </Suspense>
                  ) : activeTab === 'team-access' ? (
                    /* Team Access Request Tab */
                    currentOrganizationId ? (
                      <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>}>
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
                    /* Athlete Transfer Tab */
                    currentOrganizationId ? (
                      <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>}>
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
                    /* Messages Tab */
                    <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>}>
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

      {/* Athlete Detail Modal */}
      {selectedAthlete && (
        <AthleteDetailModal
          athlete={selectedAthlete}
          onClose={() => setSelectedAthlete(null)}
        />
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
        <Suspense fallback={<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div></div>}>
          <TeamExportPanel
            team={selectedTeam}
            onClose={() => setShowExportPanel(false)}
          />
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