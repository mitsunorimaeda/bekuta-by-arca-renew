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
import { JoinPage } from './pages/JoinPage';
import { GlobalHeader } from './components/GlobalHeader';
import { ProfileGate } from "./components/ProfileGate";

// ✅ 追加：メンテページ
import MaintenancePage from "./pages/MaintenancePage";

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
const LandingPage = lazy(() =>
  import('./pages/LandingPage').then((m) => ({ default: m.LandingPage })),
);

const SignupPage = lazy(() =>
  import('./pages/SignupPage').then((m) => ({ default: m.SignupPage })),
);

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

      // 一部環境で refresh 失敗がここに出ることがあるので、保険で拾う
      if (!session && (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN')) {
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
    React.useState<'app' | 'landing' | 'login' | 'signup' | 'privacy' | 'terms' | 'commercial' | 'help' | 'reset-password' | 'auth-callback' | 'invite-expired' | 'welcome' | 'join'>('app');

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

    if (pathname.startsWith('/join')) {
      setCurrentPage('join');
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

    if (pathname === '/login') {
      setCurrentPage('login');
      return;
    }

    if (pathname === '/signup') {
      setCurrentPage('signup');
      return;
    }

    // ✅ welcome（token は WelcomePage 側で読む）
    if (pathname.startsWith('/welcome') || searchParams.get('token')) {
      setCurrentPage('welcome');
      return;
    }

    // ✅ 法的ページ（未認証でもアクセス可能に）
    if (pathname === '/privacy') {
      setCurrentPage('privacy');
      return;
    }
    if (pathname === '/terms') {
      setCurrentPage('terms');
      return;
    }
    if (pathname === '/commercial') {
      setCurrentPage('commercial');
      return;
    }
  }, []);

  // ✅ ブラウザの戻る/進む対応
  React.useEffect(() => {
    const handlePopState = () => {
      const pathname = window.location.pathname;
      if (pathname === '/login') setCurrentPage('login');
      else if (pathname === '/signup') setCurrentPage('signup');
      else if (pathname === '/privacy') setCurrentPage('privacy');
      else if (pathname === '/terms') setCurrentPage('terms');
      else if (pathname === '/commercial') setCurrentPage('commercial');
      else setCurrentPage('app');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
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

  // ✅ メンテナンスモード（ログイン・プロフィール取得に入る前に止める）
  const MAINTENANCE_MODE =
    String(import.meta.env.VITE_MAINTENANCE_MODE || "false") === "true";

  // auth/callback は通す（任意。今の分岐で上でreturnしてるので二重ガード）
  const pathnameNow = window.location.pathname;
  const isAuthCallback = pathnameNow.startsWith("/auth/callback");

  if (MAINTENANCE_MODE && !isAuthCallback) {
    return (
      <MaintenancePage
        etaText="（安定化を確認中です。しばらくしてから再度お試しください）"
      />
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

  // ✅ シェアリンク自己登録ページ（認証不要）
  if (currentPage === 'join') {
    return (
      <JoinPage
        onLoginSuccess={() => {
          setCurrentPage('app');
          window.history.replaceState({}, '', '/');
        }}
      />
    );
  }

  // ✅ 法的ページ（未認証でもアクセス可能）
  if (currentPage === 'privacy' && !user) {
    return (
      <PrivacyPolicy
        onBack={() => {
          setCurrentPage('app');
          window.history.pushState({}, '', '/');
        }}
      />
    );
  }
  if (currentPage === 'terms' && !user) {
    return (
      <TermsOfService
        onBack={() => {
          setCurrentPage('app');
          window.history.pushState({}, '', '/');
        }}
      />
    );
  }
  if (currentPage === 'commercial' && !user) {
    return (
      <CommercialTransactions
        onBack={() => {
          setCurrentPage('app');
          window.history.pushState({}, '', '/');
        }}
      />
    );
  }

  if (!user) {
    // ログインページ
    if (currentPage === 'login') {
      return (
        <LoginForm
          onLogin={signIn}
          onNavigateToLanding={() => {
            setCurrentPage('app');
            window.history.pushState({}, '', '/');
          }}
        />
      );
    }
    // サインアップページ
    if (currentPage === 'signup') {
      return (
        <Suspense fallback={<div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50" />}>
          <SignupPage
            onLoginSuccess={() => {
              setCurrentPage('app');
              window.history.replaceState({}, '', '/');
            }}
            onNavigateToLogin={() => {
              setCurrentPage('login');
              window.history.pushState({}, '', '/login');
            }}
            onNavigateToLanding={() => {
              setCurrentPage('app');
              window.history.pushState({}, '', '/');
            }}
          />
        </Suspense>
      );
    }
    // ランディングページ（デフォルト）
    return (
      <Suspense fallback={<div className="min-h-screen bg-white" />}>
        <LandingPage
          onNavigateToLogin={() => {
            setCurrentPage('login');
            window.history.pushState({}, '', '/login');
          }}
          onNavigateToSignup={() => {
            setCurrentPage('signup');
            window.history.pushState({}, '', '/signup');
          }}
          onNavigateToPrivacy={() => {
            setCurrentPage('privacy');
            window.history.pushState({}, '', '/privacy');
          }}
          onNavigateToTerms={() => {
            setCurrentPage('terms');
            window.history.pushState({}, '', '/terms');
          }}
          onNavigateToCommercial={() => {
            setCurrentPage('commercial');
            window.history.pushState({}, '', '/commercial');
          }}
        />
      </Suspense>
    );
  }

  return (
    <ProfileGate
      loading={authLoading || (!!user && !userProfile)}
      ready={!!user && !!userProfile}
      onRetry={refreshUserProfile}
    >
      {(() => {
        // ✅ ここで型を確定させる（赤線消える）
        if (!userProfile) return null;
  
        if (requiresPasswordChange) {
          return (
            <PasswordChangeForm
              onPasswordChange={async (password) => {
                await changePassword(password);
                setRequiresPasswordChange(false);
                window.history.replaceState({}, "", "/");
              }}
              userName={userProfile.name}
            />
          );
        }

        // ✅ スタッフ承認待ち
        if (userProfile.is_active === false) {
          return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-8 max-w-md w-full text-center">
                <div className="text-5xl mb-4">⏳</div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                  アカウントは承認待ちです
                </h1>
                <p className="text-gray-600 dark:text-gray-300 text-sm mt-2">
                  管理者がアカウントを承認するまでお待ちください。
                  承認が完了するとログインできるようになります。
                </p>
                <button
                  onClick={signOut}
                  className="mt-6 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 underline"
                >
                  ログアウト
                </button>
              </div>
            </div>
          );
        }
  
        // ✅ メール未確認チェック（24時間経過後にブロック）
        const emailVerifiedAt = (userProfile as any).email_verified_at;
        const registeredVia = user?.user_metadata?.registered_via;
        if (registeredVia === 'self_signup' && !emailVerifiedAt) {
          const createdAt = new Date(userProfile.created_at || Date.now());
          const hoursSinceCreation = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);

          if (hoursSinceCreation > 24) {
            // 24時間超過 → ブロック
            return (
              <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-8 max-w-md w-full text-center">
                  <div className="text-5xl mb-4">📧</div>
                  <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    メールアドレスの確認が必要です
                  </h1>
                  <p className="text-gray-600 dark:text-gray-300 text-sm mt-2">
                    ご登録時に送信した確認メールのリンクをクリックしてください。
                    メールが届いていない場合は、迷惑メールフォルダをご確認ください。
                  </p>
                  <div className="mt-6 space-y-3">
                    <button
                      onClick={async () => {
                        try {
                          const { data: { session } } = await supabase.auth.getSession();
                          // 確認メール再送信
                          const res = await fetch(
                            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/resend-verification`,
                            {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${session?.access_token}`,
                              },
                            }
                          );
                          if (res.ok) {
                            alert('確認メールを再送信しました');
                          }
                        } catch {
                          alert('再送信に失敗しました');
                        }
                      }}
                      className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                    >
                      確認メールを再送信
                    </button>
                    <button
                      onClick={signOut}
                      className="w-full py-2 border border-gray-300 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm"
                    >
                      ログアウト
                    </button>
                  </div>
                </div>
              </div>
            );
          }
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
  
        const hasHighPriorityAlerts = getAlertsByPriority("high").length > 0;
  
        const handleLogout = async (e: React.MouseEvent<HTMLButtonElement>) => {
          e.preventDefault();
          await signOut();
          setCurrentPage("app");
          window.history.replaceState({}, "", "/");
        };
  
        return (
          <TutorialProvider userId={userProfile.id} role={effectiveRole}>
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
              <GlobalHeader
                effectiveRole={effectiveRole}
                userProfile={{
                  id: userProfile.id,
                  name: userProfile.name,
                  email: userProfile.email,
                }}
                alertsLoading={alertsLoading}
                unreadCount={unreadCount}
                hasHighPriorityAlerts={hasHighPriorityAlerts}
                onOpenAlertPanel={() => setShowAlertPanel(true)}
                onLogout={handleLogout}
                onHome={() => {
                  setCurrentPage("app");
                  setDashboardMode("staff");
                  setShowAlertPanel(false);
                }}
                onNavigateToPrivacy={() => setCurrentPage("privacy")}
                onNavigateToTerms={() => setCurrentPage("terms")}
                onNavigateToCommercial={() => setCurrentPage("commercial")}
                onNavigateToHelp={() => setCurrentPage("help")}
              />
  
              {/* Main Content */}
              <div className="relative">
                <BadgeModalController userId={userProfile.id} />
  
                {effectiveRole === "athlete" ? (
                  <AthleteView
                    user={userProfile}
                    alerts={alerts}
                    onLogout={signOut}
                    onUserUpdated={refreshUserProfile}
                    readOnly={userProfile.status === 'frozen'}
                    onHome={() => {
                      window.location.assign(window.location.origin + "/");
                    }}
                    onNavigateToPrivacy={() => setCurrentPage("privacy")}
                    onNavigateToTerms={() => setCurrentPage("terms")}
                    onNavigateToCommercial={() => setCurrentPage("commercial")}
                    onNavigateToHelp={() => setCurrentPage("help")}
                  />
                ) : isGlobalAdmin(effectiveRole) ? (
                  <AdminView
                    user={userProfile}
                    alerts={alerts}
                    onNavigateToPrivacy={() => setCurrentPage("privacy")}
                    onNavigateToTerms={() => setCurrentPage("terms")}
                    onNavigateToCommercial={() => setCurrentPage("commercial")}
                    onNavigateToHelp={() => setCurrentPage("help")}
                  />
                ) : (
                  <>
                    {isOrganizationAdmin() && (
                      <div className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 transition-colors sticky top-0 z-30">
                        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
                          <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1 max-w-md">
                            <button
                              type="button"
                              onClick={() => setDashboardMode("staff")}
                              className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center space-x-2 ${
                                dashboardMode === "staff"
                                  ? "bg-white dark:bg-gray-600 text-green-600 dark:text-green-400 shadow-sm"
                                  : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                              }`}
                            >
                              <Users className="w-4 h-4" />
                              <span>コーチ</span>
                            </button>
  
                            <button
                              type="button"
                              onClick={() => setDashboardMode("org-admin")}
                              className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center space-x-2 ${
                                dashboardMode === "org-admin"
                                  ? "bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm"
                                  : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                              }`}
                            >
                              <Building2 className="w-4 h-4" />
                              <span>組織管理</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
  
                    {dashboardMode === "staff" ? (
                      <StaffView
                        user={userProfile}
                        alerts={alerts}
                        onNavigateToPrivacy={() => setCurrentPage("privacy")}
                        onNavigateToTerms={() => setCurrentPage("terms")}
                        onNavigateToCommercial={() => setCurrentPage("commercial")}
                        onNavigateToHelp={() => setCurrentPage("help")}
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
                            onNavigateToPrivacy={() => setCurrentPage("privacy")}
                            onNavigateToTerms={() => setCurrentPage("terms")}
                            onNavigateToCommercial={() => setCurrentPage("commercial")}
                            onNavigateToHelp={() => setCurrentPage("help")}
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
  
              {userProfile && <TeamAchievementNotification userId={userProfile.id} />}
  
              <ToastContainer toasts={toasts} onClose={removeToast} />
  
              <Footer
                onNavigateToPrivacy={() => setCurrentPage("privacy")}
                onNavigateToTerms={() => setCurrentPage("terms")}
                onNavigateToCommercial={() => setCurrentPage("commercial")}
              />
            </div>
          </TutorialProvider>
        );
      })()}
    </ProfileGate>
  );
}
export default App;