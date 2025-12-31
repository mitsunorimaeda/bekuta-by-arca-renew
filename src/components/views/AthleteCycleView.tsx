import React, { useState } from "react";
import { Droplets } from "lucide-react";

import { MenstrualCycleForm } from "../MenstrualCycleForm";
import { BasalBodyTemperatureForm } from "../BasalBodyTemperatureForm";
import { MenstrualCycleChart } from "../MenstrualCycleChart";
import { MenstrualCycleCalendar } from "../MenstrualCycleCalendar";
import { CyclePerformanceCorrelation } from "../CyclePerformanceCorrelation";

type Props = {
  userId: string;
  gender: "female" | "male" | null; // AthleteViewから normalizedGenderBinary を渡す
};

export function AthleteCycleView({ userId, gender }: Props) {
  const [cycleViewMode, setCycleViewMode] = useState<"calendar" | "chart">("calendar");

  // ここで一発ガード（AthleteView側で何回もifしない）
  if (gender !== "female") {
    return (
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-6 text-center">
        <Droplets className="w-12 h-12 text-yellow-600 dark:text-yellow-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          この機能は女性ユーザー専用です
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          プロフィール設定で性別を「女性」に設定すると、月経周期トラッキング機能が利用できます。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MenstrualCycleForm userId={userId} />
        <BasalBodyTemperatureForm userId={userId} />
      </div>

      <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">周期の表示形式</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setCycleViewMode("calendar")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              cycleViewMode === "calendar"
                ? "bg-pink-600 text-white"
                : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
            }`}
          >
            カレンダー
          </button>
          <button
            onClick={() => setCycleViewMode("chart")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              cycleViewMode === "chart"
                ? "bg-pink-600 text-white"
                : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
            }`}
          >
            グラフ
          </button>
        </div>
      </div>

      {cycleViewMode === "calendar" ? (
        <MenstrualCycleCalendar userId={userId} />
      ) : (
        <MenstrualCycleChart userId={userId} days={90} />
      )}

      <CyclePerformanceCorrelation userId={userId} />
    </div>
  );
}