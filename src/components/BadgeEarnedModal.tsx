import React, { useEffect, useState } from 'react';
import { X, Sparkles, Award, Flame, Star, Trophy, Shield, Database, Heart, Sunrise, Zap } from 'lucide-react';
import confetti from 'canvas-confetti';
import { Badge } from '../hooks/useBadges';

interface BadgeEarnedModalProps {
  badge: Badge;
  onClose: () => void;
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

export function BadgeEarnedModal({ badge, onClose }: BadgeEarnedModalProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);

    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100 };

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min;
    }

    const interval: any = setInterval(function () {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);

      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
      });
    }, 250);

    return () => clearInterval(interval);
  }, []);

  const getRarityColor = (rarity: Badge['rarity']) => {
    switch (rarity) {
      case 'legendary':
        return 'from-purple-500 via-pink-500 to-purple-500';
      case 'epic':
        return 'from-orange-500 via-red-500 to-orange-500';
      case 'rare':
        return 'from-blue-500 via-cyan-500 to-blue-500';
      default:
        return 'from-gray-400 via-gray-500 to-gray-400';
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

  const IconComponent = getIconComponent(badge.icon);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black bg-opacity-70 backdrop-blur-sm">
      <div
        className={`bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden transition-all duration-500 transform ${
          isVisible ? 'scale-100 opacity-100' : 'scale-90 opacity-0'
        }`}
      >
        {/* Header with gradient */}
        <div className={`relative p-8 bg-gradient-to-br ${getRarityColor(badge.rarity)} text-white overflow-hidden`}>
          <div className="absolute inset-0 bg-black opacity-10" />
          <div className="relative z-10">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center">
              <div className="inline-flex items-center justify-center mb-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-white opacity-20 rounded-full animate-ping" />
                  <div className="relative bg-white bg-opacity-20 backdrop-blur-sm p-6 rounded-full">
                    <IconComponent className="w-16 h-16" />
                  </div>
                </div>
              </div>

              <h2 className="text-3xl font-bold mb-2">バッジ獲得！</h2>
              <p className="text-white text-opacity-90 text-sm">
                おめでとうございます！新しいバッジを獲得しました
              </p>
            </div>
          </div>

          {/* Animated sparkles */}
          <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="absolute animate-pulse"
                style={{
                  top: `${Math.random() * 100}%`,
                  left: `${Math.random() * 100}%`,
                  animationDelay: `${i * 0.2}s`,
                }}
              >
                <Sparkles className="w-4 h-4 text-white opacity-50" />
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          <div className="text-center mb-6">
            <div className="inline-block mb-3">
              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r ${getRarityColor(badge.rarity)} text-white`}
              >
                {getRarityLabel(badge.rarity)}
              </span>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{badge.name}</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">{badge.description}</p>

            <div className="flex items-center justify-center space-x-2 text-yellow-600 dark:text-yellow-400">
              <Trophy className="w-5 h-5" />
              <span className="text-lg font-bold">+{badge.points_reward} ポイント獲得</span>
            </div>
          </div>

          <button
            onClick={onClose}
            className={`w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r ${getRarityColor(badge.rarity)} hover:shadow-lg transform hover:scale-105 transition-all`}
          >
            素晴らしい！
          </button>
        </div>
      </div>
    </div>
  );
}
