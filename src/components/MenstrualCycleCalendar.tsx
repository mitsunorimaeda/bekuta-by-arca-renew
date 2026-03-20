import { useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, TrendingUp, AlertTriangle } from 'lucide-react';
import { useMenstrualCycleData } from '../hooks/useMenstrualCycleData';
import {
  getCyclePhaseForDate,
  predictNextCycle as predictNextCycleUtil,
  getPhaseColor,
  getPhaseLabel,
  type CyclePhaseInfo,
} from '../lib/cyclePhaseUtils';

interface MenstrualCycleCalendarProps {
  userId: string;
}

export function MenstrualCycleCalendar({ userId }: MenstrualCycleCalendarProps) {
  const { cycles } = useMenstrualCycleData(userId);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 指定日のフェーズを取得（cyclePhaseUtils に委譲）
  const getPhaseForDate = (date: Date): CyclePhaseInfo | null => {
    for (const cycle of cycles) {
      const info = getCyclePhaseForDate(cycle, date);
      if (info) return info;
    }
    return null;
  };

  // 予測
  const prediction = predictNextCycleUtil(cycles);
  const predictionStart = prediction ? new Date(prediction.predictedStartDate + 'T00:00:00') : null;
  const predictionEnd = prediction ? new Date(prediction.predictedEndDate + 'T00:00:00') : null;

  const isPredictedDate = (date: Date) => {
    if (!predictionStart || !predictionEnd) return false;
    const t = date.getTime();
    return t >= predictionStart.getTime() && t <= predictionEnd.getTime();
  };

  // カレンダー日付生成
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

  // 現在のフェーズ
  const currentPhaseInfo = getPhaseForDate(today);

  const getCalendarCellColor = (phase: CyclePhaseInfo['phase'] | null) => {
    if (!phase) return 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700';
    const colors = getPhaseColor(phase);
    return `${colors.bg} ${colors.border}`;
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };
  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-pink-600 dark:text-pink-400" />
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            周期カレンダー
          </h3>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={prevMonth}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </button>
          <span className="text-sm font-semibold text-gray-900 dark:text-white min-w-[100px] text-center">
            {currentMonth.getFullYear()}年{currentMonth.getMonth() + 1}月
          </span>
          <button
            onClick={nextMonth}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </button>
        </div>
      </div>

      {/* 曜日 */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {['日', '月', '火', '水', '木', '金', '土'].map((day, idx) => (
          <div
            key={day}
            className={`text-center text-xs font-semibold py-1 ${
              idx === 0
                ? 'text-red-500 dark:text-red-400'
                : idx === 6
                ? 'text-blue-500 dark:text-blue-400'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            {day}
          </div>
        ))}
      </div>

      {/* カレンダーグリッド */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day, idx) => {
          const phaseInfo = getPhaseForDate(day);
          const isPredicted = isPredictedDate(day);
          const isToday = day.getTime() === today.getTime();
          const isCurrentMonth = day.getMonth() === currentMonth.getMonth();

          return (
            <div
              key={idx}
              className={`
                relative aspect-square p-0.5 border rounded-lg transition-all
                ${getCalendarCellColor(phaseInfo?.phase || null)}
                ${isPredicted && !phaseInfo ? 'border-dashed border-2 border-pink-300 dark:border-pink-700' : 'border'}
                ${!isCurrentMonth ? 'opacity-30' : ''}
                ${isToday ? 'ring-2 ring-purple-500 dark:ring-purple-400' : ''}
              `}
            >
              <div className="flex flex-col items-center justify-center h-full">
                <span
                  className={`text-xs sm:text-sm font-medium ${
                    isToday
                      ? 'text-purple-700 dark:text-purple-300 font-bold'
                      : phaseInfo
                      ? 'text-gray-900 dark:text-white'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {day.getDate()}
                </span>

                {phaseInfo && (
                  <div className="flex gap-0.5 mt-0.5">
                    {phaseInfo.isHighPerformance && (
                      <TrendingUp className="w-2.5 h-2.5 text-green-600 dark:text-green-400" />
                    )}
                    {phaseInfo.isInjuryRisk && (
                      <AlertTriangle className="w-2.5 h-2.5 text-orange-500 dark:text-orange-400" />
                    )}
                  </div>
                )}

                {isPredicted && !phaseInfo && (
                  <span className="text-[10px] text-pink-500 dark:text-pink-400 mt-0.5">予</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 凡例（コンパクト） */}
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1">
        {(['menstrual', 'follicular', 'ovulatory', 'luteal'] as const).map(phase => {
          const colors = getPhaseColor(phase);
          return (
            <div key={phase} className="flex items-center gap-1">
              <div className={`w-3 h-3 rounded ${colors.bg} border ${colors.border}`} />
              <span className="text-xs text-gray-600 dark:text-gray-400">{getPhaseLabel(phase)}</span>
            </div>
          );
        })}
        <div className="flex items-center gap-1">
          <TrendingUp className="w-3 h-3 text-green-600 dark:text-green-400" />
          <span className="text-xs text-gray-600 dark:text-gray-400">好調期</span>
        </div>
        <div className="flex items-center gap-1">
          <AlertTriangle className="w-3 h-3 text-orange-500 dark:text-orange-400" />
          <span className="text-xs text-gray-600 dark:text-gray-400">注意期</span>
        </div>
      </div>
    </div>
  );
}
