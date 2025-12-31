import React, { useMemo } from 'react';
import { Activity, Scale, Heart, TrendingUp, TrendingDown, AlertTriangle, Calendar, ChevronRight, Plus, Droplets } from 'lucide-react';
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

export function ConsolidatedOverviewDashboard({
  acwrData,
  weightRecords,
  sleepRecords,
  motivationRecords,
  trainingRecords,
  menstrualCycles = [],
  userGender,
  onOpenDetailView,
  onQuickAdd
}: ConsolidatedOverviewDashboardProps) {

  // ✅ ACWR: “配列末尾が最新” 前提が崩れる可能性があるなら dateで決める
  const latestACWR = useMemo(() => {
    if (!acwrData || acwrData.length === 0) return null;

    // ACWRData に date がある前提（無いなら末尾でOK）
    const withDate = acwrData.filter((x: any) => x?.date);
    if (withDate.length === 0) return acwrData[acwrData.length - 1] ?? null;

    return withDate.reduce((a: any, b: any) =>
      new Date(a.date).getTime() >= new Date(b.date).getTime() ? a : b
    );
  }, [acwrData]);

  // ✅ 体重：並び順に依存しない
  const latestWeight = useMemo(() => {
    if (!weightRecords || weightRecords.length === 0) return null;
    return weightRecords.reduce((a, b) =>
      new Date(a.date).getTime() >= new Date(b.date).getTime() ? a : b
    );
  }, [weightRecords]);

  // ✅ 睡眠：並び順に依存しない（sleep_quality の null もここで吸収してOK）
  const latestSleep = useMemo(() => {
    if (!sleepRecords || sleepRecords.length === 0) return null;
    return sleepRecords.reduce((a, b) =>
      new Date(a.date).getTime() >= new Date(b.date).getTime() ? a : b
    );
  }, [sleepRecords]);

  // ✅ モチベ：並び順に依存しない
  const latestMotivation = useMemo(() => {
    if (!motivationRecords || motivationRecords.length === 0) return null;
    return motivationRecords.reduce((a, b) =>
      new Date(a.date).getTime() >= new Date(b.date).getTime() ? a : b
    );
  }, [motivationRecords]);

  // ✅ 練習：並び順に依存しない
  const latestTraining = useMemo(() => {
    if (!trainingRecords || trainingRecords.length === 0) return null;
    return trainingRecords.reduce((a, b) =>
      new Date(a.date).getTime() >= new Date(b.date).getTime() ? a : b
    );
  }, [trainingRecords]);


  const getWeightTrend = () => {
    if (weightRecords.length < 2) return null;
    const recent = Number(weightRecords[0].weight_kg);
    const previous = Number(weightRecords[1].weight_kg);
    const diff = recent - previous;
    return { value: diff, isUp: diff > 0 };
  };

  const getSleepAverage = () => {
    if (sleepRecords.length === 0) return null;
    const recentWeek = sleepRecords.slice(0, 7);
    const avg = recentWeek.reduce((sum, r) => sum + Number(r.sleep_hours), 0) / recentWeek.length;
    return avg;
  };

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
      factors++;
      if (latestACWR.riskLevel === 'good') score += 25;
      else if (latestACWR.riskLevel === 'caution') score += 15;
      else if (latestACWR.riskLevel === 'low') score += 20;
      else score += 10;
    }

    if (latestSleep) {
      factors++;
      const hours = Number(latestSleep.sleep_hours);
      const quality = latestSleep.sleep_quality;
      if (hours >= 7 && hours <= 9 && quality >= 7) score += 25;
      else if (hours >= 6 && quality >= 5) score += 15;
      else score += 5;
    }

    if (latestMotivation) {
      factors++;
      const avgMood = (latestMotivation.motivation_level + latestMotivation.energy_level + (10 - latestMotivation.stress_level)) / 3;
      if (avgMood >= 7) score += 25;
      else if (avgMood >= 5) score += 15;
      else score += 5;
    }

    if (latestWeight && weightRecords.length >= 2) {
      factors++;
      const trend = getWeightTrend();
      if (trend && Math.abs(trend.value) < 0.5) score += 25;
      else if (trend && Math.abs(trend.value) < 1) score += 15;
      else score += 10;
    }

    if (factors === 0) return 0;
    return Math.round(score / factors * 4);
  };

  const healthScore = getHealthScore();
  const weightTrend = getWeightTrend();
  const sleepAvg = getSleepAverage();

  const getCurrentCyclePhase = () => {
    if (!menstrualCycles || menstrualCycles.length === 0) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const cycle of menstrualCycles) {
      const startDate = new Date(cycle.cycle_start_date);
      startDate.setHours(0, 0, 0, 0);

      const endDate = cycle.cycle_end_date ? new Date(cycle.cycle_end_date) : null;
      if (endDate) {
        endDate.setHours(0, 0, 0, 0);
      }

      if (today >= startDate && (!endDate || today <= endDate)) {
        const daysSinceStart = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

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

    const sortedCycles = [...menstrualCycles].sort((a, b) =>
      new Date(b.cycle_start_date).getTime() - new Date(a.cycle_start_date).getTime()
    );

    const latestCycle = sortedCycles[0];
    if (!latestCycle.cycle_length_days) return null;

    const lastStart = new Date(latestCycle.cycle_start_date);
    const predictedDate = new Date(lastStart);
    predictedDate.setDate(predictedDate.getDate() + latestCycle.cycle_length_days);

    return predictedDate;
  };

  const getPhaseDisplayName = (phase: string) => {
    switch (phase) {
      case 'menstrual': return '月経期';
      case 'follicular': return '卵胞期';
      case 'ovulatory': return '排卵期';
      case 'luteal': return '黄体期';
      default: return '不明';
    }
  };

  const getPhaseColor = (phase: string) => {
    switch (phase) {
      case 'menstrual': return 'text-red-600 dark:text-red-400';
      case 'follicular': return 'text-green-600 dark:text-green-400';
      case 'ovulatory': return 'text-yellow-600 dark:text-yellow-400';
      case 'luteal': return 'text-blue-600 dark:text-blue-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getPhaseBg = (phase: string) => {
    switch (phase) {
      case 'menstrual': return 'bg-red-100 dark:bg-red-900/30';
      case 'follicular': return 'bg-green-100 dark:bg-green-900/30';
      case 'ovulatory': return 'bg-yellow-100 dark:bg-yellow-900/30';
      case 'luteal': return 'bg-blue-100 dark:bg-blue-900/30';
      default: return 'bg-gray-100 dark:bg-gray-700';
    }
  };

  const getPhaseAdvice = (phase: string) => {
    switch (phase) {
      case 'menstrual': return '低～中強度トレーニングを推奨';
      case 'follicular': return '高強度トレーニングに最適';
      case 'ovulatory': return 'ピークパフォーマンス期';
      case 'luteal': return '回復重視のトレーニングを';
      default: return '';
    }
  };

  const currentPhase = getCurrentCyclePhase();
  const predictedNextPeriod = getPredictedNextPeriod();
  const showCycleCard = userGender === 'female';


// 体重を日付降順に整列（常に [0] が最新になる）
const sortedWeightsDesc = useMemo(() => {
  return [...(weightRecords ?? [])].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}, [weightRecords]);

// 30日変化：30日前以前の「一番近い過去データ」と比較
const diff30 = useMemo(() => {
  const latest = sortedWeightsDesc[0];
  if (!latest?.date || latest.weight_kg == null) return null;

  const latestDate = new Date(latest.date);
  const targetDate = new Date(latestDate);
  targetDate.setDate(targetDate.getDate() - 30);

  const past30 = sortedWeightsDesc.find(
    (r) => r?.date && new Date(r.date) <= targetDate && r.weight_kg != null
  );

  if (!past30) return null;

  return Number(latest.weight_kg) - Number(past30.weight_kg);
}, [sortedWeightsDesc]);

  React.useEffect(() => {
    if (!import.meta.env.DEV) return;
    console.log("[ConsolidatedOverview]", {
      gender: userGender,
      showCycleCard,
      cyclesLen: menstrualCycles?.length ?? 0,
    });
  }, [userGender, showCycleCard, menstrualCycles?.length]);
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
            <div className="text-lg font-bold">{latestACWR?.acwr || '-'}</div>
          </div>
          <div className="bg-white/10 rounded-lg p-3">
            <Scale className="w-5 h-5 mb-1" />
            <div className="text-xs text-blue-100">体重</div>
            <div className="text-lg font-bold">{latestWeight ? `${Number(latestWeight.weight_kg).toFixed(1)}kg` : '-'}</div>
          </div>
          <div className="bg-white/10 rounded-lg p-3">
            <Heart className="w-5 h-5 mb-1" />
            <div className="text-xs text-blue-100">睡眠</div>
            <div className="text-lg font-bold">{latestSleep ? `${Number(latestSleep.sleep_hours).toFixed(1)}h` : '-'}</div>
          </div>
          <div className="bg-white/10 rounded-lg p-3">
            <Heart className="w-5 h-5 mb-1" />
            <div className="text-xs text-blue-100">意欲</div>
            <div className="text-lg font-bold">{latestMotivation ? `${latestMotivation.motivation_level}/10` : '-'}</div>
          </div>
        </div>
      </div>

      <div className={`grid grid-cols-1 gap-6 ${showCycleCard ? 'md:grid-cols-2 lg:grid-cols-4' : 'md:grid-cols-3'}`}>
        <div
          onClick={() => onOpenDetailView('training')}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 cursor-pointer hover:shadow-md transition-all hover:scale-[1.02]"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className={`p-3 rounded-lg ${latestACWR ? getRiskBg(latestACWR.riskLevel) : 'bg-gray-100 dark:bg-gray-700'}`}>
                <Activity className={`w-6 h-6 ${latestACWR ? getRiskColor(latestACWR.riskLevel) : 'text-gray-400'}`} />
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
                  <span className={`text-3xl font-bold ${getRiskColor(latestACWR.riskLevel)}`}>
                    {latestACWR.acwr}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">ACWR</span>
                </div>
                <div className="flex items-center space-x-2 mt-1">
                  {latestACWR.riskLevel === 'high' && <AlertTriangle className="w-4 h-4 text-red-600" />}
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {latestACWR.riskLevel === 'good' && '理想的な負荷'}
                    {latestACWR.riskLevel === 'caution' && '負荷がやや高め'}
                    {latestACWR.riskLevel === 'high' && '怪我リスク警告'}
                    {latestACWR.riskLevel === 'low' && '負荷がやや低め'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">急性負荷</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{latestACWR.acuteLoad}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">慢性負荷</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{latestACWR.chronicLoad}</p>
                </div>
              </div>

              {latestTraining && (
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
                    <span>最終記録</span>
                    <span>{new Date(latestTraining.date).toLocaleDateString('ja-JP')}</span>
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
                      前回比 {weightTrend.isUp ? '+' : ''}{weightTrend.value.toFixed(1)}kg
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
                  <span>{new Date(latestWeight.date).toLocaleDateString('ja-JP')}</span>
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
                    <p className="font-bold text-purple-900 dark:text-purple-300">{latestMotivation.motivation_level}</p>
                  </div>
                  <div>
                    <p className="text-xs text-purple-700 dark:text-purple-400 mb-1">活力</p>
                    <p className="font-bold text-purple-900 dark:text-purple-300">{latestMotivation.energy_level}</p>
                  </div>
                  <div>
                    <p className="text-xs text-purple-700 dark:text-purple-400 mb-1">ストレス</p>
                    <p className="font-bold text-purple-900 dark:text-purple-300">{latestMotivation.stress_level}</p>
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
                  <span>{new Date(latestSleep.date).toLocaleDateString('ja-JP')}</span>
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

        {showCycleCard && (
          <div
            onClick={() => onOpenDetailView('cycle')}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 cursor-pointer hover:shadow-md transition-all hover:scale-[1.02]"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className={`${currentPhase ? getPhaseBg(currentPhase.phase) : 'bg-pink-100 dark:bg-pink-900/30'} p-3 rounded-lg`}>
                  <Droplets className={`w-6 h-6 ${currentPhase ? getPhaseColor(currentPhase.phase) : 'text-pink-600 dark:text-pink-400'}`} />
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
                      {predictedNextPeriod.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
                    </p>
                    <p className="text-xs text-pink-600 dark:text-pink-400 mt-1">
                      {Math.ceil((predictedNextPeriod.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))}日後
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8">
                <Droplets className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">周期データがありません</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">月経周期を記録してトレーニングを最適化</p>
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
