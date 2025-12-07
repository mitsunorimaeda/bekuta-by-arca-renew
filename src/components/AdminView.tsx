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
import { Settings, Users, UserPlus, AlertTriangle, BarChart3, X, HelpCircle, Building2, CreditCard, Sliders, UserCog, UsersRound, Layout, ShieldCheck, MessageSquare, Menu, Shield, FileText } from 'lucide-react';
import { OrganizationManagement } from './OrganizationManagement';
import { OrganizationOverview } from './OrganizationOverview';
import { SubscriptionManagement } from './SubscriptionManagement';
import { OrganizationSettings } from './OrganizationSettings';
import { TeamAccessRequestManagement } from './TeamAccessRequestManagement';
import { AthleteTransferManagement } from './AthleteTransferManagement';
import { OrganizationMembersManagement } from './OrganizationMembersManagement';
import { useOrganizations } from '../hooks/useOrganizations';

interface AdminViewProps {
  user: User;
  alerts: Alert[];
  onNavigateToPrivacy?: () => void;
  onNavigateToTerms?: () => void;
  onNavigateToCommercial?: () => void;
  onNavigateToHelp?: () => void;
}

export function AdminView({ user, alerts, onNavigateToPrivacy, onNavigateToTerms, onNavigateToCommercial, onNavigateToHelp }: AdminViewProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [activeTab, setActiveTab] = useState<'system' | 'users' | 'organization'>('system');
  const [systemSubTab, setSystemSubTab] = useState<'overview'>('overview');
  const [usersSubTab, setUsersSubTab] = useState<'invite' | 'manage'>('invite');
  const [organizationSubTab, setOrganizationSubTab] = useState<'overview' | 'list' | 'members' | 'settings' | 'subscription' | 'transfers' | 'team-access'>('overview');
  const [inviteSubTab, setInviteSubTab] = useState<'single' | 'bulk'>('single');
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [showAlertPanel, setShowAlertPanel] = useState(false);
  const [criticalAlertDismissed, setCriticalAlertDismissed] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const { isActive, shouldShowTutorial, startTutorial, completeTutorial, skipTutorial, currentStepIndex, setCurrentStepIndex } = useTutorialContext();
  const { organizations, loading: orgsLoading } = useOrganizations(user.id);

  useEffect(() => {
    if (shouldShowTutorial() && !loading) {
      startTutorial();
    }
  }, [shouldShowTutorial, startTutorial, loading]);

  useEffect(() => {
    const savedOrgId = localStorage.getItem('admin_selected_organization');
    if (savedOrgId && organizations.some(org => org.id === savedOrgId)) {
      setSelectedOrganizationId(savedOrgId);
    } else if (organizations.length > 0 && !selectedOrganizationId) {
      setSelectedOrganizationId(organizations[0].id);
      localStorage.setItem('admin_selected_organization', organizations[0].id);
    }
  }, [organizations]);

  const handleOrganizationSelect = (orgId: string) => {
    setSelectedOrganizationId(orgId);
    localStorage.setItem('admin_selected_organization', orgId);
  };

  const selectedOrganization = organizations.find(org => org.id === selectedOrganizationId);

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
  }, []);

  const fetchTeams = async () => {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('*')
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-3">
            <h1 className="text-lg sm:text-xl font-bold text-gray-900">管理者ダッシュボード</h1>
            <div className="flex items-center space-x-1">
              {highPriorityAlerts.length > 0 && (
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
                className="p-2 text-gray-600 hover:text-purple-600 transition-colors"
                title="チュートリアル"
              >
                <HelpCircle className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Organization Selector in Header */}
          {!orgsLoading && organizations.length > 1 && (
            <div className="pb-3 border-t border-gray-100">
              <div className="flex items-center gap-3 pt-3">
                <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <select
                  value={selectedOrganizationId || ''}
                  onChange={(e) => handleOrganizationSelect(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                >
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="space-y-6 sm:space-y-8">
          {/* Critical Alert Banner */}
          {highPriorityAlerts.length > 0 && !criticalAlertDismissed && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-center">
                <AlertTriangle className="w-6 h-6 text-red-600 mr-3 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-red-900">高リスクアラート</h3>
                  <p className="text-sm text-red-700">
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
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center mb-6">
              <BarChart3 className="w-6 h-6 text-blue-600 mr-3" />
              <h2 className="text-xl font-semibold text-gray-900">システム概要</h2>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-blue-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-blue-600 mb-1">
                  {alerts.length}
                </div>
                <div className="text-sm text-blue-700">総アラート数</div>
              </div>

              <div className="bg-red-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-red-600 mb-1">
                  {highPriorityAlerts.length}
                </div>
                <div className="text-sm text-red-700">高優先度</div>
              </div>

              <div className="bg-yellow-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-yellow-600 mb-1">
                  {systemAlerts.length}
                </div>
                <div className="text-sm text-yellow-700">システム通知</div>
              </div>

              <div className="bg-green-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-green-600 mb-1">
                  {teams.length}
                </div>
                <div className="text-sm text-green-700">登録チーム数</div>
              </div>
            </div>
          </div>

          {/* Management Tabs */}
          <div className="bg-white rounded-xl shadow-sm mb-8">
            <div className="border-b border-gray-200">
              <nav className="flex px-6 overflow-x-auto">
                <button
                  onClick={() => setActiveTab('system')}
                  className={`py-4 px-6 border-b-2 font-medium text-sm flex items-center space-x-2 whitespace-nowrap transition-colors ${
                    activeTab === 'system'
                      ? 'border-blue-500 text-blue-600 bg-blue-50'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                  data-tutorial="system-tab"
                >
                  <BarChart3 className="w-4 h-4" />
                  <span>システム</span>
                </button>
                <button
                  onClick={() => setActiveTab('users')}
                  className={`py-4 px-6 border-b-2 font-medium text-sm flex items-center space-x-2 whitespace-nowrap transition-colors ${
                    activeTab === 'users'
                      ? 'border-green-500 text-green-600 bg-green-50'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
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
                      ? 'border-orange-500 text-orange-600 bg-orange-50'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
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
              <div className="border-b border-gray-100 bg-gray-50">
                <nav className="flex px-6 overflow-x-auto">
                  {activeTab === 'users' && (
                    <>
                      <button
                        onClick={() => setUsersSubTab('invite')}
                        className={`py-3 px-4 border-b-2 font-medium text-xs flex items-center space-x-2 whitespace-nowrap ${
                          usersSubTab === 'invite'
                            ? 'border-green-500 text-green-700'
                            : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300'
                        }`}
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>招待</span>
                      </button>
                      <button
                        onClick={() => setUsersSubTab('manage')}
                        className={`py-3 px-4 border-b-2 font-medium text-xs flex items-center space-x-2 ml-4 whitespace-nowrap ${
                          usersSubTab === 'manage'
                            ? 'border-green-500 text-green-700'
                            : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300'
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
                        onClick={() => setOrganizationSubTab('overview')}
                        className={`py-3 px-4 border-b-2 font-medium text-xs flex items-center space-x-2 whitespace-nowrap ${
                          organizationSubTab === 'overview'
                            ? 'border-orange-500 text-orange-700'
                            : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300'
                        }`}
                      >
                        <Layout className="w-3.5 h-3.5" />
                        <span>概要</span>
                      </button>
                      <button
                        onClick={() => setOrganizationSubTab('list')}
                        className={`py-3 px-4 border-b-2 font-medium text-xs flex items-center space-x-2 ml-4 whitespace-nowrap ${
                          organizationSubTab === 'list'
                            ? 'border-orange-500 text-orange-700'
                            : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300'
                        }`}
                      >
                        <Building2 className="w-3.5 h-3.5" />
                        <span>組織一覧</span>
                      </button>
                      <button
                        onClick={() => setOrganizationSubTab('members')}
                        className={`py-3 px-4 border-b-2 font-medium text-xs flex items-center space-x-2 ml-4 whitespace-nowrap ${
                          organizationSubTab === 'members'
                            ? 'border-orange-500 text-orange-700'
                            : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300'
                        }`}
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>メンバー</span>
                      </button>
                      <button
                        onClick={() => setOrganizationSubTab('settings')}
                        className={`py-3 px-4 border-b-2 font-medium text-xs flex items-center space-x-2 ml-4 whitespace-nowrap ${
                          organizationSubTab === 'settings'
                            ? 'border-orange-500 text-orange-700'
                            : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300'
                        }`}
                      >
                        <Sliders className="w-3.5 h-3.5" />
                        <span>設定</span>
                      </button>
                      <button
                        onClick={() => setOrganizationSubTab('subscription')}
                        className={`py-3 px-4 border-b-2 font-medium text-xs flex items-center space-x-2 ml-4 whitespace-nowrap ${
                          organizationSubTab === 'subscription'
                            ? 'border-orange-500 text-orange-700'
                            : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300'
                        }`}
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        <span>サブスクリプション</span>
                      </button>
                      <button
                        onClick={() => setOrganizationSubTab('transfers')}
                        className={`py-3 px-4 border-b-2 font-medium text-xs flex items-center space-x-2 ml-4 whitespace-nowrap ${
                          organizationSubTab === 'transfers'
                            ? 'border-orange-500 text-orange-700'
                            : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300'
                        }`}
                      >
                        <UserCog className="w-3.5 h-3.5" />
                        <span>選手移籍</span>
                      </button>
                      <button
                        onClick={() => setOrganizationSubTab('team-access')}
                        className={`py-3 px-4 border-b-2 font-medium text-xs flex items-center space-x-2 ml-4 whitespace-nowrap ${
                          organizationSubTab === 'team-access'
                            ? 'border-orange-500 text-orange-700'
                            : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300'
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
              {activeTab === 'system' ? (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">システム監視</h3>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-gray-600 text-center">
                        リアルタイムでシステム全体のACWRデータを監視しています。
                        アラートが発生した場合は即座に通知されます。
                      </p>
                    </div>
                  </div>

                  {alerts.length > 0 && (
                    <div>
                      <h4 className="text-md font-medium text-gray-900 mb-3">最近のアラート</h4>
                      <div className="space-y-2">
                        {alerts.slice(0, 5).map((alert) => (
                          <div key={alert.id} className="bg-gray-50 rounded p-3 text-sm">
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{alert.title}</span>
                              <span className={`px-2 py-1 rounded text-xs ${
                                alert.priority === 'high' ? 'bg-red-100 text-red-700' :
                                alert.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-blue-100 text-blue-700'
                              }`}>
                                {alert.priority === 'high' ? '高' :
                                 alert.priority === 'medium' ? '中' : '低'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : activeTab === 'users' ? (
                <div>
                  {usersSubTab === 'invite' ? (
                    <div>
                      <div className="border-b border-gray-200 mb-6">
                        <nav className="flex space-x-8">
                          <button
                            onClick={() => setInviteSubTab('single')}
                            className={`py-3 px-1 border-b-2 font-medium text-sm ${
                              inviteSubTab === 'single'
                                ? 'border-green-500 text-green-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                          >
                            個別招待
                          </button>
                          <button
                            onClick={() => setInviteSubTab('bulk')}
                            className={`py-3 px-1 border-b-2 font-medium text-sm ${
                              inviteSubTab === 'bulk'
                                ? 'border-green-500 text-green-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
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
                            onUserInvited={() => {
                              // Refresh data if needed
                            }}
                          />
                        </div>
                      ) : (
                        <div data-tutorial="bulk-invite">
                          <BulkUserInvitation
                            teams={teams}
                            onUsersInvited={() => {
                              // Refresh data if needed
                            }}
                          />
                        </div>
                      )}
                    </div>
                  ) : usersSubTab === 'manage' ? (
                    <div data-tutorial="user-list">
                      <UserManagement teams={teams} />
                    </div>
                  ) : null}
                </div>
              ) : activeTab === 'organization' ? (
                <div>
                  {organizationSubTab === 'overview' ? (
                    selectedOrganizationId && selectedOrganization ? (
                      <OrganizationOverview
                        organizationId={selectedOrganizationId}
                        organizationName={selectedOrganization.name}
                      />
                    ) : (
                      <div className="text-center py-12">
                        <p className="text-gray-600 dark:text-gray-400 mb-4">
                          組織を選択してください
                        </p>
                        <button
                          onClick={() => setOrganizationSubTab('list')}
                          className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                        >
                          組織一覧へ
                        </button>
                      </div>
                    )
                  ) : organizationSubTab === 'list' ? (
                    <div>
                      <OrganizationManagement userId={user.id} />
                    </div>
                  ) : organizationSubTab === 'members' ? (
                    <div>
                      {selectedOrganizationId && selectedOrganization ? (
                        <OrganizationMembersManagement
                          organizationId={selectedOrganizationId}
                          organizationName={selectedOrganization.name}
                        />
                      ) : (
                        <div className="text-center py-12">
                          <p className="text-gray-600 dark:text-gray-400 mb-4">
                            組織メンバーを管理するには、まず組織を選択してください
                          </p>
                          <button
                            onClick={() => setOrganizationSubTab('list')}
                            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                          >
                            組織一覧へ
                          </button>
                        </div>
                      )}
                    </div>
                  ) : organizationSubTab === 'settings' ? (
                    <div>
                      {selectedOrganizationId ? (
                        <OrganizationSettings organizationId={selectedOrganizationId} />
                      ) : (
                        <div className="text-center py-12">
                          <p className="text-gray-600 dark:text-gray-400 mb-4">
                            設定を表示するには、まず組織を選択してください
                          </p>
                          <button
                            onClick={() => setOrganizationSubTab('list')}
                            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                          >
                            組織一覧へ
                          </button>
                        </div>
                      )}
                    </div>
                  ) : organizationSubTab === 'subscription' ? (
                    <div>
                      {selectedOrganizationId ? (
                        <SubscriptionManagement
                          organizationId={selectedOrganizationId}
                          organizationName="デモ組織"
                        />
                      ) : (
                        <div className="text-center py-12">
                          <p className="text-gray-600 dark:text-gray-400 mb-4">
                            サブスクリプションを表示するには、まず組織を選択してください
                          </p>
                          <button
                            onClick={() => setOrganizationSubTab('list')}
                            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                          >
                            組織一覧へ
                          </button>
                        </div>
                      )}
                    </div>
                  ) : organizationSubTab === 'transfers' ? (
                    <div>
                      {selectedOrganizationId ? (
                        <AthleteTransferManagement
                          userId={user.id}
                          organizationId={selectedOrganizationId}
                          isAdmin={true}
                        />
                      ) : (
                        <div className="text-center py-12">
                          <p className="text-gray-600 dark:text-gray-400 mb-4">
                            選手移籍管理を表示するには、まず組織を選択してください
                          </p>
                          <button
                            onClick={() => setOrganizationSubTab('list')}
                            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                          >
                            組織一覧へ
                          </button>
                        </div>
                      )}
                    </div>
                  ) : organizationSubTab === 'team-access' ? (
                    <div>
                      {selectedOrganizationId ? (
                        <TeamAccessRequestManagement
                          userId={user.id}
                          organizationId={selectedOrganizationId}
                          isAdmin={true}
                        />
                      ) : (
                        <div className="text-center py-12">
                          <p className="text-gray-600 dark:text-gray-400 mb-4">
                            チームアクセスリクエストを表示するには、まず組織を選択してください
                          </p>
                          <button
                            onClick={() => setOrganizationSubTab('list')}
                            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                          >
                            組織一覧へ
                          </button>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </main>

      <TutorialController
        steps={getTutorialSteps('admin')}
        isActive={isActive}
        onComplete={completeTutorial}
        onSkip={skipTutorial}
        currentStepIndex={currentStepIndex}
        onStepChange={setCurrentStepIndex}
      />
    </div>
  );
}