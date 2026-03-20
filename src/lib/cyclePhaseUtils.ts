/**
 * 月経周期フェーズ計算ユーティリティ
 * 全フェーズ計算のシングルソース（React/Supabase依存なし）
 */

import { DEFAULT_CYCLE_LENGTH, DEFAULT_PERIOD_DURATION } from './cycleConstants';

// ── 型定義 ──

export type CyclePhase = 'menstrual' | 'follicular' | 'ovulatory' | 'luteal';

export interface CyclePhaseInfo {
  phase: CyclePhase;
  dayInCycle: number;
  totalCycleDays: number;
  phaseLabel: string;
  phaseEmoji: string;
  trainingAdvice: string;
  cautionNote: string | null;
  isHighPerformance: boolean;
  isInjuryRisk: boolean;
}

export interface PhaseBoundaries {
  menstrualEnd: number;   // 月経期の最終日（1-indexed）
  follicularEnd: number;  // 卵胞期の最終日
  ovulatoryEnd: number;   // 排卵期の最終日
  lutealEnd: number;      // 黄体期の最終日 = cycleLength
}

export interface CyclePrediction {
  predictedStartDate: string; // YYYY-MM-DD
  predictedEndDate: string;   // YYYY-MM-DD（生理終了予測）
  averageCycleLength: number;
  averagePeriodDuration: number;
  confidence: 'low' | 'medium' | 'high';
  cyclesUsed: number;
}

/** MenstrualCycle Rowの最小インターフェース（DB型に依存しない） */
export interface CycleRecord {
  cycle_start_date: string;
  cycle_end_date?: string | null;
  period_duration_days?: number | null;
  cycle_length_days?: number | null;
}

// ── フェーズ境界計算 ──

/**
 * 個人の周期長に応じたフェーズ境界を計算
 * 黄体期は約14日固定（生理学的に安定）の原則に基づく
 */
export function calculatePhaseBoundaries(
  periodDuration: number = DEFAULT_PERIOD_DURATION,
  cycleLength: number = DEFAULT_CYCLE_LENGTH,
): PhaseBoundaries {
  const pd = Math.max(1, Math.min(14, periodDuration));
  const cl = Math.max(20, Math.min(60, cycleLength));

  // 排卵日 ≈ cycleLength - 14（黄体期は約14日）
  const ovulationDay = Math.max(pd + 2, cl - 14);
  const ovulatoryStart = ovulationDay - 1;
  const ovulatoryEnd = Math.min(ovulationDay + 1, cl);

  return {
    menstrualEnd: pd,
    follicularEnd: Math.max(pd, ovulatoryStart - 1),
    ovulatoryEnd,
    lutealEnd: cl,
  };
}

// ── フェーズ判定 ──

/**
 * 指定日のフェーズ情報を返す
 */
export function getCyclePhaseForDate(
  cycle: CycleRecord,
  targetDate: Date | string,
): CyclePhaseInfo | null {
  const startDate = new Date(cycle.cycle_start_date + 'T00:00:00');
  const target = typeof targetDate === 'string'
    ? new Date(targetDate + 'T00:00:00')
    : targetDate;

  const dayInCycle = Math.floor(
    (target.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  ) + 1; // 1-indexed

  if (dayInCycle < 1) return null;

  const periodDuration = cycle.period_duration_days || DEFAULT_PERIOD_DURATION;
  const cycleLength = cycle.cycle_length_days || DEFAULT_CYCLE_LENGTH;

  if (dayInCycle > cycleLength) return null;

  const bounds = calculatePhaseBoundaries(periodDuration, cycleLength);

  let phase: CyclePhase;
  if (dayInCycle <= bounds.menstrualEnd) {
    phase = 'menstrual';
  } else if (dayInCycle <= bounds.follicularEnd) {
    phase = 'follicular';
  } else if (dayInCycle <= bounds.ovulatoryEnd) {
    phase = 'ovulatory';
  } else {
    phase = 'luteal';
  }

  return buildPhaseInfo(phase, dayInCycle, cycleLength);
}

/**
 * 周期配列から指定日のフェーズを検索
 */
export function findPhaseForDate(
  cycles: CycleRecord[],
  targetDate: Date | string,
): CyclePhaseInfo | null {
  for (const cycle of cycles) {
    const info = getCyclePhaseForDate(cycle, targetDate);
    if (info) return info;
  }
  return null;
}

/**
 * 現在のフェーズを取得
 */
export function getCurrentPhase(
  cycles: CycleRecord[],
): { cycle: CycleRecord; phaseInfo: CyclePhaseInfo } | null {
  const today = new Date();
  for (const cycle of cycles) {
    const info = getCyclePhaseForDate(cycle, today);
    if (info) return { cycle, phaseInfo: info };
  }
  return null;
}

// ── 予測 ──

/**
 * 過去の周期から次回を予測（直近重み付き）
 */
export function predictNextCycle(cycles: CycleRecord[]): CyclePrediction | null {
  if (cycles.length === 0) return null;

  // cycle_length_daysが記録されている周期のみ使用
  const withLength = cycles.filter(c => c.cycle_length_days && c.cycle_length_days > 0);
  const withDuration = cycles.filter(c => c.period_duration_days && c.period_duration_days > 0);

  // 最新の周期開始日
  const latestCycle = cycles[0]; // cycles は降順ソート前提

  let avgCycleLength: number;
  let confidence: 'low' | 'medium' | 'high';
  let cyclesUsed: number;

  if (withLength.length >= 3) {
    // 直近3周期の加重平均（最新=3, 2番目=2, 3番目=1）
    const recent = withLength.slice(0, 3);
    const weights = [3, 2, 1];
    let weightedSum = 0;
    let totalWeight = 0;
    recent.forEach((c, i) => {
      weightedSum += (c.cycle_length_days!) * weights[i];
      totalWeight += weights[i];
    });
    avgCycleLength = Math.round(weightedSum / totalWeight);
    confidence = 'high';
    cyclesUsed = recent.length;
  } else if (withLength.length >= 1) {
    avgCycleLength = Math.round(
      withLength.reduce((sum, c) => sum + c.cycle_length_days!, 0) / withLength.length
    );
    confidence = withLength.length >= 2 ? 'medium' : 'low';
    cyclesUsed = withLength.length;
  } else {
    avgCycleLength = DEFAULT_CYCLE_LENGTH;
    confidence = 'low';
    cyclesUsed = 0;
  }

  const avgPeriodDuration = withDuration.length > 0
    ? Math.round(withDuration.reduce((sum, c) => sum + c.period_duration_days!, 0) / withDuration.length)
    : DEFAULT_PERIOD_DURATION;

  const startDate = new Date(latestCycle.cycle_start_date + 'T00:00:00');
  const predictedStart = new Date(startDate);
  predictedStart.setDate(predictedStart.getDate() + avgCycleLength);

  const predictedEnd = new Date(predictedStart);
  predictedEnd.setDate(predictedEnd.getDate() + avgPeriodDuration - 1);

  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  return {
    predictedStartDate: fmt(predictedStart),
    predictedEndDate: fmt(predictedEnd),
    averageCycleLength: avgCycleLength,
    averagePeriodDuration: avgPeriodDuration,
    confidence,
    cyclesUsed,
  };
}

// ── フェーズ情報ヘルパー ──

function buildPhaseInfo(
  phase: CyclePhase,
  dayInCycle: number,
  totalCycleDays: number,
): CyclePhaseInfo {
  const meta = PHASE_META[phase];
  return {
    phase,
    dayInCycle,
    totalCycleDays,
    phaseLabel: meta.label,
    phaseEmoji: meta.emoji,
    trainingAdvice: meta.advice,
    cautionNote: meta.caution,
    isHighPerformance: meta.isHighPerformance,
    isInjuryRisk: meta.isInjuryRisk,
  };
}

const PHASE_META: Record<CyclePhase, {
  label: string;
  emoji: string;
  advice: string;
  caution: string | null;
  isHighPerformance: boolean;
  isInjuryRisk: boolean;
}> = {
  menstrual: {
    label: '月経期',
    emoji: '🔴',
    advice: '無理せず軽めに。鉄分を意識しよう',
    caution: '貧血に注意。水分もしっかり取ろう',
    isHighPerformance: false,
    isInjuryRisk: false,
  },
  follicular: {
    label: '卵胞期',
    emoji: '🌸',
    advice: '体が一番元気な時期！強度を上げるチャンス',
    caution: null,
    isHighPerformance: true,
    isInjuryRisk: false,
  },
  ovulatory: {
    label: '排卵期',
    emoji: '⚡',
    advice: '靭帯が緩みやすい時期。ウォームアップ念入りに',
    caution: 'ACL損傷リスクが高まる時期。切り返し動作に注意',
    isHighPerformance: false,
    isInjuryRisk: true,
  },
  luteal: {
    label: '黄体期',
    emoji: '🌙',
    advice: '疲れやすく怪我しやすい。休息を大切に',
    caution: '体温が上がり疲労感が出やすい。無理は禁物',
    isHighPerformance: false,
    isInjuryRisk: true,
  },
};

// ── 色・表示ヘルパー ──

export function getPhaseColor(phase: CyclePhase): {
  bg: string;
  text: string;
  border: string;
  dot: string;
} {
  switch (phase) {
    case 'menstrual':
      return {
        bg: 'bg-red-50 dark:bg-red-900/20',
        text: 'text-red-700 dark:text-red-400',
        border: 'border-red-200 dark:border-red-800',
        dot: 'bg-red-500',
      };
    case 'follicular':
      return {
        bg: 'bg-green-50 dark:bg-green-900/20',
        text: 'text-green-700 dark:text-green-400',
        border: 'border-green-200 dark:border-green-800',
        dot: 'bg-green-500',
      };
    case 'ovulatory':
      return {
        bg: 'bg-yellow-50 dark:bg-yellow-900/20',
        text: 'text-yellow-700 dark:text-yellow-400',
        border: 'border-yellow-200 dark:border-yellow-800',
        dot: 'bg-yellow-500',
      };
    case 'luteal':
      return {
        bg: 'bg-blue-50 dark:bg-blue-900/20',
        text: 'text-blue-700 dark:text-blue-400',
        border: 'border-blue-200 dark:border-blue-800',
        dot: 'bg-blue-500',
      };
  }
}

export function getPhaseLabel(phase: CyclePhase): string {
  return PHASE_META[phase].label;
}

export function getPhaseEmoji(phase: CyclePhase): string {
  return PHASE_META[phase].emoji;
}
