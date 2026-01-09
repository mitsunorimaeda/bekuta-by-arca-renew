import React, { useMemo } from 'react';
import type { MatrixPoint } from '../hooks/useDailyGrowthMatrix';
import { AlertTriangle, TrendingUp, Users, Zap } from 'lucide-react';

type QuadrantKey = 'HH' | 'HL' | 'LH' | 'LL';

const quadLabel: Record<QuadrantKey, string> = {
  HH: '右上：理解↑×成長↑',
  HL: '右下：理解↑×成長↓',
  LH: '左上：理解↓×成長↑',
  LL: '左下：理解↓×成長↓',
};

function quadrantOf(p: MatrixPoint, threshold = 50): QuadrantKey {
  const highX = p.x >= threshold; // understanding
  const highY = p.y >= threshold; // growth
  if (highX && highY) return 'HH';
  if (highX && !highY) return 'HL';
  if (!highX && highY) return 'LH';
  return 'LL';
}

const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

export function GrowthUnderstandingQuadrantSummary(props: {
  points: MatrixPoint[];
  threshold?: number; // default 50
  topN?: number; // default 5
}) {
  const { points, threshold = 50, topN = 5 } = props;

  const summary = useMemo(() => {
    const buckets: Record<QuadrantKey, MatrixPoint[]> = { HH: [], HL: [], LH: [], LL: [] };

    for (const p of points) {
      buckets[quadrantOf(p, threshold)].push(p);
    }

    const stats = (key: QuadrantKey) => {
      const arr = buckets[key];
      const loads = arr.map((p) => p.load).filter((n) => typeof n === 'number' && isFinite(n));
      return {
        count: arr.length,
        avgLoad: Math.round(avg(loads)),
        avgRPE: Math.round(avg(arr.map((p) => p.rpe).filter((n) => isFinite(n)) as number[] ) * 10) / 10,
      };
    };

    const HH = stats('HH');
    const HL = stats('HL');
    const LH = stats('LH');
    const LL = stats('LL');

    // 要注意：左下(LL)の中で load が高い順（＝消耗疑い）
    const risky = [...buckets.LL]
      .sort((a, b) => (b.load ?? 0) - (a.load ?? 0))
      .slice(0, topN);

    // 良い効率：右上(HH)で load 低め順（＝効率良い成功例）
    const efficient = [...buckets.HH]
      .sort((a, b) => (a.load ?? 0) - (b.load ?? 0))
      .slice(0, topN);

    return { buckets, HH, HL, LH, LL, risky, efficient };
  }, [points, threshold, topN]);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="text-sm sm:text-base font-semibold text-gray-900">象限サマリー</div>
          <div className="text-xs text-gray-500">
            区切り：{threshold} / 左下で負荷が大きいほど「消耗疑い」
          </div>
        </div>
        <div className="text-xs text-gray-500 flex items-center gap-2">
          <Users className="w-4 h-4" />
          {points.length} 件
        </div>
      </div>

      {/* 4象限の人数＋平均負荷 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(['HH', 'LH', 'HL', 'LL'] as QuadrantKey[]).map((k) => {
          const s = (summary as any)[k] as { count: number; avgLoad: number; avgRPE: number };
          const tone =
            k === 'HH'
              ? 'border-emerald-200 bg-emerald-50'
              : k === 'LL'
              ? 'border-red-200 bg-red-50'
              : 'border-gray-200 bg-gray-50';

          return (
            <div key={k} className={`rounded-lg border p-3 ${tone}`}>
              <div className="text-[11px] text-gray-700 mb-1">{quadLabel[k]}</div>
              <div className="text-lg font-bold text-gray-900">{s.count}人</div>
              <div className="text-xs text-gray-700 mt-1 flex items-center gap-1">
                <Zap className="w-3.5 h-3.5" />
                平均負荷 {s.avgLoad}
              </div>
              <div className="text-xs text-gray-600 mt-0.5 flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" />
                平均RPE {s.avgRPE}
              </div>
            </div>
          );
        })}
      </div>

      {/* 要注意トップ */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <div className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            要注意（左下×負荷大）
          </div>

          {summary.risky.length === 0 ? (
            <div className="text-xs text-gray-600">該当なし（良い傾向）</div>
          ) : (
            <ul className="space-y-1.5">
              {summary.risky.map((p) => (
                <li key={p.user_id} className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-900 truncate mr-2">{p.name}</span>
                  <span className="text-xs text-gray-700 whitespace-nowrap">
                    load {Math.round(p.load)} / RPE {p.rpe} / {p.duration_min}分
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 良い例トップ（右上×負荷小） */}
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <div className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-emerald-700" />
            良い例（右上×負荷小）
          </div>

          {summary.efficient.length === 0 ? (
            <div className="text-xs text-gray-600">該当なし</div>
          ) : (
            <ul className="space-y-1.5">
              {summary.efficient.map((p) => (
                <li key={p.user_id} className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-900 truncate mr-2">{p.name}</span>
                  <span className="text-xs text-gray-700 whitespace-nowrap">
                    load {Math.round(p.load)} / RPE {p.rpe} / {p.duration_min}分
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}