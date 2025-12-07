import React from 'react';
import { Flame, TrendingUp, Award, AlertCircle } from 'lucide-react';
import { Streak } from '../hooks/useStreaks';

interface StreakDisplayProps {
  streak: Streak | null;
  label: string;
  icon?: React.ReactNode;
  compact?: boolean;
}

export function StreakDisplay({ streak, label, icon, compact = false }: StreakDisplayProps) {
  const getStreakColor = () => {
    if (!streak || streak.current_streak === 0) return 'text-gray-400';
    if (streak.current_streak >= 30) return 'text-orange-500';
    if (streak.current_streak >= 7) return 'text-yellow-500';
    return 'text-blue-500';
  };

  const getStreakBgColor = () => {
    if (!streak || streak.current_streak === 0) return 'bg-gray-50 dark:bg-gray-800';
    if (streak.current_streak >= 30) return 'bg-orange-50 dark:bg-orange-900/20';
    if (streak.current_streak >= 7) return 'bg-yellow-50 dark:bg-yellow-900/20';
    return 'bg-blue-50 dark:bg-blue-900/20';
  };

  const getStreakBorderColor = () => {
    if (!streak || streak.current_streak === 0) return 'border-gray-200 dark:border-gray-700';
    if (streak.current_streak >= 30) return 'border-orange-200 dark:border-orange-800';
    if (streak.current_streak >= 7) return 'border-yellow-200 dark:border-yellow-800';
    return 'border-blue-200 dark:border-blue-800';
  };

  const isAtRisk = () => {
    if (!streak || !streak.last_recorded_date) return false;
    const lastDate = new Date(streak.last_recorded_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    lastDate.setHours(0, 0, 0, 0);
    const daysDiff = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
    return daysDiff >= 1;
  };

  if (compact) {
    return (
      <div className={`inline-flex items-center space-x-2 px-3 py-1.5 rounded-full border ${getStreakBgColor()} ${getStreakBorderColor()} transition-colors`}>
        {icon || <Flame className={`w-4 h-4 ${getStreakColor()}`} />}
        <span className={`text-sm font-semibold ${getStreakColor()}`}>
          {streak?.current_streak || 0}日
        </span>
        {isAtRisk() && <AlertCircle className="w-3 h-3 text-red-500" />}
      </div>
    );
  }

  return (
    <div className={`rounded-xl border ${getStreakBgColor()} ${getStreakBorderColor()} p-4 sm:p-6 transition-all hover:shadow-md`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">{label}</p>
          <div className="flex items-baseline space-x-2">
            <p className={`text-3xl font-bold ${getStreakColor()}`}>
              {streak?.current_streak || 0}
            </p>
            <span className="text-sm text-gray-600 dark:text-gray-400">日連続</span>
          </div>
        </div>
        <div className={`p-3 rounded-lg ${getStreakBgColor()}`}>
          {icon || <Flame className={`w-6 h-6 ${getStreakColor()}`} />}
        </div>
      </div>

      {isAtRisk() && (
        <div className="flex items-center space-x-2 mb-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <p className="text-xs text-red-600 dark:text-red-400">今日記録しないとストリークが途切れます！</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-2">
          <Award className="w-4 h-4 text-gray-400" />
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">最長記録</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {streak?.longest_streak || 0}日
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <TrendingUp className="w-4 h-4 text-gray-400" />
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">累計記録</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {streak?.total_records || 0}回
            </p>
          </div>
        </div>
      </div>

      {streak && streak.current_streak > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500 dark:text-gray-400">次のマイルストーン</span>
            <span className="font-semibold text-gray-900 dark:text-white">
              {streak.current_streak < 7 ? '7日' : streak.current_streak < 30 ? '30日' : '100日'}連続
            </span>
          </div>
          <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                streak.current_streak >= 30 ? 'bg-orange-500' : streak.current_streak >= 7 ? 'bg-yellow-500' : 'bg-blue-500'
              }`}
              style={{
                width: `${
                  streak.current_streak < 7
                    ? (streak.current_streak / 7) * 100
                    : streak.current_streak < 30
                    ? ((streak.current_streak - 7) / 23) * 100
                    : ((streak.current_streak - 30) / 70) * 100
                }%`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
