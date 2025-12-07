import React from 'react';
import { TrendingUp, Calendar, CheckCircle, AlertCircle } from 'lucide-react';

interface ACWRProgressIndicatorProps {
  daysWithData: number;
  isDarkMode: boolean;
}

export default function ACWRProgressIndicator({ daysWithData, isDarkMode }: ACWRProgressIndicatorProps) {
  const MINIMUM_DAYS = 21;
  const RECOMMENDED_DAYS = 28;

  const progress = Math.min((daysWithData / RECOMMENDED_DAYS) * 100, 100);
  const isMinimumReached = daysWithData >= MINIMUM_DAYS;
  const isRecommendedReached = daysWithData >= RECOMMENDED_DAYS;

  const getStatusConfig = () => {
    if (isRecommendedReached) {
      return {
        icon: CheckCircle,
        color: 'text-green-600 dark:text-green-400',
        bgColor: 'bg-green-50 dark:bg-green-900/20',
        borderColor: 'border-green-200 dark:border-green-800',
        progressColor: 'bg-green-500',
        title: 'ACWR分析：利用可能',
        message: '十分なデータが蓄積されました。精度の高いACWR分析が可能です。'
      };
    } else if (isMinimumReached) {
      return {
        icon: AlertCircle,
        color: 'text-yellow-600 dark:text-yellow-400',
        bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
        borderColor: 'border-yellow-200 dark:border-yellow-800',
        progressColor: 'bg-yellow-500',
        title: 'ACWR分析：利用可能（精度向上中）',
        message: `データが増えるほど精度が上がります。あと${RECOMMENDED_DAYS - daysWithData}日で推奨期間に到達します。`
      };
    } else {
      const week = Math.floor(daysWithData / 7) + 1;
      return {
        icon: Calendar,
        color: 'text-blue-600 dark:text-blue-400',
        bgColor: 'bg-blue-50 dark:bg-blue-900/20',
        borderColor: 'border-blue-200 dark:border-blue-800',
        progressColor: 'bg-blue-500',
        title: `データ収集中（${week}週目）`,
        message: `ACWR分析まであと${MINIMUM_DAYS - daysWithData}日。継続してトレーニングを記録しましょう！`
      };
    }
  };

  const config = getStatusConfig();
  const StatusIcon = config.icon;

  const getMilestones = () => [
    { day: 7, label: '1週目', reached: daysWithData >= 7 },
    { day: 14, label: '2週目', reached: daysWithData >= 14 },
    { day: 21, label: '3週目\n(最低ライン)', reached: daysWithData >= 21 },
    { day: 28, label: '4週目\n(推奨)', reached: daysWithData >= 28 }
  ];

  return (
    <div className={`rounded-lg border ${config.borderColor} ${config.bgColor} p-4 sm:p-6`}>
      <div className="flex items-start gap-3 mb-4">
        <StatusIcon className={`${config.color} flex-shrink-0 mt-0.5`} size={24} />
        <div className="flex-1 min-w-0">
          <h3 className={`font-semibold ${config.color} text-base sm:text-lg mb-1`}>
            {config.title}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {config.message}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-gray-700 dark:text-gray-300">
            記録日数: {daysWithData}日
          </span>
          <span className="text-gray-500 dark:text-gray-400">
            {Math.round(progress)}%
          </span>
        </div>

        <div className="relative h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`absolute inset-y-0 left-0 ${config.progressColor} rounded-full transition-all duration-500 ease-out`}
            style={{ width: `${progress}%` }}
          />

          {getMilestones().map((milestone) => {
            const position = (milestone.day / RECOMMENDED_DAYS) * 100;
            return (
              <div
                key={milestone.day}
                className="absolute top-0 bottom-0 w-0.5 bg-white dark:bg-gray-600"
                style={{ left: `${position}%` }}
              />
            );
          })}
        </div>

        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
          {getMilestones().map((milestone) => (
            <div
              key={milestone.day}
              className={`flex flex-col items-center ${
                milestone.reached ? 'text-gray-700 dark:text-gray-300 font-medium' : ''
              }`}
            >
              <span className="whitespace-pre-line text-center leading-tight">
                {milestone.label}
              </span>
              {milestone.reached && (
                <CheckCircle size={12} className="text-green-500 mt-0.5" />
              )}
            </div>
          ))}
        </div>
      </div>

      {!isRecommendedReached && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-start gap-2">
            <TrendingUp size={16} className="text-gray-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              ACWRは急性負荷（直近1週間）と慢性負荷（過去4週間）の比率です。
              継続的な記録で、より正確な怪我リスク評価が可能になります。
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
