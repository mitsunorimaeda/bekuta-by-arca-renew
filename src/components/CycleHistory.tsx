import React from 'react';
import { Calendar, TrendingUp, AlertTriangle } from 'lucide-react';
import type { Database } from '../lib/database.types';
import { SYMPTOM_OPTIONS } from '../lib/cycleConstants';

type MenstrualCycle = Database['public']['Tables']['menstrual_cycles']['Row'];

interface CycleHistoryProps {
  cycles: MenstrualCycle[];
}

export function CycleHistory({ cycles }: CycleHistoryProps) {
  if (cycles.length === 0) {
    return (
      <div className="text-center py-8">
        <Calendar className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          まだ記録がありません
        </p>
      </div>
    );
  }

  // 統計情報
  const cycleLengths = cycles
    .filter(c => c.cycle_length_days && c.cycle_length_days > 0)
    .map(c => c.cycle_length_days!);
  const periodDurations = cycles
    .filter(c => c.period_duration_days && c.period_duration_days > 0)
    .map(c => c.period_duration_days!);

  const avgCycleLength = cycleLengths.length > 0
    ? Math.round(cycleLengths.reduce((a, b) => a + b, 0) / cycleLengths.length)
    : null;
  const avgPeriodDuration = periodDurations.length > 0
    ? Math.round(periodDurations.reduce((a, b) => a + b, 0) / periodDurations.length * 10) / 10
    : null;

  // 周期の規則性（標準偏差）
  const isIrregular = cycleLengths.length >= 3 && (() => {
    const mean = cycleLengths.reduce((a, b) => a + b, 0) / cycleLengths.length;
    const variance = cycleLengths.reduce((sum, v) => sum + (v - mean) ** 2, 0) / cycleLengths.length;
    return Math.sqrt(variance) > 5; // 標準偏差5日以上は不規則
  })();

  const flowLabel = (intensity: string | null) => {
    switch (intensity) {
      case 'light': return '軽い';
      case 'moderate': return '普通';
      case 'heavy': return '多い';
      default: return null;
    }
  };

  const getSymptomLabel = (value: string) => {
    const found = SYMPTOM_OPTIONS.find(s => s.value === value);
    return found ? `${found.icon}${found.label}` : value;
  };

  return (
    <div className="space-y-4">
      {/* 統計サマリー */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 text-center">
          <div className="text-xl font-bold text-gray-900 dark:text-white">
            {avgCycleLength ?? '—'}
            {avgCycleLength && <span className="text-sm font-normal text-gray-500">日</span>}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">平均周期</div>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 text-center">
          <div className="text-xl font-bold text-gray-900 dark:text-white">
            {avgPeriodDuration ?? '—'}
            {avgPeriodDuration && <span className="text-sm font-normal text-gray-500">日</span>}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">平均生理日数</div>
        </div>
      </div>

      {/* 不規則警告 */}
      {isIrregular && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
              周期が不安定です
            </p>
            <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-0.5">
              10代は周期が安定しないことが普通です。記録を続けて自分のパターンを知りましょう
            </p>
          </div>
        </div>
      )}

      {/* 規則的な場合 */}
      {cycleLengths.length >= 3 && !isIrregular && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-3 flex items-start gap-2">
          <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm font-medium text-green-800 dark:text-green-300">
            周期は安定しています（約{avgCycleLength}日周期）
          </p>
        </div>
      )}

      {/* 周期一覧 */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider px-1">
          記録一覧（{cycles.length}件）
        </p>
        {cycles.map((cycle) => {
          const symptoms = Array.isArray(cycle.symptoms) ? cycle.symptoms as string[] : [];
          return (
            <div
              key={cycle.id}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-bold text-gray-900 dark:text-white">
                  {formatDate(cycle.cycle_start_date)}〜
                </span>
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  {cycle.period_duration_days && (
                    <span>生理{cycle.period_duration_days}日</span>
                  )}
                  {cycle.cycle_length_days && (
                    <span className="bg-gray-100 dark:bg-gray-700 rounded px-1.5 py-0.5">
                      周期{cycle.cycle_length_days}日
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {flowLabel(cycle.flow_intensity) && (
                  <span className="text-xs bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded px-1.5 py-0.5">
                    出血量: {flowLabel(cycle.flow_intensity)}
                  </span>
                )}
                {symptoms.map((s, i) => (
                  <span
                    key={i}
                    className="text-xs bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded px-1.5 py-0.5"
                  >
                    {getSymptomLabel(s)}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}
