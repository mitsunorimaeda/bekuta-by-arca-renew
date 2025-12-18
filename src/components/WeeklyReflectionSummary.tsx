// src/components/WeeklyReflectionSummary.tsx
import React, { useMemo } from 'react';
import type { Reflection } from '../hooks/useReflections';
import { BarChart3, Tags } from 'lucide-react';

type Props = {
  reflections: Reflection[];
};

export function WeeklyReflectionSummary({ reflections }: Props) {
  const stats = useMemo(() => {
    const days = reflections.length;

    const tagCount = new Map<string, number>();
    for (const r of reflections) {
      for (const t of r.cause_tags ?? []) {
        tagCount.set(t, (tagCount.get(t) ?? 0) + 1);
      }
    }
    const topTags = [...tagCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const wroteFree = reflections.filter((r) => (r.free_note ?? '').trim().length > 0).length;
    const wroteNext = reflections.filter((r) => (r.next_action ?? '').trim().length > 0).length;

    return { days, topTags, wroteFree, wroteNext };
  }, [reflections]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 className="w-5 h-5 text-gray-700 dark:text-gray-200" />
        <h3 className="font-bold text-gray-900 dark:text-white">週の振り返りまとめ（直近7日）</h3>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-3">
          <div className="text-gray-500 dark:text-gray-400 text-xs">入力日数</div>
          <div className="text-xl font-bold text-gray-900 dark:text-white">{stats.days}日</div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-3">
          <div className="text-gray-500 dark:text-gray-400 text-xs">次の一手を書いた日</div>
          <div className="text-xl font-bold text-gray-900 dark:text-white">{stats.wroteNext}日</div>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-center gap-2 mb-2">
          <Tags className="w-4 h-4 text-gray-600 dark:text-gray-300" />
          <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">多かった原因タグ</div>
        </div>

        {stats.topTags.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">まだタグがありません</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {stats.topTags.map(([t, n]) => (
              <span
                key={t}
                className="px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200"
              >
                {t} <span className="opacity-70">×{n}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
        タグが溜まるほど「自分のパターン」が見える → 改善が早くなる。
      </p>
    </div>
  );
}