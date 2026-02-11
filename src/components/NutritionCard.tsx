// src/components/NutritionCard.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Flame, Camera, Loader2, CheckCircle2, Lightbulb, Tag } from "lucide-react";
import { buildDailyTargets, calcGaps } from "../lib/nutritionCalc";
import { supabase } from "../lib/supabase";
import NutritionEditModal, { type NutritionLog } from "./NutritionEditModal";
import NutritionSummaryPanel from "./NutritionSummaryPanel";

type MealType = "朝食" | "昼食" | "夕食" | "補食";
type MacroTotals = { cal: number; p: number; f: number; c: number };
type DailyRow = { date: string; cal: number; p: number; f: number; c: number };

type Props = {
  user: any;
  latestInbody?: any;
  latestWeightKg?: number | null;
  date?: any;
  trainingRecords?: any[];

  badgeText?: string;

  nutritionLogs?: NutritionLog[];
  nutritionTotals?: MacroTotals;
  nutritionLoading?: boolean;
  nutritionError?: string | null;

  onSaved?: (updated?: NutritionLog | null) => void;

  onSelectDate?: (date: string) => void;
};

function toNum(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

// ✅ kcal統一（PFC=4-9-4）
function kcalFromPFC(p: number, f: number, c: number) {
  const P = toNum(p, 0);
  const F = toNum(f, 0);
  const C = toNum(c, 0);
  return Math.round(P * 4 + F * 9 + C * 4);
}
function kcalFromLog(l: any) {
  const p = toNum(l?.p, 0);
  const f = toNum(l?.f, 0);
  const c = toNum(l?.c, 0);
  const hasMacro = p > 0 || f > 0 || c > 0;
  return hasMacro ? kcalFromPFC(p, f, c) : Math.round(toNum(l?.total_calories, 0));
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

function addDays(yyyyMMdd: string, delta: number) {
  const [y, m, d] = yyyyMMdd.split("-").map((x) => Number(x));
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/**
 * nutrition-gemini の返却を厳格にパース
 * ✅ caloriesは参考値として残し、保存/表示はPFC由来kcalに統一
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
    Number.isFinite(pN) && pN >= 0 &&
    Number.isFinite(fN) && fN >= 0 &&
    Number.isFinite(cN) && cN >= 0;

  if (!ok) {
    // ✅ UIに巨大JSONを出さない：短いメッセージにする（詳細はコンソール）
    const preview = r?.preview ?? null;
    console.warn("[NutritionCard] Gemini parse failed. raw=", json);
    const msg =
      r?.error ??
      r?.message ??
      "P/F/C を読み取れませんでした（写真を撮り直してください）";

    const e = new Error(msg);
    (e as any).code = "AI_PARSE_FAILED";
    (e as any).preview = preview;
    throw e;
  }

  const menuItems = r?.menu_items ?? r?.menuItems ?? [];
  const comment = r?.comment ?? r?.advice_markdown ?? r?.advice ?? null;

  const p = toNum(pN, 0);
  const f = toNum(fN, 0);
  const c = toNum(cN, 0);

  return {
    total_calories: kcalFromPFC(p, f, c),
    p,
    f,
    c,

    ai_calories: Number.isFinite(calsN) ? Math.round(calsN) : null,
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
  return `すでに「${label}」は記録済みです。新規追加はできません。`;
}

/** 今日の結論カード用：不足量（remain>0 = 足りない） */
type DeficitRow = {
  key: "cal" | "p" | "f" | "c";
  label: string;
  unit: string;
  now: number;
  goal: number;
  remain: number;
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

function buildQuickSuggestions(deficits: DeficitRow[] | null) {
  if (!deficits) return [];

  const byKey = Object.fromEntries(deficits.map((d) => [d.key, d])) as Record<string, DeficitRow>;
  const pNeed = Math.max(0, toNum(byKey.p?.remain, 0));
  const cNeed = Math.max(0, toNum(byKey.c?.remain, 0));
  const fNeed = Math.max(0, toNum(byKey.f?.remain, 0));
  const calNeed = Math.max(0, toNum(byKey.cal?.remain, 0));

  const primary =
    pNeed >= 15 ? "p" :
    cNeed >= 40 ? "c" :
    fNeed >= 10 ? "f" :
    calNeed >= 300 ? "cal" :
    pNeed > 0 || cNeed > 0 || fNeed > 0 || calNeed > 0 ? "mix" :
    "ok";

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

  return [
    "主食＋主菜＋果物（まず“セット”で増やす）",
    "補食：おにぎり＋乳製品（簡単に底上げ）",
    "夕食：丼もの/定食スタイルで“量”を確保",
  ];
}

/** menu_items は jsonb/配列/文字列(JSON) があり得るので正規化 */
function normalizeMenuItems(raw: any): any[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;

  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  if (typeof raw === "object") {
    const vals = Object.values(raw);
    return Array.isArray(vals) ? vals : [];
  }

  return [];
}
function formatMenuItem(x: any) {
  if (!x) return "";
  if (typeof x === "string") return x;

  const name = x?.name ?? "";
  const note = x?.note ? `(${x.note})` : "";
  const amt = x?.estimated_amount ? ` ${x.estimated_amount}` : "";
  const s = `${name}${note}${amt}`.trim();
  return s || "";
}

export function NutritionCard({
  user,
  latestInbody,
  latestWeightKg,
  date,

  badgeText = "栄養管理",

  nutritionLogs = [],
  nutritionTotals = { cal: 0, p: 0, f: 0, c: 0 },
  nutritionLoading = false,
  nutritionError = null,

  onSaved,
  onSelectDate,
}: Props) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const labelFileRef = useRef<HTMLInputElement | null>(null);

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

  // ✅ 編集モーダル
  const [editOpen, setEditOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<NutritionLog | null>(null);

  const openEditForExisting = async (type: MealType, slot: number) => {
    const userId = user?.id;
    if (!userId) return;

    const safeSlot = normalizeMealSlot(type, slot);

    // ① まず localLogs から探す
    const foundLocal = (Array.isArray(localLogs) ? localLogs : []).find(
      (l: any) =>
        String(l?.record_date) === String(recordDate) &&
        l?.meal_type === type &&
        Number(l?.meal_slot) === Number(safeSlot)
    );

    if (foundLocal) {
      setSelectedLog(foundLocal as NutritionLog);
      setEditOpen(true);
      return;
    }

    // ② local に無い（同期遅れ/他端末）なら DB から 1件取る
    const { data, error } = await supabase
      .from("nutrition_logs")
      .select("*")
      .eq("user_id", userId)
      .eq("record_date", recordDate)
      .eq("meal_type", type)
      .eq("meal_slot", safeSlot)
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      setSelectedLog(data as NutritionLog);
      setEditOpen(true);
    }
  };

  // ✅ 合計は「localLogsから常に再集計」＆ kcalはPFC由来で統一
  const displayTotals: MacroTotals = useMemo(() => {
    const sum = (Array.isArray(localLogs) ? localLogs : []).reduce(
      (acc, l: any) => {
        const p = toNum(l?.p, 0);
        const f = toNum(l?.f, 0);
        const c = toNum(l?.c, 0);
        acc.p += p;
        acc.f += f;
        acc.c += c;

        acc.cal += kcalFromLog(l);
        return acc;
      },
      { cal: 0, p: 0, f: 0, c: 0 }
    );

    const canUsePropsTotals =
      nutritionLoading && (!Array.isArray(localLogs) || localLogs.length === 0) && nutritionTotals;

    if (canUsePropsTotals) {
      const p = toNum((nutritionTotals as any).p, 0);
      const f = toNum((nutritionTotals as any).f, 0);
      const c = toNum((nutritionTotals as any).c, 0);
      const cal = (p > 0 || f > 0 || c > 0)
        ? kcalFromPFC(p, f, c)
        : toNum((nutritionTotals as any).cal, 0);

      return { cal, p, f, c };
    }

    return {
      cal: Math.round(sum.cal),
      p: Math.round(sum.p * 10) / 10,
      f: Math.round(sum.f * 10) / 10,
      c: Math.round(sum.c * 10) / 10,
    };
  }, [localLogs, nutritionLoading, nutritionTotals]);

  async function callNutritionGeminiViaInvoke(payload: any) {
    const { data, error } = await supabase.functions.invoke("nutrition-gemini", { body: payload });

    if (error) {
      // ✅ 422 等の中身を拾って、原因が分かるようにする
      const ctx = (error as any)?.context;
      const status = ctx?.status ?? (error as any)?.status ?? null;

      let detail = "";
      try {
        // ctx.body が文字列 or JSON のことがある
        const body = ctx?.body;
        if (body) {
          detail = typeof body === "string" ? body : JSON.stringify(body, null, 2);
        }
      } catch { /* noop */ }

      const msg =
        (error as any)?.message ??
        "nutrition-gemini invoke error";

      const full = status ? `${msg} (status=${status})` : msg;

      // UI には短く、詳細は console に
      console.error("[nutrition-gemini invoke error]", { error, payload, detail });

      throw new Error(detail ? `${full}\n${detail}` : full);
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
      return { weightKg: null as number | null, targets: null as any, refs: null as any };
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

  // ✅ 日別履歴（直近14日）
  const [dailyRows, setDailyRows] = useState<DailyRow[]>([]);
  const [dailyLoading, setDailyLoading] = useState(false);

  useEffect(() => {
    const userId = user?.id;
    if (!userId) return;

    const fetchDaily = async () => {
      setDailyLoading(true);
      try {
        const end = recordDate;
        const start = addDays(recordDate, -13);

        const q1 = await supabase
          .from("nutrition_daily_reports")
          .select("report_date,total_calories,p,f,c")
          .eq("user_id", userId)
          .gte("report_date", start)
          .lte("report_date", end)
          .order("report_date", { ascending: false });

        if (!q1.error && Array.isArray(q1.data)) {
          const rows: DailyRow[] = q1.data.map((r: any) => {
            const p = toNum(r?.p, 0);
            const f = toNum(r?.f, 0);
            const c = toNum(r?.c, 0);
            const cal = (p > 0 || f > 0 || c > 0) ? kcalFromPFC(p, f, c) : Math.round(toNum(r?.total_calories, 0));
            return { date: String(r.report_date), cal, p, f, c };
          });
          setDailyRows(rows);
          return;
        }

        const q2 = await supabase
          .from("nutrition_logs")
          .select("record_date,p,f,c,total_calories")
          .eq("user_id", userId)
          .gte("record_date", start)
          .lte("record_date", end);

        if (q2.error) throw q2.error;

        const map = new Map<string, DailyRow>();
        for (const r of q2.data ?? []) {
          const d = String((r as any).record_date);
          const p = toNum((r as any).p, 0);
          const f = toNum((r as any).f, 0);
          const c = toNum((r as any).c, 0);
          const cal = (p > 0 || f > 0 || c > 0) ? kcalFromPFC(p, f, c) : Math.round(toNum((r as any).total_calories, 0));
          const prev = map.get(d) ?? { date: d, cal: 0, p: 0, f: 0, c: 0 };
          prev.p += p; prev.f += f; prev.c += c; prev.cal += cal;
          map.set(d, prev);
        }
        const rows = Array.from(map.values())
          .sort((a, b) => (a.date < b.date ? 1 : -1))
          .map((x) => ({
            ...x,
            cal: Math.round(x.cal),
            p: Math.round(x.p * 10) / 10,
            f: Math.round(x.f * 10) / 10,
            c: Math.round(x.c * 10) / 10,
          }));
        setDailyRows(rows);
      } catch (e) {
        console.warn("[NutritionCard] daily history fetch failed:", e);
        setDailyRows([]);
      } finally {
        setDailyLoading(false);
      }
    };

    fetchDaily();
  }, [user?.id, recordDate]);

  // ✅ 重複チェック（「エラー」ではなく「編集へ誘導」）
  const ensureNotDuplicateOrOpenEdit = async (type: MealType, slot: number) => {
    const safeSlot = normalizeMealSlot(type, slot);

    const existsLocal = (Array.isArray(localLogs) ? localLogs : []).some(
      (l: any) =>
        String(l?.record_date) === String(recordDate) &&
        l?.meal_type === type &&
        Number(l?.meal_slot) === Number(safeSlot)
    );

    if (existsLocal) {
      setUploadErr(null);
      setSuccessMsg(null);
      await openEditForExisting(type, safeSlot);
      throw new Error(duplicateMealMessage(type, safeSlot));
    }

    // localに無いがDBにある可能性（別端末/同期遅れ）
    const userId = user?.id;
    if (userId) {
      const { data, error } = await supabase
        .from("nutrition_logs")
        .select("id")
        .eq("user_id", userId)
        .eq("record_date", recordDate)
        .eq("meal_type", type)
        .eq("meal_slot", safeSlot)
        .limit(1)
        .maybeSingle();

      if (!error && data?.id) {
        setUploadErr(null);
        setSuccessMsg(null);
        await openEditForExisting(type, safeSlot);
        throw new Error(duplicateMealMessage(type, safeSlot));
      }
    }

    return safeSlot;
  };

  const resetFileInputs = () => {
    if (fileRef.current) fileRef.current.value = "";
    if (labelFileRef.current) labelFileRef.current.value = "";
  };

  const handleSelectPhoto = async (file: File | null) => {
    if (!file) return;

    setUploading(true);
    setUploadErr(null);
    setSuccessMsg(null);

    let insertedId: string | null = null;

    try {
      const userId = user?.id;
      if (!userId) throw new Error("user.id が取れません");

      // ✅ 重複なら編集を開いて処理停止
      const safeSlot = await ensureNotDuplicateOrOpenEdit(mealType, mealSlot);

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
          image_meta: { original_name: file.name, size: file.size, type: file.type, source: "meal_photo" },
          analysis_status: "pending",
          analysis_error: null,
        })
        .select("*")
        .single();

      if (insErr) {
        if (isDuplicateMealError(insErr)) {
          await openEditForExisting(mealType, safeSlot);
          throw new Error(duplicateMealMessage(mealType, safeSlot));
        }
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

      // 4) UPDATE success（✅ kcal=PFCで統一）
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

          analysis_meta: { ...(meta ?? {}), ai_calories: parsed.ai_calories ?? null },
          analysis_model: meta?.used_model ?? null,
          analysis_reason: meta?.reason ?? null,
        })
        .eq("id", inserted.id)
        .select("*")
        .single();

      if (updErr) throw updErr;

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
      const msg = String(e?.message ?? e);

      // ✅ 重複は「エラー表示」しない（編集を開く誘導）
      if (msg.includes("記録済み")) {
        // 小さく案内だけ出す（赤枠ではなく成功枠でも良いが、ここは控えめに）
        setSuccessMsg("すでに記録があるので、編集を開きました");
        setUploadErr(null);
      } else if ((e as any)?.code === "AI_PARSE_FAILED") {
        setUploadErr(
          "P/F/C を読み取れませんでした。\n" +
          "・料理をアップで\n・明るい場所で\n・ブレないように\n" +
          "もう一度撮影してみてください。"
        );
      } else {
        setUploadErr(msg);
      }

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
      console.error("[NutritionCard] photo/analyze error:", e);
    } finally {
      setUploading(false);
      resetFileInputs();
    }
  };

  /**
   * ✅ バックアップ：ラベルOCR（複数写真）
   */
  const handleSelectLabelPhotos = async (files: FileList | null) => {
    const list = files ? Array.from(files) : [];
    if (list.length === 0) return;

    setUploading(true);
    setUploadErr(null);
    setSuccessMsg(null);

    try {
      const userId = user?.id;
      if (!userId) throw new Error("user.id が取れません");

      // ✅ 重複なら編集を開いて停止
      const safeSlot = await ensureNotDuplicateOrOpenEdit(mealType, mealSlot);

      // base64（最大3枚）
      const imagesBase64 = await Promise.all(list.slice(0, 3).map(fileToBase64));
      const context = `meal_type=${mealType}${mealType === "補食" ? ` slot=${safeSlot}` : ""}`;

      const geminiJson = await callNutritionGeminiViaInvoke({
        type: "analyze_label",
        imagesBase64,
        context,
      });

      const parsed = parseGeminiResultStrict(geminiJson);
      const meta = geminiJson?.meta ?? null;

      const { data: inserted, error: insErr } = await supabase
        .from("nutrition_logs")
        .insert({
          user_id: userId,
          record_date: recordDate,
          meal_type: mealType,
          meal_slot: safeSlot,

          total_calories: parsed.total_calories,
          p: parsed.p,
          f: parsed.f,
          c: parsed.c,
          menu_items: parsed.menu_items,
          advice_markdown: parsed.advice_markdown,

          image_path: null,
          image_url: null,
          image_meta: {
            source: "label_ocr",
            label_images: list.slice(0, 3).map((f) => ({ name: f.name, size: f.size, type: f.type })),
          },

          analysis_status: "success",
          analysis_error: null,

          analysis_meta: { ...(meta ?? {}), ai_calories: parsed.ai_calories ?? null },
          analysis_model: meta?.used_model ?? null,
          analysis_reason: meta?.reason ?? null,
        })
        .select("*")
        .single();

      if (insErr) {
        if (isDuplicateMealError(insErr)) {
          await openEditForExisting(mealType, safeSlot);
          throw new Error(duplicateMealMessage(mealType, safeSlot));
        }
        throw insErr;
      }

      setLocalLogs((prev) =>
        [...(Array.isArray(prev) ? prev : []), inserted].sort((a: any, b: any) => {
          const at = new Date(a?.created_at ?? 0).getTime();
          const bt = new Date(b?.created_at ?? 0).getTime();
          return at - bt;
        })
      );

      setSuccessMsg("ラベルから記録完了");
      if (typeof onSaved === "function") onSaved(inserted as NutritionLog);
    } catch (e: any) {
      const msg = String(e?.message ?? e);

      if (msg.includes("記録済み")) {
        setSuccessMsg("すでに記録があるので、編集を開きました");
        setUploadErr(null);
      } else if ((e as any)?.code === "AI_PARSE_FAILED") {
        setUploadErr(
          "ラベルからP/F/Cを読み取れませんでした。\n" +
          "・栄養成分表示を画面いっぱいに\n・斜め/反射を避ける\n・明るい場所で\n" +
          "撮り直してみてください。"
        );
      } else if (msg.includes("Unknown type") || msg.includes("analyze_label")) {
        setUploadErr(
          "ラベル解析（analyze_label）が未実装です。\n" +
          "nutrition-gemini に type:'analyze_label' を追加実装したら動きます。"
        );
      } else {
        setUploadErr(msg);
      }

      console.error("[NutritionCard] label analyze error:", e);
    } finally {
      setUploading(false);
      resetFileInputs();
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

          <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400 space-x-3">
            {refs?.bmrKcal != null && <span>推定基礎代謝量: {refs.bmrKcal} kcal</span>}
            {refs?.tdeeKcal != null && <span>今日必要なカロリー(推定TDEE): {refs.tdeeKcal} kcal</span>}
          </div>

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

          <button
            type="button"
            onClick={() => labelFileRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1 px-3 py-2 text-sm rounded-lg bg-slate-700 text-white hover:bg-slate-800 disabled:opacity-60"
            title="栄養成分表示（ラベル）を撮影して解析"
          >
            <Tag className="w-4 h-4" />
            ラベル
          </button>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="absolute -left-[9999px] top-0 w-px h-px opacity-0"
            onChange={(e) => handleSelectPhoto(e.target.files?.[0] ?? null)}
          />

          <input
            ref={labelFileRef}
            type="file"
            accept="image/*"
            multiple
            className="absolute -left-[9999px] top-0 w-px h-px opacity-0"
            onChange={(e) => handleSelectLabelPhotos(e.target.files)}
          />
        </div>
      </div>

      {/* ✅ 日別履歴（直近） */}
      <div className="mt-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/20 p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">履歴（直近14日）</p>
          <span className="text-[11px] text-gray-500 dark:text-gray-400">
            {onSelectDate ? "タップで日付切替" : "（日付切替は親側で対応）"}
          </span>
        </div>

        {dailyLoading ? (
          <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">読み込み中...</div>
        ) : dailyRows.length === 0 ? (
          <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">履歴がありません</div>
        ) : (
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {dailyRows.slice(0, 8).map((d) => (
              <button
                key={d.date}
                type="button"
                onClick={() => onSelectDate?.(d.date)}
                disabled={!onSelectDate}
                className={[
                  "rounded-lg border px-3 py-2 text-left transition-colors",
                  "hover:bg-white dark:hover:bg-gray-800",
                  d.date === recordDate ? "border-emerald-500" : "border-gray-200 dark:border-gray-700",
                  !onSelectDate ? "opacity-70 cursor-default" : "",
                ].join(" ")}
              >
                <div className="text-xs text-gray-500 dark:text-gray-400">{d.date}</div>
                <div className="text-sm font-semibold text-gray-900 dark:text-white">{d.cal} kcal</div>
                <div className="text-[11px] text-gray-500 dark:text-gray-400">
                  P{d.p} F{d.f} C{d.c}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* success */}
      {successMsg && (
        <div className="mt-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-300" />
          <p className="text-sm text-emerald-700 dark:text-emerald-200 whitespace-pre-wrap">{successMsg}</p>
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
          <span className="text-[11px] text-slate-500 dark:text-slate-400">※ 目安です</span>
        </div>

        {!targets ? (
          <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            体重データがあると、推定目標（BMR/TDEE/PFC）が出せます。
          </div>
        ) : nutritionLoading ? (
          <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">集計中…</div>
        ) : (
          <div className="mt-3 space-y-3">
            <div>
              <p className="text-xs font-medium text-slate-700 dark:text-slate-200">不足（優先度）</p>
              {shortageRanking && shortageRanking.length > 0 ? (
                <div className="mt-1 space-y-1">
                  {shortageRanking.slice(0, 2).map((d) => (
                    <div key={d.key} className="text-sm text-slate-800 dark:text-slate-100">
                      <span className="font-semibold">{d.label}</span>
                      <span className="ml-2 text-slate-600 dark:text-slate-300">
                        あと <b>{d.remain}</b> {d.unit}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-1 text-sm text-slate-700 dark:text-slate-200">
                  目標はだいたい到達（超過が気になる場合は脂質/間食を見直し）
                </div>
              )}

              {gaps && (
                <div className="mt-2 text-[11px] text-slate-600 dark:text-slate-300">
                  残り目安：P {toNum((gaps as any).p, 0).toFixed(1)} g / F {toNum((gaps as any).f, 0).toFixed(1)} g / C{" "}
                  {toNum((gaps as any).c, 0).toFixed(1)} g / kcal {Math.round(toNum((gaps as any).cal, 0))}
                </div>
              )}
            </div>

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

      {/* Summary Panel */}
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
            {localLogs.map((log: any) => {
              const menuItems = normalizeMenuItems(log?.menu_items);
              const menuText = menuItems.map((x: any) => formatMenuItem(x)).filter(Boolean).join(" / ");
              const kcal = kcalFromLog(log);

              return (
                <div key={log.id} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                  <div className="flex items-start justify-between gap-3">
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
                            {kcal} kcal
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

                        {menuText && (
                          <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400 break-words">
                            推定メニュー: {menuText}
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
                    </div>

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
              );
            })}
          </div>
        )}
      </div>

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
            if (typeof onSaved === "function") onSaved(null);
          }}
        />
      )}
    </div>
  );
}

export default NutritionCard;
