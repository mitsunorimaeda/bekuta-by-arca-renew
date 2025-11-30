import React, { Suspense, lazy } from 'react';
import { useAuth } from './hooks/useAuth';
import { useAlerts } from './hooks/useAlerts';
import { useOrganizationRole } from './hooks/useOrganizationRole';
import { useToast } from './hooks/useToast';
import { TutorialProvider } from './contexts/TutorialContext';
import { LoginForm } from './components/LoginForm';
import { PasswordChangeForm } from './components/PasswordChangeForm';
import { WelcomePage } from './components/WelcomePage';
import { AthleteView } from './components/AthleteView';
import { StaffView } from './components/StaffView';
import { AdminView } from './components/AdminView';
// Lazy load heavy components for better performance
const OrganizationAdminView = lazy(() => import('./components/OrganizationAdminView').then(m => ({ default: m.OrganizationAdminView })));
import { AlertBadge } from './components/AlertBadge';
const AlertPanel = lazy(() => import('./components/AlertPanel').then(m => ({ default: m.AlertPanel })));
import { Building2, Users, Menu, X } from 'lucide-react';
import { ConsentModal } from './components/ConsentModal';
import { ToastContainer } from './components/ToastContainer';
import { Footer } from './components/Footer';
import { PrivacyPolicy } from './pages/PrivacyPolicy';
import { TermsOfService } from './pages/TermsOfService';
import { CommercialTransactions } from './pages/CommercialTransactions';
import { HelpPage } from './pages/HelpPage';
import { TeamAchievementNotification } from './components/TeamAchievementNotification';
import { LogOut } from 'lucide-react';

function App() {
  console.log('🎯 App component is rendering');

  const { user, userProfile, loading: authLoading, requiresPasswordChange: authRequiresPasswordChange, signIn, signOut, changePassword } = useAuth();
  const [requiresPasswordChange, setRequiresPasswordChange] = React.useState(false);

  // Sync password change requirement from auth hook
  React.useEffect(() => {
    setRequiresPasswordChange(authRequiresPasswordChange);
  }, [authRequiresPasswordChange]);
  const { organizationRoles, isOrganizationAdmin, getOrganizationAdminRoles } = useOrganizationRole(userProfile?.id);
  const {
    alerts,
    loading: alertsLoading,
    unreadCount,
    markAsRead,
    dismissAlert,
    markAllAsRead,
    getAlertsByPriority
  } = useAlerts(userProfile?.id || '', userProfile?.role || 'athlete');
  const { toasts, removeToast, success, error, info } = useToast();

  const [showAlertPanel, setShowAlertPanel] = React.useState(false);
  const [showConsentModal, setShowConsentModal] = React.useState(false);
  const [hasAcceptedTerms, setHasAcceptedTerms] = React.useState(false);
  const [currentPage, setCurrentPage] = React.useState<'app' | 'privacy' | 'terms' | 'commercial' | 'help' | 'reset-password'>('app');
  const [welcomeToken, setWelcomeToken] = React.useState<string | null>(null);
  const [prefilledEmail, setPrefilledEmail] = React.useState<string>('');
  const [dashboardMode, setDashboardMode] = React.useState<'staff' | 'org-admin'>('staff');
  const [showMobileMenu, setShowMobileMenu] = React.useState(false);
  const [isRecoveryMode, setIsRecoveryMode] = React.useState(false);

  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    if (token) {
      setWelcomeToken(token);
    }

    // Check if this is a password reset redirect from recovery link
    const hash = window.location.hash;
    if (hash.includes('type=recovery') || hash.includes('access_token')) {
      console.log('🔐 Recovery mode detected from URL');
      setIsRecoveryMode(true);
      // Clear the URL hash immediately to prevent persistence on refresh
      // Supabase auth will handle the recovery token internally
      window.history.replaceState({}, '', window.location.pathname + window.location.search);
    }
  }, []);

  // Handle recovery mode - force password change
  React.useEffect(() => {
    if (isRecoveryMode && user && !authLoading) {
      console.log('🔐 Recovery mode active, forcing password change');
      setRequiresPasswordChange(true);
    }
  }, [isRecoveryMode, user, authLoading]);

  // Clear recovery mode if user logs out or session ends
  React.useEffect(() => {
    if (!user && isRecoveryMode) {
      console.log('🔐 Clearing recovery mode - no active user');
      setIsRecoveryMode(false);
    }
  }, [user, isRecoveryMode]);

  // Check if user has accepted terms on first login
  React.useEffect(() => {
    if (user && userProfile && !requiresPasswordChange) {
      const acceptedTerms = localStorage.getItem(`accepted_terms_${user.id}`);
      if (!acceptedTerms) {
        setShowConsentModal(true);
      } else {
        setHasAcceptedTerms(true);
      }
    }
  }, [user, userProfile, requiresPasswordChange]);

  const handleLogout = async (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await signOut();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const hasHighPriorityAlerts = getAlertsByPriority('high').length > 0;

  console.log('🔐 App render - Auth states:');
  console.log('  - authLoading:', authLoading);
  console.log('  - user exists:', !!user);
  console.log('  - userProfile exists:', !!userProfile);
  console.log('  - requiresPasswordChange:', requiresPasswordChange);

  // 認証ローディング中のみスピナーを表示
  if (authLoading) {
    console.log('⏳ Showing auth loading spinner');
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center transition-colors">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400"></div>
      </div>
    );
  }

  if (welcomeToken) {
    return (
      <WelcomePage
        token={welcomeToken}
        onContinue={(email, token) => {
          setPrefilledEmail(email);
          setWelcomeToken(null);
          window.history.replaceState({}, '', '/');
        }}
      />
    );
  }

  if (!user || !userProfile) {
    console.log('🚪 Showing login form - user:', !!user, 'userProfile:', !!userProfile);
    return <LoginForm onLogin={signIn} />;
  }

  // Show password change form if required
  if (requiresPasswordChange) {
    console.log('🔑 Showing password change form');
    return (
      <PasswordChangeForm
        onPasswordChange={async (password: string) => {
          try {
            await changePassword(password);
            // Clear recovery mode and ensure clean state
            setIsRecoveryMode(false);
            setRequiresPasswordChange(false);
            // Ensure URL is completely clean
            window.history.replaceState({}, '', '/');
            console.log('✅ Password changed successfully, recovery mode cleared');
          } catch (error) {
            console.error('❌ Password change failed:', error);
            throw error;
          }
        }}
        userName={userProfile.name}
      />
    );
  }

  // Show consent modal if terms not accepted
  if (showConsentModal) {
    return (
      <ConsentModal
        onAccept={() => {
          localStorage.setItem(`accepted_terms_${user.id}`, new Date().toISOString());
          setHasAcceptedTerms(true);
          setShowConsentModal(false);
        }}
        onDecline={async () => {
          await signOut();
        }}
      />
    );
  }


  // Show legal pages if requested
  if (currentPage === 'privacy') {
    return <PrivacyPolicy onBack={() => setCurrentPage('app')} />;
  }
  if (currentPage === 'terms') {
    return <TermsOfService onBack={() => setCurrentPage('app')} />;
  }
  if (currentPage === 'commercial') {
    return <CommercialTransactions onBack={() => setCurrentPage('app')} />;
  }
  if (currentPage === 'help') {
    return <HelpPage user={userProfile} onBack={() => setCurrentPage('app')} />;
  }

  console.log('✅ Showing main application');
  return (
    <TutorialProvider userId={userProfile.id} role={userProfile.role}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
        {/* Navigation Bar - Hidden for athletes as they have their own header */}
        {userProfile.role !== 'athlete' && (
          <nav className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 relative z-20 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="flex items-baseline space-x-2 transition-colors">
                <span className="text-xl font-bold tracking-tight text-gray-900 dark:text-white" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif', letterSpacing: '-0.02em' }}>
                  Bekuta
                </span>
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 hidden sm:inline" style={{ letterSpacing: '0.05em' }}>
                  by ARCA
                </span>
              </h1>
            </div>
            <div className="flex items-center space-x-3">
              {/* デスクトップ: ユーザー名 + アラート + ログアウト */}
              <span className="text-sm text-gray-600 dark:text-gray-300 hidden md:block transition-colors">
                {userProfile.name}さん
              </span>

              {!alertsLoading && (
                <AlertBadge
                  count={unreadCount}
                  hasHighPriority={hasHighPriorityAlerts}
                  onClick={() => setShowAlertPanel(true)}
                  className="touch-target"
                />
              )}

              {/* デスクトップ: ログアウトボタン */}
              <button
                onClick={handleLogout}
                className="hidden md:flex bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600
                  text-gray-700 dark:text-gray-200 px-3 py-2 rounded-lg
                  border border-gray-300 dark:border-gray-600
                  transition-colors items-center space-x-2 text-sm"
                type="button"
              >
                <LogOut className="w-4 h-4" />
                <span>ログアウト</span>
              </button>

              {/* モバイル: ハンバーガーメニュー */}
              <button
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                className="md:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                type="button"
              >
                {showMobileMenu ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>
          </nav>
        )}

        {/* Mobile Menu - Only for non-athletes */}
        {userProfile.role !== 'athlete' && showMobileMenu && (
          <div className="md:hidden bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-lg transition-colors">
            <div className="px-4 py-3 space-y-3">
              <div className="flex items-center space-x-3 pb-3 border-b border-gray-200 dark:border-gray-700">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 dark:text-blue-400 font-semibold text-sm">
                    {userProfile.name.charAt(0)}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{userProfile.name}さん</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{userProfile.email}</p>
                </div>
              </div>
              <button
                onClick={(e) => {
                  setShowMobileMenu(false);
                  handleLogout(e);
                }}
                className="w-full flex items-center space-x-3 px-4 py-3 text-left text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
                type="button"
              >
                <LogOut className="w-5 h-5" />
                <span>ログアウト</span>
              </button>
            </div>
          </div>
        )}

      {/* Main Content */}
      <div className="relative">
        {userProfile.role === 'athlete' ? (
          <AthleteView
            user={userProfile}
            alerts={alerts}
            onLogout={signOut}
            onNavigateToPrivacy={() => setCurrentPage('privacy')}
            onNavigateToTerms={() => setCurrentPage('terms')}
            onNavigateToCommercial={() => setCurrentPage('commercial')}
            onNavigateToHelp={() => setCurrentPage('help')}
          />
        ) : userProfile.role === 'admin' ? (
          <AdminView
            user={userProfile}
            alerts={alerts}
            onNavigateToPrivacy={() => setCurrentPage('privacy')}
            onNavigateToTerms={() => setCurrentPage('terms')}
            onNavigateToCommercial={() => setCurrentPage('commercial')}
            onNavigateToHelp={() => setCurrentPage('help')}
          />
        ) : (
          // Staff or Organization Admin
          <>
            {/* Dashboard Mode Switcher for Staff who are also Org Admins */}
            {isOrganizationAdmin() && (
              <div className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 transition-colors sticky top-0 z-30">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
                  <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1 max-w-md">
                    <button
                      onClick={() => setDashboardMode('staff')}
                      className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center space-x-2 ${
                        dashboardMode === 'staff'
                          ? 'bg-white dark:bg-gray-600 text-green-600 dark:text-green-400 shadow-sm'
                          : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      <Users className="w-4 h-4" />
                      <span>コーチ</span>
                    </button>
                    <button
                      onClick={() => setDashboardMode('org-admin')}
                      className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center space-x-2 ${
                        dashboardMode === 'org-admin'
                          ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
                          : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      <Building2 className="w-4 h-4" />
                      <span>組織管理</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
            {dashboardMode === 'staff' ? (
              <StaffView
                user={userProfile}
                alerts={alerts}
                onNavigateToPrivacy={() => setCurrentPage('privacy')}
                onNavigateToTerms={() => setCurrentPage('terms')}
                onNavigateToCommercial={() => setCurrentPage('commercial')}
                onNavigateToHelp={() => setCurrentPage('help')}
              />
            ) : (
              getOrganizationAdminRoles().length > 0 && (
                <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>}>
                  <OrganizationAdminView
                    user={userProfile}
                    alerts={alerts}
                    organizationId={getOrganizationAdminRoles()[0].organizationId}
                    organizationName={getOrganizationAdminRoles()[0].organizationName}
                    onNavigateToPrivacy={() => setCurrentPage('privacy')}
                    onNavigateToTerms={() => setCurrentPage('terms')}
                    onNavigateToCommercial={() => setCurrentPage('commercial')}
                    onNavigateToHelp={() => setCurrentPage('help')}
                  />
                </Suspense>
              )
            )}
          </>
        )}
      </div>

      {/* Alert Panel */}
      {showAlertPanel && !alertsLoading && (
        <Suspense fallback={<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div></div>}>
          <AlertPanel
          alerts={alerts}
          onMarkAsRead={markAsRead}
          onDismiss={dismissAlert}
          onMarkAllAsRead={markAllAsRead}
          onClose={() => setShowAlertPanel(false)}
          userRole={userProfile.role}
          />
        </Suspense>
      )}

      {/* Team Achievement Notification */}
      {userProfile && <TeamAchievementNotification userId={userProfile.id} />} 

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onClose={removeToast} />

        {/* Footer */}
        <Footer
          onNavigateToPrivacy={() => setCurrentPage('privacy')}
          onNavigateToTerms={() => setCurrentPage('terms')}
          onNavigateToCommercial={() => setCurrentPage('commercial')}
        />
      </div>
    </TutorialProvider>
  );
}

export default App;