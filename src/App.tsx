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
// 🔽 ここはもう使わないのでコメントアウトしてOK（ファイル自体は残しておいても問題なし）
// import { PasswordResetConfirm } from './components/PasswordResetConfirm';

// Lazy load heavy components for better performance
const OrganizationAdminView = lazy(() =>
  import('./components/OrganizationAdminView').then((m) => ({
    default: m.OrganizationAdminView,
  })),
);
import { AlertBadge } from './components/AlertBadge';
const AlertPanel = lazy(() =>
  import('./components/AlertPanel').then((m) => ({ default: m.AlertPanel })),
);

import { Building2, Users, Menu, X, LogOut } from 'lucide-react';
import { ConsentModal } from './components/ConsentModal';
import { ToastContainer } from './components/ToastContainer';
import { Footer } from './components/Footer';
import { PrivacyPolicy } from './pages/PrivacyPolicy';
import { TermsOfService } from './pages/TermsOfService';
import { CommercialTransactions } from './pages/CommercialTransactions';
import { HelpPage } from './pages/HelpPage';
import { TeamAchievementNotification } from './components/TeamAchievementNotification';

// 🔽 Supabase クライアントを使う
import { supabase } from './lib/supabase';

type AppUserRole = 'athlete' | 'staff' | 'admin';

function App() {
  console.log('🎯 App component is rendering');

  const {
    user,
    userProfile,
    loading: authLoading,
    requiresPasswordChange: authRequiresPasswordChange,
    signIn,
    signOut,
    changePassword,
    acceptTerms,
  } = useAuth();

  const effectiveRole: AppUserRole =
    userProfile?.role === 'staff' ||
    userProfile?.role === 'admin' ||
    userProfile?.role === 'athlete'
      ? userProfile.role
      : 'athlete';

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
    React.useState<'app' | 'privacy' | 'terms' | 'commercial' | 'help' | 'reset-password'>('app');
  const [welcomeToken, setWelcomeToken] = React.useState<string | null>(null);
  const [dashboardMode, setDashboardMode] = React.useState<'staff' | 'org-admin'>('staff');
  const [showMobileMenu, setShowMobileMenu] = React.useState(false);

  // 🔹 ローカルでの「同意済み」フラグ
  const [termsAcceptedLocally, setTermsAcceptedLocally] = React.useState(false);

  // パスワード変更フラグを同期
  React.useEffect(() => {
    setRequiresPasswordChange(authRequiresPasswordChange);
  }, [authRequiresPasswordChange]);

  // URL（token / reset-password）チェック
  React.useEffect(() => {
    const url = new URL(window.location.href);
    const urlParams = url.searchParams;
    const token = urlParams.get('token');
    if (token) {
      setWelcomeToken(token);
    }

    // パスワードリセット用の専用パス
    if (url.pathname.startsWith('/reset-password')) {
      console.log('🔐 /reset-password route detected');
      setCurrentPage('reset-password');
    }
  }, []);

  // ✅ recovery リンク（ハッシュ）からセッションを貼る
  React.useEffect(() => {
    // 例: #access_token=xxx&refresh_token=yyy&type=recovery
    const hash = window.location.hash;
    if (!hash) return;

    const params = new URLSearchParams(hash.replace('#', ''));
    const type = params.get('type');

    if (type !== 'recovery') return;

    console.log('🔐 Recovery hash detected in URL');

    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');

    if (!access_token || !refresh_token) {
      console.warn('⚠️ recovery URL に access_token または refresh_token がありません');
      return;
    }

    (async () => {
      const { data, error } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      });

      if (error) {
        console.error('❌ Failed to set recovery session:', error);
        return;
      }

      if (data.session?.user) {
        console.log('👤 Recovery session user set');

        // パスワード変更フローに入る想定なのでフラグをオン
        setRequiresPasswordChange(true);

        // URL の # 以下を消す
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname + window.location.search,
        );

        // 念のため reset-password ページであることを保証
        setCurrentPage('reset-password');
      } else {
        console.log('⚠️ No user found after setSession');
      }
    })();
  }, []);

  // ✅ DB の terms_accepted を見て同意モーダルを制御
  React.useEffect(() => {
    console.log('👀 Checking terms consent state:', {
      hasUser: !!user,
      hasProfile: !!userProfile,
      requiresPasswordChange,
      profileTermsAccepted: userProfile?.terms_accepted,
      termsAcceptedLocally,
    });

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

  // 🔄 認証ローディング中
  if (authLoading) {
    console.log('⏳ Showing auth loading spinner');
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center transition-colors">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400" />
      </div>
    );
  }

  // 🔐 パスワードリセット専用ページ
  if (currentPage === 'reset-password') {
    console.log('🔐 Showing reset password flow');

    // まだセッションが立っていない間はローディング表示
    if (!user || !userProfile) {
      return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto" />
            <p className="text-sm text-gray-600 dark:text-gray-300">
              パスワードリセットリンクを確認しています…
            </p>
          </div>
        </div>
      );
    }

    // セッションがある → 新しいパスワードを入力してもらう
    return (
      <PasswordChangeForm
        onPasswordChange={async (password: string) => {
          try {
            await changePassword(password);
            setRequiresPasswordChange(false);
            setCurrentPage('app');
            window.history.replaceState({}, '', '/');
            console.log('✅ Password changed successfully (from recovery link)');
          } catch (error) {
            console.error('❌ Password change failed:', error);
            throw error;
          }
        }}
        userName={userProfile.name}
      />
    );
  }

  // Welcome トークンがある場合（初回セットアップフロー）
  if (welcomeToken) {
    return (
      <WelcomePage
        token={welcomeToken}
        onContinue={() => {
          setWelcomeToken(null);
          window.history.replaceState({}, '', '/');
        }}
      />
    );
  }

  // 未ログイン or userProfile がまだ取れていない場合
  if (!user || !userProfile) {
    return (
      <LoginForm
        onLogin={async (email, password) => {
          await signIn(email, password);
        }}
      />
    );
  }

  // パスワード変更が必要な場合（通常ログイン後の強制変更など）
  if (requiresPasswordChange) {
    console.log('🔑 Showing password change form (authRequiresPasswordChange)');
    return (
      <PasswordChangeForm
        onPasswordChange={async (password: string) => {
          try {
            await changePassword(password);
            setRequiresPasswordChange(false);
            window.history.replaceState({}, '', '/');
            console.log('✅ Password changed successfully');
          } catch (error) {
            console.error('❌ Password change failed:', error);
            throw error;
          }
        }}
        userName={userProfile.name}
      />
    );
  }

  // ✅ 利用規約モーダル
  if (showConsentModal) {
    return (
      <ConsentModal
        onAccept={async () => {
          try {
            await acceptTerms();
            setTermsAcceptedLocally(true);
            setShowConsentModal(false);
          } catch (error) {
            console.error('❌ acceptTerms failed:', error);
          }
        }}
        onDecline={async () => {
          await signOut();
        }}
      />
    );
  }

  // 法的ページ
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
    <TutorialProvider userId={userProfile.id} role={effectiveRole}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
        {/* Navigation Bar - Hidden for athletes as they have their own header */}
        {effectiveRole !== 'athlete' && (
          <nav className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 relative z-20 transition-colors">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center h-16">
                <div className="flex items-center">
                <div className="flex items-center">
  <button
    onClick={() => {
      // ホーム画面に戻す
      setCurrentPage('app');

      // 少し待ってから擬似リフレッシュ（再レンダリング）
      setTimeout(() => {
        window.location.reload();
      }, 50);
    }}
                    className="flex items-baseline space-x-2 transition-colors active:opacity-70"
                    style={{ WebkitTapHighlightColor: 'transparent' }} // iOSでの青枠防止
                  >
                    <span
                      className="text-xl font-bold tracking-tight text-gray-900 dark:text-white"
                      style={{
                        fontFamily:
                          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                        letterSpacing: '-0.02em',
                      }}
                    >
                      Bekuta
                    </span>
                    <span
                      className="text-xs font-medium text-gray-500 dark:text-gray-400 hidden sm:inline"
                      style={{ letterSpacing: '0.05em' }}
                    >
                      by ARCA
                    </span>
                  </button>
                </div>
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
        {effectiveRole !== 'athlete' && showMobileMenu && (
          <div className="md:hidden bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-lg transition-colors">
            <div className="px-4 py-3 space-y-3">
              <div className="flex items-center space-x-3 pb-3 border-b border-gray-200 dark:border-gray-700">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 dark:text-blue-400 font-semibold text-sm">
                    {userProfile.name.charAt(0)}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text:white">{userProfile.name}さん</p>
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
          {effectiveRole === 'athlete' ? (
            <AthleteView
              user={userProfile}
              alerts={alerts}
              onLogout={signOut}
              onNavigateToPrivacy={() => setCurrentPage('privacy')}
              onNavigateToTerms={() => setCurrentPage('terms')}
              onNavigateToCommercial={() => setCurrentPage('commercial')}
              onNavigateToHelp={() => setCurrentPage('help')}
            />
          ) : effectiveRole === 'admin' ? (
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