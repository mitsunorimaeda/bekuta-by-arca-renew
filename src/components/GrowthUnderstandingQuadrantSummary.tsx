// src/components/GrowthUnderstandingQuadrantSummary.tsx
import React, { useMemo } from 'react';

type DataPoint = {
  growth_vector?: number | null;
  intent_signal_score?: number | null;
  load?: number | null; // sRPE
};

type Props = {
  data?: DataPoint[] | null;
  title?: string;
  // 50ラインで4象限にする前提（必要なら変えられる）
  threshold?: number;
};

export function GrowthUnderstandingQuadrantSummary({
  data,
  title = '今週のサマリー（4象限）',
  threshold = 50,
}: Props) {
  const safe = Array.isArray(data) ? data : [];

  const summary = useMemo(() => {
    let q1 = 0; // 高成長×高理解
    let q2 = 0; // 低成長×高理解
    let q3 = 0; // 低成長×低理解
    let q4 = 0; // 高成長×低理解

    let sumG = 0;
    let sumU = 0;
    let cnt = 0;

    let totalLoad = 0;

    for (const p of safe) {
      const g = typeof p.growth_vector === 'number' ? p.growth_vector : null;
      const u = typeof p.intent_signal_score === 'number' ? p.intent_signal_score : null;
      const l = typeof p.load === 'number' ? p.load : 0;

      totalLoad += l;

      if (g == null || u == null) continue;
      cnt += 1;
      sumG += g;
      sumU += u;

      const highG = g >= threshold;
      const highU = u >= threshold;

      if (highG && highU) q1 += 1;
      else if (!highG && highU) q2 += 1;
      else if (!highG && !highU) q3 += 1;
      else q4 += 1;
    }

    const avgG = cnt > 0 ? Math.round((sumG / cnt) * 10) / 10 : null;
    const avgU = cnt > 0 ? Math.round((sumU / cnt) * 10) / 10 : null;

    return {
      q1,
      q2,
      q3,
      q4,
      avgG,
      avgU,
      cnt,
      totalLoad: Math.round(totalLoad),
    };
  }, [safe, threshold]);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm sm:text-base font-semibold text-gray-900">{title}</div>
          <div className="mt-1 text-xs text-gray-600">
            ※ {threshold}ラインで4象限 / 点の大きさ=load（sRPE）
          </div>
        </div>

        <div className="text-right text-xs text-gray-600">
          <div>有効点：<b className="text-gray-900">{summary.cnt}</b></div>
          <div>週load：<b className="text-gray-900">{summary.totalLoad}</b></div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-lg border border-gray-200 p-3">
          <div className="text-xs text-gray-600">高成長 × 高理解</div>
          <div className="text-lg font-bold text-gray-900">{summary.q1}</div>
        </div>
        <div className="rounded-lg border border-gray-200 p-3">
          <div className="text-xs text-gray-600">低成長 × 高理解</div>
          <div className="text-lg font-bold text-gray-900">{summary.q2}</div>
        </div>
        <div className="rounded-lg border border-gray-200 p-3">
          <div className="text-xs text-gray-600">低成長 × 低理解</div>
          <div className="text-lg font-bold text-gray-900">{summary.q3}</div>
        </div>
        <div className="rounded-lg border border-gray-200 p-3">
          <div className="text-xs text-gray-600">高成長 × 低理解</div>
          <div className="text-lg font-bold text-gray-900">{summary.q4}</div>
        </div>
      </div>

      <div className="mt-3 text-xs sm:text-sm text-gray-700 flex flex-wrap gap-x-4 gap-y-1">
        <span>
          平均 成長度：<b>{summary.avgG ?? '-'}</b>
        </span>
        <span>
          平均 理解度：<b>{summary.avgU ?? '-'}</b>
        </span>
      </div>
    </div>
  );
}

export default GrowthUnderstandingQuadrantSummary;