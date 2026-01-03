// src/components/GamificationView.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Trophy, Award, Users, Flame, HelpCircle } from "lucide-react";

import { useStreaks } from "../hooks/useStreaks";
import { usePoints } from "../hooks/usePoints";
import { useBadges } from "../hooks/useBadges";
import { useRankings } from "../hooks/useRankings";
import { useRealtimeHub } from "../hooks/useRealtimeHub";

import { StreakDisplay } from "./StreakDisplay";
import { LevelProgressCard } from "./LevelProgressCard";
import { BadgeCollection } from "./BadgeCollection";
import { BadgeEarnedModal } from "./BadgeEarnedModal";
import { TeamRankings } from "./TeamRankings";
import { LevelUpModal } from "./LevelUpModal";
import { TutorialController } from "./TutorialController";
import { getTutorialSteps } from "../lib/tutorialContent";
import { ErrorBoundary } from "./ErrorBoundary";
import { PointHistoryModal } from "./PointHistoryModal";

interface GamificationViewProps {
  userId: string;
  userTeamId: string | null;
}

export function GamificationView({ userId, userTeamId }: GamificationViewProps) {
  // ✅ Hubの状態（visibility/onlineなど）を見るログ
  const { state } = useRealtimeHub();
  useEffect(() => {
    console.log("[RealtimeHub state]", state);
  }, [state]);

  // ✅ props確認ログ
  useEffect(() => {
    console.log("[Gamification] props", { userId, userTeamId });
  }, [userId, userTeamId]);

  // --- Hooks ---
  const { loading: streaksLoading, getStreakByType, getTotalStreak } = useStreaks(userId);

  // ✅ transactions を初回で取らない（通信削減の本命）
  const {
    userPoints,
    loading: pointsLoading,
    getLevelProgress,
    transactions,
    transactionsLoading,
    loadTransactions,
  } = usePoints(userId, {
    includeTransactions: false, // ✅ 初回0回（point_transactions）
    transactionsLimit: 50,
  });

  const {
    allBadges,
    userBadges,
    loading: badgesLoading,
    getNewBadges,
    markBadgeAsViewed,
    getBadgeProgress,
  } = useBadges(userId, {
    enabled: true,
    pollMs: 5 * 60 * 1000,
  });

  // --- Rankings lazy enable（ランキング領域が見えたらON）---
  const [rankingsEl, setRankingsEl] = useState<HTMLDivElement | null>(null);
  const [rankingsEnabled, setRankingsEnabled] = useState(false);
  const offTimerRef = useRef<number | null>(null);

  useEffect(() => {
    console.log("[Gamification] rankingsEl set?", !!rankingsEl);
  }, [rankingsEl]);

  useEffect(() => {
    if (!rankingsEl) return;

    console.log("[Gamification] IntersectionObserver setup");

    const obs = new IntersectionObserver(
      (entries) => {
        const inView = entries.some((e) => e.isIntersecting);
        console.log("[Gamification] rankings inView?", inView);

        if (inView) {
          console.log("[Gamification] ✅ rankingsEnabled -> true");
          setRankingsEnabled(true);
          obs.disconnect();

          if (offTimerRef.current) {
            window.clearTimeout(offTimerRef.current);
            offTimerRef.current = null;
          }
        }
      },
      { threshold: 0, rootMargin: "200px 0px" }
    );

    obs.observe(rankingsEl);

    return () => {
      obs.disconnect();
      if (offTimerRef.current) {
        window.clearTimeout(offTimerRef.current);
        offTimerRef.current = null;
      }
    };
  }, [rankingsEl]);

  useEffect(() => {
    console.log("[Gamification] rankingsEnabled:", rankingsEnabled);
  }, [rankingsEnabled]);

  // ✅ Ranking（view参照＝ポーリング前提）
  const { weeklyRankings, pointsRankings, loading: rankingsLoading, error: rankingsError } =
    useRankings(userTeamId, {
      enabled: rankingsEnabled && !!userTeamId,
      pollMs: 120000,
      pauseWhenHidden: true,
    });

  useEffect(() => {
    console.log("[Gamification] rankings state", {
      enabled: rankingsEnabled && !!userTeamId,
      userTeamId,
      rankingsLoading,
      weeklyLen: weeklyRankings?.length ?? 0,
      pointsLen: pointsRankings?.length ?? 0,
      rankingsError,
    });
  }, [rankingsEnabled, userTeamId, rankingsLoading, weeklyRankings, pointsRankings, rankingsError]);

  // --- UI State ---
  const [showBadgeCollection, setShowBadgeCollection] = useState(false);
  const [newBadgeToShow, setNewBadgeToShow] = useState<any>(null);
  const [levelUpData, setLevelUpData] = useState<{ level: number; rankTitle: string } | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);

  // ✅ ポイント履歴モーダル
  const [showPointHistory, setShowPointHistory] = useState(false);

  // ✅ 全体ローディング（rankings は画面全体のローディングには含めない）
  const loading = streaksLoading || pointsLoading || badgesLoading;

  const levelProgress = useMemo(() => {
    if (pointsLoading) return 0;
    try {
      return getLevelProgress();
    } catch (e) {
      console.warn("[GamificationView] getLevelProgress failed", e);
      return 0;
    }
  }, [pointsLoading, getLevelProgress]);

  const newBadges = useMemo(() => {
    if (badgesLoading) return [];
    try {
      return getNewBadges() ?? [];
    } catch (e) {
      console.warn("[GamificationView] getNewBadges failed", e);
      return [];
    }
  }, [badgesLoading, getNewBadges]);

  const badgeProgress = useMemo(() => {
    if (badgesLoading) return { earned: 0, total: 0, percentage: 0 };
    try {
      return getBadgeProgress() ?? { earned: 0, total: 0, percentage: 0 };
    } catch (e) {
      console.warn("[GamificationView] getBadgeProgress failed", e);
      return { earned: 0, total: 0, percentage: 0 };
    }
  }, [badgesLoading, getBadgeProgress]);

  // ---------------------------------------
  // ✅ レベルアップ検知（初回ログインは出さない / ページを開いた時点で上がってても出す）
  // ---------------------------------------
  const lastLevelRef = useRef<number | null>(null);

  const levelSeenKey = useMemo(() => {
    return `bekuta:last_seen_level:${userId || "unknown"}`;
  }, [userId]);

  const getStoredLevel = () => {
    try {
      const raw = localStorage.getItem(levelSeenKey);
      const n = raw == null ? NaN : Number(raw);
      return Number.isFinite(n) ? n : null;
    } catch {
      return null;
    }
  };

  const setStoredLevel = (lvl: number) => {
    try {
      localStorage.setItem(levelSeenKey, String(lvl));
    } catch {
      // Safariプライベート等でも落とさない
    }
  };

  useEffect(() => {
    const curLevel = userPoints?.current_level;
    if (curLevel == null) return;

    const stored = getStoredLevel();

    // ✅ 初回（保存だけ。初回ログインでモーダルは出さない）
    if (stored == null) {
      setStoredLevel(curLevel);
      lastLevelRef.current = curLevel;
      return;
    }

    // ✅ ページを開いた時点で既に上がっていた（stored より大きい）
    if (curLevel > stored) {
      setLevelUpData({
        level: curLevel,
        rankTitle: userPoints?.rank_title ?? "",
      });
      // 連続発火防止：出すと決めた時点で保存
      setStoredLevel(curLevel);
    }

    // ✅ 表示中に上がった（リアルタイム/再取得）
    if (lastLevelRef.current != null && curLevel > lastLevelRef.current) {
      setLevelUpData({
        level: curLevel,
        rankTitle: userPoints?.rank_title ?? "",
      });
      setStoredLevel(curLevel);
    }

    lastLevelRef.current = curLevel;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userPoints?.current_level, userPoints?.rank_title, levelSeenKey]);

  // ---------------------------------------
  // ✅ 新バッジ演出
  // ---------------------------------------
  useEffect(() => {
    try {
      if (newBadgeToShow) return;
      if (!newBadges || newBadges.length === 0) return;

      const badge = newBadges[0];
      if (badge?.badge) setNewBadgeToShow(badge.badge);
    } catch (e) {
      console.warn("[GamificationView] new badge effect failed", e);
    }
  }, [newBadges, newBadgeToShow]);

  const handleBadgeModalClose = async () => {
    try {
      if (newBadgeToShow && newBadges.length > 0) {
        const newBadge = newBadges.find((nb: any) => nb?.badge?.id === newBadgeToShow.id);
        if (newBadge) {
          await markBadgeAsViewed(newBadge.id);
        }
      }
    } catch (e) {
      console.warn("[GamificationView] markBadgeAsViewed failed", e);
    } finally {
      setNewBadgeToShow(null);
    }
  };

  // ✅ ポイント履歴：開いた時だけ取得（初回だけ通信）
  const openPointHistory = async () => {
    console.log("[Gamification] openPointHistory clicked");
    setShowPointHistory(true);

    const currentLen = (transactions ?? []).length;
    if (currentLen === 0) {
      console.log("[Gamification] loadTransactions start");
      await loadTransactions({ silent: false } as any);
      console.log("[Gamification] loadTransactions done");
    } else {
      console.log("[Gamification] transactions already loaded (skip fetch)");
    }
  };

  const reloadPointHistory = async () => {
    console.log("[Gamification] reloadPointHistory");
    await loadTransactions({ silent: false } as any);
  };

  return (
    <ErrorBoundary
      title="ゲーミフィケーションの表示に失敗しました"
      description="この画面だけ復旧できます。再表示を試してください。"
    >
      {loading ? (
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
      ) : (
        <div className="space-y-6">
          <ErrorBoundary compact title="チュートリアルの表示でエラー">
            <TutorialController
              steps={getTutorialSteps("gamification")}
              isActive={showTutorial}
              onComplete={() => setShowTutorial(false)}
              onSkip={() => setShowTutorial(false)}
            />
          </ErrorBoundary>

          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">ゲーミフィケーション</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                楽しみながら継続的な記録を！ストリークとバッジで成長を可視化
              </p>
            </div>
            <button
              onClick={() => setShowTutorial(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              title="チュートリアルを表示"
            >
              <HelpCircle className="w-5 h-5" />
              <span className="hidden sm:inline">チュートリアル</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <ErrorBoundary compact title="ストリーク表示でエラー">
              <StreakDisplay
                streak={getTotalStreak()}
                label="総合ストリーク"
                icon={<Flame className="w-6 h-6" />}
              />
            </ErrorBoundary>

            <ErrorBoundary compact title="レベル表示でエラー">
              <div className="space-y-3">
                <LevelProgressCard userPoints={userPoints} levelProgress={levelProgress} showDetails={false} />
              </div>
            </ErrorBoundary>

            <button
              onClick={() => setShowBadgeCollection(true)}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-all text-left"
              data-tutorial="badges-card"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">バッジコレクション</p>
                  <div className="flex items-baseline space-x-2">
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">{badgeProgress.earned}</p>
                    <span className="text-sm text-gray-600 dark:text-gray-400">/ {badgeProgress.total}</span>
                  </div>
                </div>
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                  <Award className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                </div>
              </div>

              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full transition-all duration-500"
                  style={{ width: `${badgeProgress.percentage}%` }}
                />
              </div>

              {newBadges.length > 0 && (
                <div className="mt-2 flex items-center space-x-1 text-xs text-red-600 dark:text-red-400 font-semibold animate-pulse">
                  <span>新しいバッジ: {newBadges.length}個</span>
                </div>
              )}
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-6">
              <div data-tutorial="streaks-section">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center space-x-2">
                  <Flame className="w-5 h-5 text-orange-500" />
                  <span>あなたのストリーク</span>
                </h3>

                <ErrorBoundary compact title="ストリーク詳細でエラー">
                  <div className="space-y-4">
                    <StreakDisplay streak={getStreakByType("training")} label="練習記録" />
                    <StreakDisplay streak={getStreakByType("weight")} label="体重記録" />
                    <StreakDisplay streak={getStreakByType("sleep")} label="睡眠記録" />
                    <StreakDisplay streak={getStreakByType("motivation")} label="モチベーション記録" />
                  </div>
                </ErrorBoundary>
              </div>

              <div data-tutorial="level-section">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center space-x-2">
                  <Trophy className="w-5 h-5 text-yellow-500" />
                  <span>レベル進捗</span>
                </h3>

                <ErrorBoundary compact title="レベル進捗の表示でエラー">
                  <LevelProgressCard
                    userPoints={userPoints}
                    levelProgress={levelProgress}
                    showDetails={true}
                    actions={
                      <button
                        onClick={openPointHistory}
                        className="w-full sm:w-auto px-3 py-2 rounded-lg text-sm
                                   bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700
                                   hover:bg-gray-50 dark:hover:bg-gray-700
                                   text-gray-900 dark:text-white transition-colors"
                        title="ポイント履歴を表示"
                      >
                        ポイント履歴
                      </button>
                    }
                  />
                </ErrorBoundary>
              </div>
            </div>

            <div ref={setRankingsEl} data-tutorial="rankings-section">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center space-x-2">
                <Users className="w-5 h-5 text-blue-500" />
                <span>チームランキング</span>
              </h3>

              <ErrorBoundary compact title="ランキング表示でエラー">
                {!rankingsEnabled ? (
                  <div className="text-sm text-gray-500 dark:text-gray-400 h-24 flex items-center">
                    ランキングを読み込みます…
                  </div>
                ) : rankingsLoading ? (
                  <div className="flex items-center justify-center h-24">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                  </div>
                ) : (
                  <TeamRankings
                    weeklyRankings={weeklyRankings}
                    pointsRankings={pointsRankings}
                    myUserId={userId}
                  />
                )}
              </ErrorBoundary>

              {rankingsError && (
                <div className="mt-2 text-xs text-red-600 dark:text-red-400">
                  rankingsError: {rankingsError}
                </div>
              )}
            </div>
          </div>

          {showBadgeCollection && (
            <ErrorBoundary title="バッジ一覧の表示でエラー">
              <BadgeCollection
                userBadges={userBadges}
                allBadges={allBadges}
                onClose={() => setShowBadgeCollection(false)}
              />
            </ErrorBoundary>
          )}

          {newBadgeToShow && (
            <ErrorBoundary title="バッジ獲得モーダルの表示でエラー">
              <BadgeEarnedModal badge={newBadgeToShow} onClose={handleBadgeModalClose} />
            </ErrorBoundary>
          )}

          {levelUpData && (
            <ErrorBoundary title="レベルアップ演出の表示でエラー">
              <LevelUpModal
                newLevel={levelUpData.level}
                rankTitle={levelUpData.rankTitle}
                onClose={() => setLevelUpData(null)}
              />
            </ErrorBoundary>
          )}

          {/* ✅ ポイント履歴モーダル */}
          <PointHistoryModal
            open={showPointHistory}
            onClose={() => setShowPointHistory(false)}
            transactions={(transactions ?? []) as any}
            loading={transactionsLoading}
            onReload={reloadPointHistory}
          />
        </div>
      )}
    </ErrorBoundary>
  );
}