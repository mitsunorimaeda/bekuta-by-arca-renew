import React, { useState } from "react";
import { Droplets } from "lucide-react";

import { useMenstrualCycleData } from "../../hooks/useMenstrualCycleData";
import { CyclePhaseCard } from "../CyclePhaseCard";
import { CycleQuickLog } from "../CycleQuickLog";
import { MenstrualCycleCalendar } from "../MenstrualCycleCalendar";
import { CycleHistory } from "../CycleHistory";
import { MenstrualCycleChart } from "../MenstrualCycleChart";
import { CyclePerformanceCorrelation } from "../CyclePerformanceCorrelation";
import { BasalBodyTemperatureForm } from "../BasalBodyTemperatureForm";

type Props = {
  userId: string;
  gender: "female" | "male" | null;
};

type SubTab = "history" | "chart" | "correlation";

export function AthleteCycleView({ userId, gender }: Props) {
  const [subTab, setSubTab] = useState<SubTab>("history");
  const {
    cycles,
    loading,
    quickLogPeriodStart,
    quickLogPeriodEnd,
    getCurrentPhaseInfo,
    getPrediction,
  } = useMenstrualCycleData(userId);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  const phaseInfo = getCurrentPhaseInfo();
  const prediction = getPrediction();
  const hasOpenCycle = cycles.some(c => !c.cycle_end_date);

  return (
    <div className="space-y-4">
      {/* フェーズカード */}
      <CyclePhaseCard phaseInfo={phaseInfo} prediction={prediction} />

      {/* クイックログ */}
      <CycleQuickLog
        onPeriodStart={quickLogPeriodStart}
        onPeriodEnd={quickLogPeriodEnd}
        hasOpenCycle={hasOpenCycle}
      />

      {/* カレンダー */}
      <MenstrualCycleCalendar userId={userId} />

      {/* サブタブ */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
        {([
          { key: "history" as const, label: "履歴" },
          { key: "chart" as const, label: "グラフ" },
          { key: "correlation" as const, label: "相関分析" },
        ]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setSubTab(tab.key)}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
              subTab === tab.key
                ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* サブタブコンテンツ */}
      {subTab === "history" && <CycleHistory cycles={cycles} />}
      {subTab === "chart" && (
        <div className="space-y-4">
          <MenstrualCycleChart userId={userId} days={90} />
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3">
              基礎体温を記録（任意）
            </p>
            <BasalBodyTemperatureForm userId={userId} />
          </div>
        </div>
      )}
      {subTab === "correlation" && <CyclePerformanceCorrelation userId={userId} />}
    </div>
  );
}
