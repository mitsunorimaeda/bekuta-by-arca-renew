// src/components/NutritionOverview.tsx
import React, { useMemo } from "react";

export type NutritionMacroTotals = {
  cal: number;
  p: number;
  f: number;
  c: number;
};

export type NutritionMacroTargets = {
  cal: number;
  p: number;
  f: number;
  c: number;
};

export type NutritionOverviewProps = {
  /** 今日の合計（useTodayNutritionTotals など） */
  totals: NutritionMacroTotals;

  /** 今日の目標（buildDailyTargets の target） */
  targets: NutritionMacroTargets | null;

  /** 取得中 */
  loading?: boolean;

  /** 右上に任意の小さな補足（例：YYYY-MM-DD） */
  subtitle?: string;

  /** タップで詳細へ（使わなければ渡さない） */
  onOpen?: () => void;
};

function toNum(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function pct(now: number, goal: number) {
  if (!Number.isFinite(goal) || goal <= 0) return 0;
  const raw = (now / goal) * 100;
  return Math.min(100, Math.max(0, raw));
}

/** 進捗ステータス（色を変える） */
function status(now: number, goal: number) {
  if (!Number.isFinite(goal) || goal <= 0) return "na" as const;

  const r = now / goal;

  // 目安（雑でOK：ホームは“判断”ではなく“進捗”）
  if (r < 0.7) return "low" as const;      // まだ足りない
  if (r <= 1.1) return "ok" as const;      // だいたい良い
  return "high" as const;                  // やや超過
}

function barClass(st: ReturnType<typeof status>) {
  // 色は“主張しすぎない”ホーム設計
  // low=青、ok=緑、high=橙 ぐらいのニュアンスで
  switch (st) {
    case "low":
      return "bg-blue-600";
    case "ok":
      return "bg-emerald-600";
    case "high":
      return "bg-orange-600";
    default:
      return "bg-gray-400";
  }
}

function labelClass(st: ReturnType<typeof status>) {
  switch (st) {
    case "low":
      return "text-blue-700 dark:text-blue-300";
    case "ok":
      return "text-emerald-700 dark:text-emerald-300";
    case "high":
      return "text-orange-700 dark:text-orange-300";
    default:
      return "text-gray-500 dark:text-gray-400";
  }
}

export function NutritionOverview({
  totals,
  targets,
  loading = false,
  subtitle,
  onOpen,
}: NutritionOverviewProps) {
  const rows = useMemo(() => {
    if (!targets) return null;

    const calNow = toNum(totals?.cal, 0);
    const pNow = toNum(totals?.p, 0);
    const fNow = toNum(totals?.f, 0);
    const cNow = toNum(totals?.c, 0);

    return [
      {
        key: "cal",
        label: "カロリー",
        unit: "kcal",
        now: Math.round(calNow),
        goal: Math.round(toNum(targets?.cal, 0)),
      },
      {
        key: "p",
        label: "たんぱく質",
        unit: "g",
        now: Math.round(pNow * 10) / 10,
        goal: Math.round(toNum(targets?.p, 0) * 10) / 10,
      },
      {
        key: "f",
        label: "脂質",
        unit: "g",
        now: Math.round(fNow * 10) / 10,
        goal: Math.round(toNum(targets?.f, 0) * 10) / 10,
      },
      {
        key: "c",
        label: "炭水化物",
        unit: "g",
        now: Math.round(cNow * 10) / 10,
        goal: Math.round(toNum(targets?.c, 0) * 10) / 10,
      },
    ];
  }, [totals, targets]);

  return (
    <div
      className={[
        "bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 sm:p-5 transition-colors",
        onOpen ? "cursor-pointer hover:shadow-md" : "",
      ].join(" ")}
      onClick={onOpen}
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : -1}
      onKeyDown={(e) => {
        if (!onOpen) return;
        if (e.key === "Enter" || e.key === " ") onOpen();
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            今日の栄養進捗
          </h3>
          {subtitle && (
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              {subtitle}
            </p>
          )}
        </div>

        {/* 右上は“余計な情報を置かない” */}
      </div>

      {loading ? (
        <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
          読み込み中…
        </div>
      ) : !rows ? (
        <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
          目標値を表示するには体重データが必要です
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {rows.map((r) => {
            const st = status(r.now, r.goal);
            const percent = pct(r.now, r.goal);

            return (
              <div key={r.key}>
                <div className="flex items-baseline justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-200">
                      {r.label}
                    </span>
                    <span className={`text-[11px] ${labelClass(st)}`}>
                      {Math.round(percent)}%
                    </span>
                  </div>

                  <div className="text-[11px] text-gray-500 dark:text-gray-400">
                    {r.now}/{r.goal} {r.unit}
                  </div>
                </div>

                <div className="mt-1.5 h-2.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                  <div
                    className={`h-full ${barClass(st)}`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {onOpen && (
        <div className="mt-3 text-[11px] text-gray-500 dark:text-gray-400">
          タップで詳細を見る
        </div>
      )}
    </div>
  );
}

export default NutritionOverview;