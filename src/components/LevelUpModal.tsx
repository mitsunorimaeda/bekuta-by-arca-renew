import React, { useEffect, useState } from 'react';
import { X, Trophy, Star, Sparkles, TrendingUp } from 'lucide-react';
import confetti from 'canvas-confetti';

interface LevelUpModalProps {
  newLevel: number;
  rankTitle: string;
  onClose: () => void;
}

export function LevelUpModal({ newLevel, rankTitle, onClose }: LevelUpModalProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);

    const duration = 4000;
    const end = Date.now() + duration;

    (function frame() {
      confetti({
        particleCount: 2,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#FFD700', '#FFA500', '#FF6347'],
      });
      confetti({
        particleCount: 2,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#FFD700', '#FFA500', '#FF6347'],
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    })();
  }, []);

  const getRankColor = () => {
    if (newLevel >= 50) return 'from-purple-600 via-pink-600 to-purple-600';
    if (newLevel >= 40) return 'from-red-600 via-orange-600 to-red-600';
    if (newLevel >= 30) return 'from-orange-600 via-yellow-600 to-orange-600';
    if (newLevel >= 20) return 'from-yellow-600 via-green-600 to-yellow-600';
    if (newLevel >= 10) return 'from-green-600 via-blue-600 to-green-600';
    return 'from-blue-600 via-cyan-600 to-blue-600';
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black bg-opacity-70 backdrop-blur-sm">
      <div
        className={`bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden transition-all duration-500 transform ${
          isVisible ? 'scale-100 opacity-100' : 'scale-90 opacity-0'
        }`}
      >
        {/* Header with animated gradient */}
        <div className={`relative p-8 bg-gradient-to-r ${getRankColor()} text-white overflow-hidden`}>
          <div className="absolute inset-0 bg-black opacity-10" />

          {/* Animated background elements */}
          <div className="absolute inset-0 overflow-hidden">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="absolute animate-pulse"
                style={{
                  top: `${Math.random() * 100}%`,
                  left: `${Math.random() * 100}%`,
                  animationDelay: `${i * 0.3}s`,
                  animationDuration: '2s',
                }}
              >
                <Star className="w-4 h-4 text-white opacity-30" />
              </div>
            ))}
          </div>

          <div className="relative z-10">
            <button
              onClick={onClose}
              className="absolute top-0 right-0 p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center">
              {/* Animated Icon */}
              <div className="inline-flex items-center justify-center mb-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-white opacity-20 rounded-full animate-ping" style={{ animationDuration: '1.5s' }} />
                  <div className="absolute inset-0 bg-white opacity-20 rounded-full animate-ping" style={{ animationDelay: '0.5s', animationDuration: '1.5s' }} />
                  <div className="relative bg-white bg-opacity-20 backdrop-blur-sm p-6 rounded-full">
                    <Trophy className="w-16 h-16 animate-bounce" style={{ animationDuration: '1s' }} />
                  </div>
                </div>
              </div>

              <h2 className="text-4xl font-bold mb-2 animate-pulse">LEVEL UP!</h2>
              <p className="text-white text-opacity-90 text-lg">レベルアップしました！</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          {/* New Level Display */}
          <div className="text-center mb-6">
            <div className="flex items-center justify-center space-x-4 mb-4">
              <div className="flex items-center space-x-2">
                <span className="text-4xl font-bold text-gray-400 dark:text-gray-500">
                  Lv.{newLevel - 1}
                </span>
              </div>
              <TrendingUp className="w-6 h-6 text-gray-400" />
              <div className="flex items-center space-x-2">
                <span className={`text-4xl font-bold bg-gradient-to-r ${getRankColor()} bg-clip-text text-transparent`}>
                  Lv.{newLevel}
                </span>
                <Sparkles className={`w-6 h-6 text-yellow-500 animate-pulse`} />
              </div>
            </div>

            <div className="mb-4">
              <div className="inline-block">
                <span className={`px-4 py-2 rounded-full text-lg font-bold bg-gradient-to-r ${getRankColor()} text-white shadow-lg`}>
                  {rankTitle}
                </span>
              </div>
            </div>

            <p className="text-gray-600 dark:text-gray-400 mb-4">
              おめでとうございます！新しいランクに到達しました
            </p>

            {/* Level Benefits */}
            <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
              <p className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                レベル{newLevel}特典
              </p>
              <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                <p>• より多くのポイント獲得ボーナス</p>
                <p>• 新しいバッジ獲得チャンス</p>
                <p>• チーム内でのステータス向上</p>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className={`w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r ${getRankColor()} hover:shadow-lg transform hover:scale-105 transition-all`}
          >
            さらに成長する！
          </button>
        </div>
      </div>
    </div>
  );
}
