// src/components/PFCBalance.tsx
import React, { useEffect, useMemo, useState } from "react";

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

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const m = window.matchMedia(query);
    const onChange = () => setMatches(m.matches);
    onChange();
    if (m.addEventListener) m.addEventListener("change", onChange);
    else m.addListener(onChange);
    return () => {
      if (m.removeEventListener) m.removeEventListener("change", onChange);
      else m.removeListener(onChange);
    };
  }, [query]);

  return matches;
}

function useIsDark() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const read = () => {
      const hasClass =
        typeof document !== "undefined" &&
        document.documentElement?.classList?.contains("dark");
      const prefers = window.matchMedia?.("(prefers-color-scheme: dark)")?.matches;
      setDark(Boolean(hasClass ?? prefers));
    };

    read();

    const m = window.matchMedia?.("(prefers-color-scheme: dark)");
    const onChange = () => read();
    if (m?.addEventListener) m.addEventListener("change", onChange);
    else m?.addListener?.(onChange);

    // class の変更も拾いたい（Tailwindのdark切替）
    const obs =
      typeof MutationObserver !== "undefined"
        ? new MutationObserver(() => read())
        : null;
    obs?.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    return () => {
      if (m?.removeEventListener) m.removeEventListener("change", onChange);
      else m?.removeListener?.(onChange);
      obs?.disconnect();
    };
  }, []);

  return dark;
}

/** SVG donut helpers */
function polarToCartesian(cx: number, cy: number, r: number, angleRad: number) {
  return {
    x: cx + r * Math.cos(angleRad),
    y: cy + r * Math.sin(angleRad),
  };
}

function describeArcDonut(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  startAngleRad: number,
  endAngleRad: number
) {
  const largeArcFlag = endAngleRad - startAngleRad > Math.PI ? 1 : 0;

  const p1 = polarToCartesian(cx, cy, rOuter, startAngleRad);
  const p2 = polarToCartesian(cx, cy, rOuter, endAngleRad);
  const p3 = polarToCartesian(cx, cy, rInner, endAngleRad);
  const p4 = polarToCartesian(cx, cy, rInner, startAngleRad);

  // sweep-flag = 1 で時計回り
  return [
    `M ${p1.x} ${p1.y}`,
    `A ${rOuter} ${rOuter} 0 ${largeArcFlag} 1 ${p2.x} ${p2.y}`,
    `L ${p3.x} ${p3.y}`,
    `A ${rInner} ${rInner} 0 ${largeArcFlag} 0 ${p4.x} ${p4.y}`,
    "Z",
  ].join(" ");
}

type LabelItem = {
  key: "p" | "f" | "c";
  name: string;
  pct: number;
  color: string;
  midRad: number;
};

function adjustYPositions(items: { y: number }[], minGap: number, minY: number, maxY: number) {
  // items は y 昇順を想定
  for (let i = 1; i < items.length; i++) {
    const prev = items[i - 1];
    const cur = items[i];
    if (cur.y - prev.y < minGap) cur.y = prev.y + minGap;
  }
  // 下に押し出し過ぎたら、上から詰め直す
  const overflow = items.length ? items[items.length - 1].y - maxY : 0;
  if (overflow > 0) {
    for (let i = items.length - 1; i >= 0; i--) items[i].y -= overflow;
    for (let i = 0; i < items.length; i++) {
      if (i === 0) items[i].y = Math.max(items[i].y, minY);
      else items[i].y = Math.max(items[i].y, items[i - 1].y + minGap);
    }
  }
  // 上にはみ出たら下へ
  const under = items.length ? minY - items[0].y : 0;
  if (under > 0) {
    for (let i = 0; i < items.length; i++) items[i].y += under;
  }
}

export default function PFCBalance({
  totals,
  targets, // 今は使わない（将来のために残す）
  title = "PFCバランス",
}: {
  totals: Totals;
  targets?: Targets | null;
  title?: string;
}) {
  const isSm = useMediaQuery("(max-width: 639px)");
  const isDark = useIsDark();

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

    return { pG, fG, cG, now, nowPct };
  }, [totals]);

  const totalK = Math.round(data.now.total);

  // 表示用（丸め）
  const pPct = Math.round(data.nowPct.p);
  const fPct = Math.round(data.nowPct.f);
  const cPct = Math.round(data.nowPct.c);

  // 色（現状の雰囲気を維持）
  const colors = {
    p: "#059669", // emerald-600
    f: "#F97316", // orange-500
    c: "#2563EB", // blue-600
  };

  const borderStroke = isDark ? "rgba(17,24,39,0.9)" : "rgba(255,255,255,0.95)";
  const labelPill = isDark ? "rgba(17,24,39,0.70)" : "rgba(255,255,255,0.85)";
  const labelText = isDark ? "#E5E7EB" : "#111827"; // gray-200 / gray-900
  const lineStroke = isDark ? "rgba(148,163,184,0.75)" : "rgba(107,114,128,0.65)"; // slate-400 / gray-500

  /** PC: 100% stacked bar（中にラベル） */
  const PcBar = () => {
    const pW = clamp(data.nowPct.p, 0, 100);
    const fW = clamp(data.nowPct.f, 0, 100);
    const cW = clamp(100 - pW - fW, 0, 100); // 誤差吸収

    const label = (key: "p" | "f" | "c", pctVal: number) => {
      const name =
        key === "p" ? "P（たんぱく質）" : key === "f" ? "F（脂質）" : "C（炭水化物）";
      return `${name} ${pctVal}%`;
    };

    return (
      <div className="mt-3">
        <div className="relative h-12 rounded-2xl overflow-hidden bg-gray-200 dark:bg-gray-700 flex">
          <div className="h-full" style={{ width: `${pW}%`, background: colors.p }} />
          <div className="h-full" style={{ width: `${fW}%`, background: colors.f }} />
          <div className="h-full" style={{ width: `${cW}%`, background: colors.c }} />

          {/* ラベル（被ってOK / 中央寄せ） */}
          <div className="absolute inset-0 flex">
            <div className="flex items-center justify-center px-2" style={{ width: `${pW}%` }}>
              <span
                className="text-[12px] font-extrabold tracking-tight text-white whitespace-nowrap"
                style={{ textShadow: "0 1px 2px rgba(0,0,0,0.25)" }}
              >
                {label("p", pPct)}
              </span>
            </div>
            <div className="flex items-center justify-center px-2" style={{ width: `${fW}%` }}>
              <span
                className="text-[12px] font-extrabold tracking-tight text-white whitespace-nowrap"
                style={{ textShadow: "0 1px 2px rgba(0,0,0,0.25)" }}
              >
                {label("f", fPct)}
              </span>
            </div>
            <div className="flex items-center justify-center px-2" style={{ width: `${cW}%` }}>
              <span
                className="text-[12px] font-extrabold tracking-tight text-white whitespace-nowrap"
                style={{ textShadow: "0 1px 2px rgba(0,0,0,0.25)" }}
              >
                {label("c", cPct)}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  /** SP: donut + callout（見切れ防止＆衝突回避） */
  const SpDonut = () => {
    // SVG 設計：見切れ防止のため余白多め
    const W = 340;
    const H = 230;
    const pad = 18;
    const cx = W / 2;
    const cy = 118;

    const rOuter = 72;
    const rInner = 34;

    // 角度（開始を上：-90度）
    const startBase = -Math.PI / 2;

    // 3セグメント
    const items: LabelItem[] = [
      { key: "p", name: "P（たんぱく質）", pct: pPct, color: colors.p, midRad: 0 },
      { key: "f", name: "F（脂質）", pct: fPct, color: colors.f, midRad: 0 },
      { key: "c", name: "C（炭水化物）", pct: cPct, color: colors.c, midRad: 0 },
    ];

    // 角度確定（誤差吸収で合計100に寄せる）
    const raw = [
      clamp(data.nowPct.p, 0, 100),
      clamp(data.nowPct.f, 0, 100),
      clamp(100 - clamp(data.nowPct.p, 0, 100) - clamp(data.nowPct.f, 0, 100), 0, 100),
    ];
    const pctArr = raw;

    let cur = startBase;
    const arcs = pctArr.map((p, idx) => {
      const ang = (p / 100) * Math.PI * 2;
      const s = cur;
      const e = cur + ang;
      cur = e;
      return { s, e, idx, pct: p };
    });

    // mid angle
    arcs.forEach((a) => {
      const mid = (a.s + a.e) / 2;
      items[a.idx].midRad = mid;
    });

    // ラベル位置（左右で整列＋Y衝突回避）
    const left: any[] = [];
    const right: any[] = [];

    const labelAnchorXRight = cx + rOuter + 62;
    const labelAnchorXLeft = cx - rOuter - 62;
    const labelMinY = pad + 14;
    const labelMaxY = H - pad - 14;
    const minGap = 18;

    items.forEach((it) => {
      const side = Math.cos(it.midRad) >= 0 ? "right" : "left";
      const out = polarToCartesian(cx, cy, rOuter + 10, it.midRad);
      const y0 = out.y;
      const o = {
        ...it,
        side,
        // line start（外周）
        sx: out.x,
        sy: out.y,
        // elbow（少し外へ）
        ex: polarToCartesian(cx, cy, rOuter + 22, it.midRad).x,
        ey: polarToCartesian(cx, cy, rOuter + 22, it.midRad).y,
        // label target（後で調整）
        lx: side === "right" ? labelAnchorXRight : labelAnchorXLeft,
        ly: y0,
      };
      (side === "right" ? right : left).push(o);
    });

    right.sort((a, b) => a.ly - b.ly);
    left.sort((a, b) => a.ly - b.ly);

    adjustYPositions(right, minGap, labelMinY, labelMaxY);
    adjustYPositions(left, minGap, labelMinY, labelMaxY);

    const placed = [...right, ...left];

    const pillW = 154;
    const pillH = 36;

    return (
      <div className="mt-3">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          height={H}
          className="block"
          role="img"
          aria-label="PFCバランス（ドーナツ）"
        >
          {/* donut */}
          {arcs.map((a) => {
            const it = items[a.idx];
            const d = describeArcDonut(cx, cy, rOuter, rInner, a.s, a.e);
            return (
              <path
                key={it.key}
                d={d}
                fill={it.color}
                stroke={borderStroke}
                strokeWidth={2}
              />
            );
          })}

          {/* center text */}
          <text
            x={cx}
            y={cy - 2}
            textAnchor="middle"
            fontSize="18"
            fontWeight={900}
            fill={labelText}
          >
            {totalK} kcal
          </text>
          <text
            x={cx}
            y={cy + 18}
            textAnchor="middle"
            fontSize="11"
            fontWeight={700}
            fill={isDark ? "rgba(209,213,219,0.85)" : "rgba(75,85,99,0.75)"}
          >
            （P/F/C換算）
          </text>

          {/* callouts */}
          {placed.map((it: any) => {
            const isRight = it.side === "right";
            const tx = it.lx;
            const ty = it.ly;

            const lineEndX = isRight ? tx - pillW / 2 : tx + pillW / 2;
            const lineEndY = ty;

            return (
              <g key={it.key}>
                {/* leader line（折れ線） */}
                <path
                  d={`M ${it.sx} ${it.sy} L ${it.ex} ${it.ey} L ${lineEndX} ${lineEndY}`}
                  fill="none"
                  stroke={lineStroke}
                  strokeWidth={2}
                  strokeLinecap="round"
                />

                {/* label pill */}
                <rect
                  x={tx - pillW / 2}
                  y={ty - pillH / 2}
                  width={pillW}
                  height={pillH}
                  rx={10}
                  fill={labelPill}
                  stroke={isDark ? "rgba(148,163,184,0.25)" : "rgba(107,114,128,0.18)"}
                />

                {/* text (2 lines OK) */}
                <text
                  x={tx}
                  y={ty - 3}
                  textAnchor="middle"
                  fontSize="12"
                  fontWeight={900}
                  fill={labelText}
                >
                  {it.name}
                </text>
                <text
                  x={tx}
                  y={ty + 14}
                  textAnchor="middle"
                  fontSize="16"
                  fontWeight={900}
                  fill={labelText}
                >
                  {it.pct}%
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  };

  return (
    <div className="rounded-2xl bg-white dark:bg-gray-900 shadow-sm ring-1 ring-gray-200 dark:ring-gray-800 p-4">
      <div className="flex items-baseline justify-between">
        <div className="text-sm font-semibold text-gray-900 dark:text-white">{title}</div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          合計: <span className="font-bold tabular-nums">{totalK}</span> kcal（P/F/C換算）
        </div>
      </div>

      {/* PC: bar / SP: donut */}
      {isSm ? <SpDonut /> : <PcBar />}
    </div>
  );
}