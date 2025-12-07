import React, { useState } from 'react';
import { X, Lock, Sparkles, Award, Flame, Star, Trophy, Shield, Database, Heart, Sunrise, Zap } from 'lucide-react';
import { Badge, UserBadge } from '../hooks/useBadges';

interface BadgeCollectionProps {
  userBadges: UserBadge[];
  allBadges: Badge[];
  onClose?: () => void;
  onBadgeClick?: (badge: UserBadge | Badge) => void;
}

const ICON_MAP: { [key: string]: React.ComponentType<any> } = {
  Sparkles,
  Award,
  Flame,
  Star,
  Trophy,
  Shield,
  Database,
  Heart,
  Sunrise,
  Zap,
};

export function BadgeCollection({ userBadges, allBadges, onClose, onBadgeClick }: BadgeCollectionProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = [
    { id: 'all', label: 'すべて' },
    { id: 'streak', label: 'ストリーク' },
    { id: 'performance', label: 'パフォーマンス' },
    { id: 'consistency', label: '継続' },
    { id: 'milestone', label: 'マイルストーン' },
    { id: 'special', label: 'スペシャル' },
    { id: 'team', label: 'チーム' },
  ];

  const earnedBadgeIds = new Set(userBadges.map((ub) => ub.badge_id));

  const filteredBadges = allBadges.filter(
    (badge) =>
      !badge.is_hidden &&
      (selectedCategory === 'all' || badge.category === selectedCategory)
  );

  const getRarityColor = (rarity: Badge['rarity']) => {
    switch (rarity) {
      case 'legendary':
        return 'from-purple-500 to-pink-500';
      case 'epic':
        return 'from-orange-500 to-red-500';
      case 'rare':
        return 'from-blue-500 to-cyan-500';
      default:
        return 'from-gray-400 to-gray-500';
    }
  };

  const getRarityBorderColor = (rarity: Badge['rarity']) => {
    switch (rarity) {
      case 'legendary':
        return 'border-purple-300 dark:border-purple-700';
      case 'epic':
        return 'border-orange-300 dark:border-orange-700';
      case 'rare':
        return 'border-blue-300 dark:border-blue-700';
      default:
        return 'border-gray-300 dark:border-gray-600';
    }
  };

  const getRarityLabel = (rarity: Badge['rarity']) => {
    switch (rarity) {
      case 'legendary':
        return 'レジェンダリー';
      case 'epic':
        return 'エピック';
      case 'rare':
        return 'レア';
      default:
        return 'コモン';
    }
  };

  const getIconComponent = (iconName: string) => {
    const IconComponent = ICON_MAP[iconName] || Star;
    return IconComponent;
  };

  const earnedCount = filteredBadges.filter((b) => earnedBadgeIds.has(b.id)).length;
  const totalCount = filteredBadges.length;
  const progress = totalCount > 0 ? (earnedCount / totalCount) * 100 : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">バッジコレクション</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              獲得: {earnedCount} / {totalCount} ({Math.round(progress)}%)
            </p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-6 h-6 text-gray-600 dark:text-gray-400" />
            </button>
          )}
        </div>

        {/* Progress Bar */}
        <div className="px-6 pt-4">
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Category Filter */}
        <div className="px-6 py-4 overflow-x-auto">
          <div className="flex space-x-2">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  selectedCategory === cat.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Badge Grid */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {filteredBadges.map((badge) => {
              const isEarned = earnedBadgeIds.has(badge.id);
              const userBadge = userBadges.find((ub) => ub.badge_id === badge.id);
              const IconComponent = getIconComponent(badge.icon);

              return (
                <div
                  key={badge.id}
                  onClick={() => onBadgeClick && onBadgeClick(userBadge || badge)}
                  className={`relative p-4 rounded-xl border-2 transition-all cursor-pointer ${
                    isEarned
                      ? `${getRarityBorderColor(badge.rarity)} bg-white dark:bg-gray-700 hover:shadow-lg transform hover:scale-105`
                      : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 opacity-60 hover:opacity-80'
                  }`}
                >
                  {/* Rarity Indicator */}
                  {isEarned && badge.rarity !== 'common' && (
                    <div className="absolute top-2 right-2">
                      <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${getRarityColor(badge.rarity)}`} />
                    </div>
                  )}

                  {/* New Badge Indicator */}
                  {userBadge?.is_new && (
                    <div className="absolute -top-2 -right-2">
                      <div className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
                        NEW
                      </div>
                    </div>
                  )}

                  {/* Icon */}
                  <div className="flex justify-center mb-3">
                    <div
                      className={`p-4 rounded-full ${
                        isEarned
                          ? `bg-gradient-to-br ${getRarityColor(badge.rarity)} text-white`
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-400'
                      }`}
                    >
                      {isEarned ? (
                        <IconComponent className="w-8 h-8" />
                      ) : (
                        <Lock className="w-8 h-8" />
                      )}
                    </div>
                  </div>

                  {/* Badge Info */}
                  <div className="text-center">
                    <h3 className={`text-sm font-bold mb-1 ${isEarned ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                      {badge.name}
                    </h3>
                    <p className={`text-xs ${isEarned ? 'text-gray-600 dark:text-gray-400' : 'text-gray-400 dark:text-gray-500'}`}>
                      {badge.description}
                    </p>
                    {isEarned && (
                      <div className="mt-2 flex items-center justify-center space-x-1 text-xs text-gray-500 dark:text-gray-400">
                        <Trophy className="w-3 h-3" />
                        <span>+{badge.points_reward}pt</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {filteredBadges.length === 0 && (
            <div className="text-center py-12">
              <Lock className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400">このカテゴリーにはバッジがありません</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
