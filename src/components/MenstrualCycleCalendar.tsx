import React, { useState, useMemo } from 'react';
import { Calendar, ChevronLeft, ChevronRight, TrendingUp, AlertTriangle, Info } from 'lucide-react';
import { useMenstrualCycleData } from '../hooks/useMenstrualCycleData';

interface MenstrualCycleCalendarProps {
  userId: string;
}

interface CyclePhaseInfo {
  phase: 'menstrual' | 'follicular' | 'ovulatory' | 'luteal' | null;
  day: number;
  isHighPerformance: boolean;
  isInjuryRisk: boolean;
}

export function MenstrualCycleCalendar({ userId }: MenstrualCycleCalendarProps) {
  const { cycles, getCurrentCyclePhase } = useMenstrualCycleData(userId);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const currentPhase = getCurrentCyclePhase();

  const getCyclePhaseForDate = (date: Date): CyclePhaseInfo => {
    const dateStr = date.toISOString().split('T')[0];

    for (const cycle of cycles) {
      const cycleStart = new Date(cycle.cycle_start_date);
      const cycleEnd = cycle.cycle_end_date ? new Date(cycle.cycle_end_date) : new Date();

      if (date >= cycleStart && date <= cycleEnd) {
        const dayInCycle = Math.floor((date.getTime() - cycleStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;

        let phase: CyclePhaseInfo['phase'] = null;
        let isHighPerformance = false;
        let isInjuryRisk = false;

        if (dayInCycle >= 1 && dayInCycle <= 5) {
          phase = 'menstrual';
          isInjuryRisk = true;
        } else if (dayInCycle >= 6 && dayInCycle <= 13) {
          phase = 'follicular';
          isHighPerformance = true;
        } else if (dayInCycle >= 14 && dayInCycle <= 16) {
          phase = 'ovulatory';
          isHighPerformance = true;
        } else if (dayInCycle >= 17 && dayInCycle <= 28) {
          phase = 'luteal';
          isInjuryRisk = true;
        }

        return { phase, day: dayInCycle, isHighPerformance, isInjuryRisk };
      }
    }

    return { phase: null, day: 0, isHighPerformance: false, isInjuryRisk: false };
  };

  const predictNextCycle = (): { start: Date; end: Date } | null => {
    if (cycles.length === 0) return null;

    const sortedCycles = [...cycles].sort((a, b) =>
      new Date(b.cycle_start_date).getTime() - new Date(a.cycle_start_date).getTime()
    );

    const lastCycle = sortedCycles[0];
    if (!lastCycle.cycle_end_date) return null;

    const avgCycleLength = sortedCycles.reduce((sum, cycle) => {
      if (!cycle.cycle_end_date) return sum;
      const start = new Date(cycle.cycle_start_date);
      const end = new Date(cycle.cycle_end_date);
      return sum + Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    }, 0) / sortedCycles.filter(c => c.cycle_end_date).length;

    const lastEnd = new Date(lastCycle.cycle_end_date);
    const predictedStart = new Date(lastEnd);
    predictedStart.setDate(predictedStart.getDate() + 1);

    const predictedEnd = new Date(predictedStart);
    predictedEnd.setDate(predictedEnd.getDate() + Math.round(avgCycleLength));

    return { start: predictedStart, end: predictedEnd };
  };

  const getCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const days: Date[] = [];
    const current = new Date(startDate);

    while (current <= lastDay || current.getDay() !== 0) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    return days;
  };

  const calendarDays = getCalendarDays();
  const prediction = predictNextCycle();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const getPhaseColor = (phase: CyclePhaseInfo['phase']) => {
    switch (phase) {
      case 'menstrual':
        return 'bg-red-100 dark:bg-red-900/30 border-red-400 dark:border-red-600';
      case 'follicular':
        return 'bg-green-100 dark:bg-green-900/30 border-green-400 dark:border-green-600';
      case 'ovulatory':
        return 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-400 dark:border-yellow-600';
      case 'luteal':
        return 'bg-blue-100 dark:bg-blue-900/30 border-blue-400 dark:border-blue-600';
      default:
        return 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700';
    }
  };

  const getPhaseLabel = (phase: CyclePhaseInfo['phase']) => {
    switch (phase) {
      case 'menstrual': return '月経期';
      case 'follicular': return '卵胞期';
      case 'ovulatory': return '排卵期';
      case 'luteal': return '黄体期';
      default: return '';
    }
  };

  const isPredictedDate = (date: Date) => {
    if (!prediction) return false;
    return date >= prediction.start && date <= prediction.end;
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 transition-colors">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Calendar className="w-6 h-6 text-pink-600 dark:text-pink-400" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
            周期カレンダー
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <span className="text-lg font-semibold text-gray-900 dark:text-white min-w-[120px] text-center">
            {currentMonth.getFullYear()}年 {currentMonth.getMonth() + 1}月
          </span>
          <button
            onClick={nextMonth}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>
      </div>

      {currentPhase && (
        <div className="mb-6 p-4 bg-gradient-to-r from-pink-50 to-purple-50 dark:from-pink-900/20 dark:to-purple-900/20 rounded-lg border border-pink-200 dark:border-pink-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">現在のフェーズ</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {getPhaseLabel(currentPhase.phase as any)} - 周期{currentPhase.dayInCycle}日目
              </p>
            </div>
            {currentPhase.phase === 'follicular' || currentPhase.phase === 'ovulatory' ? (
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <TrendingUp className="w-5 h-5" />
                <span className="text-sm font-medium">ハイパフォーマンス期</span>
              </div>
            ) : currentPhase.phase === 'luteal' || currentPhase.phase === 'menstrual' ? (
              <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
                <AlertTriangle className="w-5 h-5" />
                <span className="text-sm font-medium">怪我リスク注意</span>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {prediction && (
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-2">
            <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">次回の周期予測</p>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                {prediction.start.getMonth() + 1}月{prediction.start.getDate()}日 - {prediction.end.getMonth() + 1}月{prediction.end.getDate()}日
                （カレンダー上の点線枠で表示）
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-7 gap-1 mb-2">
        {['日', '月', '火', '水', '木', '金', '土'].map((day, idx) => (
          <div
            key={day}
            className={`text-center text-sm font-semibold py-2 ${
              idx === 0 ? 'text-red-600 dark:text-red-400' :
              idx === 6 ? 'text-blue-600 dark:text-blue-400' :
              'text-gray-600 dark:text-gray-400'
            }`}
          >
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day, idx) => {
          const phaseInfo = getCyclePhaseForDate(day);
          const isPredicted = isPredictedDate(day);
          const isToday = day.getTime() === today.getTime();
          const isCurrentMonth = day.getMonth() === currentMonth.getMonth();

          return (
            <div
              key={idx}
              className={`
                relative aspect-square p-1 border rounded-lg transition-all
                ${getPhaseColor(phaseInfo.phase)}
                ${isPredicted ? 'border-dashed border-2' : 'border'}
                ${!isCurrentMonth ? 'opacity-40' : ''}
                ${isToday ? 'ring-2 ring-purple-500 dark:ring-purple-400' : ''}
              `}
            >
              <div className="flex flex-col items-center justify-center h-full">
                <span className={`text-sm font-medium ${
                  isToday ? 'text-purple-700 dark:text-purple-300 font-bold' :
                  phaseInfo.phase ? 'text-gray-900 dark:text-white' :
                  'text-gray-600 dark:text-gray-400'
                }`}>
                  {day.getDate()}
                </span>

                {phaseInfo.phase && (
                  <div className="flex gap-0.5 mt-1">
                    {phaseInfo.isHighPerformance && (
                      <TrendingUp className="w-3 h-3 text-green-600 dark:text-green-400" />
                    )}
                    {phaseInfo.isInjuryRisk && (
                      <AlertTriangle className="w-3 h-3 text-orange-600 dark:text-orange-400" />
                    )}
                  </div>
                )}

                {isPredicted && !phaseInfo.phase && (
                  <span className="text-xs text-blue-600 dark:text-blue-400 font-medium mt-1">
                    予測
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">周期フェーズ</h4>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-600"></div>
            <span className="text-sm text-gray-700 dark:text-gray-300">月経期（1-5日目）</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-green-100 dark:bg-green-900/30 border border-green-400 dark:border-green-600"></div>
            <span className="text-sm text-gray-700 dark:text-gray-300">卵胞期（6-13日目）</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-400 dark:border-yellow-600"></div>
            <span className="text-sm text-gray-700 dark:text-gray-300">排卵期（14-16日目）</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-blue-100 dark:bg-blue-900/30 border border-blue-400 dark:border-blue-600"></div>
            <span className="text-sm text-gray-700 dark:text-gray-300">黄体期（17-28日目）</span>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">パフォーマンスガイド</h4>
          <div className="flex items-start gap-2 bg-green-50 dark:bg-green-900/20 p-2 rounded">
            <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5" />
            <div className="text-xs text-green-800 dark:text-green-200">
              <p className="font-medium mb-1">ハイパフォーマンス期</p>
              <p>卵胞期・排卵期：高強度トレーニングに適した時期</p>
            </div>
          </div>
          <div className="flex items-start gap-2 bg-orange-50 dark:bg-orange-900/20 p-2 rounded">
            <AlertTriangle className="w-4 h-4 text-orange-600 dark:text-orange-400 mt-0.5" />
            <div className="text-xs text-orange-800 dark:text-orange-200">
              <p className="font-medium mb-1">怪我リスク注意期</p>
              <p>月経期・黄体期：無理せず調整トレーニング推奨</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
