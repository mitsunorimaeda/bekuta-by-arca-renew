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

// バー内に置くラベル：狭い区画は出さない（見切れ防止）
function shouldShowLabel(widthPct: number) {
  return widthPct >= 12; // 12%未満は無理に出さない
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

  const labels = {
    p: `P（たんぱく質）`,
    f: `F（脂質）`,
    c: `C（炭水化物）`,
  };

  return (
    <div className="rounded-2xl bg-white dark:bg-gray-900 shadow-sm ring-1 ring-gray-200 dark:ring-gray-800 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-sm font-semibold text-gray-900 dark:text-white">
          {title}
        </div>
        <div className="text-[11px] text-gray-500 dark:text-gray-400">
          合計: <span className="font-bold tabular-nums">{totalK}</span> kcal
        </div>
      </div>

      {/* 100% stacked bar + labels inside */}
      <div className="mt-3">
        <div className="h-10 rounded-2xl bg-gray-200 dark:bg-gray-700 overflow-hidden flex">
          {/* P */}
          <div
            className="h-full bg-emerald-600 relative flex items-center justify-center"
            style={{ width: `${data.nowPct.p}%` }}
            aria-label={`P ${Math.round(data.nowPct.p)}%`}
          >
            {shouldShowLabel(data.nowPct.p) && (
              <div className="px-2 text-white text-[11px] sm:text-xs font-bold leading-tight text-center whitespace-nowrap">
                {labels.p}
                <span className="ml-1 tabular-nums">{Math.round(data.nowPct.p)}%</span>
              </div>
            )}
          </div>

          {/* F */}
          <div
            className="h-full bg-orange-500 relative flex items-center justify-center"
            style={{ width: `${data.nowPct.f}%` }}
            aria-label={`F ${Math.round(data.nowPct.f)}%`}
          >
            {shouldShowLabel(data.nowPct.f) && (
              <div className="px-2 text-white text-[11px] sm:text-xs font-bold leading-tight text-center whitespace-nowrap">
                {labels.f}
                <span className="ml-1 tabular-nums">{Math.round(data.nowPct.f)}%</span>
              </div>
            )}
          </div>

          {/* C */}
          <div
            className="h-full bg-blue-600 relative flex items-center justify-center"
            style={{ width: `${data.nowPct.c}%` }}
            aria-label={`C ${Math.round(data.nowPct.c)}%`}
          >
            {shouldShowLabel(data.nowPct.c) && (
              <div className="px-2 text-white text-[11px] sm:text-xs font-bold leading-tight text-center whitespace-nowrap">
                {labels.c}
                <span className="ml-1 tabular-nums">{Math.round(data.nowPct.c)}%</span>
              </div>
            )}
          </div>

          {/* どれかが小さすぎてラベルが出ない時の“凡例”を右下に出す（スマホ救済） */}
          {(!shouldShowLabel(data.nowPct.p) ||
            !shouldShowLabel(data.nowPct.f) ||
            !shouldShowLabel(data.nowPct.c)) && (
            <div className="absolute right-3 bottom-2 text-[10px] sm:text-[11px] text-white/90 font-bold">
              P/F/C
            </div>
          )}
        </div>

        {/* 目標比ガイド線（バー上に重ねる） */}
        {data.tgtPct && (
          <div className="relative mt-2 h-0">
            <div
              className="absolute -top-10 bottom-0 w-px bg-white/70 dark:bg-white/60"
              style={{ left: `${data.tgtPct.p}%` }}
              title={`目標P境界 ${Math.round(data.tgtPct.p)}%`}
            />
            <div
              className="absolute -top-10 bottom-0 w-px bg-white/70 dark:bg-white/60"
              style={{ left: `${data.tgtPct.p + data.tgtPct.f}%` }}
              title={`目標F境界 ${Math.round(data.tgtPct.p + data.tgtPct.f)}%`}
            />
          </div>
        )}

        {data.tgtPct && (
          <div className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
            うすい線＝目標PFC比（目安）
          </div>
        )}
      </div>

      {/* スマホは“下の3カード”をやめて、1行の軽いサマリーにする */}
      <div className="mt-3 text-xs text-gray-600 dark:text-gray-300">
        P {data.pG.toFixed(1)}g / F {data.fG.toFixed(1)}g / C {data.cG.toFixed(1)}g
      </div>

      {/* 目標との差分（あれば） */}
      {data.tgtPct && (
        <div className="mt-2 text-[11px] text-gray-600 dark:text-gray-300">
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