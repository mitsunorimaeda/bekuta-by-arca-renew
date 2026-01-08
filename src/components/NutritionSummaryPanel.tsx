// src/components/NutritionSummaryPanel.tsx
import React, { useMemo } from "react";
import PFCBalance from "./PFCBalance";

type Totals = { cal: number; p: number; f: number; c: number };
type Targets = { cal: number; p: number; f: number; c: number };

type Props = {
  dateLabel?: string;
  totals: Totals;
  targets: Targets | null;
  loading?: boolean;

  // 推定（任意）
  bmrKcal?: number | null;
  tdeeKcal?: number | null;

  // CTA（例：写真で記録）
  onPrimaryAction?: () => void;
  primaryLabel?: string;
};

function toNum(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}
function pct(now: number, goal: number) {
  if (!Number.isFinite(goal) || goal <= 0) return 0;
  return clamp((now / goal) * 100, 0, 100);
}
function fmt1(n: number) {
  return Math.round(n * 10) / 10;
}
function remain(now: number, goal: number) {
  if (!Number.isFinite(goal) || goal <= 0) return null;
  return Math.max(0, goal - now);
}

function ProgressBar({ now, goal }: { now: number; goal: number }) {
  const w = pct(now, goal);
  return (
    <div className="mt-2 h-2.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
      <div
        className="h-full bg-gray-400 dark:bg-gray-300"
        style={{ width: `${w}%` }}
      />
    </div>
  );
}

function MacroCell({
  label,
  unit,
  now,
  goal,
}: {
  label: string;
  unit: string;
  now: number;
  goal: number;
}) {
  const r = remain(now, goal);
  return (
    <div className="rounded-xl bg-gray-50 dark:bg-gray-800/60 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {label}
        </div>
        <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
          {r != null ? `あと${fmt1(r)}${unit}` : ""}
        </div>
      </div>

      <div className="mt-1.5 flex items-baseline gap-2">
        <div className="text-2xl font-extrabold tabular-nums text-gray-900 dark:text-white">
          {fmt1(now)}
        </div>
        <div className="text-sm font-bold text-gray-600 dark:text-gray-300 tabular-nums">
          / {fmt1(goal)}
          {unit}
        </div>
      </div>

      <ProgressBar now={now} goal={goal} />
    </div>
  );
}

export default function NutritionSummaryPanel({
  dateLabel,
  totals,
  targets,
  loading = false,
  bmrKcal = null,
  tdeeKcal = null,
  onPrimaryAction,
  primaryLabel = "食事を記録",
}: Props) {
  const t = useMemo(
    () => ({
      cal: toNum(totals?.cal, 0),
      p: toNum(totals?.p, 0),
      f: toNum(totals?.f, 0),
      c: toNum(totals?.c, 0),
    }),
    [totals]
  );

  const g = useMemo(() => {
    if (!targets) return null;
    return {
      cal: toNum(targets?.cal, 0),
      p: toNum(targets?.p, 0),
      f: toNum(targets?.f, 0),
      c: toNum(targets?.c, 0),
    };
  }, [targets]);

  const calRemain = g ? remain(t.cal, g.cal) : null;

  return (
    <div className="rounded-2xl bg-white dark:bg-gray-900 shadow-sm ring-1 ring-gray-200 dark:ring-gray-800">
      {/* ヘッダー */}
      <div className="px-4 sm:px-5 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-gray-900 dark:text-white">
              栄養サマリー
            </div>
            {dateLabel && (
              <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                {dateLabel}
              </div>
            )}
          </div>

          {/* 右上：推定値（小さく、邪魔しない） */}
          <div className="text-right text-[11px] leading-snug text-gray-500 dark:text-gray-400">
            {bmrKcal != null && <div>推定BMR: {Math.round(bmrKcal)}kcal</div>}
            {tdeeKcal != null && <div>今日必要: {Math.round(tdeeKcal)}kcal</div>}
          </div>
        </div>
      </div>

      {/* 本体 */}
      <div className="px-4 sm:px-5 pb-4 sm:pb-5">
        {loading ? (
          <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
            読み込み中…
          </div>
        ) : !g ? (
          <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
            目標値の表示には体重データが必要です
          </div>
        ) : (
          <div className="mt-4">
            {/* カロリー（中央大きく） */}
            <div className="rounded-2xl bg-gray-50 dark:bg-gray-800/60 px-4 py-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  カロリー
                </div>

                <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  {calRemain != null ? `あと${Math.round(calRemain)}kcal` : ""}
                </div>
              </div>

              <div className="mt-2 flex items-baseline justify-center gap-2">
                <div className="text-5xl font-extrabold tabular-nums text-gray-900 dark:text-white">
                  {Math.round(t.cal)}
                </div>
                <div className="text-xl font-bold text-gray-600 dark:text-gray-300 tabular-nums">
                  / {Math.round(g.cal)}kcal
                </div>
              </div>

              <div className="mt-3">
                <ProgressBar now={t.cal} goal={g.cal} />
              </div>
            </div>

            {/* PFC 3列（プレースホルダー削除）*/}
            <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
            <MacroCell label="たんぱく質" unit="g" now={t.p} goal={g.p} />
            <MacroCell label="脂質" unit="g" now={t.f} goal={g.f} />
            <MacroCell label="炭水化物" unit="g" now={t.c} goal={g.c} />
            </div>

            {/* PFCバランスバー */}
            <div className="gap-3 mt-4">
            <PFCBalance totals={{ p: t.p, f: t.f, c: t.c }} targets={g ? { p: g.p, f: g.f, c: g.c } : null} />
            </div>

            {/* 下部：CTA（カロミルの右下ボタンっぽい） */}
            {onPrimaryAction && (
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={onPrimaryAction}
                  className="inline-flex items-center justify-center px-5 py-2.5 rounded-full bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-500 transition"
                >
                  {primaryLabel}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}