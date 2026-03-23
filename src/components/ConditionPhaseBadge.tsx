// src/components/ConditionPhaseBadge.tsx
// 月経周期を「コンディションフェーズ」として抽象的に表示するバッジ
// 月経という言葉は使わず、コーチが行動しやすい表現にする

import type { CyclePhase } from '../lib/cyclePhaseUtils';

interface ConditionPhaseBadgeProps {
  phase: CyclePhase | null | undefined;
  /** 'badge' = コンパクト表示（選手一覧用）, 'label' = テキスト付き */
  variant?: 'badge' | 'label';
  className?: string;
}

// フェーズ → 抽象表現マッピング
const PHASE_CONFIG: Record<CyclePhase, {
  label: string;
  shortLabel: string;
  color: string;       // バッジ背景色
  textColor: string;   // テキスト色
  dotColor: string;    // ドット色
  coachTip: string;    // コーチ向けヒント
}> = {
  menstrual: {
    label: '回復フェーズ',
    shortLabel: '回復',
    color: 'bg-amber-100 dark:bg-amber-900/30',
    textColor: 'text-amber-700 dark:text-amber-400',
    dotColor: 'bg-amber-400',
    coachTip: '負荷軽減を推奨',
  },
  follicular: {
    label: 'アクティブフェーズ',
    shortLabel: 'アクティブ',
    color: 'bg-emerald-100 dark:bg-emerald-900/30',
    textColor: 'text-emerald-700 dark:text-emerald-400',
    dotColor: 'bg-emerald-400',
    coachTip: '高強度トレーニングに適した時期',
  },
  ovulatory: {
    label: 'ピークフェーズ',
    shortLabel: 'ピーク',
    color: 'bg-blue-100 dark:bg-blue-900/30',
    textColor: 'text-blue-700 dark:text-blue-400',
    dotColor: 'bg-blue-400',
    coachTip: 'パフォーマンスが最も高い時期',
  },
  luteal: {
    label: 'ケアフェーズ',
    shortLabel: 'ケア',
    color: 'bg-orange-100 dark:bg-orange-900/30',
    textColor: 'text-orange-700 dark:text-orange-400',
    dotColor: 'bg-orange-400',
    coachTip: '怪我リスクに注意。負荷調整を推奨',
  },
};

export function ConditionPhaseBadge({ phase, variant = 'badge', className = '' }: ConditionPhaseBadgeProps) {
  if (!phase) return null;

  const config = PHASE_CONFIG[phase];
  if (!config) return null;

  if (variant === 'badge') {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${config.color} ${config.textColor} ${className}`}
        title={config.coachTip}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${config.dotColor}`} />
        {config.shortLabel}
      </span>
    );
  }

  // variant === 'label'
  return (
    <div className={`flex items-center gap-2 ${className}`} title={config.coachTip}>
      <span className={`w-2.5 h-2.5 rounded-full ${config.dotColor}`} />
      <div>
        <span className={`text-sm font-medium ${config.textColor}`}>{config.label}</span>
        <p className="text-xs text-gray-500 dark:text-gray-400">{config.coachTip}</p>
      </div>
    </div>
  );
}

/** フェーズからコーチ向けヒントを取得 */
export function getConditionPhaseConfig(phase: CyclePhase | null | undefined) {
  if (!phase) return null;
  return PHASE_CONFIG[phase] ?? null;
}
