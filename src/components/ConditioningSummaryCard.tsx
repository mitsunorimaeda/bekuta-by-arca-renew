import React from 'react';
import { Moon, Heart, Activity, AlertTriangle, CheckCircle, TrendingUp, TrendingDown } from 'lucide-react';
import { ACWRData } from '../lib/acwr';

interface ConditioningSummaryCardProps {
  latestACWR: ACWRData | null;
  sleepHours: number | null;
  sleepQuality: number | null;
  motivationLevel: number | null;
  energyLevel: number | null;
  stressLevel: number | null;
}

export function ConditioningSummaryCard({
  latestACWR,
  sleepHours,
  sleepQuality,
  motivationLevel,
  energyLevel,
  stressLevel
}: ConditioningSummaryCardProps) {
  const getOverallCondition = () => {
    let score = 0;
    let factors = 0;

    if (latestACWR) {
      factors++;
      if (latestACWR.riskLevel === 'good') score += 3;
      else if (latestACWR.riskLevel === 'caution') score += 2;
      else if (latestACWR.riskLevel === 'low') score += 2.5;
      else score += 1;
    }

    if (sleepHours !== null) {
      factors++;
      if (sleepHours >= 7 && sleepHours <= 9) score += 3;
      else if (sleepHours >= 6 && sleepHours < 7) score += 2;
      else score += 1;
    }

    if (motivationLevel !== null) {
      factors++;
      if (motivationLevel >= 7) score += 3;
      else if (motivationLevel >= 5) score += 2;
      else score += 1;
    }

    if (energyLevel !== null) {
      factors++;
      if (energyLevel >= 7) score += 3;
      else if (energyLevel >= 5) score += 2;
      else score += 1;
    }

    if (stressLevel !== null) {
      factors++;
      if (stressLevel <= 4) score += 3;
      else if (stressLevel <= 6) score += 2;
      else score += 1;
    }

    if (factors === 0) return { level: 'unknown', color: 'gray', label: 'データなし' };

    const avgScore = score / factors;

    if (avgScore >= 2.5) return { level: 'excellent', color: 'green', label: '最高', icon: CheckCircle };
    if (avgScore >= 2) return { level: 'good', color: 'blue', label: '良好', icon: TrendingUp };
    if (avgScore >= 1.5) return { level: 'fair', color: 'yellow', label: '注意', icon: AlertTriangle };
    return { level: 'poor', color: 'red', label: '警告', icon: TrendingDown };
  };

  const overallCondition = getOverallCondition();
  const ConditionIcon = overallCondition.icon || AlertTriangle;

  const getRecommendation = () => {
    const isHighACWR = latestACWR && (latestACWR.riskLevel === 'high' || latestACWR.riskLevel === 'caution');
    const isLowSleep = sleepHours !== null && sleepHours < 7;
    const isLowMotivation = motivationLevel !== null && motivationLevel < 5;
    const isHighStress = stressLevel !== null && stressLevel > 7;

    if (isHighACWR && isLowSleep) {
      return {
        text: '怪我リスク極大：練習負荷が高く、睡眠不足です。休息を優先してください。',
        color: 'text-red-700 dark:text-red-400',
        bg: 'bg-red-50 dark:bg-red-900/20'
      };
    }

    if (isLowMotivation && isHighStress) {
      return {
        text: 'メンタル注意：モチベーション低下とストレス過多です。リフレッシュを推奨します。',
        color: 'text-orange-700 dark:text-orange-400',
        bg: 'bg-orange-50 dark:bg-orange-900/20'
      };
    }

    if (isLowSleep) {
      return {
        text: '睡眠不足：パフォーマンス低下のリスクがあります。睡眠時間を確保しましょう。',
        color: 'text-yellow-700 dark:text-yellow-400',
        bg: 'bg-yellow-50 dark:bg-yellow-900/20'
      };
    }

    if (isHighACWR) {
      return {
        text: 'トレーニング負荷注意：回復を優先し、負荷を調整してください。',
        color: 'text-blue-700 dark:text-blue-400',
        bg: 'bg-blue-50 dark:bg-blue-900/20'
      };
    }

    return {
      text: 'コンディション良好：このまま計画的なトレーニングを継続しましょう。',
      color: 'text-green-700 dark:text-green-400',
      bg: 'bg-green-50 dark:bg-green-900/20'
    };
  };

  const recommendation = getRecommendation();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 transition-colors">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          今日のコンディション
        </h3>
        <div className={`flex items-center space-x-2 px-4 py-2 bg-${overallCondition.color}-100 dark:bg-${overallCondition.color}-900/20 rounded-full`}>
          <ConditionIcon className={`w-5 h-5 text-${overallCondition.color}-600 dark:text-${overallCondition.color}-400`} />
          <span className={`font-semibold text-${overallCondition.color}-700 dark:text-${overallCondition.color}-400`}>
            {overallCondition.label}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        {latestACWR && (
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 transition-colors">
            <div className="flex items-center mb-2">
              <Activity className="w-4 h-4 text-gray-500 dark:text-gray-400 mr-2" />
              <span className="text-xs text-gray-600 dark:text-gray-400">ACWR</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{latestACWR.acwr}</p>
          </div>
        )}

        {sleepHours !== null && (
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 transition-colors">
            <div className="flex items-center mb-2">
              <Moon className="w-4 h-4 text-gray-500 dark:text-gray-400 mr-2" />
              <span className="text-xs text-gray-600 dark:text-gray-400">睡眠</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{sleepHours.toFixed(1)}h</p>
          </div>
        )}

        {motivationLevel !== null && (
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 transition-colors">
            <div className="flex items-center mb-2">
              <Heart className="w-4 h-4 text-gray-500 dark:text-gray-400 mr-2" />
              <span className="text-xs text-gray-600 dark:text-gray-400">意欲</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{motivationLevel}/10</p>
          </div>
        )}
      </div>

      <div className={`${recommendation.bg} border border-${overallCondition.color}-200 dark:border-${overallCondition.color}-800 rounded-lg p-4`}>
        <p className={`text-sm ${recommendation.color}`}>
          {recommendation.text}
        </p>
      </div>
    </div>
  );
}
