import React from 'react';
import { Trophy, TrendingUp, Star, Sparkles } from 'lucide-react';
import { UserPoints } from '../hooks/usePoints';

interface LevelProgressCardProps {
  userPoints: UserPoints | null;
  levelProgress: number;
  compact?: boolean;
  showDetails?: boolean;
}

export function LevelProgressCard({
  userPoints,
  levelProgress,
  compact = false,
  showDetails = true,
}: LevelProgressCardProps) {
  const getRankColor = () => {
    if (!userPoints) return 'text-gray-500';
    if (userPoints.current_level >= 50) return 'text-purple-600 dark:text-purple-400';
    if (userPoints.current_level >= 40) return 'text-red-600 dark:text-red-400';
    if (userPoints.current_level >= 30) return 'text-orange-600 dark:text-orange-400';
    if (userPoints.current_level >= 20) return 'text-yellow-600 dark:text-yellow-400';
    if (userPoints.current_level >= 10) return 'text-green-600 dark:text-green-400';
    return 'text-blue-600 dark:text-blue-400';
  };

  const getRankBgColor = () => {
    if (!userPoints) return 'bg-gray-50 dark:bg-gray-800';
    if (userPoints.current_level >= 50) return 'bg-purple-50 dark:bg-purple-900/20';
    if (userPoints.current_level >= 40) return 'bg-red-50 dark:bg-red-900/20';
    if (userPoints.current_level >= 30) return 'bg-orange-50 dark:bg-orange-900/20';
    if (userPoints.current_level >= 20) return 'bg-yellow-50 dark:bg-yellow-900/20';
    if (userPoints.current_level >= 10) return 'bg-green-50 dark:bg-green-900/20';
    return 'bg-blue-50 dark:bg-blue-900/20';
  };

  const getRankBorderColor = () => {
    if (!userPoints) return 'border-gray-200 dark:border-gray-700';
    if (userPoints.current_level >= 50) return 'border-purple-200 dark:border-purple-800';
    if (userPoints.current_level >= 40) return 'border-red-200 dark:border-red-800';
    if (userPoints.current_level >= 30) return 'border-orange-200 dark:border-orange-800';
    if (userPoints.current_level >= 20) return 'border-yellow-200 dark:border-yellow-800';
    if (userPoints.current_level >= 10) return 'border-green-200 dark:border-green-800';
    return 'border-blue-200 dark:border-blue-800';
  };

  const getProgressBarColor = () => {
    if (!userPoints) return 'bg-gray-400';
    if (userPoints.current_level >= 50) return 'bg-gradient-to-r from-purple-500 to-pink-500';
    if (userPoints.current_level >= 40) return 'bg-gradient-to-r from-red-500 to-orange-500';
    if (userPoints.current_level >= 30) return 'bg-gradient-to-r from-orange-500 to-yellow-500';
    if (userPoints.current_level >= 20) return 'bg-gradient-to-r from-yellow-500 to-green-500';
    if (userPoints.current_level >= 10) return 'bg-gradient-to-r from-green-500 to-blue-500';
    return 'bg-gradient-to-r from-blue-500 to-cyan-500';
  };

  const getRankIcon = () => {
    if (!userPoints) return <Star className="w-6 h-6" />;
    if (userPoints.current_level >= 50) return <Sparkles className="w-6 h-6" />;
    if (userPoints.current_level >= 30) return <Trophy className="w-6 h-6" />;
    return <Star className="w-6 h-6" />;
  };

  if (compact) {
    return (
      <div className={`inline-flex items-center space-x-3 px-4 py-2 rounded-xl border ${getRankBgColor()} ${getRankBorderColor()} transition-colors`}>
        <div className={getRankColor()}>{getRankIcon()}</div>
        <div>
          <p className="text-xs text-gray-600 dark:text-gray-400">Lv.{userPoints?.current_level || 1}</p>
          <p className={`text-sm font-bold ${getRankColor()}`}>{userPoints?.rank_title || 'ビギナー'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border ${getRankBgColor()} ${getRankBorderColor()} p-4 sm:p-6 transition-all hover:shadow-lg`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">あなたのランク</p>
          <div className="flex items-baseline space-x-2 mb-1">
            <h3 className={`text-2xl font-bold ${getRankColor()}`}>
              {userPoints?.rank_title || 'ビギナー'}
            </h3>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            レベル {userPoints?.current_level || 1}
          </p>
        </div>
        <div className={`p-3 rounded-xl ${getRankBgColor()} ${getRankColor()}`}>
          {getRankIcon()}
        </div>
      </div>

      {showDetails && (
        <>
          <div className="mb-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-gray-600 dark:text-gray-400">次のレベルまで</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {userPoints?.points_to_next_level || 100} pt
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${getProgressBarColor()}`}
                style={{ width: `${levelProgress}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-right">
              {Math.round(levelProgress)}%
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-white dark:bg-gray-700 rounded-lg">
                <Trophy className="w-4 h-4 text-yellow-500" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">総ポイント</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {userPoints?.total_points.toLocaleString() || 0}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-white dark:bg-gray-700 rounded-lg">
                <TrendingUp className="w-4 h-4 text-green-500" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">現在のレベル</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  Lv.{userPoints?.current_level || 1}
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
