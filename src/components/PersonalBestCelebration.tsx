import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Trophy, TrendingUp, Zap } from 'lucide-react';
import { formatCalculatedValue } from '../lib/performanceCalculations';

interface PersonalBestCelebrationProps {
  testName: string;
  value: number;
  unit: string;
  previousBest?: number;
  onClose: () => void;
}

export function PersonalBestCelebration({
  testName,
  value,
  unit,
  previousBest,
  onClose
}: PersonalBestCelebrationProps) {
  useEffect(() => {
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min;
    }

    const interval: any = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);

      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
      });
    }, 250);

    return () => clearInterval(interval);
  }, []);

  // 前回比（「小さいほど良い」種目もあるけど、ここは今の挙動を維持）
  const improvement = previousBest ? ((value - previousBest) / previousBest) * 100 : null;

  // ✅ 表示値はユーティリティに統一（秒=2桁、kg=1桁、RSI=そのまま等）
  const displayValue = formatCalculatedValue(testName, value);

  // ✅ improvement は%なので小数1桁でOK（好みで2桁も可）
  const displayImprovement = improvement !== null ? improvement.toFixed(1) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-gradient-to-br from-yellow-50 via-yellow-100 to-orange-100 dark:from-yellow-900/40 dark:via-yellow-800/40 dark:to-orange-900/40 rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 transform animate-scale-up border-4 border-yellow-400 dark:border-yellow-600">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full mb-6 animate-bounce-slow shadow-lg">
            <Trophy className="w-12 h-12 text-white" />
          </div>

          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 animate-fade-in">
            🎉 パーソナルベスト更新！
          </h2>

          <p className="text-lg text-gray-700 dark:text-gray-200 mb-6">
            {testName}
          </p>

          <div className="bg-white/80 dark:bg-gray-800/80 rounded-xl p-6 mb-6 shadow-inner">
            <div className="flex items-center justify-center space-x-3 mb-4">
              <Zap className="w-8 h-8 text-yellow-500 animate-pulse" />
              <div className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-600 to-orange-600 dark:from-yellow-400 dark:to-orange-400">
                {displayValue}
              </div>
              <span className="text-2xl text-gray-600 dark:text-gray-300">{unit}</span>
            </div>

            {displayImprovement !== null && (
              <div className="flex items-center justify-center space-x-2 text-green-600 dark:text-green-400">
                <TrendingUp className="w-5 h-5" />
                <span className="text-lg font-semibold">
                  前回比 +{displayImprovement}%
                </span>
              </div>
            )}
          </div>

          <div className="space-y-2 mb-6">
            <p className="text-gray-700 dark:text-gray-300 font-medium">
              素晴らしい成果です！
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              日々の努力が実を結びました。この調子で頑張りましょう！
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-bold py-3 px-6 rounded-lg transition-all transform hover:scale-105 shadow-lg"
            style={{
              WebkitTapHighlightColor: 'transparent',
              touchAction: 'manipulation'
            }}
          >
            続ける
          </button>
        </div>
      </div>

      <style>{`
        @keyframes scale-up {
          from {
            transform: scale(0.8);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }

        @keyframes bounce-slow {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-10px);
          }
        }

        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-scale-up {
          animation: scale-up 0.4s ease-out;
        }

        .animate-bounce-slow {
          animation: bounce-slow 2s infinite;
        }

        .animate-fade-in {
          animation: fade-in 0.6s ease-out;
        }
      `}</style>
    </div>
  );
}