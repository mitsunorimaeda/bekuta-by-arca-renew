/**
 * PMS（月経前症候群）インサイト検出
 * 過去の周期データと日別ログから、「もしかしてPMSかも」を判定
 */

import type { CycleRecord } from './cyclePhaseUtils';
import { getCurrentPhase } from './cyclePhaseUtils';
import type { DailyLog } from '../hooks/useMenstrualDailyLog';

export interface PmsInsight {
  isPmsLikely: boolean;
  matchingSymptoms: string[];
  daysUntilPeriod: number | null;
  message: string;
}

/** PMS関連の症状値 */
const PMS_SYMPTOMS = new Set([
  'mood_swings', 'mood_changes', 'irritability', 'anxiety', 'crying',
  'food_cravings', 'insomnia', 'oversleeping', 'poor_concentration',
  'bloating', 'breast_tenderness', 'headache', 'fatigue', 'acne',
  'back_pain', 'cramps', 'nausea',
]);

/**
 * 生理前（黄体期後半〜生理直前）に繰り返し出現する症状パターンを検出
 *
 * ロジック:
 * 1. 各周期の「生理前7日間」に記録された症状を集計
 * 2. 2周期以上で同じ症状が出ていれば「PMSパターン」
 * 3. 今日が黄体期で、かつ今日の症状がパターンに一致 → PMS likely
 */
export function detectPmsInsight(
  cycles: CycleRecord[],
  dailyLogs: DailyLog[],
  today: string,
): PmsInsight | null {
  if (cycles.length < 2) return null;

  // 現在のフェーズを確認
  const currentPhase = getCurrentPhase(cycles);
  if (!currentPhase) return null;

  const { phaseInfo } = currentPhase;
  // 黄体期以外はPMSインサイト不要
  if (phaseInfo.phase !== 'luteal') return null;

  // 過去の各周期の「生理前7日間」の症状を集計
  const prePeriodSymptomCounts: Record<string, number> = {};
  let analyzedCycles = 0;

  for (let i = 0; i < Math.min(cycles.length, 5); i++) {
    const cycle = cycles[i];
    const startDate = new Date(cycle.cycle_start_date + 'T00:00:00');

    // この周期の生理前7日間
    const prePeriodDays: string[] = [];
    for (let d = 1; d <= 7; d++) {
      const day = new Date(startDate);
      day.setDate(day.getDate() - d);
      prePeriodDays.push(day.toISOString().slice(0, 10));
    }

    // その期間のログを検索
    const logsInRange = dailyLogs.filter(l => prePeriodDays.includes(l.log_date));
    if (logsInRange.length === 0) continue;

    analyzedCycles++;
    const symptomsInRange = new Set<string>();
    for (const log of logsInRange) {
      const symptoms = Array.isArray(log.symptoms) ? log.symptoms : [];
      for (const s of symptoms) {
        if (typeof s === 'string' && PMS_SYMPTOMS.has(s)) {
          symptomsInRange.add(s);
        }
      }
    }
    for (const s of symptomsInRange) {
      prePeriodSymptomCounts[s] = (prePeriodSymptomCounts[s] || 0) + 1;
    }
  }

  if (analyzedCycles < 2) return null;

  // 2周期以上で出た症状 = PMSパターン
  const pmsPatterns = Object.entries(prePeriodSymptomCounts)
    .filter(([, count]) => count >= 2)
    .map(([symptom]) => symptom);

  if (pmsPatterns.length === 0) return null;

  // 今日のログに一致するパターンがあるか
  const todayLog = dailyLogs.find(l => l.log_date === today);
  const todaySymptoms = todayLog
    ? (Array.isArray(todayLog.symptoms) ? todayLog.symptoms as string[] : [])
    : [];

  const matchingSymptoms = todaySymptoms.filter(s => pmsPatterns.includes(s));

  // 次の生理までの日数
  const daysUntilPeriod = phaseInfo.totalCycleDays
    ? phaseInfo.totalCycleDays - phaseInfo.dayInCycle
    : null;

  if (matchingSymptoms.length > 0) {
    return {
      isPmsLikely: true,
      matchingSymptoms,
      daysUntilPeriod,
      message: 'もしかしてPMSかも',
    };
  }

  // 今日の症状がなくても、黄体期でPMSパターンがある場合は軽い注意
  return {
    isPmsLikely: false,
    matchingSymptoms: [],
    daysUntilPeriod,
    message: `生理前に出やすい症状: ${pmsPatterns.length}種類のパターンあり`,
  };
}
