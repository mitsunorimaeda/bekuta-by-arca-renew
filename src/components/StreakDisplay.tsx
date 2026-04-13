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

  const getDaysDiffFromToday = () => {
    if (!streak?.last_recorded_date) return null;
    // YYYY-MM-DD文字列をTZ非依存で比較
    const [ly, lm, ld] = streak.last_recorded_date.split('-').map(Number);
    const lastDateNum = ly * 10000 + lm * 100 + ld;
    const now = new Date();
    // JSTで今日の日付を取得
    const jstOffset = 9 * 60;
    const jstNow = new Date(now.getTime() + (jstOffset - now.getTimezoneOffset()) * 60000);
    const todayNum = jstNow.getFullYear() * 10000 + (jstNow.getMonth() + 1) * 100 + jstNow.getDate();
    return todayNum - lastDateNum;
  };

  const isAtRisk = () => {
    const diff = getDaysDiffFromToday();
    return diff !== null && diff >= 1;
  };

  const isFreezeProtected = () => {
    const diff = getDaysDiffFromToday();
    return diff === 1 && (streak?.streak_freeze_count ?? 0) > 0;
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
        <div className="flex flex-col items-end gap-2">
          <div className={`p-3 rounded-lg ${getStreakBgColor()}`}>
            {icon || <Flame className={`w-6 h-6 ${getStreakColor()}`} />}
          </div>
          {(streak?.streak_freeze_count ?? 0) > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-700 text-xs font-semibold text-blue-700 dark:text-blue-300">
              🧊 ×{streak!.streak_freeze_count}
            </span>
          )}
        </div>
      </div>

      {isAtRisk() && (
        <div className={`flex items-center space-x-2 mb-3 p-2 border rounded-lg ${
          isFreezeProtected()
            ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
        }`}>
          <AlertCircle className={`w-4 h-4 flex-shrink-0 ${isFreezeProtected() ? 'text-blue-500' : 'text-red-500'}`} />
          {isFreezeProtected() ? (
            <p className="text-xs text-blue-700 dark:text-blue-300">
              🧊 ストリークフリーズ残り{streak!.streak_freeze_count}回 — 今日記録しなくても1回スキップできます
            </p>
          ) : (
            <p className="text-xs text-red-600 dark:text-red-400">今日記録しないとストリークが途切れます！</p>
          )}
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
