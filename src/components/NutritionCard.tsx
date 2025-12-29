// src/components/NutritionCard.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Flame, Camera, Loader2, CheckCircle2 } from "lucide-react";
import { buildDailyTargets, calcGaps } from "../lib/nutritionCalc";
import { supabase } from "../lib/supabase";

type MealType = "朝食" | "昼食" | "夕食" | "補食";

function toNum(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}
function safeDateString(date: any) {
  if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  return new Date().toISOString().slice(0, 10);
}
function formatMealLabel(mealType: string, mealSlot: any) {
  if (mealType === "補食") return `補食${Number(mealSlot ?? 1)}`;
  return mealType;
}
function normalizeSex(gender: any) {
  if (!gender) return null;
  if (gender === "male") return "male";
  if (gender === "female") return "female";
  return null;
}
function calcAge(dateOfBirth: any) {
  if (!dateOfBirth) return null;
  const d = new Date(dateOfBirth);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return age >= 0 ? age : null;
}

/** DB制約に合わせて meal_slot を正規化（朝昼夕=1、補食=1/2） */
function normalizeMealSlot(type: MealType, slot: number) {
  if (type === "補食") return clamp(toNum(slot, 1), 1, 2);
  return 1;
}

/** File -> base64(payload only) */
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = reader.result as string;
      resolve(res.split(",")[1] ?? "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Tokyo日付 yyyy-mm-dd に寄せる */
function toTokyoDateString(anyDate: any) {
  if (!anyDate) return null;
  if (typeof anyDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(anyDate)) return anyDate;
  const d = new Date(anyDate);
  if (Number.isNaN(d.getTime())) return null;
  const parts = d.toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" }).split("/");
  return `${parts[0]}-${String(parts[1]).padStart(2, "0")}-${String(parts[2]).padStart(2, "0")}`;
}

/** duration_min の正規化（秒っぽい値は分に直す、異常値カット） */
function normalizeDurationMin(raw: any) {
  let v = Number(raw);
  if (!Number.isFinite(v) || v <= 0) return 0;
  if (v > 600 && v % 60 === 0) v = v / 60; // 秒っぽい
  v = Math.min(360, Math.max(0, v)); // 1回0-360分
  return Math.round(v);
}
function sumMinutesForDate(records: any[] | null | undefined, yyyyMmDd: string) {
  if (!Array.isArray(records)) return 0;
  let sum = 0;
  for (const r of records) {
    const d =
      toTokyoDateString(r?.record_date) ??
      toTokyoDateString(r?.recordDate) ??
      toTokyoDateString(r?.date) ??
      toTokyoDateString(r?.created_at) ??
      toTokyoDateString(r?.recorded_at);
    if (d !== yyyyMmDd) continue;
    sum += normalizeDurationMin(r?.duration_min);
  }
  return sum;
}
function avgRpeForDate(records: any[] | null | undefined, yyyyMmDd: string) {
  if (!Array.isArray(records)) return 0;
  let s = 0;
  let n = 0;
  for (const r of records) {
    const d =
      toTokyoDateString(r?.record_date) ??
      toTokyoDateString(r?.recordDate) ??
      toTokyoDateString(r?.date) ??
      toTokyoDateString(r?.created_at) ??
      toTokyoDateString(r?.recorded_at);
    if (d !== yyyyMmDd) continue;

    const v = Number(r?.rpe) || Number(r?.session_rpe) || Number(r?.RPE);
    if (Number.isFinite(v) && v > 0) {
      s += v;
      n += 1;
    }
  }
  return n > 0 ? s / n : 0;
}

/** 消費kcal推定（簡易） */
function estimateExerciseKcal({
  weightKg,
  minutes,
  avgRpe,
}: {
  weightKg: number;
  minutes: number;
  avgRpe: number;
}) {
  const w = Math.max(0, weightKg);
  const m = Math.max(0, minutes);
  const r = clamp(avgRpe, 1, 10);
  const met = 2 + (r - 1) * (10 / 9); // RPE1->MET2, RPE10->MET12
  const kcal = (met * 3.5 * w) / 200 * m;
  return Math.round(kcal);
}

/**
 * nutrition-gemini の返却を厳格にパース（必須キーが揃わない場合は throw）
 * 期待値（標準）: { result: { calories, protein, fat, carbs, menu_items, comment } } 等
 */
function parseGeminiResultStrict(json: any) {
  const r = json?.result ?? json?.data ?? json ?? {};

  const calories = r?.calories ?? r?.total_calories ?? r?.kcal;
  const protein = r?.protein ?? r?.p;
  const fat = r?.fat ?? r?.f;
  const carbs = r?.carbs ?? r?.c;

  const calsN = Number(calories);
  const pN = Number(protein);
  const fN = Number(fat);
  const cN = Number(carbs);

  // 必須：kcal と P/F/C が数値として取れないなら失敗扱い（0埋め事故を防ぐ）
  const ok =
    Number.isFinite(calsN) && calsN >= 0 &&
    Number.isFinite(pN) && pN >= 0 &&
    Number.isFinite(fN) && fN >= 0 &&
    Number.isFinite(cN) && cN >= 0;

  if (!ok) {
    const msg =
      r?.error ??
      r?.message ??
      "Gemini返却に必須値（calories/protein/fat/carbs）が見つかりません";
    const detail = JSON.stringify(
      { calories, protein, fat, carbs, keys: Object.keys(r ?? {}) },
      null,
      2
    );
    throw new Error(`${msg}\n${detail}`);
  }

  const menuItems = r?.menu_items ?? r?.menuItems ?? [];
  const comment = r?.comment ?? r?.advice_markdown ?? r?.advice ?? null;

  return {
    total_calories: Math.round(calsN),
    p: toNum(pN, 0),
    f: toNum(fN, 0),
    c: toNum(cN, 0),
    menu_items: Array.isArray(menuItems) ? menuItems : [],
    advice_markdown: comment != null ? String(comment) : null,
    raw: json,
  };
}

export function NutritionCard({
  user,
  latestInbody,
  date,
  trainingRecords,

  badgeText = "栄養(β)",

  nutritionLogs = [],
  nutritionTotals = { cal: 0, p: 0, f: 0, c: 0 },
  nutritionLoading = false,
  nutritionError = null,

  /** 親が fetch し直す用（AthleteView側で渡してね） */
  onSaved,
}: any) {
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [mealType, setMealType] = useState<MealType>("朝食");
  const [mealSlot, setMealSlot] = useState<number>(1);

  const recordDate = safeDateString(date);

  // ✅ 表示を即更新するためのローカル状態（propsと同期）
  const [localLogs, setLocalLogs] = useState<any[]>(Array.isArray(nutritionLogs) ? nutritionLogs : []);
  const [localTotals, setLocalTotals] = useState<any>(nutritionTotals ?? { cal: 0, p: 0, f: 0, c: 0 });

  useEffect(() => {
    setLocalLogs(Array.isArray(nutritionLogs) ? nutritionLogs : []);
  }, [nutritionLogs]);
  useEffect(() => {
    setLocalTotals(nutritionTotals ?? { cal: 0, p: 0, f: 0, c: 0 });
  }, [nutritionTotals]);

  // 体重（InBody優先）
  const targetsAndGaps = useMemo(() => {
    const weightFromUser = toNum(user?.weight_kg, NaN);
    const weightFromInbody = toNum(latestInbody?.weight ?? latestInbody?.weight_kg, NaN);
    const weightKg = Number.isFinite(weightFromInbody)
      ? weightFromInbody
      : Number.isFinite(weightFromUser)
      ? weightFromUser
      : NaN;

    const heightCm = toNum(user?.height_cm, NaN);
    const age = calcAge(user?.date_of_birth);
    const sex = normalizeSex(user?.gender);

    const bodyFatPercent = toNum(
      latestInbody?.body_fat_percent ?? latestInbody?.body_fat_perc ?? latestInbody?.body_fat_percent,
      NaN
    );

    if (!Number.isFinite(weightKg) || weightKg <= 0) {
      return { weightKg: null, targets: null, gaps: null, refs: null };
    }

    const res = buildDailyTargets({
      weightKg,
      bodyFatPercent: Number.isFinite(bodyFatPercent) ? bodyFatPercent : null,
      heightCm: Number.isFinite(heightCm) ? heightCm : null,
      age: Number.isFinite(Number(age)) ? Number(age) : null,
      sex: sex ?? null,
      activityLevel: "moderate",
      goalType: "maintain",
    });

    const targets = res?.target ?? null;

    const gaps = targets
      ? calcGaps({
          today: {
            cal: toNum(localTotals?.cal, 0),
            p: toNum(localTotals?.p, 0),
            f: toNum(localTotals?.f, 0),
            c: toNum(localTotals?.c, 0),
          },
          target: targets,
        })
      : null;

    return {
      weightKg,
      targets,
      gaps,
      refs: {
        ffmKg: res?.ffmKg ?? null,
        bmrKcal: res?.bmrKcal ?? null,
        tdeeKcal: res?.tdeeKcal ?? null,
      },
    };
  }, [user, latestInbody, localTotals]);

  const weightKg = targetsAndGaps.weightKg ?? 0;
  const targets = targetsAndGaps.targets;
  const gaps = targetsAndGaps.gaps;
  const refs = targetsAndGaps.refs;

  // 練習消費
  const trainingMinutes = useMemo(
    () => sumMinutesForDate(trainingRecords, recordDate),
    [trainingRecords, recordDate]
  );
  const trainingAvgRpe = useMemo(
    () => avgRpeForDate(trainingRecords, recordDate),
    [trainingRecords, recordDate]
  );
  const exerciseKcal = useMemo(() => {
    if (!weightKg || trainingMinutes <= 0 || trainingAvgRpe <= 0) return 0;
    return estimateExerciseKcal({ weightKg, minutes: trainingMinutes, avgRpe: trainingAvgRpe });
  }, [weightKg, trainingMinutes, trainingAvgRpe]);

  const netKcal = useMemo(() => {
    const intake = toNum(localTotals?.cal, 0);
    return intake - toNum(exerciseKcal, 0);
  }, [localTotals, exerciseKcal]);

  const lastAdvice = useMemo(() => {
    if (!Array.isArray(localLogs) || localLogs.length === 0) return null;
    const last = localLogs[localLogs.length - 1];
    return last?.advice_markdown ?? null;
  }, [localLogs]);

  /**
   * ✅ Supabase SDK経由で Functions を呼ぶ（CORS/URL/Token管理が安定）
   * Edge側は Authorization Bearer を自動で付けてくれる構成が多い
   */
  async function callNutritionGeminiViaInvoke(payload: any) {
    const { data, error } = await supabase.functions.invoke("nutrition-gemini", {
      body: payload,
    });
    if (error) {
      // errorは object のことがあるので、できるだけ読みやすく
      const msg = (error as any)?.message ?? JSON.stringify(error);
      throw new Error(msg || "nutrition-gemini invoke error");
    }
    return data;
  }

  const handleSelectPhoto = async (file: File | null) => {
    if (!file) return;

    setUploading(true);
    setUploadErr(null);
    setSuccessMsg(null);

    let insertedId: string | number | null = null;

    try {
      const userId = user?.id;
      if (!userId) throw new Error("user.id が取れません");

      const safeSlot = normalizeMealSlot(mealType, mealSlot);

      // 1) Storage upload
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const uuid = crypto.randomUUID();
      const path = `nutrition/${userId}/${recordDate}/${uuid}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("nutrition-images")
        .upload(path, file, { upsert: false, contentType: file.type || "image/jpeg" });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from("nutrition-images").getPublicUrl(path);
      const imageUrl = pub?.publicUrl ?? null;

      // 2) INSERT（まずpendingで入れる）
      const { data: inserted, error: insErr } = await supabase
        .from("nutrition_logs")
        .insert({
          user_id: userId,
          record_date: recordDate,
          meal_type: mealType,
          meal_slot: safeSlot,
          image_path: path,
          image_url: imageUrl,
          image_meta: { original_name: file.name, size: file.size, type: file.type },

          analysis_status: "pending",
          analysis_error: null,
        })
        .select("*")
        .single();

      if (insErr) throw insErr;
      insertedId = inserted?.id;

      // 3) base64 -> nutrition-gemini analyze
      const base64 = await fileToBase64(file);

      // context（任意）：ざっくり補足。必要なら増やせる
      const context = `meal_type=${mealType}${mealType === "補食" ? ` slot=${safeSlot}` : ""}`;

      const geminiJson = await callNutritionGeminiViaInvoke({
        type: "analyze_meal",
        imageBase64: base64,
        context,
      });

      const parsed = parseGeminiResultStrict(geminiJson);

      // 4) UPDATE nutrition_logs（success）
   
      const meta = geminiJson?.meta ?? null;
        const { data: updated, error: updErr } = await supabase
        .from("nutrition_logs")
        .update({
          total_calories: parsed.total_calories,
          p: parsed.p,
          f: parsed.f,
          c: parsed.c,
          menu_items: parsed.menu_items,
          advice_markdown: parsed.advice_markdown,
      
          analysis_status: "success",
          analysis_error: null,
      
          // ★★★ ここを追加 ★★★
          analysis_meta: meta ?? {},
          analysis_model: meta?.used_model ?? null,
          analysis_reason: meta?.reason ?? null,
        })
        .eq("id", inserted.id)
        .select("*")
        .single();

      if (updErr) throw updErr;

      // 5) ✅ UI即更新（今日の記録 / 合計）
      setLocalLogs((prev) =>
        [...(Array.isArray(prev) ? prev : []), updated].sort((a, b) => {
          const at = new Date(a?.created_at ?? 0).getTime();
          const bt = new Date(b?.created_at ?? 0).getTime();
          return at - bt;
        })
      );

      setLocalTotals((prev: any) => {
        const base = prev ?? { cal: 0, p: 0, f: 0, c: 0 };
        return {
          cal: toNum(base.cal, 0) + toNum(updated.total_calories, 0),
          p: toNum(base.p, 0) + toNum(updated.p, 0),
          f: toNum(base.f, 0) + toNum(updated.f, 0),
          c: toNum(base.c, 0) + toNum(updated.c, 0),
        };
      });

      setSuccessMsg("記録完了");

      // 6) ✅ 親にも通知（親が再fetchするならここで）
      if (typeof onSaved === "function") onSaved(updated);
    } catch (e: any) {
      console.error("[NutritionCard] photo/analyze error:", e);
      const msg = String(e?.message ?? e);

      setUploadErr(msg);

      // ✅ DB側もfailedにする（残骸を“管理された残骸”にする）
      if (insertedId != null) {
        try {
          await supabase
            .from("nutrition_logs")
            .update({
              analysis_status: "failed",
              analysis_error: msg.slice(0, 2000), // DBのtextは長いけど、念のため適度に
            })
            .eq("id", insertedId);
        } catch (markErr) {
          console.error("[NutritionCard] failed status update error:", markErr);
        }
      }
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 sm:p-6 transition-colors">
      {/* header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 text-xs font-medium">
              <Flame className="w-3.5 h-3.5" />
              {badgeText}
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">{recordDate}</span>
          </div>

          <h3 className="mt-2 text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
            今日の栄養サマリー
          </h3>

          <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400 space-x-3">
            {refs?.bmrKcal != null && <span>BMR: {refs.bmrKcal} kcal</span>}
            {refs?.tdeeKcal != null && <span>TDEE(推定): {refs.tdeeKcal} kcal</span>}
            {trainingMinutes > 0 && (
              <span>
                練習: {trainingMinutes} min / RPE平均 {trainingAvgRpe.toFixed(1)} / 消費(推定){" "}
                {exerciseKcal} kcal
              </span>
            )}
          </div>
        </div>

        {/* photo uploader */}
        <div className="flex items-center gap-2">
          <select
            value={mealType}
            onChange={(e) => {
              const v = e.target.value as MealType;
              setMealType(v);
              if (v !== "補食") setMealSlot(1);
            }}
            className="px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200"
            disabled={uploading}
          >
            <option value="朝食">朝食</option>
            <option value="昼食">昼食</option>
            <option value="夕食">夕食</option>
            <option value="補食">補食</option>
          </select>

          {mealType === "補食" && (
            <select
              value={mealSlot}
              onChange={(e) => setMealSlot(Number(e.target.value))}
              className="px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200"
              disabled={uploading}
            >
              <option value={1}>補食1</option>
              <option value={2}>補食2</option>
            </select>
          )}

          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1 px-3 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
            title="写真で記録"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
            写真で記録
          </button>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => handleSelectPhoto(e.target.files?.[0] ?? null)}
          />
        </div>
      </div>

      {/* success */}
      {successMsg && (
        <div className="mt-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-300" />
          <p className="text-sm text-emerald-700 dark:text-emerald-200">
            {successMsg}（今日の記録を更新しました）
          </p>
        </div>
      )}

      {/* errors */}
      {uploadErr && (
        <div className="mt-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
          <p className="text-sm text-red-700 dark:text-red-300">写真/解析に失敗しました：{uploadErr}</p>
        </div>
      )}
      {nutritionError && (
        <div className="mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
          <p className="text-sm text-red-700 dark:text-red-300">栄養ログの取得に失敗しました：{nutritionError}</p>
        </div>
      )}

      {/* totals */}
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
          <p className="text-xs text-gray-600 dark:text-gray-400">摂取kcal</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">
            {nutritionLoading ? "..." : Math.round(toNum(localTotals?.cal, 0))}
          </p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
          <p className="text-xs text-gray-600 dark:text-gray-400">P(g)</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">
            {nutritionLoading ? "..." : toNum(localTotals?.p, 0).toFixed(1)}
          </p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
          <p className="text-xs text-gray-600 dark:text-gray-400">F(g)</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">
            {nutritionLoading ? "..." : toNum(localTotals?.f, 0).toFixed(1)}
          </p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
          <p className="text-xs text-gray-600 dark:text-gray-400">C(g)</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">
            {nutritionLoading ? "..." : toNum(localTotals?.c, 0).toFixed(1)}
          </p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
          <p className="text-xs text-gray-600 dark:text-gray-400">収支kcal（摂取-運動）</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">
            {nutritionLoading ? "..." : Math.round(netKcal)}
          </p>
        </div>
      </div>

      {/* targets + gaps */}
      <div className="mt-4">
        {!targets ? (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              目標値の計算には「体重」が必要です（InBody/プロフィールの体重が必要）。
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
              <p className="text-xs text-gray-600 dark:text-gray-400">目標kcal</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">{targets.cal}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">差分: {toNum(gaps?.cal, 0)} kcal</p>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
              <p className="text-xs text-gray-600 dark:text-gray-400">目標P</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">{targets.p} g</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">残り: {toNum(gaps?.p, 0).toFixed(1)} g</p>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
              <p className="text-xs text-gray-600 dark:text-gray-400">目標F</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">{targets.f} g</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">残り: {toNum(gaps?.f, 0).toFixed(1)} g</p>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
              <p className="text-xs text-gray-600 dark:text-gray-400">目標C</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">{targets.c} g</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">残り: {toNum(gaps?.c, 0).toFixed(1)} g</p>
            </div>
          </div>
        )}
      </div>

      {/* advice */}
      {lastAdvice && (
        <div className="mt-4 bg-slate-50 dark:bg-slate-900/20 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">今日のAIアドバイス（最新）</p>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{String(lastAdvice)}</p>
        </div>
      )}

      {/* logs */}
      <div className="mt-5">
        <p className="text-sm font-medium text-gray-900 dark:text-white">今日の記録</p>

        {nutritionLoading ? (
          <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">読み込み中...</div>
        ) : !Array.isArray(localLogs) || localLogs.length === 0 ? (
          <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            まだ栄養記録がありません（朝/昼/夕/補食を追加していこう）
          </div>
        ) : (
          <div className="mt-2 space-y-2">
            {localLogs.map((log: any) => (
              <div key={log.id} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {formatMealLabel(log.meal_type, log.meal_slot)}
                      <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                        {toNum(log.total_calories, 0)} kcal
                      </span>
                      {log.analysis_status && (
                        <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                          {log.analysis_status}
                        </span>
                      )}
                    </p>

                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      P {toNum(log.p, 0).toFixed(1)} / F {toNum(log.f, 0).toFixed(1)} / C{" "}
                      {toNum(log.c, 0).toFixed(1)}
                      {log.is_edited ? "（編集済）" : ""}
                    </p>

                    {Array.isArray(log.menu_items) && log.menu_items.length > 0 && (
                      <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                        推定メニュー:{" "}
                        {log.menu_items
                          .map((x: any) => (typeof x === "string" ? x : x?.name ?? ""))
                          .filter(Boolean)
                          .join(" / ")}
                      </p>
                    )}

                    {log.advice_markdown && (
                      <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400 whitespace-pre-wrap">
                        {String(log.advice_markdown)}
                      </p>
                    )}

                    {log.analysis_status === "failed" && log.analysis_error && (
                      <p className="mt-1 text-[11px] text-red-600 dark:text-red-400 whitespace-pre-wrap">
                        解析失敗: {String(log.analysis_error)}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    onClick={() => console.log("[NutritionCard] detail later", log.id)}
                  >
                    詳細
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
        ※ Supabase Functions invoke（nutrition-gemini）で解析。失敗時はnutrition_logsにfailedを記録。
      </p>
    </div>
  );
}

export default NutritionCard;