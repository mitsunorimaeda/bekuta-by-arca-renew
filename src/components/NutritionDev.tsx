import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { Activity, RefreshCw, AlertTriangle, Info } from "lucide-react";


type ActivityLevel = "low" | "medium" | "high" | "elite";

type MetabolismResult = {
  weight: number;
  body_fat_percent: number | null;
  leanMass: number | null;
  bmr: number;
  tdee: number;
};

export function NutritionDev() {
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>("high");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MetabolismResult | null>(null);

  const endpoint = useMemo(() => {
    // Supabase Edge Functions のURL（ローカル / 本番を吸収）
    // もし VITE_SUPABASE_URL があるならそこから作るのが安全
    // 例: https://xxxx.supabase.co/functions/v1/calculate-metabolism
    const base = (import.meta as any).env?.VITE_SUPABASE_URL;
    return base ? `${base}/functions/v1/calculate-metabolism` : "/functions/v1/calculate-metabolism";
  }, []);

  const fetchMetabolism = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: auth, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;
      const userId = auth?.user?.id;
      if (!userId) throw new Error("ログインユーザーが取得できません");

      // Edge Function は「認証付き」で叩くのが基本
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error("セッショントークンが取得できません");

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          user_id: userId,
          activity_level: activityLevel,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || `Edge Function error: ${res.status}`);
      }

      setResult(json);
    } catch (e: any) {
      setError(String(e?.message ?? e));
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 初回ロードで1回叩く
    fetchMetabolism();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-indigo-600" />
          <h2 className="text-lg font-semibold text-gray-900">栄養デバッグ（非公開）</h2>
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

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <div className="text-sm text-gray-600 flex items-center gap-2">
          <Info className="w-4 h-4 text-gray-400" />
          目的：InBody → LBM → BMR → TDEE を Edge Function の固定計算で検証
        </div>

        <div className="sm:ml-auto flex items-center gap-2">
          <span className="text-xs text-gray-500">活動レベル</span>
          <select
            value={activityLevel}
            onChange={(e) => setActivityLevel(e.target.value as ActivityLevel)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
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

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5" />
          <div className="whitespace-pre-wrap">{error}</div>
        </div>
      )}

      {!error && !result && (
        <div className="text-sm text-gray-600">データなし（InBodyが未登録 or user_id紐付け未完了の可能性）</div>
      )}

      {result && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-xs text-gray-500 mb-1">体重</div>
            <div className="text-2xl font-bold text-gray-900">{result.weight} kg</div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-xs text-gray-500 mb-1">体脂肪率</div>
            <div className="text-2xl font-bold text-gray-900">
              {result.body_fat_percent == null ? "—" : `${result.body_fat_percent}%`}
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-xs text-gray-500 mb-1">除脂肪体重（LBM 推定）</div>
            <div className="text-2xl font-bold text-gray-900">
              {result.leanMass == null ? "—" : `${Math.round(result.leanMass * 10) / 10} kg`}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              ※ 体脂肪率がある場合のみ算出
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-xs text-gray-500 mb-1">BMR（基礎代謝）</div>
            <div className="text-2xl font-bold text-gray-900">{result.bmr} kcal</div>
            <div className="text-xs text-gray-500 mt-1">
              LBMあり：Katch-McArdle / なし：体重ベース簡易式
            </div>
          </div>

          <div className="bg-indigo-50 rounded-lg p-4 sm:col-span-2">
            <div className="text-xs text-indigo-700 mb-1">TDEE（推定消費）</div>
            <div className="text-3xl font-extrabold text-indigo-900">{result.tdee} kcal</div>
            <div className="text-xs text-indigo-700 mt-1">
              activity_level = <span className="font-semibold">{activityLevel}</span>
            </div>
          </div>

          <div className="sm:col-span-2">
            <div className="text-xs text-gray-500 mb-2">Raw JSON</div>
            <pre className="bg-gray-900 text-gray-100 rounded-lg p-3 text-xs overflow-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

export default NutritionDev;