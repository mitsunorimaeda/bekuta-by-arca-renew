import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { Activity, RefreshCw, AlertTriangle, Info } from "lucide-react";

type ActivityLevel = "low" | "medium" | "high" | "elite";

type MetabolismResult = {
  weight: number;
  body_fat_percent: number | null;
  lean_mass: number | null;
  bmr: number;
  tdee: number;
};

export function NutritionDev() {
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>("high");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MetabolismResult | null>(null);

  const [avg7d, setAvg7d] = useState<any>(null);
  const [loadingAvg, setLoadingAvg] = useState(false);
  const [avgErr, setAvgErr] = useState<string | null>(null);

  // Edge Function endpoint
  const endpoint = useMemo(() => {
    const base = (import.meta as any).env?.VITE_SUPABASE_URL;
    return base
      ? `${base}/functions/v1/calculate-metabolism`
      : "/functions/v1/calculate-metabolism";
  }, []);

  // -----------------------------
  // メイン：代謝計算（今日）
  // -----------------------------
  const fetchMetabolism = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth?.user?.id;
      if (!userId) throw new Error("ログインユーザーが取得できません");

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error("アクセストークン取得失敗");

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          activity_level: activityLevel,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Edge Function error");

      setResult(json);

      // 7日平均も取得
      await fetchMetabolism7dAvg(userId);
    } catch (e: any) {
      setError(String(e?.message ?? e));
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  // -----------------------------
  // 7日平均取得（View）
  // -----------------------------
  const fetchMetabolism7dAvg = async (userId: string) => {
    setLoadingAvg(true);
    setAvgErr(null);

    try {
      const { data, error } = await supabase
        .from("nutrition_metabolism_7d_avg")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (error) throw error;
      setAvg7d(data);
    } catch (e: any) {
      setAvgErr(String(e?.message ?? e));
      setAvg7d(null);
    } finally {
      setLoadingAvg(false);
    }
  };

  // -----------------------------
  // 差分計算
  // -----------------------------
  const diffKcal = useMemo(() => {
    if (!result || !avg7d) return null;
    return result.tdee - avg7d.avg_tdee;
  }, [result, avg7d]);

  const diffMessage = useMemo(() => {
    if (diffKcal === null) return null;
    if (diffKcal > 150) return "今日は活動量がかなり高め";
    if (diffKcal > 50) return "今日はやや活動量多め";
    if (diffKcal < -150) return "今日は活動量が低め";
    if (diffKcal < -50) return "今日はやや活動量少なめ";
    return "平均的な活動量";
  }, [diffKcal]);

  useEffect(() => {
    fetchMetabolism();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-indigo-600" />
          <h2 className="text-lg font-semibold text-gray-900">
            栄養デバッグ（非公開）
          </h2>
        </div>

        <button
          onClick={fetchMetabolism}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          再取得
        </button>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <div className="text-sm text-gray-600 flex items-center gap-2">
          <Info className="w-4 h-4 text-gray-400" />
          InBody → LBM → BMR → TDEE（検証用）
        </div>

        <div className="sm:ml-auto flex items-center gap-2">
          <span className="text-xs text-gray-500">活動レベル</span>
          <select
            value={activityLevel}
            onChange={(e) => setActivityLevel(e.target.value as ActivityLevel)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg"
          >
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
            <option value="elite">elite</option>
          </select>

          <button
            onClick={fetchMetabolism}
            disabled={loading}
            className="px-3 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            反映
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-xs text-gray-500">体重</div>
            <div className="text-2xl font-bold">{result.weight} kg</div>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-xs text-gray-500">体脂肪率</div>
            <div className="text-2xl font-bold">
              {result.body_fat_percent ?? "—"}%
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-xs text-gray-500">除脂肪体重（LBM）</div>
            <div className="text-2xl font-bold">
              {result.lean_mass ?? "—"} kg
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-xs text-gray-500">BMR</div>
            <div className="text-2xl font-bold">{result.bmr} kcal</div>
          </div>

          <div className="bg-indigo-50 p-4 rounded-lg sm:col-span-2">
            <div className="text-xs text-indigo-700">TDEE</div>
            <div className="text-3xl font-extrabold text-indigo-900">
              {result.tdee} kcal
            </div>
          </div>
        </div>
      )}

      {/* 7日平均 */}
      {loadingAvg && (
        <div className="text-sm text-gray-500">7日平均を計算中...</div>
      )}

      {avgErr && (
        <div className="text-sm text-yellow-700">
          7日平均取得失敗: {avgErr}
        </div>
      )}

      {avg7d && result && diffKcal !== null && (
        <div className="border rounded-lg p-4 bg-white">
          <div className="font-semibold mb-2">
            直近7日平均との差（活動量）
          </div>

          <div className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <div className="text-gray-500">今日</div>
              <div className="font-bold">{result.tdee} kcal</div>
            </div>
            <div>
              <div className="text-gray-500">7日平均</div>
              <div className="font-bold">{avg7d.avg_tdee} kcal</div>
            </div>
            <div>
              <div className="text-gray-500">差分</div>
              <div
                className={`font-bold ${
                  diffKcal > 0
                    ? "text-red-600"
                    : diffKcal < 0
                    ? "text-blue-600"
                    : "text-gray-700"
                }`}
              >
                {diffKcal > 0 && "+"}
                {diffKcal} kcal
              </div>
            </div>
          </div>

          <div className="text-xs text-gray-600 mt-2">
            評価：<span className="font-semibold">{diffMessage}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default NutritionDev;