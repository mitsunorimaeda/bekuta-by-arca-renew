// src/components/PFCBalance.tsx
import React, { useMemo, useState } from "react";

type Totals = { p: number; f: number; c: number };
type Targets = { p: number; f: number; c: number }; // 将来用（今は使わない）

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

/**
 * 小数% → 整数% にして「必ず合計100」になるよう調整
 *（最大剰余法 / Largest Remainder Method）
 */
function toIntPct100(p: number, f: number, c: number) {
  const raw = [
    { key: "p" as const, v: clamp(p, 0, 100) },
    { key: "f" as const, v: clamp(f, 0, 100) },
    { key: "c" as const, v: clamp(c, 0, 100) },
  ];

  // total が 0 のケースは呼び出し側で弾く
  const floors = raw.map((x) => ({
    ...x,
    floor: Math.floor(x.v),
    frac: x.v - Math.floor(x.v),
  }));

  let sum = floors.reduce((acc, x) => acc + x.floor, 0);
  let remain = 100 - sum;

  // frac の大きい順に +1 して合計100に寄せる
  floors.sort((a, b) => b.frac - a.frac);

  const addMap: Record<"p" | "f" | "c", number> = { p: 0, f: 0, c: 0 };
  for (let i = 0; i < floors.length && remain > 0; i++) {
    addMap[floors[i].key] += 1;
    remain -= 1;
  }

  // 元の順に戻して返す
  const base: Record<"p" | "f" | "c", number> = { p: 0, f: 0, c: 0 };
  for (const x of raw) {
    const fnd = floors.find((z) => z.key === x.key)!;
    base[x.key] = fnd.floor + addMap[x.key];
  }

  // 念のため最終調整（丸め誤差や極端値対策）
  const finalSum = base.p + base.f + base.c;
  if (finalSum !== 100) {
    // どれかに差分を乗せる（最大のやつに寄せる）
    const maxKey = (["p", "f", "c"] as const).reduce((best, k) =>
      base[k] > base[best] ? k : best
    , "p");
    base[maxKey] += 100 - finalSum;
  }

  return base;
}

function fmt1(n: number) {
  return Math.round(n * 10) / 10;
}

type Key = "p" | "f" | "c";

const LABEL: Record<Key, { short: string; long: string }> = {
  p: { short: "P", long: "たんぱく質" },
  f: { short: "F", long: "脂質" },
  c: { short: "C", long: "炭水化物" },
};

export default function PFCBalance({
  totals,
  targets, // 今は未使用（残しておく）
  title = "PFCバランス",
}: {
  totals: Totals;
  targets?: Targets | null;
  title?: string;
}) {
  const [active, setActive] = useState<Key | null>(null);

  const data = useMemo(() => {
    const pG = toNum(totals?.p, 0);
    const fG = toNum(totals?.f, 0);
    const cG = toNum(totals?.c, 0);

    const now = kcalFromPFC(pG, fG, cG);
    const total = now.total;

    if (!Number.isFinite(total) || total <= 0) {
      return {
        pG,
        fG,
        cG,
        now,
        totalK: 0,
        pctInt: { p: 0, f: 0, c: 0 } as Record<Key, number>,
        pctFloat: { p: 0, f: 0, c: 0 } as Record<Key, number>,
      };
    }

    const pPct = (now.pK / total) * 100;
    const fPct = (now.fK / total) * 100;
    const cPct = (now.cK / total) * 100;

    const pctInt = toIntPct100(pPct, fPct, cPct);

    return {
      pG,
      fG,
      cG,
      now,
      totalK: Math.round(total),
      pctInt: pctInt as Record<Key, number>,
      pctFloat: { p: pPct, f: fPct, c: cPct } as Record<Key, number>,
    };
  }, [totals]);

  const totalK = data.totalK;

  const activeDetail = useMemo(() => {
    if (!active) return null;
    const g =
      active === "p" ? data.pG : active === "f" ? data.fG : data.cG;
    const k =
      active === "p" ? data.now.pK : active === "f" ? data.now.fK : data.now.cK;
    const pct = data.pctInt[active] ?? 0;
    return { g, k, pct, key: active };
  }, [active, data]);

  const setOrToggle = (k: Key) => {
    setActive((prev) => (prev === k ? null : k));
  };

  const fade = (k: Key) => {
    if (!active) return "opacity-100";
    return active === k ? "opacity-100" : "opacity-35";
  };

  const isEmpty = totalK <= 0;

  return (
    <div className="rounded-2xl bg-white dark:bg-gray-900 shadow-sm ring-1 ring-gray-200 dark:ring-gray-800 p-4">
      {/* Header（最小情報） */}
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-sm font-semibold text-gray-900 dark:text-white">
          {title}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          合計: <span className="font-bold tabular-nums">{totalK}</span> kcal（P/F/C換算）
        </div>
      </div>

      {/* 0kcal / 未入力 */}
      {isEmpty ? (
        <div className="mt-4 rounded-xl bg-gray-50 dark:bg-gray-800/60 p-4 text-sm text-gray-600 dark:text-gray-300">
          まだ記録がありません（写真で食事を追加するとPFCバランスが表示されます）
        </div>
      ) : (
        <>
          {/* =========================
              PC（sm以上）：横バー + グラフ内ラベル
             ========================= */}
          <div className="hidden sm:block mt-3">
            <div className="h-10 rounded-xl bg-gray-200 dark:bg-gray-700 overflow-hidden flex">
              {/* P */}
              <button
                type="button"
                onClick={() => setOrToggle("p")}
                className={`h-full bg-emerald-600 flex items-center justify-center px-2 ${fade(
                  "p"
                )}`}
                style={{ width: `${data.pctInt.p}%` }}
                title={`P（たんぱく質） ${data.pctInt.p}%`}
              >
                <span className="text-white font-semibold text-xs whitespace-nowrap drop-shadow">
                  P（たんぱく質） {data.pctInt.p}%
                </span>
              </button>

              {/* F */}
              <button
                type="button"
                onClick={() => setOrToggle("f")}
                className={`h-full bg-orange-500 flex items-center justify-center px-2 ${fade(
                  "f"
                )}`}
                style={{ width: `${data.pctInt.f}%` }}
                title={`F（脂質） ${data.pctInt.f}%`}
              >
                <span className="text-white font-semibold text-xs whitespace-nowrap drop-shadow">
                  F（脂質） {data.pctInt.f}%
                </span>
              </button>

              {/* C */}
              <button
                type="button"
                onClick={() => setOrToggle("c")}
                className={`h-full bg-blue-600 flex items-center justify-center px-2 ${fade(
                  "c"
                )}`}
                style={{ width: `${data.pctInt.c}%` }}
                title={`C（炭水化物） ${data.pctInt.c}%`}
              >
                <span className="text-white font-semibold text-xs whitespace-nowrap drop-shadow">
                  C（炭水化物） {data.pctInt.c}%
                </span>
              </button>
            </div>

            {/* タップ後の1行詳細 */}
            {activeDetail && (
              <div className="mt-2 text-xs text-gray-600 dark:text-gray-300 tabular-nums">
                {LABEL[activeDetail.key].short}（{LABEL[activeDetail.key].long}）：
                {fmt1(activeDetail.g)}g / {Math.round(activeDetail.k)}kcal（{activeDetail.pct}%）
              </div>
            )}
          </div>

          {/* =========================
              Mobile（sm未満）：ドーナツ + ピル（線なし）
             ========================= */}
          <div className="sm:hidden mt-3">
            <div className="relative rounded-2xl bg-gray-50 dark:bg-gray-800/60 p-3">
              <div className="relative mx-auto w-[260px] max-w-full">
                {/* Donut */}
                <svg
                  viewBox="0 0 200 200"
                  className="block mx-auto w-[220px] h-[220px]"
                >
                  {/* 背景リング */}
                  <circle
                    cx="100"
                    cy="100"
                    r="70"
                    fill="none"
                    stroke="rgba(156,163,175,0.25)"
                    strokeWidth="28"
                  />

                  {/* Segments */}
                  {(() => {
                    const CIRC = 2 * Math.PI * 70;

                    const segs: Array<{
                      key: Key;
                      pct: number;
                      className: string;
                    }> = [
                      { key: "p", pct: data.pctInt.p, className: "stroke-emerald-600" },
                      { key: "f", pct: data.pctInt.f, className: "stroke-orange-500" },
                      { key: "c", pct: data.pctInt.c, className: "stroke-blue-600" },
                    ];

                    let offsetPct = 0;

                    return segs.map((s) => {
                      const dash = (s.pct / 100) * CIRC;
                      const dashArray = `${dash} ${CIRC - dash}`;
                      const dashOffset = (offsetPct / 100) * CIRC;

                      offsetPct += s.pct;

                      return (
                        <circle
                          key={s.key}
                          cx="100"
                          cy="100"
                          r="70"
                          fill="none"
                          strokeWidth="28"
                          strokeLinecap="butt"
                          className={`${s.className} ${fade(s.key)}`}
                          strokeDasharray={dashArray}
                          strokeDashoffset={-dashOffset}
                          transform="rotate(-90 100 100)"
                        />
                      );
                    });
                  })()}

                  {/* 中央テキスト */}
                  <text
                    x="100"
                    y="96"
                    textAnchor="middle"
                    className="fill-gray-900 dark:fill-white"
                    style={{ fontSize: 22, fontWeight: 800 }}
                  >
                    {totalK} kcal
                  </text>
                  <text
                    x="100"
                    y="118"
                    textAnchor="middle"
                    className="fill-gray-500 dark:fill-gray-300"
                    style={{ fontSize: 12, fontWeight: 700 }}
                  >
                    （P/F/C換算）
                  </text>
                </svg>

                {/* Pills（線なし・被ってOK） */}
                <button
                  type="button"
                  onClick={() => setOrToggle("c")}
                  className={`absolute left-0 top-2 rounded-2xl bg-white/90 dark:bg-gray-900/80 ring-1 ring-gray-200 dark:ring-gray-700 px-3 py-2 text-left shadow-sm ${active === "c" ? "ring-2 ring-blue-500" : ""}`}
                >
                  <div className="text-xs font-extrabold text-gray-900 dark:text-white">
                    C（炭水化物）
                  </div>
                  <div className="text-2xl leading-none font-extrabold text-gray-900 dark:text-white tabular-nums">
                    {data.pctInt.c}%
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setOrToggle("p")}
                  className={`absolute right-0 top-6 rounded-2xl bg-white/90 dark:bg-gray-900/80 ring-1 ring-gray-200 dark:ring-gray-700 px-3 py-2 text-left shadow-sm ${active === "p" ? "ring-2 ring-emerald-500" : ""}`}
                >
                  <div className="text-xs font-extrabold text-gray-900 dark:text-white">
                    P（たんぱく質）
                  </div>
                  <div className="text-2xl leading-none font-extrabold text-gray-900 dark:text-white tabular-nums">
                    {data.pctInt.p}%
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setOrToggle("f")}
                  className={`absolute left-0 bottom-4 rounded-2xl bg-white/90 dark:bg-gray-900/80 ring-1 ring-gray-200 dark:ring-gray-700 px-3 py-2 text-left shadow-sm ${active === "f" ? "ring-2 ring-orange-400" : ""}`}
                >
                  <div className="text-xs font-extrabold text-gray-900 dark:text-white">
                    F（脂質）
                  </div>
                  <div className="text-2xl leading-none font-extrabold text-gray-900 dark:text-white tabular-nums">
                    {data.pctInt.f}%
                  </div>
                </button>
              </div>

              {/* タップ後の1行詳細（スマホはここに） */}
              {activeDetail && (
                <div className="mt-2 text-xs text-gray-600 dark:text-gray-300 tabular-nums text-center">
                  {LABEL[activeDetail.key].short}（{LABEL[activeDetail.key].long}）：
                  {fmt1(activeDetail.g)}g / {Math.round(activeDetail.k)}kcal（{activeDetail.pct}%）
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}