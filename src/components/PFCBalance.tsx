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

function roundPct(n: number) {
  return Math.round(n);
}

export default function PFCBalance({
  totals,
  targets,
  title = "PFCバランス",
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

    const nowPctRaw = {
      p: pct(now.pK, now.total),
      f: pct(now.fK, now.total),
      c: pct(now.cK, now.total),
    };

    // 見た目のズレを減らす：最後の1つに誤差を寄せて合計100にする
    const pR = roundPct(nowPctRaw.p);
    const fR = roundPct(nowPctRaw.f);
    const cR = clamp(100 - pR - fR, 0, 100);

    const nowPct = { p: pR, f: fR, c: cR };

    const tgtPct = (() => {
      if (!targets) return null;
      const tp = toNum(targets.p, 0);
      const tf = toNum(targets.f, 0);
      const tc = toNum(targets.c, 0);
      const t = kcalFromPFC(tp, tf, tc);
      return {
        p: roundPct(pct(t.pK, t.total)),
        f: roundPct(pct(t.fK, t.total)),
        c: roundPct(pct(t.cK, t.total)),
      };
    })();

    return { pG, fG, cG, now, nowPct, tgtPct };
  }, [totals, targets]);

  const totalK = Math.round(data.now.total);

  // ---- Donut (SVG) helpers ----
  const donut = useMemo(() => {
    const size = 220; // viewBox
    const cx = size / 2;
    const cy = size / 2;
    const r = 70;
    const stroke = 28;
    const c = 2 * Math.PI * r;

    const segs = [
      { key: "p", label: "P（たんぱく質）", pct: data.nowPct.p, color: "#059669" }, // emerald-600
      { key: "f", label: "F（脂質）", pct: data.nowPct.f, color: "#f97316" }, // orange-500
      { key: "c", label: "C（炭水化物）", pct: data.nowPct.c, color: "#2563eb" }, // blue-600
    ] as const;

    let offset = 0; // in length
    const rings = segs.map((s) => {
      const len = (s.pct / 100) * c;
      const dasharray = `${len} ${Math.max(0, c - len)}`;
      const dashoffset = -offset;
      offset += len;
      return { ...s, dasharray, dashoffset };
    });

    return { size, cx, cy, r, stroke, c, rings };
  }, [data.nowPct]);

  // ---- UI ----
  return (
    <div className="rounded-2xl bg-white dark:bg-gray-900 shadow-sm ring-1 ring-gray-200 dark:ring-gray-800 p-4">
      {/* Header */}
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-sm font-semibold text-gray-900 dark:text-white">
          {title}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          合計: <span className="font-bold tabular-nums">{totalK}</span> kcal（P/F/C換算）
        </div>
      </div>

      {/* PC: 100% stacked bar (そのまま良い前提で、グラフ内にラベルも入れる) */}
      <div className="hidden sm:block mt-3">
        <div className="relative h-4 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden flex">
          <div className="h-full bg-emerald-600" style={{ width: `${data.nowPct.p}%` }} />
          <div className="h-full bg-orange-500" style={{ width: `${data.nowPct.f}%` }} />
          <div className="h-full bg-blue-600" style={{ width: `${data.nowPct.c}%` }} />
          {/* ラベル（PCはバー内に“P（たんぱく質）◯%”まで入れる） */}
          <div className="absolute inset-0 flex text-[11px] font-bold text-white">
            <div className="h-full flex items-center justify-center px-2" style={{ width: `${data.nowPct.p}%` }}>
              <span className="truncate">P（たんぱく質） {data.nowPct.p}%</span>
            </div>
            <div className="h-full flex items-center justify-center px-2" style={{ width: `${data.nowPct.f}%` }}>
              <span className="truncate">F（脂質） {data.nowPct.f}%</span>
            </div>
            <div className="h-full flex items-center justify-center px-2" style={{ width: `${data.nowPct.c}%` }}>
              <span className="truncate">C（炭水化物） {data.nowPct.c}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile: Donut + pills (線なし) */}
      <div className="sm:hidden mt-3">
        <div className="relative mx-auto w-full max-w-[420px] h-[240px]">
          {/* donut */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <svg
              width={200}
              height={200}
              viewBox={`0 0 ${donut.size} ${donut.size}`}
              role="img"
              aria-label="PFCバランス（ドーナツ）"
            >
              {/* base */}
              <circle
                cx={donut.cx}
                cy={donut.cy}
                r={donut.r}
                stroke="rgba(148,163,184,0.35)"
                strokeWidth={donut.stroke}
                fill="transparent"
              />

              {/* rings */}
              <g transform={`rotate(-90 ${donut.cx} ${donut.cy})`}>
                {donut.rings.map((s) => (
                  <circle
                    key={s.key}
                    cx={donut.cx}
                    cy={donut.cy}
                    r={donut.r}
                    stroke={s.color}
                    strokeWidth={donut.stroke}
                    fill="transparent"
                    strokeDasharray={s.dasharray}
                    strokeDashoffset={s.dashoffset}
                  />
                ))}
              </g>

              {/* center text */}
              <text
                x={donut.cx}
                y={donut.cy - 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="24"
                fontWeight="800"
                fill="currentColor"
              >
                {totalK} kcal
              </text>
              <text
                x={donut.cx}
                y={donut.cy + 20}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="12"
                fontWeight="700"
                fill="rgba(107,114,128,0.95)"
              >
                （P/F/C換算）
              </text>
            </svg>
          </div>

          {/* label pills (線なし / 多少かぶってOK) */}
          <LabelPill
            className="absolute left-2 top-4"
            title="C（炭水化物）"
            pct={data.nowPct.c}
          />
          <LabelPill
            className="absolute right-2 top-7"
            title="P（たんぱく質）"
            pct={data.nowPct.p}
          />
          <LabelPill
            className="absolute left-2 bottom-6"
            title="F（脂質）"
            pct={data.nowPct.f}
          />
        </div>
      </div>
    </div>
  );
}

function LabelPill({
  title,
  pct,
  className = "",
}: {
  title: string;
  pct: number;
  className?: string;
}) {
  return (
    <div
      className={[
        "rounded-xl bg-white/95 dark:bg-gray-900/90",
        "ring-1 ring-gray-200 dark:ring-gray-700",
        "px-3 py-2",
        "shadow-sm",
        "max-w-[160px]",
        className,
      ].join(" ")}
    >
      <div className="text-[12px] font-extrabold text-gray-900 dark:text-white leading-tight">
        {title}
      </div>
      <div className="text-[18px] font-extrabold tabular-nums text-gray-900 dark:text-white leading-none mt-0.5">
        {pct}%
      </div>
    </div>
  );
}