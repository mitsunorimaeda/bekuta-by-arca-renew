// src/components/PFCBalance.tsx
import React, { useMemo } from "react";

type Totals = { p: number; f: number; c: number };

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

/** SVG arc utils */
function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180.0;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}
function describeWedge(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y} Z`;
}

function LabelChip({
  label,
  percent,
  dotClass,
}: {
  label: string;
  percent: number;
  dotClass: string;
}) {
  return (
    <div className="rounded-xl bg-gray-50 dark:bg-gray-800/60 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`inline-block w-2.5 h-2.5 rounded-full ${dotClass} flex-none`} />
          <span className="text-xs font-bold text-gray-900 dark:text-white whitespace-nowrap">
            {label}
          </span>
        </div>
        <span className="text-sm font-extrabold tabular-nums text-gray-900 dark:text-white whitespace-nowrap">
          {Math.round(percent)}%
        </span>
      </div>
    </div>
  );
}

export default function PFCBalance({
  totals,
  title = "PFCバランス",
}: {
  totals: Totals;
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

    // 念のため合計が100にならない誤差を吸収（表示用）
    const sum = nowPct.p + nowPct.f + nowPct.c;
    const fix = sum > 0 ? 100 / sum : 0;
    const displayPct = {
      p: nowPct.p * fix,
      f: nowPct.f * fix,
      c: nowPct.c * fix,
    };

    return { now, displayPct };
  }, [totals]);

  // --- Pie angles (mobile) ---
  const angles = useMemo(() => {
    const p = data.displayPct.p;
    const f = data.displayPct.f;
    const c = data.displayPct.c;

    const pA = (p / 100) * 360;
    const fA = (f / 100) * 360;
    const cA = 360 - pA - fA; // 誤差吸収

    const a0 = 0;
    const a1 = a0 + pA;
    const a2 = a1 + fA;
    const a3 = 360;

    return {
      p: { start: a0, end: a1, mid: (a0 + a1) / 2 },
      f: { start: a1, end: a2, mid: (a1 + a2) / 2 },
      c: { start: a2, end: a3, mid: (a2 + a3) / 2 },
    };
  }, [data.displayPct.p, data.displayPct.f, data.displayPct.c]);

  return (
    <div className="rounded-2xl bg-white dark:bg-gray-900 shadow-sm ring-1 ring-gray-200 dark:ring-gray-800 p-4">
      <div className="text-sm font-semibold text-gray-900 dark:text-white">{title}</div>

      {/* ===== Mobile: Pie (sm未満) ===== */}
      <div className="mt-3 sm:hidden">
        <div className="flex justify-center">
          <svg
            viewBox="0 0 120 120"
            className="w-44 h-44"
            role="img"
            aria-label="PFC pie chart"
          >
            {/* wedges */}
            <path d={describeWedge(60, 60, 52, angles.p.start, angles.p.end)} className="fill-emerald-600" />
            <path d={describeWedge(60, 60, 52, angles.f.start, angles.f.end)} className="fill-orange-500" />
            <path d={describeWedge(60, 60, 52, angles.c.start, angles.c.end)} className="fill-blue-600" />

            {/* labels inside (P/F/C). 小さすぎる比率は見切れ/圧迫を避けるため非表示 */}
            {data.displayPct.p >= 8 && (
              <text
                x={polarToCartesian(60, 60, 30, angles.p.mid).x}
                y={polarToCartesian(60, 60, 30, angles.p.mid).y}
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-white font-extrabold"
                style={{ fontSize: 14 }}
              >
                P
              </text>
            )}
            {data.displayPct.f >= 8 && (
              <text
                x={polarToCartesian(60, 60, 30, angles.f.mid).x}
                y={polarToCartesian(60, 60, 30, angles.f.mid).y}
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-white font-extrabold"
                style={{ fontSize: 14 }}
              >
                F
              </text>
            )}
            {data.displayPct.c >= 8 && (
              <text
                x={polarToCartesian(60, 60, 30, angles.c.mid).x}
                y={polarToCartesian(60, 60, 30, angles.c.mid).y}
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-white font-extrabold"
                style={{ fontSize: 14 }}
              >
                C
              </text>
            )}

            {/* center hole (ドーナツ風：見切れ防止＆見やすい) */}
            <circle cx="60" cy="60" r="24" className="fill-white dark:fill-gray-900" />
          </svg>
        </div>
      </div>

      {/* ===== PC: Stacked bar (sm以上) ===== */}
      <div className="mt-3 hidden sm:block">
        <div className="h-8 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden flex">
          {/* P */}
          <div
            className="relative h-full bg-emerald-600"
            style={{ width: `${data.displayPct.p}%` }}
            title={`P ${Math.round(data.displayPct.p)}%`}
          >
            {data.displayPct.p >= 12 && (
              <span className="absolute inset-0 flex items-center justify-center text-xs font-extrabold text-white">
                P
              </span>
            )}
          </div>

          {/* F */}
          <div
            className="relative h-full bg-orange-500"
            style={{ width: `${data.displayPct.f}%` }}
            title={`F ${Math.round(data.displayPct.f)}%`}
          >
            {data.displayPct.f >= 12 && (
              <span className="absolute inset-0 flex items-center justify-center text-xs font-extrabold text-white">
                F
              </span>
            )}
          </div>

          {/* C */}
          <div
            className="relative h-full bg-blue-600"
            style={{ width: `${data.displayPct.c}%` }}
            title={`C ${Math.round(data.displayPct.c)}%`}
          >
            {data.displayPct.c >= 12 && (
              <span className="absolute inset-0 flex items-center justify-center text-xs font-extrabold text-white">
                C
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ===== % only (always visible, never clipped) ===== */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        <LabelChip label="P（たんぱく質）" percent={data.displayPct.p} dotClass="bg-emerald-600" />
        <LabelChip label="F（脂質）" percent={data.displayPct.f} dotClass="bg-orange-500" />
        <LabelChip label="C（炭水化物）" percent={data.displayPct.c} dotClass="bg-blue-600" />
      </div>
    </div>
  );
}