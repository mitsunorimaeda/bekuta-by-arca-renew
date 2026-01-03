// src/components/PointHistoryModal.tsx
import React, { useEffect, useMemo } from "react";
import { X, RefreshCw, Clock, Tag } from "lucide-react";

type Tx = {
  id: string;
  user_id: string;
  points: number;
  reason: string | null;
  category: string | null;
  metadata: any;
  created_at: string; // timestamptz
};

type Props = {
  open: boolean;
  onClose: () => void;
  transactions: Tx[];
  loading: boolean;
  onReload?: () => Promise<void> | void;
};

function formatJST(iso: string) {
  try {
    const d = new Date(iso);
    const date = new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
    const time = new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(d);
    return { date, time };
  } catch {
    return { date: "----/--/--", time: "--:--" };
  }
}

function categoryLabel(cat?: string | null) {
  const c = (cat ?? "").toLowerCase();
  if (!c) return "その他";
  if (c.includes("streak")) return "ストリーク";
  if (c.includes("badge")) return "バッジ";
  if (c.includes("login")) return "ログイン";
  if (c.includes("manual")) return "手動";
  if (c.includes("admin")) return "管理者";
  if (c.includes("training")) return "トレーニング";
  if (c.includes("weight")) return "体重";
  if (c.includes("sleep")) return "睡眠";
  if (c.includes("motivation")) return "モチベ";
  return cat ?? "その他";
}

function categoryTone(cat?: string | null) {
  const c = (cat ?? "").toLowerCase();
  if (c.includes("badge")) return "bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300";
  if (c.includes("streak")) return "bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300";
  if (c.includes("training")) return "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300";
  if (c.includes("sleep")) return "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300";
  if (c.includes("weight")) return "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300";
  return "bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
}

export function PointHistoryModal({ open, onClose, transactions, loading, onReload }: Props) {
  // ESCで閉じる
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const grouped = useMemo(() => {
    const map = new Map<string, Tx[]>();
    for (const tx of transactions ?? []) {
      const { date } = formatJST(tx.created_at);
      const arr = map.get(date) ?? [];
      arr.push(tx);
      map.set(date, arr);
    }
    // 日付降順、各日付内も created_at 降順
    const keys = Array.from(map.keys()).sort((a, b) => (a < b ? 1 : -1));
    return keys.map((k) => ({
      date: k,
      items: (map.get(k) ?? []).sort((a, b) => (a.created_at < b.created_at ? 1 : -1)),
    }));
  }, [transactions]);

  if (!open) return null;

  const hasItems = (transactions?.length ?? 0) > 0;

  return (
    <div className="fixed inset-0 z-[100]">
      {/* overlay */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      {/* dialog */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">ポイント履歴</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                獲得・減少したポイントの記録です（JST表示）
              </p>
            </div>

            <div className="flex items-center gap-2">
              {onReload && (
                <button
                  onClick={onReload}
                  disabled={loading}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm
                             bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700
                             hover:bg-gray-50 dark:hover:bg-gray-700
                             text-gray-900 dark:text-white transition-colors
                             disabled:opacity-60 disabled:cursor-not-allowed"
                  title="更新"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                  更新
                </button>
              )}

              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
                title="閉じる"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* body */}
          <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
            {loading && !hasItems ? (
              <div className="h-48 flex items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
              </div>
            ) : !hasItems ? (
              <div className="h-48 flex flex-col items-center justify-center text-center">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">まだ履歴がありません</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  記録やバッジ獲得でポイントが付与されると、ここに表示されます。
                </p>
                {onReload && (
                  <button
                    onClick={onReload}
                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm
                               bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    再読み込み
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-5">
                {grouped.map((g) => (
                  <div key={g.date}>
                    <div className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2">
                      {g.date}
                    </div>

                    <div className="space-y-2">
                      {g.items.map((tx) => {
                        const { time } = formatJST(tx.created_at);
                        const pts = Number(tx.points ?? 0);
                        const sign = pts > 0 ? "+" : "";
                        const reason = (tx.reason ?? "").trim() || "ポイント付与";
                        const cat = categoryLabel(tx.category);
                        const catTone = categoryTone(tx.category);

                        return (
                          <div
                            key={tx.id}
                            className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                  <span className="inline-flex items-center gap-1">
                                    <Clock className="w-3.5 h-3.5" />
                                    {time}
                                  </span>
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${catTone}`}>
                                    <Tag className="w-3.5 h-3.5" />
                                    {cat}
                                  </span>
                                </div>

                                <div className="mt-1 text-sm font-semibold text-gray-900 dark:text-white truncate">
                                  {reason}
                                </div>

                                {/* metadataの軽いヒント（あれば） */}
                                {tx.metadata?.source && (
                                  <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                    source: {String(tx.metadata.source)}
                                  </div>
                                )}
                              </div>

                              <div
                                className={`shrink-0 text-sm font-bold ${
                                  pts >= 0 ? "text-blue-700 dark:text-blue-300" : "text-red-600 dark:text-red-300"
                                }`}
                              >
                                {sign}
                                {pts.toLocaleString()} pt
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* footer */}
          <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm
                         bg-gray-100 dark:bg-gray-800
                         hover:bg-gray-200 dark:hover:bg-gray-700
                         text-gray-900 dark:text-white transition-colors"
            >
              閉じる
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}