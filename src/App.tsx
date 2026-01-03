// App.tsx
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
import { BadgeModalController } from './components/BadgeModalController';
import { AuthCallbackPage } from './pages/AuthCallbackPage';
import InviteExpired from './pages/InviteExpired';
import { GlobalHeader } from './components/GlobalHeader';
import { ProfileGate } from "./components/ProfileGate";



const OrganizationAdminView = lazy(() =>
  import('./components/OrganizationAdminView').then((m) => ({
    default: m.OrganizationAdminView,
  })),
);

import { AlertBadge } from './components/AlertBadge';
const AlertPanel = lazy(() =>
  import('./components/AlertPanel').then((m) => ({ default: m.AlertPanel })),
);

import { Building2, Users } from 'lucide-react';
import { ConsentModal } from './components/ConsentModal';
import { ToastContainer } from './components/ToastContainer';
import { Footer } from './components/Footer';
import { PrivacyPolicy } from './pages/PrivacyPolicy';
import { TermsOfService } from './pages/TermsOfService';
import { CommercialTransactions } from './pages/CommercialTransactions';
import { HelpPage } from './pages/HelpPage';
import { TeamAchievementNotification } from './components/TeamAchievementNotification';
import type { AppRole } from './lib/roles';          // ← 型（TypeScript用）
import { isGlobalAdmin } from './lib/permissions';
import { supabase, recoverFromInvalidRefreshToken } from './lib/supabase';

function App() {
  const {
    user,
    userProfile,
    loading: authLoading,
    requiresPasswordChange: authRequiresPasswordChange,
    signIn,
    signOut,
    changePassword,
    acceptTerms,
    refreshUserProfile, 
  } = useAuth();

  // ✅ セッション健全性チェック + auth state 監視（まとめ）
  React.useEffect(() => {
    let mounted = true;

    // ① 起動直後：壊れた refresh_token を握ってたら自動回復
    (async () => {
      const { error } = await supabase.auth.getSession();
      if (!mounted) return;

      if (error) {
        await recoverFromInvalidRefreshToken(error);
      }
    })();

    // ② 以後：タブ間/復元/自動更新で auth 状態が変わったら追従
    const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      // 参考：必要ならログ
      // console.log('[auth]', event, !!session);

      // 明示的に sign out されたら、URL/ページ状態もリセットしたい場合（任意）
      // if (event === 'SIGNED_OUT') {
      //   window.history.replaceState({}, '', '/');
      // }

      // 一部環境で refresh 失敗がここに出ることがあるので、保険で拾う
      // (Supabaseのイベント自体にerrorが載らないこともあるが、念のため)
      if (!session && (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN')) {
        // session が無いのに “更新/サインイン” 系イベントが来るのは怪しい
        // getSession 再確認 → error なら回復
        const { error } = await supabase.auth.getSession();
        if (error) await recoverFromInvalidRefreshToken(error);
      }
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

const effectiveRole: AppRole =
  userProfile?.role === "staff" ||
  userProfile?.role === "global_admin" ||
  userProfile?.role === "athlete"
    ? (userProfile.role as AppRole)
    : "athlete";

  const [requiresPasswordChange, setRequiresPasswordChange] = React.useState(false);
  const { isOrganizationAdmin, getOrganizationAdminRoles } = useOrganizationRole(userProfile?.id);

  const {
    alerts,
    loading: alertsLoading,
    unreadCount,
    markAsRead,
    dismissAlert,
    markAllAsRead,
    getAlertsByPriority,
  } = useAlerts(userProfile?.id || '', effectiveRole);

  const { toasts, removeToast } = useToast();

  const [showAlertPanel, setShowAlertPanel] = React.useState(false);
  const [showConsentModal, setShowConsentModal] = React.useState(false);
  const [currentPage, setCurrentPage] =
    React.useState<'app' | 'privacy' | 'terms' | 'commercial' | 'help' | 'reset-password' | 'auth-callback' | 'invite-expired' | 'welcome'>('app');

  const [dashboardMode, setDashboardMode] = React.useState<'staff' | 'org-admin'>('staff');
  const [termsAcceptedLocally, setTermsAcceptedLocally] = React.useState(false);


  React.useEffect(() => {
    setRequiresPasswordChange(authRequiresPasswordChange);
  }, [authRequiresPasswordChange]);

  // 🌐 URL 判定
  React.useEffect(() => {
    const url = new URL(window.location.href);
    const pathname = url.pathname;
    const searchParams = url.searchParams;

    if (pathname.startsWith('/auth/callback')) {
      setCurrentPage('auth-callback');
      return;
    }

    if (pathname.startsWith('/invite-expired')) {
      setCurrentPage('invite-expired');
      return;
    }

    if (pathname.startsWith('/reset-password')) {
      setCurrentPage('reset-password');
      return;
    }

    // ✅ welcome（token は WelcomePage 側で読む）
    if (pathname.startsWith('/welcome') || searchParams.get('token')) {
      setCurrentPage('welcome');
      return;
    }
  }, []);

  // recovery hash
  React.useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;

    const params = new URLSearchParams(hash.replace('#', ''));
    if (params.get('type') !== 'recovery') return;

    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');
    if (!access_token || !refresh_token) return;

    (async () => {
      const { data } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      });

      if (data.session?.user) {
        setRequiresPasswordChange(true);
        window.history.replaceState({}, document.title, window.location.pathname);
        setCurrentPage('reset-password');
      }
    })();
  }, []);

  // 利用規約
  React.useEffect(() => {
    if (user && userProfile && !requiresPasswordChange) {
      if (!userProfile.terms_accepted && !termsAcceptedLocally) {
        setShowConsentModal(true);
      } else {
        setShowConsentModal(false);
      }
    } else {
      setShowConsentModal(false);
    }
  }, [user, userProfile, requiresPasswordChange, termsAcceptedLocally]);

  // --- ページ分岐 ---

  if (currentPage === 'auth-callback') {
    return (
      <AuthCallbackPage
        onDone={() => {
          setCurrentPage('app');
          window.history.replaceState({}, '', '/');
        }}
      />
    );
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (currentPage === 'invite-expired') {
    return <InviteExpired />;
  }

  // ✅ Welcome（token は WelcomePage 内）
  if (currentPage === 'welcome') {
    return (
      <WelcomePage
        onContinue={() => {
          setCurrentPage('app');
          window.history.replaceState({}, '', '/');
        }}
      />
    );
  }

  if (!user) return <LoginForm onLogin={signIn} />;

// userはいるが userProfile がまだ無い → “エラー画面”ではなく Gate 表示
if (!userProfile) {
  return (
    <ProfileGate
      onRetry={refreshUserProfile}
      onLogout={signOut}
      // 任意：何秒かごとに自動リトライするなら ProfileGate 側で setInterval でもOK
      title="Bekuta"
      message="プロフィールを読み込んでいます…"
    />
  );
}

  if (requiresPasswordChange) {
    return (
      <PasswordChangeForm
        onPasswordChange={async (password) => {
          await changePassword(password);
          setRequiresPasswordChange(false);
          window.history.replaceState({}, '', '/');
        }}
        userName={userProfile.name}
      />
    );
  }

  if (showConsentModal) {
    return (
      <ConsentModal
        onAccept={async () => {
          await acceptTerms();
          setTermsAcceptedLocally(true);
          setShowConsentModal(false);
        }}
        onDecline={signOut}
      />
    );
  }

  const hasHighPriorityAlerts = getAlertsByPriority('high').length > 0;

  const handleLogout = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    await signOut();
    setCurrentPage('app');
    window.history.replaceState({}, '', '/');
  };

  return (
    <TutorialProvider userId={userProfile.id} role={effectiveRole}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <GlobalHeader
        effectiveRole={effectiveRole}
        userProfile={{ id: userProfile.id, name: userProfile.name, email: userProfile.email }}
        alertsLoading={alertsLoading}
        unreadCount={unreadCount}
        hasHighPriorityAlerts={hasHighPriorityAlerts}
        onOpenAlertPanel={() => setShowAlertPanel(true)}
        onLogout={handleLogout}
        onHome={() => {
          console.log('🏠 Bekuta logo clicked');
          setCurrentPage('app');
          setDashboardMode('staff');
          setShowAlertPanel(false);
        }}
        onNavigateToPrivacy={() => setCurrentPage('privacy')}
        onNavigateToTerms={() => setCurrentPage('terms')}
        onNavigateToCommercial={() => setCurrentPage('commercial')}
        onNavigateToHelp={() => setCurrentPage('help')}
      />

        {/* Main Content */}
        <div className="relative">
          <BadgeModalController userId={userProfile.id} />

          {effectiveRole === 'athlete' ? (
            <AthleteView
              user={userProfile}
              alerts={alerts}
              onLogout={signOut}
              onUserUpdated={refreshUserProfile}
              onHome={() => {
                console.log('🏠 Athlete Bekuta home tapped');
                window.location.assign('https://bekuta.netlify.app/');
              }}
              onNavigateToPrivacy={() => setCurrentPage('privacy')}
              onNavigateToTerms={() => setCurrentPage('terms')}
              onNavigateToCommercial={() => setCurrentPage('commercial')}
              onNavigateToHelp={() => setCurrentPage('help')}
            />
          ) : isGlobalAdmin(effectiveRole) ? (
            <AdminView
              user={userProfile}
              alerts={alerts}
              onNavigateToPrivacy={() => setCurrentPage('privacy')}
              onNavigateToTerms={() => setCurrentPage('terms')}
              onNavigateToCommercial={() => setCurrentPage('commercial')}
              onNavigateToHelp={() => setCurrentPage('help')}
            />
          ) : (
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
                  <Suspense
                    fallback={
                      <div className="flex items-center justify-center min-h-screen">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
                      </div>
                    }
                  >
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
          <Suspense
            fallback={
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white" />
              </div>
            }
          >
            <AlertPanel
              alerts={alerts}
              onMarkAsRead={markAsRead}
              onDismiss={dismissAlert}
              onMarkAllAsRead={markAllAsRead}
              onClose={() => setShowAlertPanel(false)}
              userRole={effectiveRole}
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