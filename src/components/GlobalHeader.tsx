// src/components/GlobalHeader.tsx
import React from 'react';
import { AlertTriangle, HelpCircle, Menu, X, LogOut, Shield, FileText, Building2 } from 'lucide-react';
import { AlertBadge } from './AlertBadge';

type Role = 'athlete' | 'staff' | 'admin';

type GlobalHeaderProps = {
  effectiveRole: Role;

  userProfile: {
    id: string;
    name: string;
    email: string;
  };

  alertsLoading: boolean;
  unreadCount: number;
  hasHighPriorityAlerts: boolean;

  onOpenAlertPanel: () => void;
  onLogout: (e: React.MouseEvent<HTMLButtonElement>) => void;

  onHome: () => void;

  onNavigateToPrivacy?: () => void;
  onNavigateToTerms?: () => void;
  onNavigateToCommercial?: () => void;
  onNavigateToHelp?: () => void;
};

export function GlobalHeader({
  effectiveRole,
  userProfile,
  alertsLoading,
  unreadCount,
  hasHighPriorityAlerts,
  onOpenAlertPanel,
  onLogout,
  onHome,
  onNavigateToPrivacy,
  onNavigateToTerms,
  onNavigateToCommercial,
  onNavigateToHelp,
}: GlobalHeaderProps) {
  const [showMobileMenu, setShowMobileMenu] = React.useState(false);

  // Athletes: 既にAthleteView側にヘッダーがある前提なので非表示
  if (effectiveRole === 'athlete') return null;

  const closeMenu = () => setShowMobileMenu(false);

  return (
    <>
      <nav className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 relative z-40 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Left: Logo */}
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => {
                  onHome();
                  closeMenu();
                }}
                className="flex items-baseline space-x-2 transition-colors active:opacity-70 cursor-pointer"
                style={{ WebkitTapHighlightColor: 'transparent' }}
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

            {/* Right */}
            <div className="flex items-center space-x-3">
              {/* Desktop name */}
              <span className="text-sm text-gray-600 dark:text-gray-300 hidden md:block transition-colors">
                {userProfile.name}さん
              </span>

              {/* Alerts */}
              {!alertsLoading && (
                <AlertBadge
                  count={unreadCount}
                  hasHighPriority={hasHighPriorityAlerts}
                  onClick={onOpenAlertPanel}
                  className="touch-target"
                />
              )}

              {/* Desktop legal/help (optional): ここは出さず、モバイルメニューに集約でもOK */}
              {/* Desktop logout */}
              <button
                onClick={onLogout}
                className="hidden md:flex bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600
                  text-gray-700 dark:text-gray-200 px-3 py-2 rounded-lg
                  border border-gray-300 dark:border-gray-600
                  transition-colors items-center space-x-2 text-sm"
                type="button"
              >
                <LogOut className="w-4 h-4" />
                <span>ログアウト</span>
              </button>

              {/* Mobile hamburger */}
              <button
                onClick={() => setShowMobileMenu((v) => !v)}
                className="md:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                type="button"
                aria-label="メニュー"
              >
                {showMobileMenu ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      {showMobileMenu && (
        <div className="md:hidden bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-lg transition-colors relative z-40">
          <div className="px-4 py-3 space-y-2">
            {/* Profile */}
            <div className="flex items-center space-x-3 pb-3 border-b border-gray-200 dark:border-gray-700">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                <span className="text-blue-600 dark:text-blue-400 font-semibold text-sm">
                  {(userProfile.name || 'U').charAt(0)}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {userProfile.name}さん
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{userProfile.email}</p>
              </div>
            </div>

            {/* Help / Legal */}
            {onNavigateToHelp && (
              <button
                onClick={() => {
                  closeMenu();
                  onNavigateToHelp();
                }}
                className="w-full flex items-center space-x-3 px-4 py-3 text-left text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
                type="button"
              >
                <HelpCircle className="w-5 h-5" />
                <span>ヘルプ・マニュアル</span>
              </button>
            )}

            {onNavigateToPrivacy && (
              <button
                onClick={() => {
                  closeMenu();
                  onNavigateToPrivacy();
                }}
                className="w-full flex items-center space-x-3 px-4 py-3 text-left text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
                type="button"
              >
                <Shield className="w-5 h-5" />
                <span>プライバシーポリシー</span>
              </button>
            )}

            {onNavigateToTerms && (
              <button
                onClick={() => {
                  closeMenu();
                  onNavigateToTerms();
                }}
                className="w-full flex items-center space-x-3 px-4 py-3 text-left text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
                type="button"
              >
                <FileText className="w-5 h-5" />
                <span>利用規約</span>
              </button>
            )}

            {onNavigateToCommercial && (
              <button
                onClick={() => {
                  closeMenu();
                  onNavigateToCommercial();
                }}
                className="w-full flex items-center space-x-3 px-4 py-3 text-left text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
                type="button"
              >
                <Building2 className="w-5 h-5" />
                <span>特定商取引法に基づく表記</span>
              </button>
            )}

            {/* Divider */}
            <div className="border-t border-gray-200 dark:border-gray-700 my-2" />

            {/* Logout */}
            <button
              onClick={(e) => {
                closeMenu();
                onLogout(e);
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
    </>
  );
}