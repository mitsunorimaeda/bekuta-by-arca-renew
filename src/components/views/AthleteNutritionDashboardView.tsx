// src/components/views/AthleteNutritionDashboardView.tsx
import React, { useMemo } from 'react';
import type { Database } from '../../lib/database.types';
import { Flame, ArrowLeft, Camera, Search, CheckCircle2, Info } from 'lucide-react';

type UserProfile = Database['public']['Tables']['users']['Row'];

// nutrition_logs / nutrition_daily_totals の型はプロジェクト差が出やすいので、ここは any で受けます。
// （既存の useTodayNutritionTotals の戻りに合わせて後で強く型付けするのが安全）
type Props = {
  user: UserProfile;
  date: string;
  nutritionLogs: any[];
  nutritionTotals: any | null;
  nutritionLoading: boolean;
  nutritionError: string | null;
  onBackHome: () => void;
};

export default function AthleteNutritionDashboardView({
  user,
  date,
  nutritionLogs,
  nutritionTotals,
  nutritionLoading,
  nutritionError,
  onBackHome,
}: Props) {
  // 思想：評価しない。点数化しない。できたことを見える化。
  const completedCount = useMemo(() => {
    // 「確定」フラグがあるならそこを優先。なければ logs の数で進捗にする。
    // 例：log.status === 'confirmed' / log.is_confirmed 等、実データに合わせて調整OK
    const confirmed = nutritionLogs?.filter((l) => l?.status === 'confirmed' || l?.is_confirmed === true).length ?? 0;
    return confirmed > 0 ? confirmed : (nutritionLogs?.length ?? 0);
  }, [nutritionLogs]);

  const progressLabel = useMemo(() => {
    // 朝/昼/夕 各1回だけAI推定、の思想に合わせた「今日の進捗」
    // 補食は別枠になりうるので、ここは「まず3」をベースにする
    const base = Math.min(completedCount, 3);
    if (base === 0) return 'まだ記録がありません';
    if (base === 1) return '1つ確定できた';
    if (base === 2) return '2つ確定できた';
    return '今日の基本3食の確定が完了';
  }, [completedCount]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 sm:p-6 transition-colors">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-orange-500" />
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">栄養ダッシュボード</h2>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              AIは下書き。最後に決めるのはあなた。評価や点数化はしません。
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              {user.name}さん · {date}
            </p>
          </div>

          <button
            onClick={onBackHome}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">ホームへ</span>
          </button>
        </div>
      </div>

      {/* Progress / Next action */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 sm:p-6 transition-colors">
          <div className="flex items-center justify-between">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">今日の進捗</h3>
            <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>

          <div className="mt-3">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{completedCount}/3</p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{progressLabel}</p>
          </div>

          <div className="mt-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-orange-600 dark:text-orange-400 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-orange-900 dark:text-orange-200">ポイント</p>
                <p className="text-sm text-orange-800 dark:text-orange-300 mt-1">
                  「できた／できない」ではなく、<b>次の選択を少し良くする</b>ためのメモです。
                  まずは 1食だけでも “確定” まで進めばOK。
                </p>
              </div>
            </div>
          </div>

          {/* Quick actions (UIのみ。実機能は NutritionCard 側の導線に合わせて後で接続) */}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              onClick={() => {
                // ここは NutritionCard のモーダル/導線に合わせてあとで接続
                // 例：openCamera(), openFoodSearch() など
                alert('ここに「写真→AI→編集→確定」の導線を接続します（次ステップ）');
              }}
            >
              <Camera className="w-4 h-4" />
              写真で記録
            </button>

            <button
              type="button"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              onClick={() => {
                alert('ここに「食品名検索→編集→確定」の導線を接続します（次ステップ）');
              }}
            >
              <Search className="w-4 h-4" />
              食品名検索
            </button>
          </div>
        </div>

        {/* Totals card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 sm:p-6 transition-colors">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">今日のサマリー</h3>

          {nutritionLoading ? (
            <div className="mt-4 flex items-center justify-center h-24">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : nutritionError ? (
            <div className="mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <p className="text-sm text-red-700 dark:text-red-300">取得エラー：{nutritionError}</p>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {/* nutritionTotals の形に合わせて表示（key名が違うならここを合わせる） */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                <p className="text-xs text-gray-600 dark:text-gray-400">推定カロリー</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  {nutritionTotals?.kcal ?? nutritionTotals?.calories ?? '-'}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                  <p className="text-xs text-gray-600 dark:text-gray-400">P</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{nutritionTotals?.protein_g ?? nutritionTotals?.p_g ?? '-'}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                  <p className="text-xs text-gray-600 dark:text-gray-400">C</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{nutritionTotals?.carbs_g ?? nutritionTotals?.c_g ?? '-'}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                  <p className="text-xs text-gray-600 dark:text-gray-400">F</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{nutritionTotals?.fat_g ?? nutritionTotals?.f_g ?? '-'}</p>
                </div>
              </div>

              <p className="text-xs text-gray-500 dark:text-gray-500">
                ※ “正確さ” より “納得して次に活かせる” ことを優先します。
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Logs list */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 sm:p-6 transition-colors">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">今日の記録</h3>

        {nutritionLoading ? (
          <div className="mt-4 flex items-center justify-center h-24">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : nutritionLogs?.length ? (
          <div className="mt-4 space-y-3">
            {nutritionLogs.map((log: any) => (
              <div key={log.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {log.meal_type ?? log.mealType ?? '食事'} {log.meal_slot ? `(${log.meal_slot})` : ''}
                  </p>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{log.status ?? (log.is_confirmed ? 'confirmed' : 'draft')}</span>
                </div>

                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {log.title ?? log.summary ?? '（内容）'}
                </p>

                <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-600 dark:text-gray-400">
                  <span>kcal: {log.kcal ?? log.calories ?? '-'}</span>
                  <span>P: {log.protein_g ?? log.p_g ?? '-'}</span>
                  <span>C: {log.carbs_g ?? log.c_g ?? '-'}</span>
                  <span>F: {log.fat_g ?? log.f_g ?? '-'}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">まだ記録がありません。写真か食品名検索から始めましょう。</p>
          </div>
        )}
      </div>
    </div>
  );
}