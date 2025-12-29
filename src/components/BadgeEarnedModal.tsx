import React, { useEffect } from 'react';
import confettiImport from 'canvas-confetti';
import { Award, Star, X } from 'lucide-react';
import type { Badge } from '../lib/gamification';

interface BadgeEarnedModalProps {
  badge: Badge;
  onClose: () => void;
}

const confetti = ((confettiImport as unknown as { default?: any })?.default ?? confettiImport) as any;

export function BadgeEarnedModal({ badge, onClose }: BadgeEarnedModalProps) {
  useEffect(() => {
    // confetti 互換対策（本番で default import が崩れることがある）
    if (typeof confetti === 'function') {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
    }
  }, []);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-md w-full shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="text-center">
          <div className="w-20 h-20 bg-yellow-100 dark:bg-yellow-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Award className="w-10 h-10 text-yellow-600 dark:text-yellow-400" />
          </div>

          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            新しいバッジ獲得！
          </h2>

          <div className="flex items-center justify-center space-x-2 mb-4">
            <Star className="w-5 h-5 text-yellow-500" />
            <span className="text-xl font-semibold text-gray-800 dark:text-gray-200">
              {badge.name}
            </span>
            <Star className="w-5 h-5 text-yellow-500" />
          </div>

          <p className="text-gray-600 dark:text-gray-400 mb-8">
            {badge.description}
          </p>

          <button
            onClick={onClose}
            className="bg-yellow-600 hover:bg-yellow-700 text-white font-semibold py-3 px-8 rounded-xl transition-colors"
          >
            やった！
          </button>
        </div>
      </div>
    </div>
  );
}