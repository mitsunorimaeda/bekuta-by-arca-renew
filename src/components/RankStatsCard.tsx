// src/components/RankStatsCard.tsx
import React, { useMemo } from "react";
import type { RankScope, RankStats } from "../hooks/useRankStats";
import { Globe, Building2, Users, ChevronRight } from "lucide-react";

function scopeLabel(scope: RankScope) {
  if (scope === "global") return "全体";
  if (scope === "organization") return "組織内";
  return "チーム内";
}

function scopeIcon(scope: RankScope) {
  if (scope === "global") return <Globe className="w-5 h-5" />;
  if (scope === "organization") return <Building2 className="w-5 h-5" />;
  return <Users className="w-5 h-5" />;
}

export function RankStatsCard({
  scope,
  data,
  loading,
  error,
}: {
  scope: RankScope;
  data: RankStats | null;
  loading: boolean;
  error: string | null;
}) {
  const headline = useMemo(() => {
    if (!data) return null;
    const total = data.total_users ?? 0;
    const rank = data.my_rank;
    const pct = data.top_percent;

    if (!total || rank == null || pct == null) return `${scopeLabel(scope)}の順位データがありません`;
    return `${total.toLocaleString()}人中 ${rank.toLocaleString()}位（上位 ${pct}%）`;
  }, [data, scope]);

  // ✅ 分布：表示順を逆に（ビギナーⅠが最下層になる想定）
  const dist = useMemo(() => {
    const arr = (data?.distribution ?? []).slice();
    return arr.reverse();
  }, [data?.distribution]);

  // ✅ 最大人数（棒グラフの100%基準）
  const maxCount = useMemo(() => {
    const m = Math.max(0, ...dist.map((d) => Number(d.count ?? 0)));
    return m > 0 ? m : 1;
  }, [dist]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 text-gray-900 dark:text-white">
          <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-700">{scopeIcon(scope)}</div>
          <div>
            <div className="text-xs text-gray-600 dark:text-gray-400">{scopeLabel(scope)}ランキング</div>
            <div className="text-base font-semibold">{loading ? "読み込み中…" : headline ?? "—"}</div>
          </div>
        </div>

        <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center">
          APEX風 <ChevronRight className="w-4 h-4 ml-1" />
        </div>
      </div>

      {error && <div className="mt-2 text-xs text-red-600 dark:text-red-400">error: {error}</div>}

      {/* ✅ ランク分布（横棒グラフ：最大人数が横幅いっぱい） */}
      {dist.length ? (
        <div className="mt-3">
          <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">人数分布</div>

          <div className="space-y-2">
            {dist.map((d) => {
              const count = Number(d.count ?? 0);
              const pct = Math.round((count / maxCount) * 100); // 0〜100
              return (
                <div key={d.rank_title} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-800 dark:text-gray-200">{d.rank_title}</span>
                    <span className="text-gray-600 dark:text-gray-400">{count.toLocaleString()}人</span>
                  </div>

                  <div className="w-full h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-600"
                      style={{ width: `${pct}%` }}
                      aria-label={`${d.rank_title} ${count}人`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">分布データはまだありません</div>
      )}
    </div>
  );
}