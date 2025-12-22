// src/components/InBodyLatestCard.tsx
import React from 'react';
import { Scale, Percent, Calendar, Dumbbell, Droplets } from 'lucide-react';
import type { InbodyRecordLite } from '../hooks/useInbodyData';

function jpDate(d: string) {
  const dt = new Date(d + 'T00:00:00');
  return Number.isNaN(dt.getTime()) ? d : dt.toLocaleDateString('ja-JP');
}

export function InBodyLatestCard({
  latest,
  loading,
  error,
}: {
  latest: InbodyRecordLite | null;
  loading: boolean;
  error: string | null;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 sm:p-6 transition-colors">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
          InBody（最新）
        </h3>
        <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
          <Calendar className="w-4 h-4 mr-1" />
          {latest?.measured_at ? jpDate(latest.measured_at) : '—'}
        </div>
      </div>

      {loading ? (
        <div className="animate-pulse h-20 bg-gray-100 dark:bg-gray-700 rounded-lg" />
      ) : error ? (
        <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
      ) : !latest ? (
        <div className="text-sm text-gray-600 dark:text-gray-400">
          InBodyデータがまだありません（CSV取り込み後に表示されます）
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 transition-colors">
            <div className="flex items-center text-xs text-gray-600 dark:text-gray-400 mb-1">
              <Scale className="w-4 h-4 mr-1" /> 体重
            </div>
            <div className="text-lg font-bold text-gray-900 dark:text-white">
              {latest.weight != null ? `${latest.weight.toFixed(1)} kg` : '—'}
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 transition-colors">
            <div className="flex items-center text-xs text-gray-600 dark:text-gray-400 mb-1">
              <Dumbbell className="w-4 h-4 mr-1" /> 除脂肪量
            </div>
            <div className="text-lg font-bold text-gray-900 dark:text-white">
              {latest.fat_free_mass != null ? `${latest.fat_free_mass.toFixed(1)} kg` : '—'}
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 transition-colors">
            <div className="flex items-center text-xs text-gray-600 dark:text-gray-400 mb-1">
              <Droplets className="w-4 h-4 mr-1" /> 体脂肪量
            </div>
            <div className="text-lg font-bold text-gray-900 dark:text-white">
              {latest.fat_mass != null ? `${latest.fat_mass.toFixed(1)} kg` : '—'}
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 transition-colors">
            <div className="flex items-center text-xs text-gray-600 dark:text-gray-400 mb-1">
              <Percent className="w-4 h-4 mr-1" /> 体脂肪率
            </div>
            <div className="text-lg font-bold text-gray-900 dark:text-white">
              {latest.body_fat_percent != null ? `${latest.body_fat_percent.toFixed(1)} %` : '—'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}