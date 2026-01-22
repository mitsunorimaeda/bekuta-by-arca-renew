import React, { useMemo } from 'react';
import {
  Activity,
  Scale,
  Heart,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ChevronRight,
  Plus,
  Droplets,
} from 'lucide-react';
import { ACWRData } from '../lib/acwr';
import type { Database } from '../lib/database.types';

type MenstrualCycle = Database['public']['Tables']['menstrual_cycles']['Row'];

interface WeightRecord {
  weight_kg: number;
  date: string;
}

interface SleepRecord {
  sleep_hours: number;
  sleep_quality: number;
  date: string;
}

interface MotivationRecord {
  motivation_level: number;
  energy_level: number;
  stress_level: number;
  date: string;
}

interface TrainingRecord {
  rpe: number;
  duration_min: number;
  date: string;
  training_load?: number;
}

interface ConsolidatedOverviewDashboardProps {
  acwrData: ACWRData[];
  weightRecords: WeightRecord[];
  sleepRecords: SleepRecord[];
  motivationRecords: MotivationRecord[];
  trainingRecords: TrainingRecord[];
  menstrualCycles?: MenstrualCycle[];
  userGender?: string | null;
  onOpenDetailView: (section: 'training' | 'weight' | 'conditioning' | 'cycle') => void;
  onQuickAdd: () => void;
}

function toMs(dateLike?: string | null) {
  if (!dateLike) return NaN;
  // Safari対策：YYYY-MM-DD をローカル日付として扱う
  const s = String(dateLike);
  const normalized = s.includes('T') ? s : `${s}T00:00:00`;
  const t = new Date(normalized).getTime();
  return Number.isFinite(t) ? t : NaN;
}

function num(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function formatJP(dateLike: string) {
  const t = toMs(dateLike);
  if (!Number.isFinite(t)) return '-';
  return new Date(t).toLocaleDateString('ja-JP');
}

export function ConsolidatedOverviewDashboard({
  acwrData,
  weightRecords,
  sleepRecords,
  motivationRecords,
  trainingRecords,
  menstrualCycles = [],
  userGender,
  onOpenDetailView,
  onQuickAdd,
}: ConsolidatedOverviewDashboardProps) {
  // =========================
  // ✅ 並び順に依存しない「降順ソート」
  // =========================
  const sortedAcwrDesc = useMemo(() => {
    return [...(acwrData ?? [])]
      .filter((x: any) => x)
      .sort((a: any, b: any) => toMs(b?.date) - toMs(a?.date));
  }, [acwrData]);

  const sortedWeightsDesc = useMemo(() => {
    return [...(weightRecords ?? [])]
      .filter((x) => x && x.date != null)
      .sort((a, b) => toMs(b.date) - toMs(a.date));
  }, [weightRecords]);

  const sortedSleepDesc = useMemo(() => {
    return [...(sleepRecords ?? [])]
      .filter((x) => x && x.date != null)
      .sort((a, b) => toMs(b.date) - toMs(a.date));
  }, [sleepRecords]);

  const sortedMotivationDesc = useMemo(() => {
    return [...(motivationRecords ?? [])]
      .filter((x) => x && x.date != null)
      .sort((a, b) => toMs(b.date) - toMs(a.date));
  }, [motivationRecords]);

  const sortedTrainingDesc = useMemo(() => {
    return [...(trainingRecords ?? [])]
      .filter((x) => x && x.date != null)
      .sort((a, b) => toMs(b.date) - toMs(a.date));
  }, [trainingRecords]);

  // =========================
  // ✅ 最新データ（降順の先頭）
  // =========================
  const latestWeight = useMemo(() => sortedWeightsDesc[0] ?? null, [sortedWeightsDesc]);
  const latestSleep = useMemo(() => sortedSleepDesc[0] ?? null, [sortedSleepDesc]);
  const latestMotivation = useMemo(() => sortedMotivationDesc[0] ?? null, [sortedMotivationDesc]);
  const latestTraining = useMemo(() => sortedTrainingDesc[0] ?? null, [sortedTrainingDesc]);

  /**
   * ✅ ACWRが「0固定」になる典型原因をUI側で吸収：
   * - acwr が未計算/文字列/NaN → acute/chronic から再計算
   * - chronic が 0 / null → 0 ではなく null（表示は "-"）
   */
  const latestACWR = useMemo(() => {
    const x: any = sortedAcwrDesc[0];
    if (!x) return null;

    const acute = num(x.acuteLoad);
    const chronic = num(x.chronicLoad);

    let acwrVal = num(x.acwr);

    // acwr が無い/壊れてる時は acute/chronic から再計算
    if (acwrVal == null && acute != null && chronic != null && chronic > 0) {
      acwrVal = acute / chronic;
    }

    // chronic が 0 の場合、「0」として見せると誤解が起きるので null 扱い
    if (chronic == null || chronic <= 0) {
      acwrVal = null;
    }

    return {
      ...x,
      acuteLoad: acute ?? x.acuteLoad,
      chronicLoad: chronic ?? x.chronicLoad,
      acwr: acwrVal, // ← ここがポイント（0固定を回避）
    } as any;
  }, [sortedAcwrDesc]);

  // =========================
  // ✅ 体重トレンド（必ず降順を使う）
  // =========================
  const getWeightTrend = () => {
    if (sortedWeightsDesc.length < 2) return null;
    const recent = Number(sortedWeightsDesc[0].weight_kg);
    const previous = Number(sortedWeightsDesc[1].weight_kg);
    const diff = recent - previous;
    return { value: diff, isUp: diff > 0 };
  };

  // ✅ 週平均睡眠（必ず降順を使う）
  const getSleepAverage = () => {
    if (sortedSleepDesc.length === 0) return null;
    const recentWeek = sortedSleepDesc.slice(0, 7);
    const avg =
      recentWeek.reduce((sum, r) => sum + Number(r.sleep_hours), 0) / recentWeek.length;
    return avg;
  };

  // ✅ 30日変化：30日前以前の「一番近い過去データ」と比較
  const diff30 = useMemo(() => {
    const latest = sortedWeightsDesc[0];
    if (!latest?.date || latest.weight_kg == null) return null;

    const latestT = toMs(latest.date);
    if (!Number.isFinite(latestT)) return null;

    const targetDate = new Date(latestT);
    targetDate.setDate(targetDate.getDate() - 30);
    const targetT = targetDate.getTime();

    const past30 = sortedWeightsDesc.find((r) => {
      const t = toMs(r?.date);
      return Number.isFinite(t) && t <= targetT && r.weight_kg != null;
    });

    if (!past30) return null;

    return Number(latest.weight_kg) - Number(past30.weight_kg);
  }, [sortedWeightsDesc]);

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'good':
        return 'text-green-600 dark:text-green-400';
      case 'caution':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'high':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-blue-600 dark:text-blue-400';
    }
  };

  const getRiskBg = (riskLevel: string) => {
    switch (riskLevel) {
      case 'good':
        return 'bg-green-50 dark:bg-green-900/20';
      case 'caution':
        return 'bg-yellow-50 dark:bg-yellow-900/20';
      case 'high':
        return 'bg-red-50 dark:bg-red-900/20';
      default:
        return 'bg-blue-50 dark:bg-blue-900/20';
    }
  };

  const getHealthScore = () => {
    let score = 0;
    let factors = 0;

    if (latestACWR) {
      const rl = (latestACWR as any).riskLevel;
      factors++;
      if (rl === 'good') score += 25;
      else if (rl === 'caution') score += 15;
      else if (rl === 'low') score += 20;
      else score += 10;
    }

    if (latestSleep) {
      factors++;
      const hours = Number(latestSleep.sleep_hours);
      const quality = Number((latestSleep as any).sleep_quality);
      if (hours >= 7 && hours <= 9 && quality >= 7) score += 25;
      else if (hours >= 6 && quality >= 5) score += 15;
      else score += 5;
    }

    if (latestMotivation) {
      factors++;
      const avgMood =
        (latestMotivation.motivation_level +
          latestMotivation.energy_level +
          (10 - latestMotivation.stress_level)) /
        3;
      if (avgMood >= 7) score += 25;
      else if (avgMood >= 5) score += 15;
      else score += 5;
    }

    if (latestWeight && sortedWeightsDesc.length >= 2) {
      factors++;
      const trend = getWeightTrend();
      if (trend && Math.abs(trend.value) < 0.5) score += 25;
      else if (trend && Math.abs(trend.value) < 1) score += 15;
      else score += 10;
    }

    if (factors === 0) return 0;
    return Math.round((score / factors) * 4);
  };

  const healthScore = getHealthScore();
  const weightTrend = getWeightTrend();
  const sleepAvg = getSleepAverage();

  // =========================
  // ✅ 月経周期
  // =========================
  const getCurrentCyclePhase = () => {
    if (!menstrualCycles || menstrualCycles.length === 0) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayT = today.getTime();

    for (const cycle of menstrualCycles) {
      const startT = toMs(cycle.cycle_start_date);
      if (!Number.isFinite(startT)) continue;

      const endT = cycle.cycle_end_date ? toMs(cycle.cycle_end_date) : null;

      if (todayT >= startT && (!endT || todayT <= endT)) {
        const daysSinceStart = Math.floor((todayT - startT) / (1000 * 60 * 60 * 24));

        if (cycle.period_duration_days && daysSinceStart < cycle.period_duration_days) {
          return { phase: 'menstrual', cycle, daysSinceStart };
        }

        if (cycle.cycle_length_days) {
          const follicularEnd = Math.floor(cycle.cycle_length_days / 2);
          if (daysSinceStart < follicularEnd) {
            return { phase: 'follicular', cycle, daysSinceStart };
          }
          const lutealStart = follicularEnd + 2;
          if (daysSinceStart < lutealStart) {
            return { phase: 'ovulatory', cycle, daysSinceStart };
          }
          if (daysSinceStart < cycle.cycle_length_days) {
            return { phase: 'luteal', cycle, daysSinceStart };
          }
        }
      }
    }
    return null;
  };

  const getPredictedNextPeriod = () => {
    if (!menstrualCycles || menstrualCycles.length === 0) return null;

    const sortedCycles = [...menstrualCycles].sort(
      (a, b) => toMs(b.cycle_start_date) - toMs(a.cycle_start_date)
    );

    const latestCycle = sortedCycles[0];
    if (!latestCycle?.cycle_length_days) return null;

    const lastStartT = toMs(latestCycle.cycle_start_date);
    if (!Number.isFinite(lastStartT)) return null;

    const predictedDate = new Date(lastStartT);
    predictedDate.setDate(predictedDate.getDate() + latestCycle.cycle_length_days);

    return predictedDate;
  };

  const getPhaseDisplayName = (phase: string) => {
    switch (phase) {
      case 'menstrual':
        return '月経期';
      case 'follicular':
        return '卵胞期';
      case 'ovulatory':
        return '排卵期';
      case 'luteal':
        return '黄体期';
      default:
        return '不明';
    }
  };

  const getPhaseColor = (phase: string) => {
    switch (phase) {
      case 'menstrual':
        return 'text-red-600 dark:text-red-400';
      case 'follicular':
        return 'text-green-600 dark:text-green-400';
      case 'ovulatory':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'luteal':
        return 'text-blue-600 dark:text-blue-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getPhaseBg = (phase: string) => {
    switch (phase) {
      case 'menstrual':
        return 'bg-red-100 dark:bg-red-900/30';
      case 'follicular':
        return 'bg-green-100 dark:bg-green-900/30';
      case 'ovulatory':
        return 'bg-yellow-100 dark:bg-yellow-900/30';
      case 'luteal':
        return 'bg-blue-100 dark:bg-blue-900/30';
      default:
        return 'bg-gray-100 dark:bg-gray-700';
    }
  };

  const getPhaseAdvice = (phase: string) => {
    switch (phase) {
      case 'menstrual':
        return '低～中強度トレーニングを推奨';
      case 'follicular':
        return '高強度トレーニングに最適';
      case 'ovulatory':
        return 'ピークパフォーマンス期';
      case 'luteal':
        return '回復重視のトレーニングを';
      default:
        return '';
    }
  };

  const currentPhase = getCurrentCyclePhase();
  const predictedNextPeriod = getPredictedNextPeriod();
  const showCycleCard = userGender === 'female';

  // DEVだけ：0固定の原因を即確認できるログ（不要なら消してOK）
  React.useEffect(() => {
    if (!import.meta.env.DEV) return;
    console.log('[ACWR debug] len:', acwrData?.length ?? 0);
    console.table(
      (sortedAcwrDesc ?? []).slice(0, 10).map((x: any) => ({
        date: x?.date,
        acwr: x?.acwr,
        acute: x?.acuteLoad,
        chronic: x?.chronicLoad,
        risk: x?.riskLevel,
      }))
    );
    console.log('[ACWR debug] latestACWR:', latestACWR);
  }, [acwrData, sortedAcwrDesc, latestACWR]);

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-700 dark:to-blue-800 rounded-2xl shadow-lg p-6 text-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold mb-1">総合スコア</h2>
            <p className="text-blue-100 text-sm">すべての指標を統合した健康状態</p>
          </div>
          <div className="bg-white/20 rounded-full px-6 py-3">
            <div className="text-4xl font-bold">{healthScore}</div>
            <div className="text-xs text-center text-blue-100">/ 100</div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          <div className="bg-white/10 rounded-lg p-3">
            <Activity className="w-5 h-5 mb-1" />
            <div className="text-xs text-blue-100">ACWR</div>
            <div className="text-lg font-bold">
              {typeof (latestACWR as any)?.acwr === 'number'
                ? (latestACWR as any).acwr.toFixed(2)
                : '-'}
            </div>
          </div>
          <div className="bg-white/10 rounded-lg p-3">
            <Scale className="w-5 h-5 mb-1" />
            <div className="text-xs text-blue-100">体重</div>
            <div className="text-lg font-bold">
              {latestWeight ? `${Number(latestWeight.weight_kg).toFixed(1)}kg` : '-'}
            </div>
          </div>
          <div className="bg-white/10 rounded-lg p-3">
            <Heart className="w-5 h-5 mb-1" />
            <div className="text-xs text-blue-100">睡眠</div>
            <div className="text-lg font-bold">
              {latestSleep ? `${Number(latestSleep.sleep_hours).toFixed(1)}h` : '-'}
            </div>
          </div>
          <div className="bg-white/10 rounded-lg p-3">
            <Heart className="w-5 h-5 mb-1" />
            <div className="text-xs text-blue-100">意欲</div>
            <div className="text-lg font-bold">
              {latestMotivation ? `${latestMotivation.motivation_level}/10` : '-'}
            </div>
          </div>
        </div>
      </div>

      <div
        className={`grid grid-cols-1 gap-6 ${
          showCycleCard ? 'md:grid-cols-2 lg:grid-cols-4' : 'md:grid-cols-3'
        }`}
      >
        {/* Training */}
        <div
          onClick={() => onOpenDetailView('training')}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 cursor-pointer hover:shadow-md transition-all hover:scale-[1.02]"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div
                className={`p-3 rounded-lg ${
                  latestACWR
                    ? getRiskBg((latestACWR as any).riskLevel)
                    : 'bg-gray-100 dark:bg-gray-700'
                }`}
              >
                <Activity
                  className={`w-6 h-6 ${
                    latestACWR
                      ? getRiskColor((latestACWR as any).riskLevel)
                      : 'text-gray-400'
                  }`}
                />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">練習記録</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">Training Load</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </div>

          {latestACWR ? (
            <>
              <div className="mb-4">
                <div className="flex items-baseline space-x-2">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-300">
                    {typeof (latestACWR as any)?.acwr === 'number'
                      ? (latestACWR as any).acwr.toFixed(2)
                      : '不明'}
                  </div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">ACWR</span>
                </div>

                <div className="flex items-center space-x-2 mt-1">
                  {(latestACWR as any).riskLevel === 'high' && (
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                  )}
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {(latestACWR as any).riskLevel === 'good' && '理想的な負荷'}
                    {(latestACWR as any).riskLevel === 'caution' && '負荷がやや高め'}
                    {(latestACWR as any).riskLevel === 'high' && '怪我リスク警告'}
                    {(latestACWR as any).riskLevel === 'low' && '負荷がやや低め'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">急性負荷</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                    {(latestACWR as any).acuteLoad ?? '-'}
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">慢性負荷</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                    {(latestACWR as any).chronicLoad ?? '-'}
                  </p>
                </div>
              </div>

              {latestTraining && (
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
                    <span>最終記録</span>
                    <span>{formatJP(latestTraining.date)}</span>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8">
              <Activity className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-gray-500 dark:text-gray-400">データがありません</p>
            </div>
          )}
        </div>

        {/* Weight */}
        <div
          onClick={() => onOpenDetailView('weight')}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 cursor-pointer hover:shadow-md transition-all hover:scale-[1.02]"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="bg-green-100 dark:bg-green-900/30 p-3 rounded-lg">
                <Scale className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">体重管理</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">Weight Tracking</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </div>

          {latestWeight ? (
            <>
              <div className="mb-4">
                <div className="flex items-baseline space-x-2">
                  <span className="text-3xl font-bold text-green-600 dark:text-green-400">
                    {Number(latestWeight.weight_kg).toFixed(1)}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">kg</span>
                </div>

                {weightTrend && (
                  <div className="flex items-center space-x-1 mt-1">
                    {weightTrend.isUp ? (
                      <TrendingUp className="w-4 h-4 text-red-500" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-blue-500" />
                    )}
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      前回比 {weightTrend.isUp ? '+' : ''}
                      {weightTrend.value.toFixed(1)}kg
                    </p>
                  </div>
                )}
              </div>

              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 mb-3">
                <p className="text-xs text-green-700 dark:text-green-400 mb-1">30日間の変化</p>
                <p className="text-lg font-bold text-green-800 dark:text-green-300">
                  {diff30 !== null ? `${diff30.toFixed(1)}kg` : '-'}
                </p>
              </div>

              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
                  <span>最終記録</span>
                  <span>{formatJP(latestWeight.date)}</span>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <Scale className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-gray-500 dark:text-gray-400">データがありません</p>
            </div>
          )}
        </div>

        {/* Conditioning */}
        <div
          onClick={() => onOpenDetailView('conditioning')}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 cursor-pointer hover:shadow-md transition-all hover:scale-[1.02]"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="bg-purple-100 dark:bg-purple-900/30 p-3 rounded-lg">
                <Heart className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">コンディション</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">Sleep & Wellness</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </div>

          {latestSleep && latestMotivation ? (
            <>
              <div className="space-y-3 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">睡眠時間</span>
                  <span className="text-lg font-bold text-purple-600 dark:text-purple-400">
                    {Number(latestSleep.sleep_hours).toFixed(1)}h
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">睡眠の質</span>
                  <span className="text-lg font-bold text-purple-600 dark:text-purple-400">
                    {latestSleep.sleep_quality}/10
                  </span>
                </div>
              </div>

              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 mb-3">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-xs text-purple-700 dark:text-purple-400 mb-1">意欲</p>
                    <p className="font-bold text-purple-900 dark:text-purple-300">
                      {latestMotivation.motivation_level}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-purple-700 dark:text-purple-400 mb-1">活力</p>
                    <p className="font-bold text-purple-900 dark:text-purple-300">
                      {latestMotivation.energy_level}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-purple-700 dark:text-purple-400 mb-1">ストレス</p>
                    <p className="font-bold text-purple-900 dark:text-purple-300">
                      {latestMotivation.stress_level}
                    </p>
                  </div>
                </div>
              </div>

              {sleepAvg && (
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  週平均睡眠: {sleepAvg.toFixed(1)}時間
                </div>
              )}

              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
                  <span>最終記録</span>
                  <span>{formatJP(latestSleep.date)}</span>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <Heart className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-gray-500 dark:text-gray-400">データがありません</p>
            </div>
          )}
        </div>

        {/* Cycle */}
        {showCycleCard && (
          <div
            onClick={() => onOpenDetailView('cycle')}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 cursor-pointer hover:shadow-md transition-all hover:scale-[1.02]"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div
                  className={`${
                    currentPhase ? getPhaseBg(currentPhase.phase) : 'bg-pink-100 dark:bg-pink-900/30'
                  } p-3 rounded-lg`}
                >
                  <Droplets
                    className={`w-6 h-6 ${
                      currentPhase ? getPhaseColor(currentPhase.phase) : 'text-pink-600 dark:text-pink-400'
                    }`}
                  />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">月経周期</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Menstrual Cycle</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </div>

            {currentPhase ? (
              <>
                <div className="mb-4">
                  <div className="flex items-baseline space-x-2">
                    <span className={`text-2xl font-bold ${getPhaseColor(currentPhase.phase)}`}>
                      {getPhaseDisplayName(currentPhase.phase)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    周期開始から{currentPhase.daysSinceStart + 1}日目
                  </p>
                </div>

                <div className={`${getPhaseBg(currentPhase.phase)} rounded-lg p-3 mb-3`}>
                  <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    トレーニング推奨
                  </p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {getPhaseAdvice(currentPhase.phase)}
                  </p>
                </div>

                {predictedNextPeriod && (
                  <div className="bg-pink-50 dark:bg-pink-900/20 rounded-lg p-3">
                    <p className="text-xs text-pink-700 dark:text-pink-400 mb-1">次回予測日</p>
                    <p className="text-lg font-bold text-pink-800 dark:text-pink-300">
                      {predictedNextPeriod.toLocaleDateString('ja-JP', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                    <p className="text-xs text-pink-600 dark:text-pink-400 mt-1">
                      {Math.ceil(
                        (predictedNextPeriod.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                      )}
                      日後
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8">
                <Droplets className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">周期データがありません</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  月経周期を記録してトレーニングを最適化
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <button
        onClick={onQuickAdd}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl p-4 flex items-center justify-center space-x-2 font-medium transition-colors shadow-lg"
      >
        <Plus className="w-5 h-5" />
        <span>今日の記録を追加</span>
      </button>
    </div>
  );
}