import React, { useState, useEffect } from 'react';
import { User, Team, supabase } from '../lib/supabase';
import { Alert } from '../lib/alerts';
import { UserInvitation } from './UserInvitation';
import { BulkUserInvitation } from './BulkUserInvitation';
import { UserManagement } from './UserManagement';
import { AlertSummary } from './AlertSummary';
import { TutorialController } from './TutorialController';
import { useTutorialContext } from '../contexts/TutorialContext';
import { getTutorialSteps } from '../lib/tutorialContent';
import { Building2, Users, UserPlus, AlertTriangle, BarChart3, X, HelpCircle, CreditCard, Sliders, UserCog, UsersRound, Layout, ShieldCheck, Menu, Shield, FileText } from 'lucide-react';
import { OrganizationOverview } from './OrganizationOverview';
import { SubscriptionManagement } from './SubscriptionManagement';
import { OrganizationSettings } from './OrganizationSettings';
import { TeamAccessRequestManagement } from './TeamAccessRequestManagement';
import { AthleteTransferManagement } from './AthleteTransferManagement';
import { OrganizationMembersManagement } from './OrganizationMembersManagement';

interface OrganizationAdminViewProps {
  user: User;
  alerts: Alert[];
  organizationId: string;
  organizationName: string;
  onNavigateToPrivacy?: () => void;
  onNavigateToTerms?: () => void;
  onNavigateToCommercial?: () => void;
  onNavigateToHelp?: () => void;
}

export function OrganizationAdminView({ user, alerts, organizationId, organizationName, onNavigateToPrivacy, onNavigateToTerms, onNavigateToCommercial, onNavigateToHelp }: OrganizationAdminViewProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'organization'>('overview');
  const [usersSubTab, setUsersSubTab] = useState<'invite' | 'manage'>('invite');
  const [organizationSubTab, setOrganizationSubTab] = useState<'members' | 'settings' | 'subscription' | 'transfers' | 'team-access'>('members');
  const [inviteSubTab, setInviteSubTab] = useState<'single' | 'bulk'>('single');
  const [loading, setLoading] = useState(true);
  const [showAlertPanel, setShowAlertPanel] = useState(false);
  const [criticalAlertDismissed, setCriticalAlertDismissed] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const { isActive, shouldShowTutorial, startTutorial, completeTutorial, skipTutorial, currentStepIndex, setCurrentStepIndex } = useTutorialContext();

  useEffect(() => {
    if (shouldShowTutorial() && !loading) {
      startTutorial();
    }
  }, [shouldShowTutorial, startTutorial, loading]);

  const highPriorityAlerts = alerts.filter(alert => alert.priority === 'high');
  const systemAlerts = alerts.filter(alert => alert.type === 'no_data' || alert.type === 'reminder');

  useEffect(() => {
    const dismissed = localStorage.getItem('criticalAlertDismissed');
    const dismissedTime = dismissed ? parseInt(dismissed, 10) : 0;
    const now = Date.now();
    const thirtyMinutes = 30 * 60 * 1000;

    if (dismissedTime && now - dismissedTime < thirtyMinutes) {
      setCriticalAlertDismissed(true);
    } else if (dismissedTime && now - dismissedTime >= thirtyMinutes) {
      localStorage.removeItem('criticalAlertDismissed');
    }
  }, []);

  const handleDismissCriticalAlert = () => {
    setCriticalAlertDismissed(true);
    localStorage.setItem('criticalAlertDismissed', Date.now().toString());
  };

  useEffect(() => {
    fetchTeams();
  }, [organizationId]);

  const fetchTeams = async () => {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .eq('organization_id', organizationId)
        .order('name');

      if (error) throw error;
      setTeams(data || []);
    } catch (error) {
      console.error('Error fetching teams:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b dark:border-gray-700 transition-colors sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-3">
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">組織管理ダッシュボード</h1>
            <div className="flex items-center space-x-1">
              {highPriorityAlerts.length > 0 && (
                <button
                  onClick={() => setShowAlertPanel(true)}
                  className="p-2 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors relative"
                  title="アラート"
                >
                  <AlertTriangle className="w-5 h-5" />
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                </button>
              )}

              <button
                onClick={startTutorial}
                className="p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                title="チュートリアル"
              >
                <HelpCircle className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="space-y-6 sm:space-y-8">
          {/* Critical Alert Banner */}
          {highPriorityAlerts.length > 0 && !criticalAlertDismissed && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
              <div className="flex items-center">
                <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400 mr-3 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-red-900 dark:text-red-100">高リスクアラート</h3>
                  <p className="text-sm text-red-700 dark:text-red-200">
                    {highPriorityAlerts.length}件の注意が必要です
                  </p>
                </div>
                <button
                  onClick={handleDismissCriticalAlert}
                  className="ml-3 p-1 text-red-400 hover:text-red-600 transition-colors flex-shrink-0"
                  title="30分間非表示"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {/* System Overview */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 transition-colors">
            <div className="flex items-center mb-6">
              <BarChart3 className="w-6 h-6 text-blue-600 dark:text-blue-400 mr-3" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">組織概要</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-1">
                  {alerts.length}
                </div>
                <div className="text-sm text-blue-700 dark:text-blue-300">総アラート数</div>
              </div>

              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-red-600 dark:text-red-400 mb-1">
                  {highPriorityAlerts.length}
                </div>
                <div className="text-sm text-red-700 dark:text-red-300">高優先度</div>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 mb-1">
                  {systemAlerts.length}
                </div>
                <div className="text-sm text-yellow-700 dark:text-yellow-300">システム通知</div>
              </div>

              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400 mb-1">
                  {teams.length}
                </div>
                <div className="text-sm text-green-700 dark:text-green-300">登録チーム数</div>
              </div>
            </div>
          </div>

          {/* Management Tabs */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm mb-8 transition-colors">
            <div className="border-b border-gray-200 dark:border-gray-700">
              <nav className="flex px-6 overflow-x-auto scrollbar-hide">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`py-4 px-6 border-b-2 font-medium text-sm flex items-center space-x-2 whitespace-nowrap transition-colors ${
                    activeTab === 'overview'
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  <span>概要</span>
                </button>
                <button
                  onClick={() => setActiveTab('users')}
                  className={`py-4 px-6 border-b-2 font-medium text-sm flex items-center space-x-2 whitespace-nowrap transition-colors ${
                    activeTab === 'users'
                      ? 'border-green-500 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                  data-tutorial="users-tab"
                >
                  <Users className="w-4 h-4" />
                  <span>ユーザー管理</span>
                </button>
                <button
                  onClick={() => setActiveTab('organization')}
                  className={`py-4 px-6 border-b-2 font-medium text-sm flex items-center space-x-2 whitespace-nowrap transition-colors ${
                    activeTab === 'organization'
                      ? 'border-orange-500 text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                  data-tutorial="organization-tab"
                >
                  <Building2 className="w-4 h-4" />
                  <span>組織管理</span>
                </button>
              </nav>
            </div>

            {/* Sub-tabs Section */}
            {(activeTab === 'users' || activeTab === 'organization') && (
              <div className="border-b border-gray-100 dark:border-gray-700/50 bg-gray-50 dark:bg-gray-800/50">
                <nav className="flex px-6 overflow-x-auto">
                  {activeTab === 'users' && (
                    <>
                      <button
                        onClick={() => setUsersSubTab('invite')}
                        className={`py-3 px-4 border-b-2 font-medium text-xs flex items-center space-x-2 whitespace-nowrap ${
                          usersSubTab === 'invite'
                            ? 'border-green-500 text-green-700 dark:text-green-400'
                            : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                        }`}
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>招待</span>
                      </button>
                      <button
                        onClick={() => setUsersSubTab('manage')}
                        className={`py-3 px-4 border-b-2 font-medium text-xs flex items-center space-x-2 ml-4 whitespace-nowrap ${
                          usersSubTab === 'manage'
                            ? 'border-green-500 text-green-700 dark:text-green-400'
                            : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                        }`}
                      >
                        <UserCog className="w-3.5 h-3.5" />
                        <span>管理</span>
                      </button>
                    </>
                  )}
                  {activeTab === 'organization' && (
                    <>
                      <button
                        onClick={() => setOrganizationSubTab('members')}
                        className={`py-3 px-4 border-b-2 font-medium text-xs flex items-center space-x-2 whitespace-nowrap ${
                          organizationSubTab === 'members'
                            ? 'border-orange-500 text-orange-700 dark:text-orange-400'
                            : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                        }`}
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>メンバー</span>
                      </button>
                      <button
                        onClick={() => setOrganizationSubTab('settings')}
                        className={`py-3 px-4 border-b-2 font-medium text-xs flex items-center space-x-2 ml-4 whitespace-nowrap ${
                          organizationSubTab === 'settings'
                            ? 'border-orange-500 text-orange-700 dark:text-orange-400'
                            : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                        }`}
                      >
                        <Sliders className="w-3.5 h-3.5" />
                        <span>設定</span>
                      </button>
                      <button
                        onClick={() => setOrganizationSubTab('subscription')}
                        className={`py-3 px-4 border-b-2 font-medium text-xs flex items-center space-x-2 ml-4 whitespace-nowrap ${
                          organizationSubTab === 'subscription'
                            ? 'border-orange-500 text-orange-700 dark:text-orange-400'
                            : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                        }`}
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        <span>サブスクリプション</span>
                      </button>
                      <button
                        onClick={() => setOrganizationSubTab('transfers')}
                        className={`py-3 px-4 border-b-2 font-medium text-xs flex items-center space-x-2 ml-4 whitespace-nowrap ${
                          organizationSubTab === 'transfers'
                            ? 'border-orange-500 text-orange-700 dark:text-orange-400'
                            : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                        }`}
                      >
                        <UserCog className="w-3.5 h-3.5" />
                        <span>選手移籍</span>
                      </button>
                      <button
                        onClick={() => setOrganizationSubTab('team-access')}
                        className={`py-3 px-4 border-b-2 font-medium text-xs flex items-center space-x-2 ml-4 whitespace-nowrap ${
                          organizationSubTab === 'team-access'
                            ? 'border-orange-500 text-orange-700 dark:text-orange-400'
                            : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                        }`}
                      >
                        <UsersRound className="w-3.5 h-3.5" />
                        <span>チームアクセス</span>
                      </button>
                    </>
                  )}
                </nav>
              </div>
            )}

            <div className="p-6">
              {activeTab === 'overview' ? (
                <OrganizationOverview
                  organizationId={organizationId}
                  organizationName={organizationName}
                />
              ) : activeTab === 'users' ? (
                <div>
                  {usersSubTab === 'invite' ? (
                    <div>
                      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
                        <nav className="flex space-x-8">
                          <button
                            onClick={() => setInviteSubTab('single')}
                            className={`py-3 px-1 border-b-2 font-medium text-sm ${
                              inviteSubTab === 'single'
                                ? 'border-green-500 text-green-600 dark:text-green-400'
                                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                            }`}
                          >
                            個別招待
                          </button>
                          <button
                            onClick={() => setInviteSubTab('bulk')}
                            className={`py-3 px-1 border-b-2 font-medium text-sm ${
                              inviteSubTab === 'bulk'
                                ? 'border-green-500 text-green-600 dark:text-green-400'
                                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                            }`}
                          >
                            一括招待 (CSV)
                          </button>
                        </nav>
                      </div>

                      {inviteSubTab === 'single' ? (
                        <div data-tutorial="single-invite">
                          <UserInvitation
                            teams={teams}
                            onUserInvited={() => {}}
                            restrictToOrganizationId={organizationId}
                            allowAdminInvite={false}
                          />
                        </div>
                      ) : (
                        <div data-tutorial="bulk-invite">
                          <BulkUserInvitation
                            teams={teams}
                            onUsersInvited={() => {}}
                            restrictToOrganizationId={organizationId}
                            allowAdminInvite={false}
                          />
                        </div>
                      )}
                    </div>
                  ) : usersSubTab === 'manage' ? (
                    <div data-tutorial="user-list">
                      <UserManagement teams={teams} restrictToOrganizationId={organizationId} />
                    </div>
                  ) : null}
                </div>
              ) : activeTab === 'organization' ? (
                <div>
                  {organizationSubTab === 'members' ? (
                    <OrganizationMembersManagement
                      organizationId={organizationId}
                      organizationName={organizationName}
                    />
                  ) : organizationSubTab === 'settings' ? (
                    <OrganizationSettings organizationId={organizationId} />
                  ) : organizationSubTab === 'subscription' ? (
                    <SubscriptionManagement
                      organizationId={organizationId}
                      organizationName={organizationName}
                    />
                  ) : organizationSubTab === 'transfers' ? (
                    <AthleteTransferManagement
                      userId={user.id}
                      organizationId={organizationId}
                      isAdmin={isGlobalAdmin(user.role)}
                    />
                  ) : organizationSubTab === 'team-access' ? (
                    <TeamAccessRequestManagement
                      userId={user.id}
                      organizationId={organizationId}
                      isAdmin={true}
                    />
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </main>

      <TutorialController
        steps={getTutorialSteps('global_admin')}
        isActive={isActive}
        onComplete={completeTutorial}
        onSkip={skipTutorial}
        currentStepIndex={currentStepIndex}
        onStepChange={setCurrentStepIndex}
      />
    </div>
  );
}
