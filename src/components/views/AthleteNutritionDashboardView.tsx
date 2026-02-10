// src/components/views/AthleteNutritionDashboardView.tsx
import React, { useMemo } from "react";
import type { Database } from "../../lib/database.types";
import { ArrowLeft, Flame } from "lucide-react";
import NutritionCard from "../NutritionCard";

type UserProfile = Database["public"]["Tables"]["users"]["Row"];

type Props = {
  user: UserProfile;
  date: string;

  // 親（ページ側）で取得済みのデータ
  nutritionLogs: any[];
  nutritionTotals: any | null;
  nutritionLoading: boolean;
  nutritionError: string | null;

  // 戻る
  onBackHome: () => void;

  // （任意）InBody/練習データがあるなら渡す（無ければ null/[] でOK）
  latestInbody?: any | null;
  trainingRecords?: any[] | null;
  latestWeightKg?: number | null; // ✅追加

  // （任意）保存後に親側で再fetchしたい時に渡す
  onRefreshNutrition?: () => void;
  onChangeDate?: (date: string) => void; // ✅追加（未使用）
};

export default function AthleteNutritionDashboardView({
  user,
  date,
  nutritionLogs,
  nutritionTotals,
  nutritionLoading,
  nutritionError,
  onBackHome,
  latestInbody = null,
  trainingRecords = [],
  latestWeightKg = null,
  onRefreshNutrition,
  onChangeDate, 
}: Props) {
  // 「進捗」だけはダッシュボードらしく残す（思想：評価しない / 見える化だけ）
  const completedCount = useMemo(() => {
    const confirmed =
      nutritionLogs?.filter(
        (l) => l?.status === "confirmed" || l?.is_confirmed === true || l?.analysis_status === "success"
      ).length ?? 0;
    return confirmed > 0 ? confirmed : nutritionLogs?.length ?? 0;
  }, [nutritionLogs]);

  const progressLabel = useMemo(() => {
    const base = Math.min(completedCount, 3);
    if (base === 0) return "まだ記録がありません";
    if (base === 1) return "1つ進んだ";
    if (base === 2) return "2つ進んだ";
    return "今日の基本3食がそろった";
  }, [completedCount]);

  // NutritionCard の期待する totals 形式（cal/p/f/c）に寄せる
  // ※ 既に { cal, p, f, c } ならそのまま通る
  const normalizedTotals = useMemo(() => {
    const t = nutritionTotals ?? {};
    // いろんなキー揺れを吸収
    const cal =
      Number(t?.cal ?? t?.kcal ?? t?.calories ?? t?.total_calories ?? 0) || 0;
    const p =
      Number(t?.p ?? t?.protein_g ?? t?.p_g ?? t?.protein ?? 0) || 0;
    const f =
      Number(t?.f ?? t?.fat_g ?? t?.f_g ?? t?.fat ?? 0) || 0;
    const c =
      Number(t?.c ?? t?.carbs_g ?? t?.c_g ?? t?.carbs ?? 0) || 0;

    return { cal, p, f, c };
  }, [nutritionTotals]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 sm:p-6 transition-colors">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-orange-500" />
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
                栄養ダッシュボード
              </h2>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              今日の栄養摂取状況を確認しましょう。
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              {user?.name ?? "ユーザー"}さん · {date}
            </p>

            <div className="mt-3">
              <p className="text-sm text-gray-700 dark:text-gray-200">
                今日の進捗：<b>{Math.min(completedCount, 3)}/3</b>
                <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                  {progressLabel}
                </span>
              </p>
            </div>
          </div>

          <button type="button"
            onClick={onBackHome}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">ホームへ</span>
          </button>
        </div>
      </div>

      {/* ✅ 詳細ページは NutritionCard をそのまま表示 */}
      <NutritionCard
        user={user}
        latestInbody={latestInbody}
        date={date}
        onChangeDate={onChangeDate}
        trainingRecords={trainingRecords}
        nutritionLogs={nutritionLogs}
        nutritionTotals={normalizedTotals}
        nutritionLoading={nutritionLoading}
        nutritionError={nutritionError}
        latestWeightKg={latestWeightKg}
        onSaved={() => {
          if (typeof onRefreshNutrition === "function") onRefreshNutrition();
        }}
      />

      {/* ここに後で FAB を載せる（カメラ/食品検索） */}
      {/* <NutritionFAB ... /> */}
    </div>
  );
}