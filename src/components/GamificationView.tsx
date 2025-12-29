import React, { useEffect, useMemo, useState } from "react";
import { Trophy, Award, Users, Flame, HelpCircle } from "lucide-react";
import { useStreaks } from "../hooks/useStreaks";
import { usePoints } from "../hooks/usePoints";
import { useBadges } from "../hooks/useBadges";
import { useRankings } from "../hooks/useRankings";
import { StreakDisplay } from "./StreakDisplay";
import { LevelProgressCard } from "./LevelProgressCard";
import { BadgeCollection } from "./BadgeCollection";
import { BadgeEarnedModal } from "./BadgeEarnedModal";
import { TeamRankings } from "./TeamRankings";
import { LevelUpModal } from "./LevelUpModal";
import { TutorialController } from "./TutorialController";
import { getTutorialSteps } from "../lib/tutorialContent";
import { ErrorBoundary } from "./ErrorBoundary";

interface GamificationViewProps {
  userId: string;
  userTeamId: string | null;
}

export function GamificationView({ userId, userTeamId }: GamificationViewProps) {
  // --- Hooks（ここが壊れても ErrorBoundary が全体を救う） ---
  const { streaks, loading: streaksLoading, getStreakByType, getTotalStreak } =
    useStreaks(userId);

  const { userPoints, loading: pointsLoading, getLevelProgress } = usePoints(userId);

  const {
    allBadges,
    userBadges,
    loading: badgesLoading,
    getNewBadges,
    markBadgeAsViewed,
    getBadgeProgress,
  } = useBadges(userId);

  const { weeklyRankings, pointsRankings, loading: rankingsLoading } =
    useRankings(userId, userTeamId);

  // --- UI State ---
  const [showBadgeCollection, setShowBadgeCollection] = useState(false);
  const [newBadgeToShow, setNewBadgeToShow] = useState<any>(null);
  const [levelUpData, setLevelUpData] = useState<{ level: number; rankTitle: string } | null>(
    null
  );
  const [previousLevel, setPreviousLevel] = useState<number | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);

  const loading = streaksLoading || pointsLoading || badgesLoading || rankingsLoading;

  // derived（毎renderで安全に）
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

  // レベルアップ判定（安全）
  useEffect(() => {
    try {
      if (!userPoints) return;

      if (previousLevel !== null && userPoints.current_level > previousLevel) {
        setLevelUpData({
          level: userPoints.current_level,
          rankTitle: userPoints.rank_title,
        });
      }
      setPreviousLevel(userPoints.current_level);
    } catch (e) {
      console.warn("[GamificationView] level up effect failed", e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userPoints?.current_level]);

  // 新しいバッジがあれば自動表示（暴れにくくする）
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

  // ✅ 画面まるごと保護：これで「白画面」は原理的に起きにくい
  return (
    <ErrorBoundary
      title="ゲーミフィケーションの表示に失敗しました"
      description="この画面だけ復旧できます。再表示を試してください。"
    >
      {loading ? (
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Tutorial（落ちてもこのセクションだけ） */}
          <ErrorBoundary compact title="チュートリアルの表示でエラー">
            <TutorialController
              steps={getTutorialSteps("gamification")}
              isActive={showTutorial}
              onComplete={() => setShowTutorial(false)}
              onSkip={() => setShowTutorial(false)}
            />
          </ErrorBoundary>

          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                ゲーミフィケーション
              </h2>
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

          {/* Header Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <ErrorBoundary compact title="ストリーク表示でエラー">
              <StreakDisplay
                streak={getTotalStreak()}
                label="総合ストリーク"
                icon={<Flame className="w-6 h-6" />}
              />
            </ErrorBoundary>

            <ErrorBoundary compact title="レベル表示でエラー">
              <LevelProgressCard userPoints={userPoints} levelProgress={levelProgress} showDetails={false} />
            </ErrorBoundary>

            {/* Badges Progress */}
            <button
              onClick={() => setShowBadgeCollection(true)}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-all text-left"
              data-tutorial="badges-card"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                    バッジコレクション
                  </p>
                  <div className="flex items-baseline space-x-2">
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">
                      {badgeProgress.earned}
                    </p>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      / {badgeProgress.total}
                    </span>
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

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column */}
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
                  />
                </ErrorBoundary>
              </div>
            </div>

            {/* Right Column - Rankings（ここで落ちることが多いので隔離が効く） */}
            <div data-tutorial="rankings-section">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center space-x-2">
                <Users className="w-5 h-5 text-blue-500" />
                <span>チームランキング</span>
              </h3>

              <ErrorBoundary compact title="ランキング表示でエラー">
                <TeamRankings
                  weeklyRankings={weeklyRankings}
                  pointsRankings={pointsRankings}
                  myUserId={userId}
                />
              </ErrorBoundary>
            </div>
          </div>

          {/* Modals（落ちやすいので必ず隔離） */}
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
        </div>
      )}
    </ErrorBoundary>
  );
}