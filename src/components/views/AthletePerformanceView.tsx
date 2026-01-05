// src/components/views/AthletePerformanceView.tsx
import React, { useCallback, useMemo, useState } from "react";
import type { Database } from "../../lib/database.types";

import { usePerformanceData } from "../../hooks/usePerformanceData";

import { PerformanceRecordForm } from "../PerformanceRecordForm";
import { PerformanceRecordsList } from "../PerformanceRecordsList";
import { PerformanceOverview } from "../PerformanceOverview";
import { PersonalBestCelebration } from "../PersonalBestCelebration";

import { ArrowLeft, Zap } from "lucide-react";

type UserProfile = Database["public"]["Tables"]["users"]["Row"];

type PerformanceCategory = "jump" | "endurance" | "strength" | "sprint" | "agility";

type Props = {
  user: UserProfile;
  onBackHome: () => void;
};

export default function AthletePerformanceView({ user, onBackHome }: Props) {
  const [performanceCategory, setPerformanceCategory] = useState<PerformanceCategory>("jump");

  const {
    testTypes: performanceTestTypes,
    records: performanceRecords,
    personalBests,
    loading: performanceLoading,
    addRecord: addPerformanceRecord,
    updateRecord: updatePerformanceRecord,
    checkExistingRecord,
    getRecordsByTestType,
    getPersonalBest,
  } = usePerformanceData(user.id, performanceCategory);

  const [celebrationData, setCelebrationData] = useState<{
    testName: string;
    value: number;
    unit: string;
    previousBest?: number;
  } | null>(null);

  const getCategoryDisplayName = useCallback((category: PerformanceCategory) => {
    switch (category) {
      case "jump":
        return "ジャンプ測定";
      case "endurance":
        return "全身持久力測定";
      case "strength":
        return "筋力測定";
      case "sprint":
        return "スプリント測定";
      case "agility":
        return "アジリティ測定";
      default:
        return "パフォーマンス測定";
    }
  }, []);

  const handlePerformanceUpdate = useCallback(
    async (
      recordId: string,
      updates: {
        date?: string;
        values?: Record<string, any>;
        notes?: string;
        is_official?: boolean;
        weather_conditions?: string;
      }
    ) => {
      await updatePerformanceRecord(recordId, updates);
    },
    [updatePerformanceRecord]
  );

  const handlePerformanceRecordSubmit = useCallback(
    async (recordData: any) => {
      const result = await addPerformanceRecord(recordData);

      // ✅ PB更新時にセレブレーション
      if (result?.isNewPersonalBest) {
        const testType = performanceTestTypes.find((t) => t.id === recordData.test_type_id);
        const previousBest = getPersonalBest(recordData.test_type_id);

        if (testType) {
          setCelebrationData({
            testName: testType.display_name,
            value: Number(recordData?.values?.primary_value ?? 0),
            unit: testType.unit,
            previousBest: previousBest?.value,
          });
        }
      }

      return result;
    },
    [addPerformanceRecord, performanceTestTypes, getPersonalBest]
  );

  // ✅ lastRecords / personalBests を Map 化してフォームに渡す
  const { lastPerformanceRecords, personalBestsMap } = useMemo(() => {
    const lastMap = new Map<string, any>();
    const pbMap = new Map<string, any>();

    for (const testType of performanceTestTypes) {
      const recs = getRecordsByTestType(testType.id);
      if (recs && recs.length > 0) lastMap.set(testType.id, recs[0]);

      const pb = getPersonalBest(testType.id);
      if (pb) pbMap.set(testType.id, pb);
    }

    return { lastPerformanceRecords: lastMap, personalBestsMap: pbMap };
  }, [performanceTestTypes, getRecordsByTestType, getPersonalBest]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBackHome}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:opacity-90 active:opacity-80 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">ホームへ戻る</span>
        </button>

        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-yellow-500" />
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">パフォーマンス</h2>
        </div>
      </div>

      {/* Main */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        {/* Left Column */}
        <div className="lg:col-span-1 space-y-6">
          {/* Personal Bests Summary */}
          {personalBests.length > 0 && (
            <div className="bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-xl shadow-sm p-4 border-2 border-yellow-300 dark:border-yellow-700">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                <Zap className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mr-2" />
                パーソナルベスト
              </h3>

              <div className="space-y-2">
                {personalBests.slice(0, 3).map((pb: any) => {
                  const unit = performanceTestTypes.find((t) => t.id === pb.test_type_id)?.unit;
                  const value = Number(pb.value ?? 0);
                  const isRSI = String(pb.test_name ?? "").toLowerCase().includes("rsi");

                  return (
                    <div key={pb.test_type_id} className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-2">
                      <p className="text-xs text-gray-600 dark:text-gray-400">{pb.test_display_name}</p>
                      <p className="text-lg font-bold text-yellow-700 dark:text-yellow-300">
                        {Number.isFinite(value) ? value.toFixed(isRSI ? 2 : 1) : "-"} {unit}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Category Selection */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden transition-colors">
            <div className="grid grid-cols-5 border-b border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setPerformanceCategory("jump")}
                className={`py-3 px-2 text-xs sm:text-sm font-medium transition-colors ${
                  performanceCategory === "jump"
                    ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-b-2 border-blue-500"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                }`}
              >
                ジャンプ
              </button>

              <button
                type="button"
                onClick={() => setPerformanceCategory("sprint")}
                className={`py-3 px-2 text-xs sm:text-sm font-medium transition-colors ${
                  performanceCategory === "sprint"
                    ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-b-2 border-blue-500"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                }`}
              >
                スプリント
              </button>

              <button
                type="button"
                onClick={() => setPerformanceCategory("agility")}
                className={`py-3 px-2 text-xs sm:text-sm font-medium transition-colors ${
                  performanceCategory === "agility"
                    ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-b-2 border-blue-500"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                }`}
              >
                アジリティ
              </button>

              <button
                type="button"
                onClick={() => setPerformanceCategory("endurance")}
                className={`py-3 px-2 text-xs sm:text-sm font-medium transition-colors ${
                  performanceCategory === "endurance"
                    ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-b-2 border-blue-500"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                }`}
              >
                持久力
              </button>

              <button
                type="button"
                onClick={() => setPerformanceCategory("strength")}
                className={`py-3 px-2 text-xs sm:text-sm font-medium transition-colors ${
                  performanceCategory === "strength"
                    ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-b-2 border-blue-500"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                }`}
              >
                筋力
              </button>
            </div>
          </div>

          {/* Performance Form */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 sm:p-6 transition-colors">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
                {getCategoryDisplayName(performanceCategory)}
              </h2>
              <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-500" />
            </div>

            <PerformanceRecordForm
              userId={user.id}
              userRole={(user as any).role}
              testTypes={performanceTestTypes}
              onSubmit={handlePerformanceRecordSubmit}
              onCheckExisting={checkExistingRecord}
              onUpdate={handlePerformanceUpdate}
              loading={performanceLoading}
              lastRecords={lastPerformanceRecords}
              personalBests={personalBestsMap}
            />
          </div>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 sm:p-6 transition-colors">
            <PerformanceOverview
              testTypes={performanceTestTypes}
              records={performanceRecords}
              personalBests={personalBests}
              getRecordsByTestType={getRecordsByTestType}
              getPersonalBest={getPersonalBest}
            />
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 sm:p-6 transition-colors">
            <PerformanceRecordsList records={performanceRecords} personalBests={personalBests} loading={performanceLoading} />
          </div>
        </div>
      </div>

      {/* ✅ Personal Best Celebration */}
      {celebrationData && (
        <PersonalBestCelebration
          testName={celebrationData.testName}
          value={celebrationData.value}
          unit={celebrationData.unit}
          previousBest={celebrationData.previousBest}
          onClose={() => setCelebrationData(null)}
        />
      )}
    </div>
  );
}