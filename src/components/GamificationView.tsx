import React, { useState, useEffect } from 'react';
import { Trophy, Award, Users, Flame, HelpCircle } from 'lucide-react';
import { useStreaks } from '../hooks/useStreaks';
import { usePoints } from '../hooks/usePoints';
import { useBadges } from '../hooks/useBadges';
import { useRankings } from '../hooks/useRankings';
import { StreakDisplay } from './StreakDisplay';
import { LevelProgressCard } from './LevelProgressCard';
import { BadgeCollection } from './BadgeCollection';
import { BadgeEarnedModal } from './BadgeEarnedModal';
import { TeamRankings } from './TeamRankings';
import { LevelUpModal } from './LevelUpModal';
import { TutorialController } from './TutorialController';
import { getTutorialSteps } from '../lib/tutorialContent';

interface GamificationViewProps {
  userId: string;
  userTeamId: string | null;
}

export function GamificationView({ userId, userTeamId }: GamificationViewProps) {
  const { streaks, loading: streaksLoading, getStreakByType, getTotalStreak } = useStreaks(userId);
  const { userPoints, loading: pointsLoading, getLevelProgress } = usePoints(userId);
  const {
    allBadges,
    userBadges,
    loading: badgesLoading,
    getNewBadges,
    markBadgeAsViewed,
    getBadgeProgress
  } = useBadges(userId);
  const { weeklyRankings, pointsRankings, loading: rankingsLoading } = useRankings(userId, userTeamId);

  const [showBadgeCollection, setShowBadgeCollection] = useState(false);
  const [newBadgeToShow, setNewBadgeToShow] = useState<any>(null);
  const [levelUpData, setLevelUpData] = useState<{ level: number; rankTitle: string } | null>(null);
  const [previousLevel, setPreviousLevel] = useState<number | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);

  const loading = streaksLoading || pointsLoading || badgesLoading || rankingsLoading;

  const levelProgress = pointsLoading ? 0 : getLevelProgress();
  const newBadges = badgesLoading ? [] : getNewBadges();
  const badgeProgress = badgesLoading ? { earned: 0, total: 0, percentage: 0 } : getBadgeProgress();

  // レベルアップ判定
  useEffect(() => {
    if (userPoints && previousLevel !== null && userPoints.current_level > previousLevel) {
      setLevelUpData({
        level: userPoints.current_level,
        rankTitle: userPoints.rank_title
      });
    }
    if (userPoints) {
      setPreviousLevel(userPoints.current_level);
    }
  }, [userPoints?.current_level]);

  // 新しいバッジがあれば自動表示
  useEffect(() => {
    if (newBadges.length > 0 && !newBadgeToShow) {
      const badge = newBadges[0];
      if (badge.badge) {
        setNewBadgeToShow(badge.badge);
      }
    }
  }, [newBadges]);

  const handleBadgeModalClose = () => {
    if (newBadgeToShow && newBadges.length > 0) {
      const newBadge = newBadges.find((nb) => nb.badge?.id === newBadgeToShow.id);
      if (newBadge) {
        markBadgeAsViewed(newBadge.id);
      }
    }
    setNewBadgeToShow(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tutorial */}
      <TutorialController
        steps={getTutorialSteps('gamification')}
        isActive={showTutorial}
        onComplete={() => setShowTutorial(false)}
        onSkip={() => setShowTutorial(false)}
      />

      {/* Header with Tutorial Button */}
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

      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Total Streak */}
        <StreakDisplay
          streak={getTotalStreak()}
          label="総合ストリーク"
          icon={<Flame className="w-6 h-6" />}
        />

        {/* Level Card */}
        <LevelProgressCard
          userPoints={userPoints}
          levelProgress={levelProgress}
          showDetails={false}
        />

        {/* Badges Progress */}
        <button
          onClick={() => setShowBadgeCollection(true)}
          className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-all text-left"
          data-tutorial="badges-card"
        >
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">バッジコレクション</p>
              <div className="flex items-baseline space-x-2">
                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                  {badgeProgress.earned}
                </p>
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

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Streaks and Level */}
        <div className="space-y-6">
          <div data-tutorial="streaks-section">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center space-x-2">
              <Flame className="w-5 h-5 text-orange-500" />
              <span>あなたのストリーク</span>
            </h3>
            <div className="space-y-4">
              <StreakDisplay streak={getStreakByType('training')} label="練習記録" />
              <StreakDisplay streak={getStreakByType('weight')} label="体重記録" />
              <StreakDisplay streak={getStreakByType('sleep')} label="睡眠記録" />
              <StreakDisplay streak={getStreakByType('motivation')} label="モチベーション記録" />
            </div>
          </div>

          <div data-tutorial="level-section">
            <h3 className="text-lg font-semibold text-gray-900 dark:text:white mb-4 flex items-center space-x-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              <span>レベル進捗</span>
            </h3>
            <LevelProgressCard
              userPoints={userPoints}
              levelProgress={levelProgress}
              showDetails={true}
            />
          </div>
        </div>

        {/* Right Column - Rankings */}
        <div data-tutorial="rankings-section">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center space-x-2">
            <Users className="w-5 h-5 text-blue-500" />
            <span>チームランキング</span>
          </h3>
          <TeamRankings
            weeklyRankings={weeklyRankings}
            pointsRankings={pointsRankings}
            myUserId={userId}
          />
        </div>
      </div>

      {/* Badge Collection Modal */}
      {showBadgeCollection && (
        <BadgeCollection
          userBadges={userBadges}
          allBadges={allBadges}
          onClose={() => setShowBadgeCollection(false)}
        />
      )}

      {/* New Badge Earned Modal */}
      {newBadgeToShow && (
        <BadgeEarnedModal badge={newBadgeToShow} onClose={handleBadgeModalClose} />
      )}

      {/* Level Up Modal */}
      {levelUpData && (
        <LevelUpModal
          newLevel={levelUpData.level}
          rankTitle={levelUpData.rankTitle}
          onClose={() => setLevelUpData(null)}
        />
      )}
    </div>
  );
}