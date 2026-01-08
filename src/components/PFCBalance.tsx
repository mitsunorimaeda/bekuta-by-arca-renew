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

/** SVG helpers */
function deg2rad(deg: number) {
  return (deg * Math.PI) / 180;
}
function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const a = deg2rad(angleDeg - 90);
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}
function describeWedge(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polar(cx, cy, r, endAngle);
  const end = polar(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y} Z`;
}

type Segment = {
  key: "p" | "f" | "c";
  labelJa: string;
  percent: number;
  start: number;
  end: number;
  mid: number;
  colorClass: string;
};

export default function PFCBalance({
  totals,
  title = "PFCバランス",
}: {
  totals: Totals;
  title?: string;
}) {
  const computed = useMemo(() => {
    const pG = toNum(totals?.p, 0);
    const fG = toNum(totals?.f, 0);
    const cG = toNum(totals?.c, 0);

    const now = kcalFromPFC(pG, fG, cG);
    const rawPct = {
      p: pct(now.pK, now.total),
      f: pct(now.fK, now.total),
      c: pct(now.cK, now.total),
    };

    // 合計100%へ正規化（誤差吸収）
    const sum = rawPct.p + rawPct.f + rawPct.c;
    const fix = sum > 0 ? 100 / sum : 0;

    const displayPct = {
      p: rawPct.p * fix,
      f: rawPct.f * fix,
      c: rawPct.c * fix,
    };

    const pA = (displayPct.p / 100) * 360;
    const fA = (displayPct.f / 100) * 360;
    const cA = 360 - pA - fA;

    const a0 = 0;
    const a1 = a0 + pA;
    const a2 = a1 + fA;
    const a3 = 360;

    const segs: Segment[] = [
      {
        key: "p",
        labelJa: "P（たんぱく質）",
        percent: displayPct.p,
        start: a0,
        end: a1,
        mid: (a0 + a1) / 2,
        colorClass: "fill-emerald-600",
      },
      {
        key: "f",
        labelJa: "F（脂質）",
        percent: displayPct.f,
        start: a1,
        end: a2,
        mid: (a1 + a2) / 2,
        colorClass: "fill-orange-500",
      },
      {
        key: "c",
        labelJa: "C（炭水化物）",
        percent: clamp((cA / 360) * 100, 0, 100),
        start: a2,
        end: a3,
        mid: (a2 + a3) / 2,
        colorClass: "fill-blue-600",
      },
    ];

    return {
      totalK: Math.round(now.total),
      displayPct,
      segs,
    };
  }, [totals]);

  /** ===== mobile pie callouts (見切れ最優先：端から内側に＆伸びる向きを固定) ===== */
  const callouts = useMemo(() => {
    // viewBox: 0..200
    const cx = 100;
    const cy = 92;
    const r = 64;

    const left: any[] = [];
    const right: any[] = [];

    for (const s of computed.segs) {
      const mid = s.mid;
      const edge = polar(cx, cy, r, mid);
      const elbow = polar(cx, cy, r + 10, mid);

      // 右半分判定（角度）
      const isRight = Math.cos(deg2rad(mid - 90)) >= 0;

      // ✅ ここがポイント：右は「右端に置いて右寄せ(end)」＝文字は左へ伸びて見切れない
      // ✅ 左は「左端に置いて左寄せ(start)」＝文字は右へ伸びて見切れない
      const xLabel = isRight ? 188 : 12;
      const textAnchor = isRight ? "end" : "start";

      // 被ってOKなので、外側に出しすぎず少し内側に寄せる
      const yBase = polar(cx, cy, r + 18, mid).y;

      const item = {
        ...s,
        edge,
        elbow,
        isRight,
        xLabel,
        y: yBase,
        textAnchor,
      };

      (isRight ? right : left).push(item);
    }

    function relax(list: any[]) {
      list.sort((a, b) => a.y - b.y);

      const minY = 30;
      const maxY = 160;
      const gap = 18;

      for (let i = 0; i < list.length; i++) {
        const prev = list[i - 1];
        if (!prev) {
          list[i].y = clamp(list[i].y, minY, maxY);
          continue;
        }
        if (list[i].y - prev.y < gap) list[i].y = prev.y + gap;
      }

      const overflow = list.length ? list[list.length - 1].y - maxY : 0;
      if (overflow > 0) for (let i = 0; i < list.length; i++) list[i].y -= overflow;

      const under = list.length ? minY - list[0].y : 0;
      if (under > 0) for (let i = 0; i < list.length; i++) list[i].y += under;

      for (let i = 0; i < list.length; i++) list[i].y = clamp(list[i].y, minY, maxY);

      return list;
    }

    return {
      cx,
      cy,
      r,
      left: relax(left),
      right: relax(right),
    };
  }, [computed.segs]);

  /** ===== PC bar labels ===== */
  const pcLabels = useMemo(() => {
    const p = computed.displayPct.p;
    const f = computed.displayPct.f;
    const c = computed.displayPct.c;

    const pCenter = p / 2;
    const fCenter = p + f / 2;
    const cCenter = p + f + c / 2;

    return [
      { key: "p", center: pCenter, text: `P（たんぱく質） ${Math.round(p)}%` },
      { key: "f", center: fCenter, text: `F（脂質） ${Math.round(f)}%` },
      { key: "c", center: cCenter, text: `C（炭水化物） ${Math.round(c)}%` },
    ];
  }, [computed.displayPct.p, computed.displayPct.f, computed.displayPct.c]);

  return (
    <div className="rounded-2xl bg-white dark:bg-gray-900 shadow-sm ring-1 ring-gray-200 dark:ring-gray-800 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-sm font-semibold text-gray-900 dark:text-white">{title}</div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          合計: <span className="font-bold tabular-nums">{computed.totalK}</span> kcal（P/F/C換算）
        </div>
      </div>

      {/* ===== Mobile: Pie + callout labels ===== */}
      <div className="mt-3 sm:hidden">
        <div className="flex justify-center">
          <svg viewBox="0 0 200 200" className="w-full max-w-[360px]" role="img" aria-label="PFC pie">
            {/* wedges */}
            {computed.segs.map((s) => (
              <path key={s.key} d={describeWedge(callouts.cx, callouts.cy, callouts.r, s.start, s.end)} className={s.colorClass} />
            ))}

            {/* donut hole */}
            <circle cx={callouts.cx} cy={callouts.cy} r={26} className="fill-white dark:fill-gray-900" />

            {/* callout lines + labels */}
            {[...callouts.left, ...callouts.right].map((s: any) => {
              const endX = s.xLabel;
              const endY = s.y;

              // 被ってOKなので、線を短めに（内側に寄せる）
              const elbowX = s.isRight ? s.elbow.x + 6 : s.elbow.x - 6;

              return (
                <g key={`callout-${s.key}`}>
                  <polyline
                    points={`${s.edge.x},${s.edge.y} ${s.elbow.x},${s.elbow.y} ${elbowX},${endY} ${endX},${endY}`}
                    fill="none"
                    stroke="rgba(107,114,128,0.9)"
                    strokeWidth="1.5"
                  />
                  <text
                    x={endX}
                    y={endY}
                    textAnchor={s.textAnchor}
                    dominantBaseline="middle"
                    className="fill-gray-900 dark:fill-gray-100"
                    style={{ fontSize: 12, fontWeight: 800 }}
                  >
                    <tspan x={endX} dy="-2">
                      {s.labelJa}
                    </tspan>
                    <tspan x={endX} dy="14" style={{ fontWeight: 900 }}>
                      {Math.round(s.percent)}%
                    </tspan>
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* ===== PC: stacked bar + inside labels (overlay, not clipped) ===== */}
      <div className="mt-3 hidden sm:block">
        <div className="relative">
          <div className="h-9 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden flex">
            <div className="h-full bg-emerald-600" style={{ width: `${computed.displayPct.p}%` }} />
            <div className="h-full bg-orange-500" style={{ width: `${computed.displayPct.f}%` }} />
            <div className="h-full bg-blue-600" style={{ width: `${computed.displayPct.c}%` }} />
          </div>

          <div className="pointer-events-none absolute inset-0">
            {pcLabels.map((l) => (
              <div
                key={l.key}
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 px-2"
                style={{ left: `${l.center}%` }}
              >
                <div className="text-[12px] font-extrabold text-white whitespace-nowrap drop-shadow">
                  {l.text}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}