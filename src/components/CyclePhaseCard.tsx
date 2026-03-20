import React from 'react';
import { AlertTriangle, TrendingUp, Calendar } from 'lucide-react';
import {
  type CyclePhaseInfo,
  type CyclePrediction,
  getPhaseColor,
} from '../lib/cyclePhaseUtils';

interface CyclePhaseCardProps {
  phaseInfo: CyclePhaseInfo | null;
  prediction: CyclePrediction | null;
}

export function CyclePhaseCard({ phaseInfo, prediction }: CyclePhaseCardProps) {
  if (!phaseInfo) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 text-center">
        <div className="text-4xl mb-3">🌸</div>
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
          月経周期を記録しよう
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
          下の「生理が始まった」ボタンで記録を始めると、
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          体の状態やトレーニングアドバイスが表示されます
        </p>
        {prediction && prediction.cyclesUsed > 0 && (
          <div className="mt-4 bg-pink-50 dark:bg-pink-900/20 rounded-lg p-3">
            <p className="text-xs text-pink-600 dark:text-pink-400">
              次回予測: {formatDate(prediction.predictedStartDate)}
            </p>
          </div>
        )}
      </div>
    );
  }

  const colors = getPhaseColor(phaseInfo.phase);
  const progress = (phaseInfo.dayInCycle / phaseInfo.totalCycleDays) * 100;

  // 次の生理までの日数
  const daysUntilNext = prediction
    ? Math.ceil(
        (new Date(prediction.predictedStartDate + 'T00:00:00').getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      )
    : null;

  return (
    <div className={`${colors.bg} border ${colors.border} rounded-2xl shadow-sm p-5`}>
      {/* フェーズ名 + 日数 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <span className="text-2xl">{phaseInfo.phaseEmoji}</span>
          <div>
            <h3 className={`text-xl font-bold ${colors.text}`}>
              {phaseInfo.phaseLabel}
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              {phaseInfo.dayInCycle}日目 / {phaseInfo.totalCycleDays}日周期
            </p>
          </div>
        </div>
        {phaseInfo.isHighPerformance && (
          <div className="flex items-center space-x-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full px-3 py-1">
            <TrendingUp className="w-3 h-3" />
            <span className="text-xs font-medium">好調期</span>
          </div>
        )}
        {phaseInfo.isInjuryRisk && (
          <div className="flex items-center space-x-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded-full px-3 py-1">
            <AlertTriangle className="w-3 h-3" />
            <span className="text-xs font-medium">注意期</span>
          </div>
        )}
      </div>

      {/* プログレスバー */}
      <div className="mb-4">
        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${colors.dot}`}
            style={{ width: `${Math.min(100, progress)}%` }}
          />
        </div>
      </div>

      {/* アドバイス */}
      <div className="bg-white/60 dark:bg-gray-900/40 rounded-xl p-3 mb-3">
        <p className="text-sm font-medium text-gray-900 dark:text-white">
          {phaseInfo.trainingAdvice}
        </p>
        {phaseInfo.cautionNote && (
          <p className="text-xs text-orange-600 dark:text-orange-400 mt-1 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            {phaseInfo.cautionNote}
          </p>
        )}
      </div>

      {/* 次回予測 */}
      {daysUntilNext != null && daysUntilNext > 0 && prediction && (
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-1 text-gray-600 dark:text-gray-400">
            <Calendar className="w-3.5 h-3.5" />
            <span>次の生理まで</span>
          </div>
          <span className="font-bold text-gray-900 dark:text-white">
            約{daysUntilNext}日
            {prediction.confidence === 'low' && (
              <span className="text-xs font-normal text-gray-400 ml-1">(予測精度: 低)</span>
            )}
          </span>
        </div>
      )}
    </div>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}
