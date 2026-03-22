// src/components/AthleteViewHeader.tsx
import React from 'react';
import {
  Activity,
  HelpCircle,
  Scale,
  Settings,
  Zap,
  Moon,
  Heart,
  LayoutDashboard,
  Menu,
  X,
  LogOut,
  Trophy,
  Shield,
  FileText,
  Building2,
  Droplets,
  Flame,
  Sword,
  ChevronDown,
  User,
  MessageCircle,
} from 'lucide-react';
import { NotificationInbox } from './NotificationInbox';
import * as Sentry from '@sentry/react';
import type { ActiveTab } from '../types/athlete';

export type AthleteViewHeaderProps = {
  userName: string | null;
  userId: string;
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  safeSetActiveTab: (tab: ActiveTab) => void;
  menuOpen: boolean;
  setMenuOpen: (open: boolean | ((v: boolean) => boolean)) => void;
  readOnly: boolean;
  unreadMessageCount: number;
  startTutorial: () => void;
  onHome: () => void;
  onLogout: () => void;
  onNavigateToHelp: () => void;
  onNavigateToPrivacy: () => void;
  onNavigateToTerms: () => void;
  onNavigateToCommercial: () => void;
  normalizedGenderBinary: 'female' | 'male' | null;
  canUseFTT: boolean;
  canUseNutrition: boolean;
  isRehabilitating: boolean;
  hasActivePrograms: boolean;
  today: string;
  setNutritionDate: (d: string) => void;
};

export function AthleteViewHeader({
  userName,
  userId,
  activeTab,
  setActiveTab,
  safeSetActiveTab,
  menuOpen,
  setMenuOpen,
  readOnly,
  unreadMessageCount,
  startTutorial,
  onHome,
  onLogout,
  onNavigateToHelp,
  onNavigateToPrivacy,
  onNavigateToTerms,
  onNavigateToCommercial,
  normalizedGenderBinary,
  canUseFTT,
  canUseNutrition,
  isRehabilitating,
  hasActivePrograms,
  today,
  setNutritionDate,
}: AthleteViewHeaderProps) {
  return (
    <>
      <header className="bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-700 dark:to-blue-800 shadow-lg transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            {/* 左：ロゴ */}
            <button
              type="button"
              onClick={onHome}
              className="flex items-baseline gap-2 active:opacity-70 cursor-pointer"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <span className="text-2xl sm:text-3xl font-bold text-white">Bekuta</span>
              <span className="text-xs font-medium text-blue-100 hidden sm:inline">by ARCA</span>
            </button>

            {/* 右：? と ハンバーガー */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={startTutorial}
                className="p-2 rounded-lg text-white/90 hover:bg-white/10 hover:text-white transition-colors"
                aria-label="チュートリアル"
                title="チュートリアル"
              >
                <HelpCircle className="w-5 h-5" />
              </button>

              {/* 通知ベルアイコン */}
              {!readOnly && <NotificationInbox userId={userId} />}

              {/* メッセージアイコン */}
              <button
                type="button"
                onClick={() => { setActiveTab('messages'); setMenuOpen(false); }}
                className="relative p-2 rounded-lg text-white hover:bg-white/10 transition-colors"
                aria-label="メッセージ"
                title="メッセージ"
              >
                <MessageCircle className="w-5 h-5" />
                {unreadMessageCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                    {unreadMessageCount > 9 ? '9+' : unreadMessageCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setMenuOpen((v: boolean) => !v)}
                className="p-2 rounded-lg text-white hover:bg-white/10 transition-colors"
                aria-label="メニュー"
                title="メニュー"
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
            {userName}さん ·{' '}
            {activeTab === 'unified'
              ? 'ホーム：総合ダッシュボード'
              : activeTab === 'overview'
              ? '今日の練習データを記録'
              : activeTab === 'weight'
              ? '体重の変化を管理'
              : activeTab === 'insights'
              ? 'データから新しい発見を'
              : activeTab === 'performance'
              ? 'パフォーマンスを測定'
              : activeTab === 'profile'
              ? 'マイプロフィール'
              : activeTab === 'conditioning'
              ? '体調・リカバリー'
              : activeTab === 'cycle'
              ? '月経周期とコンディションを記録'
               : activeTab === 'nutrition'
              ? '栄養：食事内容を記録_AI分析'
              : activeTab === 'gamification'
              ? 'ストリーク、バッジ、目標を管理'
              : activeTab === 'rehab'
              ? 'トレーニング / リハビリ'
              : activeTab === 'ftt'
              ? '神経疲労チェック'
              : '設定とお知らせ'}
          </p>
        </div>
      </div>

      {/* Hamburger Menu Dropdown */}
      {menuOpen && (
        <div className="fixed inset-0 z-50" onClick={() => setMenuOpen(false)}>
          <div className="absolute inset-0 bg-black bg-opacity-50"></div>

          <div
            className="absolute top-16 right-4 bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-72 max-h-[calc(100vh-5rem)] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-2">
              {/* ── 記録セクション ── */}
              <p className="px-3 pt-2 pb-1 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">記録</p>

              {/* 🏠 ホーム */}
              <button type="button"
                onClick={() => {
                  setActiveTab('unified');
                  setMenuOpen(false);
                }}
                className={`w-full flex items-center space-x-2 px-3 py-2.5 rounded-lg transition-colors ${
                  activeTab === 'unified'
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span className="text-sm font-medium">ホーム</span>
              </button>

              {/* ★ 追加：修行（リハビリ・トレーニング） */}
              {(isRehabilitating || hasActivePrograms) && (
                <button type="button"
                  onClick={() => {
                    setActiveTab('rehab');
                    setMenuOpen(false);
                  }}
                  className={`w-full flex items-center space-x-2 px-3 py-2.5 rounded-lg transition-colors ${
                    activeTab === 'rehab'
                      ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 font-bold italic'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <Sword className="w-4 h-4 text-indigo-500" />
                  <span className="text-sm font-medium">トレーニング / リハビリ</span>
                </button>
              )}

              {/* 体重管理 */}
              <button type="button"
                onClick={() => {
                  setActiveTab('weight');
                  setMenuOpen(false);
                }}
                className={`w-full flex items-center space-x-2 px-3 py-2.5 rounded-lg transition-colors ${
                  activeTab === 'weight'
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <Scale className="w-4 h-4" />
                <span className="text-sm font-medium">体重管理</span>
              </button>

              {/* 体調・リカバリー */}
              <button type="button"
                onClick={() => {
                  setActiveTab('conditioning');
                  setMenuOpen(false);
                }}
                className={`w-full flex items-center space-x-2 px-3 py-2.5 rounded-lg transition-colors ${
                  activeTab === 'conditioning'
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <Heart className="w-4 h-4" />
                <span className="text-sm font-medium">体調・リカバリー</span>
              </button>

              {/* 女性のみ：月経周期 */}
              {normalizedGenderBinary === 'female' && (
                <button type="button"
                  onClick={() => {
                    setActiveTab('cycle');
                    setMenuOpen(false);
                  }}
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

              {/* 練習記録 */}
              <button type="button"
                onClick={() => {
                  setActiveTab('overview');
                  setMenuOpen(false);
                }}
                className={`w-full flex items-center space-x-2 px-3 py-2.5 rounded-lg transition-colors ${
                  activeTab === 'overview'
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <Activity className="w-4 h-4" />
                <span className="text-sm font-medium">練習記録</span>
              </button>

              {/*栄養*/}
              {canUseNutrition && (
                <button type="button"
                  onClick={() => {
                    setNutritionDate(today); // 今日の日付にリセット
                    safeSetActiveTab('nutrition');
                    setMenuOpen(false);
                  }}
                  className={`w-full flex items-center space-x-2 px-3 py-2.5 rounded-lg transition-colors ${
                    activeTab === 'nutrition'
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <Flame className="w-4 h-4" />
                  <span className="text-sm font-medium">栄養</span>
                </button>
              )}

              {/* ── 分析セクション ── */}
              <div className="border-t border-gray-200 dark:border-gray-700 my-2"></div>
              <p className="px-3 pt-1 pb-1 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">分析</p>

              {/* パフォーマンス */}
              <button type="button"
                onClick={() => {
                  setActiveTab('performance');
                  setMenuOpen(false);
                }}
                className={`w-full flex items-center space-x-2 px-3 py-2.5 rounded-lg transition-colors ${
                  activeTab === 'performance'
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <Zap className="w-4 h-4" />
                <span className="text-sm font-medium">パフォーマンス</span>
              </button>

              {/* マイプロフィール（パフォーマンス分析） */}
              <button type="button"
                onClick={() => {
                  setActiveTab('profile');
                  setMenuOpen(false);
                }}
                className={`w-full flex items-center space-x-2 px-3 py-2.5 rounded-lg transition-colors ${
                  activeTab === 'profile'
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <User className="w-4 h-4" />
                <span className="text-sm font-medium">マイプロフィール</span>
              </button>

              {/* ゲーミフィケーション */}
              <button type="button"
                onClick={() => {
                  setActiveTab('gamification');
                  setMenuOpen(false);
                }}
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

              {/*FTT計測*/}
              {canUseFTT && (
                <button type="button"
                  onClick={() => {
                    safeSetActiveTab('ftt');
                    setMenuOpen(false);
                  }}
                  className={`w-full flex items-center space-x-2 px-3 py-2.5 rounded-lg transition-colors ${
                    activeTab === 'ftt'
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <Activity className="w-4 h-4" />
                  <span className="text-sm font-medium">ニューロチェック（10秒）</span>
                </button>
              )}

              {/* ── その他セクション ── */}
              <div className="border-t border-gray-200 dark:border-gray-700 my-2"></div>
              <p className="px-3 pt-1 pb-1 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">その他</p>

              {/* メッセージ */}
              <button type="button"
                onClick={() => {
                  setActiveTab('messages');
                  setMenuOpen(false);
                }}
                className={`w-full flex items-center space-x-2 px-3 py-2.5 rounded-lg transition-colors ${
                  activeTab === 'messages'
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <MessageCircle className="w-4 h-4" />
                <span className="text-sm font-medium">メッセージ</span>
              </button>

              <button type="button"
                onClick={() => {
                  setActiveTab('settings');
                  setMenuOpen(false);
                }}
                className={`w-full flex items-center space-x-2 px-3 py-2.5 rounded-lg transition-colors ${
                  activeTab === 'settings'
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <Settings className="w-4 h-4" />
                <span className="text-sm font-medium">設定</span>
              </button>

              {/* 法的情報（折りたたみ） */}
              {(onNavigateToHelp || onNavigateToPrivacy || onNavigateToTerms || onNavigateToCommercial) && (
                <details className="group">
                  <summary className="w-full flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer list-none text-xs">
                    <ChevronDown className="w-3 h-3 transition-transform group-open:rotate-180" />
                    <span>ヘルプ・法的情報</span>
                  </summary>
                  <div className="pl-4 space-y-0.5">
                    {onNavigateToHelp && (
                      <button type="button" onClick={() => { setMenuOpen(false); onNavigateToHelp(); }}
                        className="w-full flex items-center space-x-2 px-3 py-1.5 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 text-xs">
                        <HelpCircle className="w-3 h-3" /><span>ヘルプ</span>
                      </button>
                    )}
                    {onNavigateToPrivacy && (
                      <button type="button" onClick={() => { setMenuOpen(false); onNavigateToPrivacy(); }}
                        className="w-full flex items-center space-x-2 px-3 py-1.5 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 text-xs">
                        <Shield className="w-3 h-3" /><span>プライバシーポリシー</span>
                      </button>
                    )}
                    {onNavigateToTerms && (
                      <button type="button" onClick={() => { setMenuOpen(false); onNavigateToTerms(); }}
                        className="w-full flex items-center space-x-2 px-3 py-1.5 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 text-xs">
                        <FileText className="w-3 h-3" /><span>利用規約</span>
                      </button>
                    )}
                    {onNavigateToCommercial && (
                      <button type="button" onClick={() => { setMenuOpen(false); onNavigateToCommercial(); }}
                        className="w-full flex items-center space-x-2 px-3 py-1.5 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 text-xs">
                        <Building2 className="w-3 h-3" /><span>特定商取引法に基づく表記</span>
                      </button>
                    )}
                  </div>
                </details>
              )}

              {onLogout && (
                <>
                  <div className="border-t border-gray-200 dark:border-gray-700 my-2"></div>
                  <button type="button"
                    onClick={async () => {
                      setMenuOpen(false);

                      // ✅ Sentry：ログアウト時にユーザー情報を外す
                      Sentry.setUser(null);

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
    </>
  );
}
