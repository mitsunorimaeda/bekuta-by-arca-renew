// src/components/PFCBalance.tsx
import React, { useMemo } from "react";

type Totals = { p: number; f: number; c: number };
type Targets = { p: number; f: number; c: number };

function toNum(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function kcalFromPFC(pG: number, fG: number, cG: number) {
  const pK = pG * 4;
  const fK = fG * 9;
  const cK = cG * 4;
  const total = pK + fK + cK;
  return { pK, fK, cK, total };
}

function pct(part: number, total: number) {
  if (!Number.isFinite(total) || total <= 0) return 0;
  return clamp((part / total) * 100, 0, 100);
}

export default function PFCBalance({
  totals,
  targets,
  title = "PFCバランス（kcal比）",
}: {
  totals: Totals;
  targets?: Targets | null;
  title?: string;
}) {
  const data = useMemo(() => {
    const pG = toNum(totals?.p, 0);
    const fG = toNum(totals?.f, 0);
    const cG = toNum(totals?.c, 0);

    const now = kcalFromPFC(pG, fG, cG);

    const nowPct = {
      p: pct(now.pK, now.total),
      f: pct(now.fK, now.total),
      c: pct(now.cK, now.total),
    };

    const tgtPct = (() => {
      if (!targets) return null;
      const tp = toNum(targets.p, 0);
      const tf = toNum(targets.f, 0);
      const tc = toNum(targets.c, 0);
      const t = kcalFromPFC(tp, tf, tc);
      return {
        p: pct(t.pK, t.total),
        f: pct(t.fK, t.total),
        c: pct(t.cK, t.total),
      };
    })();

    return { pG, fG, cG, now, nowPct, tgtPct };
  }, [totals, targets]);

  const totalK = Math.round(data.now.total);

  return (
    <div className="rounded-2xl bg-white dark:bg-gray-900 shadow-sm ring-1 ring-gray-200 dark:ring-gray-800 p-4">
      <div className="flex items-baseline justify-between">
        <div className="text-sm font-semibold text-gray-900 dark:text-white">
          {title}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          合計: <span className="font-bold tabular-nums">{totalK}</span> kcal（P/F/Cから換算）
        </div>
      </div>

      {/* 100% stacked bar */}
      <div className="mt-3">
        <div className="h-3 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden flex">
          <div
            className="h-full bg-emerald-600"
            style={{ width: `${data.nowPct.p}%` }}
            aria-label={`P ${Math.round(data.nowPct.p)}%`}
          />
          <div
            className="h-full bg-orange-500"
            style={{ width: `${data.nowPct.f}%` }}
            aria-label={`F ${Math.round(data.nowPct.f)}%`}
          />
          <div
            className="h-full bg-blue-600"
            style={{ width: `${data.nowPct.c}%` }}
            aria-label={`C ${Math.round(data.nowPct.c)}%`}
          />
        </div>

        {/* 目標比のガイド（薄い縦線） */}
        {data.tgtPct && (
          <div className="relative mt-2 h-3">
            {/* バーの左端からの位置に線を引く：P境界、P+F境界 */}
            <div
              className="absolute top-0 bottom-0 w-px bg-gray-400/70 dark:bg-gray-500/70"
              style={{ left: `${data.tgtPct.p}%` }}
              title={`目標P境界 ${Math.round(data.tgtPct.p)}%`}
            />
            <div
              className="absolute top-0 bottom-0 w-px bg-gray-400/70 dark:bg-gray-500/70"
              style={{ left: `${data.tgtPct.p + data.tgtPct.f}%` }}
              title={`目標F境界 ${Math.round(data.tgtPct.p + data.tgtPct.f)}%`}
            />
            <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
              うすい線＝目標PFC比（目安）
            </div>
          </div>
        )}
      </div>

      {/* 数字（直感用） */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-gray-50 dark:bg-gray-800/60 p-3">
          <div className="text-xs font-semibold text-gray-700 dark:text-gray-200">P</div>
          <div className="mt-1 text-sm font-extrabold tabular-nums text-gray-900 dark:text-white">
            {Math.round(data.nowPct.p)}%
          </div>
          <div className="text-[11px] text-gray-500 dark:text-gray-400 tabular-nums">
            {data.pG.toFixed(1)}g / {Math.round(data.now.pK)}kcal
          </div>
        </div>

        <div className="rounded-xl bg-gray-50 dark:bg-gray-800/60 p-3">
          <div className="text-xs font-semibold text-gray-700 dark:text-gray-200">F</div>
          <div className="mt-1 text-sm font-extrabold tabular-nums text-gray-900 dark:text-white">
            {Math.round(data.nowPct.f)}%
          </div>
          <div className="text-[11px] text-gray-500 dark:text-gray-400 tabular-nums">
            {data.fG.toFixed(1)}g / {Math.round(data.now.fK)}kcal
          </div>
        </div>

        <div className="rounded-xl bg-gray-50 dark:bg-gray-800/60 p-3">
          <div className="text-xs font-semibold text-gray-700 dark:text-gray-200">C</div>
          <div className="mt-1 text-sm font-extrabold tabular-nums text-gray-900 dark:text-white">
            {Math.round(data.nowPct.c)}%
          </div>
          <div className="text-[11px] text-gray-500 dark:text-gray-400 tabular-nums">
            {data.cG.toFixed(1)}g / {Math.round(data.now.cK)}kcal
          </div>
        </div>
      </div>

      {/* 目標との差分（あれば） */}
      {data.tgtPct && (
        <div className="mt-3 text-xs text-gray-600 dark:text-gray-300">
          目標比との差：
          <span className="ml-2 tabular-nums">
            P {Math.round(data.nowPct.p - data.tgtPct.p)}%
          </span>
          <span className="ml-2 tabular-nums">
            F {Math.round(data.nowPct.f - data.tgtPct.f)}%
          </span>
          <span className="ml-2 tabular-nums">
            C {Math.round(data.nowPct.c - data.tgtPct.c)}%
          </span>
        </div>
      )}
    </div>
  );
}