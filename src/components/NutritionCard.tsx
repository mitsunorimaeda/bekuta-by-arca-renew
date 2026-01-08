// src/components/NutritionCard.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Flame, Camera, Loader2, CheckCircle2, Lightbulb } from "lucide-react";
import { buildDailyTargets, calcGaps } from "../lib/nutritionCalc";
import { supabase } from "../lib/supabase";
import NutritionEditModal, { type NutritionLog } from "./NutritionEditModal";
import NutritionOverview from "./NutritionOverview";
import NutritionSummaryPanel from "./NutritionSummaryPanel";

type MealType = "朝食" | "昼食" | "夕食" | "補食";

type MacroTotals = { cal: number; p: number; f: number; c: number };

type Props = {
  user: any;
  latestInbody?: any;
  latestWeightKg?: number | null;
  date?: any;
  trainingRecords?: any[];

  badgeText?: string;

  nutritionLogs?: NutritionLog[];
  nutritionTotals?: MacroTotals; // 親が返してくる合計（あってもOK / なくてもOK）
  nutritionLoading?: boolean;
  nutritionError?: string | null;

  onSaved?: (updated: NutritionLog) => void; // 親が再fetchしたい場合に使う
};

function toNum(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
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

/**
 * nutrition-gemini の返却を厳格にパース（必須キーが揃わない場合は throw）
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

  const ok =
    Number.isFinite(calsN) &&
    calsN >= 0 &&
    Number.isFinite(pN) &&
    pN >= 0 &&
    Number.isFinite(fN) &&
    fN >= 0 &&
    Number.isFinite(cN) &&
    cN >= 0;

  if (!ok) {
    const msg =
      r?.error ?? r?.message ?? "Gemini返却に必須値（calories/protein/fat/carbs）が見つかりません";
    const detail = JSON.stringify({ calories, protein, fat, carbs, keys: Object.keys(r ?? {}) }, null, 2);
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

function isDuplicateMealError(err: any) {
  const code = err?.code ?? err?.details?.code;
  const msg = String(err?.message ?? "");
  const detail = String(err?.details ?? "");
  const hint = String(err?.hint ?? "");
  return (
    code === "23505" ||
    msg.includes("nutrition_logs_user_date_meal_slot_unique") ||
    detail.includes("nutrition_logs_user_date_meal_slot_unique") ||
    hint.includes("nutrition_logs_user_date_meal_slot_unique")
  );
}
function duplicateMealMessage(mealType: MealType, mealSlot: number) {
  const label = mealType === "補食" ? `補食${mealSlot}` : mealType;
  return `すでに「${label}」は記録済みです。新規追加はできません。\n「今日の記録」から開いて編集してください。`;
}

/** 今日の結論カード用：不足量（remain>0 = 足りない） */
type DeficitRow = {
  key: "cal" | "p" | "f" | "c";
  label: string;
  unit: string;
  now: number;
  goal: number;
  remain: number; // goal - now
};

function buildDeficits(totals: MacroTotals, targets: any | null): DeficitRow[] | null {
  if (!targets) return null;

  const calNow = toNum(totals?.cal, 0);
  const pNow = toNum(totals?.p, 0);
  const fNow = toNum(totals?.f, 0);
  const cNow = toNum(totals?.c, 0);

  const rows: DeficitRow[] = [
    {
      key: "cal",
      label: "エネルギー",
      unit: "kcal",
      now: Math.round(calNow),
      goal: Math.round(toNum(targets?.cal, 0)),
      remain: Math.round(toNum(targets?.cal, 0)) - Math.round(calNow),
    },
    {
      key: "p",
      label: "たんぱく質",
      unit: "g",
      now: Math.round(pNow * 10) / 10,
      goal: Math.round(toNum(targets?.p, 0) * 10) / 10,
      remain: Math.round((toNum(targets?.p, 0) - pNow) * 10) / 10,
    },
    {
      key: "f",
      label: "脂質",
      unit: "g",
      now: Math.round(fNow * 10) / 10,
      goal: Math.round(toNum(targets?.f, 0) * 10) / 10,
      remain: Math.round((toNum(targets?.f, 0) - fNow) * 10) / 10,
    },
    {
      key: "c",
      label: "炭水化物",
      unit: "g",
      now: Math.round(cNow * 10) / 10,
      goal: Math.round(toNum(targets?.c, 0) * 10) / 10,
      remain: Math.round((toNum(targets?.c, 0) - cNow) * 10) / 10,
    },
  ];

  return rows;
}

/** “次の一手”は断言しない。候補を3つだけ出す（ローカルルール） */
function buildQuickSuggestions(deficits: DeficitRow[] | null) {
  if (!deficits) return [];

  const byKey = Object.fromEntries(deficits.map((d) => [d.key, d])) as Record<string, DeficitRow>;
  const pNeed = Math.max(0, toNum(byKey.p?.remain, 0));
  const cNeed = Math.max(0, toNum(byKey.c?.remain, 0));
  const fNeed = Math.max(0, toNum(byKey.f?.remain, 0));
  const calNeed = Math.max(0, toNum(byKey.cal?.remain, 0));

  // 優先を雑に決める（不足が“行動に繋がる”単位のとき）
  const primary =
    pNeed >= 15 ? "p" :
    cNeed >= 40 ? "c" :
    fNeed >= 10 ? "f" :
    calNeed >= 300 ? "cal" :
    pNeed > 0 || cNeed > 0 || fNeed > 0 || calNeed > 0 ? "mix" :
    "ok";

  // 併せ技（P不足かつC不足が大きい日は「主食+主菜」系）
  const pcCombo = pNeed >= 15 && cNeed >= 40;

  if (primary === "ok") {
    return [
      "今日はだいたいOK。水分・野菜・睡眠を整える",
      "補食を入れるなら：ヨーグルト or 果物",
      "明日に備えて：夕食で主食・主菜を欠かさない",
    ];
  }

  if (pcCombo) {
    return [
      "ご飯（中）＋鶏むね/ささみ（目安）",
      "おにぎり2個＋ツナ/サバ缶（半分〜1缶）",
      "うどん＋卵/納豆（タンパク質を足す）",
    ];
  }

  if (primary === "p") {
    return [
      "鶏むね・ささみ（目安）／脂質を抑えてPを足す",
      "卵＋納豆（手軽にPを積む）",
      "プロテイン1杯＋ヨーグルト（補食で埋める）",
    ];
  }

  if (primary === "c") {
    return [
      "おにぎり2個（まず主食で埋める）",
      "ご飯＋汁物（消化しやすく）",
      "バナナ＋ヨーグルト（補食でCを足す）",
    ];
  }

  if (primary === "f") {
    return [
      "ナッツひと握り（20g目安）",
      "オリーブオイルを料理に小さじ1〜2追加",
      "サバ缶（脂質もPも足せる）",
    ];
  }

  // cal / mix
  return [
    "主食＋主菜＋果物（まず“セット”で増やす）",
    "補食：おにぎり＋乳製品（簡単に底上げ）",
    "夕食：丼もの/定食スタイルで“量”を確保",
  ];
}

export function NutritionCard({
  user,
  latestInbody,
  latestWeightKg,
  date,
  trainingRecords,

  badgeText = "栄養(β)",

  nutritionLogs = [],
  nutritionTotals = { cal: 0, p: 0, f: 0, c: 0 },
  nutritionLoading = false,
  nutritionError = null,

  onSaved,
}: Props) {
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [mealType, setMealType] = useState<MealType>("朝食");
  const [mealSlot, setMealSlot] = useState<number>(1);

  const recordDate =
    toTokyoDateString(date) ?? toTokyoDateString(new Date()) ?? new Date().toISOString().slice(0, 10);

  // ✅ 表示を即更新するためのローカル状態（propsと同期）
  const [localLogs, setLocalLogs] = useState<NutritionLog[]>(Array.isArray(nutritionLogs) ? nutritionLogs : []);

  useEffect(() => {
    setLocalLogs(Array.isArray(nutritionLogs) ? nutritionLogs : []);
  }, [nutritionLogs]);

  // ✅ 合計は「localLogsから常に再集計」＝編集/削除でズレない
  const displayTotals: MacroTotals = useMemo(() => {
    const sum = (Array.isArray(localLogs) ? localLogs : []).reduce(
      (acc, l: any) => {
        acc.cal += toNum(l?.total_calories, 0);
        acc.p += toNum(l?.p, 0);
        acc.f += toNum(l?.f, 0);
        acc.c += toNum(l?.c, 0);
        return acc;
      },
      { cal: 0, p: 0, f: 0, c: 0 }
    );

    // 初回ロード中に localLogs が空でも、親が totals を持ってる場合はそれを優先表示して“0チラつき”を回避
    const canUsePropsTotals =
      nutritionLoading && (!Array.isArray(localLogs) || localLogs.length === 0) && nutritionTotals;

    return canUsePropsTotals
      ? {
          cal: toNum(nutritionTotals.cal, 0),
          p: toNum(nutritionTotals.p, 0),
          f: toNum(nutritionTotals.f, 0),
          c: toNum(nutritionTotals.c, 0),
        }
      : sum;
  }, [localLogs, nutritionLoading, nutritionTotals]);

  // ✅ 編集モーダル
  const [editOpen, setEditOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<NutritionLog | null>(null);

  async function callNutritionGeminiViaInvoke(payload: any) {
    const { data, error } = await supabase.functions.invoke("nutrition-gemini", { body: payload });
    if (error) {
      const msg = (error as any)?.message ?? JSON.stringify(error);
      throw new Error(msg || "nutrition-gemini invoke error");
    }
    return data;
  }

  // 体重（InBody優先 → 体重記録latestWeightKg → user.profile）
  const targetsAndRefs = useMemo(() => {
    const weightFromUser = toNum(user?.weight_kg, NaN);
    const weightFromInbody = toNum(latestInbody?.weight ?? latestInbody?.weight_kg, NaN);
    const weightFromLatest = toNum(latestWeightKg, NaN);

    const weightKg = Number.isFinite(weightFromInbody)
      ? weightFromInbody
      : Number.isFinite(weightFromLatest)
      ? weightFromLatest
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
      return {
        weightKg: null as number | null,
        targets: null as any,
        refs: null as any,
      };
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

    return {
      weightKg,
      targets: res?.target ?? null,
      refs: {
        ffmKg: res?.ffmKg ?? null,
        bmrKcal: res?.bmrKcal ?? null,
        tdeeKcal: res?.tdeeKcal ?? null,
      },
    };
  }, [user, latestInbody, latestWeightKg]);

  const targets = targetsAndRefs.targets;
  const refs = targetsAndRefs.refs;

  // ✅ 結論カード（不足ランキング + 次の一手）
  const deficits = useMemo(() => buildDeficits(displayTotals, targets), [displayTotals, targets]);

  const shortageRanking = useMemo(() => {
    if (!deficits) return null;
    // “足りない”のみ抽出して大きい順
    const shorts = deficits.filter((d) => d.remain > 0 && Number.isFinite(d.remain));
    shorts.sort((a, b) => b.remain - a.remain);
    return shorts;
  }, [deficits]);

  const quickSuggestions = useMemo(() => buildQuickSuggestions(deficits), [deficits]);

  const gaps = useMemo(() => {
    if (!targets) return null;
    return calcGaps({
      today: {
        cal: toNum(displayTotals?.cal, 0),
        p: toNum(displayTotals?.p, 0),
        f: toNum(displayTotals?.f, 0),
        c: toNum(displayTotals?.c, 0),
      },
      target: targets,
    });
  }, [displayTotals, targets]);

  const handleSelectPhoto = async (file: File | null) => {
    if (!file) return;

    const safeSlot = normalizeMealSlot(mealType, mealSlot);
    const exists = (Array.isArray(localLogs) ? localLogs : []).some(
      (l: any) =>
        String(l?.record_date) === String(recordDate) &&
        l?.meal_type === mealType &&
        Number(l?.meal_slot) === Number(safeSlot)
    );
    if (exists) {
      setUploadErr(duplicateMealMessage(mealType, safeSlot));
      if (fileRef.current) fileRef.current.value = "";
      return;
    }

    setUploading(true);
    setUploadErr(null);
    setSuccessMsg(null);

    let insertedId: string | null = null;

    try {
      const userId = user?.id;
      if (!userId) throw new Error("user.id が取れません");

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

      // 2) INSERT（pending）
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

      if (insErr) {
        if (isDuplicateMealError(insErr)) throw new Error(duplicateMealMessage(mealType, safeSlot));
        throw insErr;
      }

      insertedId = inserted?.id ?? null;

      // 3) analyze
      const base64 = await fileToBase64(file);
      const context = `meal_type=${mealType}${mealType === "補食" ? ` slot=${safeSlot}` : ""}`;

      const geminiJson = await callNutritionGeminiViaInvoke({
        type: "analyze_meal",
        imageBase64: base64,
        context,
      });

      const parsed = parseGeminiResultStrict(geminiJson);
      const meta = geminiJson?.meta ?? null;

      // 4) UPDATE success
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

          analysis_meta: meta ?? {},
          analysis_model: meta?.used_model ?? null,
          analysis_reason: meta?.reason ?? null,
        })
        .eq("id", inserted.id)
        .select("*")
        .single();

      if (updErr) throw updErr;

      // 5) UI即更新（合計は useMemo で再計算される）
      setLocalLogs((prev) =>
        [...(Array.isArray(prev) ? prev : []), updated].sort((a: any, b: any) => {
          const at = new Date(a?.created_at ?? 0).getTime();
          const bt = new Date(b?.created_at ?? 0).getTime();
          return at - bt;
        })
      );

      setSuccessMsg("記録完了");
      if (typeof onSaved === "function") onSaved(updated as NutritionLog);
    } catch (e: any) {
      console.error("[NutritionCard] photo/analyze error:", e);
      const msg = String(e?.message ?? e);
      setUploadErr(msg);

      // ✅ pending 作った場合は failed 記録
      if (insertedId != null) {
        try {
          await supabase
            .from("nutrition_logs")
            .update({ analysis_status: "failed", analysis_error: msg.slice(0, 2000) })
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

          <h3 className="mt-2 text-base sm:text-lg font-semibold text-gray-900 dark:text-white">栄養</h3>

          {/* ✅ 推定値（BMR/TDEE）を“見える”ように */}
          <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400 space-x-3">
            {refs?.bmrKcal != null && <span>推定BMR: {refs.bmrKcal} kcal</span>}
            {refs?.tdeeKcal != null && <span>今日必要(推定TDEE): {refs.tdeeKcal} kcal</span>}
          </div>

          {/* ✅ 目標PFCを“見える”ように（targets がある時だけ） */}
          {targets && (
            <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
              目標: {targets.cal} kcal / P {targets.p} g / F {targets.f} g / C {targets.c} g
            </div>
          )}
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
            title="写真を選択"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
            写真
          </button>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="absolute -left-[9999px] top-0 w-px h-px opacity-0"
            onChange={(e) => handleSelectPhoto(e.target.files?.[0] ?? null)}
          />
        </div>
      </div>

      {/* success */}
      {successMsg && (
        <div className="mt-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-300" />
          <p className="text-sm text-emerald-700 dark:text-emerald-200">{successMsg}</p>
        </div>
      )}

      {/* errors */}
      {uploadErr && (
        <div className="mt-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
          <p className="text-sm text-red-700 dark:text-red-300 whitespace-pre-wrap">写真/解析に失敗しました：{uploadErr}</p>
        </div>
      )}
      {nutritionError && (
        <div className="mt-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
          <p className="text-sm text-red-700 dark:text-red-300">栄養ログの取得に失敗しました：{nutritionError}</p>
        </div>
      )}

      {/* ✅ 今日の結論カード（不足ランキング + 次の一手） */}
      <div className="mt-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-slate-50 dark:bg-slate-900/20 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-slate-700 dark:text-slate-200" />
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">今日の結論</p>
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">※ 目安（AIは下書き）</span>
        </div>

        {!targets ? (
          <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            体重データがあると、推定目標（BMR/TDEE/PFC）が出せます。
          </div>
        ) : nutritionLoading ? (
          <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">集計中…</div>
        ) : (
          <div className="mt-3 space-y-3">
            {/* 不足ランキング */}
            <div>
              <p className="text-xs font-medium text-slate-700 dark:text-slate-200">不足（優先度）</p>
              {shortageRanking && shortageRanking.length > 0 ? (
                <div className="mt-1 space-y-1">
                  {shortageRanking.slice(0, 2).map((d) => (
                    <div key={d.key} className="text-sm text-slate-800 dark:text-slate-100">
                      <span className="font-semibold">{d.label}</span>
                      <span className="ml-2 text-slate-600 dark:text-slate-300">
                        まだ <b>{d.remain}</b> {d.unit}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-1 text-sm text-slate-700 dark:text-slate-200">
                  目標はだいたい到達（超過が気になる場合は脂質/間食を見直し）
                </div>
              )}

              {/* “残り”も見えると納得感が上がる（gapsを補助表示） */}
              {gaps && (
                <div className="mt-2 text-[11px] text-slate-600 dark:text-slate-300">
                  残り目安：P {toNum(gaps.p, 0).toFixed(1)} g / F {toNum(gaps.f, 0).toFixed(1)} g / C{" "}
                  {toNum(gaps.c, 0).toFixed(1)} g / kcal {Math.round(toNum(gaps.cal, 0))}
                </div>
              )}
            </div>

            {/* 次の一手 */}
            <div>
              <p className="text-xs font-medium text-slate-700 dark:text-slate-200">次の一手（候補）</p>
              <ul className="mt-1 list-disc pl-5 space-y-1 text-sm text-slate-800 dark:text-slate-100">
                {quickSuggestions.slice(0, 3).map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

        <div className="mt-4">
        <NutritionSummaryPanel
            dateLabel={recordDate}
            totals={displayTotals}
            targets={targets}
            loading={nutritionLoading}
            bmrKcal={refs?.bmrKcal ?? null}
            tdeeKcal={refs?.tdeeKcal ?? null}
            onPrimaryAction={() => fileRef.current?.click()}
            primaryLabel="食事を記録"
        />
        </div>

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
                  {/* 左：サムネ + テキスト */}
                  <div className="flex items-start gap-3 min-w-0">
                    {log.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={log.image_url}
                        alt="meal"
                        className="w-14 h-14 rounded-lg object-cover border border-gray-200 dark:border-gray-700 flex-none"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex-none" />
                    )}

                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {formatMealLabel(log.meal_type, log.meal_slot)}
                        <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                          {toNum(log.total_calories, 0)} kcal
                        </span>
                        {log.analysis_status && (
                          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                            {String(log.analysis_status)}
                          </span>
                        )}
                      </p>

                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        P {toNum(log.p, 0).toFixed(1)} / F {toNum(log.f, 0).toFixed(1)} / C {toNum(log.c, 0).toFixed(1)}
                        {log.is_edited ? "（編集済）" : ""}
                      </p>

                      {log.analysis_status === "failed" && log.analysis_error && (
                        <p className="mt-1 text-[11px] text-red-600 dark:text-red-400 whitespace-pre-wrap">
                          解析失敗: {String(log.analysis_error)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* 右：詳細ボタン */}
                  <button
                    type="button"
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    onClick={() => {
                      setSelectedLog(log as NutritionLog);
                      setEditOpen(true);
                    }}
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
        ※ Supabase Functions invoke（nutrition-gemini）で解析。失敗時は nutrition_logs に failed を記録。
      </p>

      {/* ✅ Edit Modal */}
      {editOpen && selectedLog && (
        <NutritionEditModal
          open={editOpen}
          log={selectedLog}
          onClose={() => {
            setEditOpen(false);
            setSelectedLog(null);
          }}
          onSaved={(updated) => {
            setLocalLogs((prev) => (Array.isArray(prev) ? prev.map((x: any) => (x.id === updated.id ? updated : x)) : []));
            setEditOpen(false);
            setSelectedLog(null);
            if (typeof onSaved === "function") onSaved(updated);
          }}
          onDeleted={(deletedId) => {
            setLocalLogs((prev) => (Array.isArray(prev) ? prev.filter((x: any) => x?.id !== deletedId) : []));
            setEditOpen(false);
            setSelectedLog(null);
          }}
        />
      )}
    </div>
  );
}

export default NutritionCard;