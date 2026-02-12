// supabase/functions/nutrition-gemini/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type DailySummaryRequest = {
  type: "daily_summary";
  date: string; // JST YYYY-MM-DD
  target: { cal: number; p: number; f: number; c: number };
  totals: { cal: number; p: number; f: number; c: number };
  gaps: { cal: number; p: number; f: number; c: number };
  note?: string;
};

type NutritionRequest =
  | { type: "analyze_meal"; imageBase64: string; context?: string }
  | { type: "analyze_label"; imagesBase64: string[]; context?: string }
  | {
      type: "generate_plan";
      profile: {
        sex?: "male" | "female";
        age?: number;
        height?: number;
        weight?: number;
        bodyFatPercent?: number;
        activityLevel?: string;
        goal?: "gain" | "maintain" | "loss";
      };
    }
  | DailySummaryRequest;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function toNum(v: unknown, fallback: number | null = null) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function truncateByChars(s: string, maxChars: number) {
  const str = String(s ?? "");
  return str.length <= maxChars ? str : str.slice(0, maxChars);
}

function safeDateYYYYMMDD(s: string) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/**
 * Geminiが返した text からJSONだけ抜き出してparse（混在・前置き対策）
 */
function safeParseJsonFromText(text: string) {
  const cleaned = String(text ?? "")
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  // ① まず全文JSONでいけるか
  try {
    return JSON.parse(cleaned);
  } catch {
    // noop
  }

  // ② 最初の { から最後の } の範囲
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const slice = cleaned.slice(start, end + 1);
    try {
      return JSON.parse(slice);
    } catch {
      // noop
    }
  }

  // ③ 複数候補を走査
  const candidates: string[] = [];
  const idxs: number[] = [];
  for (let i = 0; i < cleaned.length; i++) {
    if (cleaned[i] === "{") idxs.push(i);
  }
  for (const s of idxs) {
    for (let e = cleaned.length - 1; e > s; e--) {
      if (cleaned[e] === "}") {
        const cand = cleaned.slice(s, e + 1);
        if (cand.length > 20) candidates.push(cand);
        break;
      }
    }
  }
  for (const cand of candidates) {
    try {
      return JSON.parse(cand);
    } catch {
      // continue
    }
  }

  throw new Error(`JSON parse failed: ${cleaned.slice(0, 240)}...`);
}

/**
 * candidates.parts から text を全部連結
 */
function extractGeminiText(raw: any): string {
  const parts = raw?.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts)) {
    const texts = parts
      .map((p: any) => (typeof p?.text === "string" ? p.text : ""))
      .filter((t: string) => t.length > 0);
    if (texts.length > 0) return texts.join("\n").trim();
  }
  const t1 =
    raw?.candidates?.[0]?.content?.parts?.[0]?.text ??
    raw?.candidates?.[0]?.content?.text ??
    "";
  return String(t1 ?? "").trim();
}



/**
 * ✅ analyze_label(複数商品) の出力を正規化
 * - items: 各商品（ラベルから読めたPFCを格納）
 * - total: 合計（itemsから計算して確定）
 * - 互換: protein/fat/carbs/calories/menu_items/comment も返す（NutritionCardの既存parse用）
 */
type LabelItem = {
  name: string;
  serving_label: string;
  p: number | null;
  f: number | null;
  c: number | null;
  label_kcal: number | null;
  confidence: "high" | "med" | "low";
};

function round1(n: number) {
  return Math.round(n * 10) / 10;
}
function toConf(v: any): "high" | "med" | "low" {
  const s = String(v ?? "").toLowerCase();
  if (s === "high") return "high";
  if (s === "low") return "low";
  return "med";
}
function normServingLabel(v: any) {
  return truncateByChars(isNonEmptyString(v) ? v : "", 24);
}
function normName(v: any) {
  const s = isNonEmptyString(v) ? v.trim() : "";
  return truncateByChars(s, 40);
}
function pickItemFromLegacy(raw: any): LabelItem {
  const p = toNum(raw?.p ?? raw?.protein ?? raw?.protein_g, null);
  const f = toNum(raw?.f ?? raw?.fat ?? raw?.fat_g, null);
  const c = toNum(raw?.c ?? raw?.carbs ?? raw?.carbs_g, null);
  const kcal = toNum(raw?.label_kcal ?? raw?.calories ?? raw?.kcal, null);

  const serving =
    (isNonEmptyString(raw?.serving_label) && raw.serving_label) ||
    (isNonEmptyString(raw?.serving) && raw.serving) ||
    "";

  const nameCandidatesRaw = Array.isArray(raw?.name_candidates)
    ? raw.name_candidates
    : Array.isArray(raw?.names)
      ? raw.names
      : [];
  const name0 =
    normName(raw?.name) ||
    (nameCandidatesRaw.find((x: any) => isNonEmptyString(x)) ? normName(nameCandidatesRaw.find((x: any) => isNonEmptyString(x))) : "");

  return {
    name: name0 || "加工食品",
    serving_label: normServingLabel(serving),
    p: p === null ? null : clamp(round1(p), 0, 300),
    f: f === null ? null : clamp(round1(f), 0, 300),
    c: c === null ? null : clamp(round1(c), 0, 800),
    label_kcal: kcal === null ? null : clamp(Math.round(kcal), 0, 5000),
    confidence: toConf(raw?.confidence),
  };
}

function normalizeAnalyzeLabelMultiResult(raw: any) {
  // 想定スキーマ（Geminiに要求する形）
  // {
  //   items: [{name, serving_label, p, f, c, label_kcal, confidence}],
  //   total: {p,f,c,label_kcal},
  //   comment: string
  // }
  let itemsRaw: any[] = [];
  if (Array.isArray(raw?.items)) itemsRaw = raw.items;
  else if (Array.isArray(raw?.products)) itemsRaw = raw.products;
  else if (Array.isArray(raw?.foods)) itemsRaw = raw.foods;

  // 互換（旧スキーマしか来ないケース）→ 1件として扱う
  if (!Array.isArray(itemsRaw) || itemsRaw.length === 0) {
    itemsRaw = [raw];
  }

  const items: LabelItem[] = itemsRaw.slice(0, 8).map((it: any) => {
    const name = normName(it?.name) || "加工食品";
    const serving_label = normServingLabel(it?.serving_label ?? it?.serving ?? it?.basis);

    const p = toNum(it?.p ?? it?.protein ?? it?.protein_g, null);
    const f = toNum(it?.f ?? it?.fat ?? it?.fat_g, null);
    const c = toNum(it?.c ?? it?.carbs ?? it?.carbs_g, null);
    const kcal = toNum(it?.label_kcal ?? it?.kcal ?? it?.calories, null);

    return {
      name,
      serving_label,
      p: p === null ? null : clamp(round1(p), 0, 300),
      f: f === null ? null : clamp(round1(f), 0, 300),
      c: c === null ? null : clamp(round1(c), 0, 800),
      label_kcal: kcal === null ? null : clamp(Math.round(kcal), 0, 5000),
      confidence: toConf(it?.confidence),
    };
  });

  // total（itemsから合算）
  const sumP = round1(items.reduce((acc, it) => acc + (toNum(it.p, 0) ?? 0), 0));
  const sumF = round1(items.reduce((acc, it) => acc + (toNum(it.f, 0) ?? 0), 0));
  const sumC = round1(items.reduce((acc, it) => acc + (toNum(it.c, 0) ?? 0), 0));
  const sumK = Math.round(items.reduce((acc, it) => acc + (toNum(it.label_kcal, 0) ?? 0), 0));

  const totalRaw = raw?.total ?? raw?.sum ?? null;
  const tP = toNum(totalRaw?.p ?? totalRaw?.protein, null);
  const tF = toNum(totalRaw?.f ?? totalRaw?.fat, null);
  const tC = toNum(totalRaw?.c ?? totalRaw?.carbs, null);
  const tK = toNum(totalRaw?.label_kcal ?? totalRaw?.kcal ?? totalRaw?.calories, null);

  const total = {
    p: tP === null ? sumP : clamp(round1(tP), 0, 1000),
    f: tF === null ? sumF : clamp(round1(tF), 0, 1000),
    c: tC === null ? sumC : clamp(round1(tC), 0, 2000),
    label_kcal: tK === null ? (sumK > 0 ? clamp(sumK, 0, 15000) : null) : clamp(Math.round(tK), 0, 15000),
  };

  // menu_items：NutritionCardの既存表示にそのまま使える文字列に寄せる
  const menu_items = items.slice(0, 6).map((it) => ({
    name: it.name,
    estimated_amount: it.serving_label || "1食分",
    note: `P${toNum(it.p, 0).toFixed(1)} F${toNum(it.f, 0).toFixed(1)} C${toNum(it.c, 0).toFixed(1)}` + (it.label_kcal != null ? ` / ${it.label_kcal}kcal` : ""),
  }));

  const commentSource =
    (isNonEmptyString(raw?.comment) && raw.comment) ||
    (isNonEmptyString(raw?.advice_markdown) && raw.advice_markdown) ||
    (isNonEmptyString(raw?.advice) && raw.advice) ||
    "";
  const comment = truncateByChars(commentSource, 110);

  // ✅ 互換用フィールド（NutritionCardのparseGeminiResultStrictが読む）
  // calories は参考値として total.label_kcal を入れる（なくてもOK）
  const compat = {
    calories: total.label_kcal ?? null,
    protein: total.p,
    fat: total.f,
    carbs: total.c,
  };

  return {
    items,
    total,
    menu_items,
    comment,
    ...compat,
  };
}

function looksBadAnalyzeLabelMulti(result: {
  items: LabelItem[];
  total: { p: number; f: number; c: number; label_kcal: number | null };
}) {
  const hasAny = Array.isArray(result.items) && result.items.length > 0;
  const sumZero = (result.total.p ?? 0) === 0 && (result.total.f ?? 0) === 0 && (result.total.c ?? 0) === 0;
  if (!hasAny) return true;
  if (sumZero) return true;
  return false;
}

/**
 * generate_plan の出力を正規化
 */
function normalizeGeneratePlanResult(raw: any) {
  const bmr = toNum(raw?.bmr, null);
  const tdee = toNum(raw?.tdee, null);

  const tp = raw?.target ?? {};
  const protein = toNum(tp?.protein ?? tp?.p, null);
  const fat = toNum(tp?.fat ?? tp?.f, null);
  const carbs = toNum(tp?.carbs ?? tp?.c, null);

  const adviceSource =
    (isNonEmptyString(raw?.advice) && raw.advice) ||
    (isNonEmptyString(raw?.comment) && raw.comment) ||
    "";

  return {
    bmr: bmr === null ? null : clamp(bmr, 500, 5000),
    tdee: tdee === null ? null : clamp(tdee, 800, 8000),
    target: {
      protein: protein === null ? null : clamp(protein, 0, 300),
      fat: fat === null ? null : clamp(fat, 0, 300),
      carbs: carbs === null ? null : clamp(carbs, 0, 800),
    },
    advice: truncateByChars(adviceSource, 160),
  };
}


function normalizeAnalyzeMealResult(raw: any) {
  const calories = toNum(raw?.calories, null);
  const protein = toNum(raw?.protein, null);
  const fat = toNum(raw?.fat, null);
  const carbs = toNum(raw?.carbs, null);

  const menuItemsRaw = Array.isArray(raw?.menu_items) ? raw.menu_items : [];
  const menu_items = menuItemsRaw.slice(0, 6).map((it: any) => ({
    name: isNonEmptyString(it?.name) ? it.name : "",
    estimated_amount: isNonEmptyString(it?.estimated_amount) ? it.estimated_amount : "",
    note: isNonEmptyString(it?.note) ? it.note : "",
  }));

  const linesRaw = Array.isArray(raw?.comment_lines) ? raw.comment_lines : [];
  const comment_lines = linesRaw
    .filter((x: any) => isNonEmptyString(x))
    .slice(0, 3)
    .map((s: string) => truncateByChars(s, 40));

  const comment = truncateByChars(comment_lines.join(" / "), 110);

  return {
    calories: calories === null ? null : clamp(calories, 0, 5000),
    protein: protein === null ? null : clamp(protein, 0, 300),
    fat: fat === null ? null : clamp(fat, 0, 300),
    carbs: carbs === null ? null : clamp(carbs, 0, 800),
    menu_items,
    comment,        // 既存互換
    comment_lines,  // 新規
  };
}

function normalizeDailySummaryResult(raw: any) {
  const headline = isNonEmptyString(raw?.headline) ? truncateByChars(raw.headline, 28) : "";
  const w = Array.isArray(raw?.what_went_well) ? raw.what_went_well : [];
  const what_went_well = w
    .filter((x: any) => isNonEmptyString(x))
    .slice(0, 2)
    .map((s: string) => truncateByChars(s, 32));

  const one_next_action = isNonEmptyString(raw?.one_next_action)
    ? truncateByChars(raw.one_next_action, 24)
    : "";

  return { headline, what_went_well, one_next_action };
}




function buildCompactSummaryText(s: { headline: string; what_went_well: string[] }) {
  const lines: string[] = [];
  if (s.headline) lines.push(s.headline);
  for (const item of s.what_went_well.slice(0, 2)) {
    if (item) lines.push(`・${item}`);
  }
  return truncateByChars(lines.join("\n"), 140);
}

/**
 * analyze_meal 品質判定
 */
function looksBadAnalyzeMeal(result: {
  calories: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  menu_items: Array<{ name: string; estimated_amount: string; note: string }>;
  comment_lines?: string[];
}) {
  const calBad = result.calories === null || result.calories === 0;
  const pBad = result.protein === null || result.protein === 0;
  const cBad = result.carbs === null || result.carbs === 0;

  const hasItemName = result.menu_items?.some((it) => (it?.name ?? "").trim().length >= 2);
  const hasAmount = result.menu_items?.some((it) => (it?.estimated_amount ?? "").trim().length >= 2);

  const comment = Array.isArray(result.comment_lines) ? result.comment_lines.join(" ") : "";
  const tooCompliment = /(美味しそう|いいですね|いかがでしょうか|元気な一日)/.test(comment);
  const hasNutritionWords = /(タンパク|たんぱく|炭水化物|脂質|PFC|kcal|g|不足|追加|改善)/.test(comment);

  if ((calBad && pBad && cBad) && (!hasItemName || !hasAmount)) return true;
  if (tooCompliment && !hasNutritionWords) return true;

  return false;
}

// index.ts の上の方（関数群が並んでるあたり）に置く
const mealSchema = {
  type: "object",
  properties: {
    calories: { type: ["number", "null"] },
    protein: { type: ["number", "null"] },
    fat: { type: ["number", "null"] },
    carbs: { type: ["number", "null"] },
    menu_items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          estimated_amount: { type: "string" },
          note: { type: "string" },
        },
        required: ["name", "estimated_amount", "note"],
      },
    },
    comment_lines: { type: "array", items: { type: "string" } },
  },
  required: ["calories", "protein", "fat", "carbs", "menu_items", "comment_lines"],
} as const;

/**
 * Gemini呼び出し（共通）
 */
async function callGemini(params: {
  apiKey: string;
  model: string;
  parts: any[];
  temperature: number;
  maxOutputTokens: number;
  schema?: any;           // ✅追加
}) {
  const { apiKey, model, parts, temperature, maxOutputTokens, schema } = params;

  const generationConfig: any = {
    responseMimeType: "application/json",
    temperature,
    maxOutputTokens,
  };
  if (schema) generationConfig.responseSchema = schema; // ✅ analyze_meal の時だけ

  const body = {
    contents: [{ role: "user", parts }],
    generationConfig,
  };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
  );

  if (!res.ok) {
    const t = await res.text();
    return { ok: false as const, status: res.status, detail: t.slice(0, 1200), raw: null, text: "" };
  }

  const raw = await res.json();
  const text = extractGeminiText(raw);
  return { ok: true as const, status: 200, detail: null, raw, text };
}





serve(async (req) => {
  try {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return json({ error: "Method Not Allowed" }, 405);

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) return json({ error: "Gemini config missing: GEMINI_API_KEY" }, 500);

    const GEMINI_MODEL_PRIMARY =
      Deno.env.get("GEMINI_MODEL_PRIMARY") ?? "gemini-2.5-flash";

    const GEMINI_MODEL_FLASH =
      Deno.env.get("GEMINI_MODEL_FLASH") ?? "gemini-2.5-flash";

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return json({ error: "Supabase config missing: SUPABASE_URL / SUPABASE_ANON_KEY" }, 500);
    }

    let body: NutritionRequest;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    // Authorization（daily_summaryでDB保存するため必須）
    const authHeader = req.headers.get("authorization") ?? "";
    const jwt = authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7)
      : "";

    if (body.type === "daily_summary" && !jwt) {
      return json({ error: "Authorization Bearer token is required for daily_summary" }, 401);
    }

    const supabase =
      jwt
        ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            global: { headers: { Authorization: `Bearer ${jwt}` } },
            auth: { persistSession: false },
          })
        : createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: { persistSession: false },
          });

    // daily_summaryのユーザー識別
    let authedUserId: string | null = null;
    if (body.type === "daily_summary") {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data?.user?.id) {
        return json({ error: "Failed to identify user", detail: String(error?.message ?? error) }, 401);
      }
      authedUserId = data.user.id;
    }

    // ======= analyze_meal =======
    if (body.type === "analyze_meal") {
      if (!body.imageBase64) return json({ error: "imageBase64 is required" }, 400);

      const prompt = `
      あなたはスポーツ栄養士AI。画像の食事を見て「料理名・構成・量」を推定し、P/F/Cとkcalを推定する。
      雑談・感想は禁止。必ず推定値を出す（不明でも合理的に推定して埋める）。
      JSON以外の文字を1文字でも出したら失格。
      
      必ずJSONのみで返す（説明文/コードブロック禁止）。
      {
       "calories": number|null,
       "protein": number|null,
       "fat": number|null,
       "carbs": number|null,
       "menu_items": [{"name": string, "estimated_amount": string, "note": string}],
       "comment_lines": [string,string,string]
      }
      
      推定ルール:
      - menu_itemsは主食/主菜/副菜/汁/飲料を意識して最大6つ
      - estimated_amountは必ず入れる（例: "ご飯200g", "ルー180g", "肉50g", "1皿"）
      - calories/protein/fat/carbs は1食合計の推定値（数字で）
      - comment_lines は必ず3つ:
        1) 良い点 2) 不足しやすい点 3) 次の一手
      - comment_lines の各要素は最大40文字
      - JSON文字列内に改行は禁止（配列で表現する）
      `.trim();
      

      const parts = [
        { inlineData: { mimeType: "image/jpeg", data: body.imageBase64 } },
        {
          text:
            prompt +
            (body.context && body.context.trim()
              ? `\n補足:${truncateByChars(body.context.trim(), 220)}`
              : ""),
        },
      ];


      const first = await callGemini({
        apiKey: GEMINI_API_KEY,
        model: GEMINI_MODEL_FLASH,
        parts,
        temperature: 0.1,
        maxOutputTokens: 700,
        schema: mealSchema, // ✅ここだけ追加
      });
      
      

      console.log("[nutrition-gemini] analyze_meal first model=", GEMINI_MODEL_FLASH);
      console.log("[nutrition-gemini] analyze_meal first text preview=", first.ok ? first.text.slice(0, 300) : "");


      if (!first.ok) {
        console.error("[nutrition-gemini] Gemini flash error", {
          status: first.status,
          detail: first.detail,
        });
        return json({ error: `Gemini error ${first.status}`, detail: first.detail }, 502);
      }

      // ② パース
      let parsed: any = null;
      try {
        parsed = safeParseJsonFromText(first.text);
      } catch (e) {
        console.error("[nutrition-gemini] JSON parse failed (flash) -> retry flash", {
          model: GEMINI_MODEL_FLASH,
          textPreview: String(first.text).slice(0, 600),
          err: String((e as Error)?.message ?? e),
        });

        const retryPrompt = `
あなたは「JSON生成器」。必ず有効なJSONのみを返す。前置き/説明/謝罪は禁止。
次のスキーマを厳守し、数値はできるだけ推定して埋める（不明でも合理的推定）。
{
 "calories": number|null,
 "protein": number|null,
 "fat": number|null,
 "carbs": number|null,
 "menu_items": [{"name": string, "estimated_amount": string, "note": string}],
 "comment_lines": [string,string,string]
}
commentは3行(良い点/不足/次の一手)、110字以内。menu_items最大6。
`.trim();

        const retryParts = [
          { inlineData: { mimeType: "image/jpeg", data: body.imageBase64 } },
          {
            text:
              retryPrompt +
              (body.context && body.context.trim()
                ? `\n補足:${truncateByChars(body.context.trim(), 220)}`
                : ""),
          },
        ];

        const second = await callGemini({
          apiKey: GEMINI_API_KEY,
          model: GEMINI_MODEL_FLASH,
          parts: retryParts,
          temperature: 0.1,
          maxOutputTokens: 600,
          schema: mealSchema, // ✅ここも
        });
        
        console.log("[nutrition-gemini] analyze_meal retry model=", GEMINI_MODEL_FLASH);
        console.log("[nutrition-gemini] analyze_meal retry text preview=", second.ok ? second.text.slice(0, 300) : "");


        if (!second.ok) {
          console.error("[nutrition-gemini] Gemini flash retry error", {
            status: second.status,
            detail: second.detail,
          });
          return json({ error: `Gemini error ${second.status}`, detail: second.detail }, 502);
        }

        try {
          parsed = safeParseJsonFromText(second.text);
        } catch (e2) {
          console.error("[nutrition-gemini] JSON parse failed (flash retry)", {
            model: GEMINI_MODEL_FLASH,
            textPreview: String(second.text).slice(0, 800),
            err: String((e2 as Error)?.message ?? e2),
          });
          return json(
            {
              error: "FAILED_TO_PARSE_GEMINI_JSON",
              message: "Geminiの出力をJSONとして解釈できませんでした",
              detail: String((e2 as Error)?.message ?? e2),
              model: GEMINI_MODEL_FLASH,
              preview: String(second.text).slice(0, 800),
              hint: "GeminiがJSON以外の文字を含めた可能性があります",
            },
            422
          );
          
        }

        const result2 = normalizeAnalyzeMealResult(parsed);
        return json({
          ok: true,
          result: result2,
          meta: { used_model: GEMINI_MODEL_FLASH, reason: "retry_after_parse_fail" },
        });
      }

      const result1 = normalizeAnalyzeMealResult(parsed);

      // ④ liteの品質が薄い場合もflashへリトライ
      if (looksBadAnalyzeMeal(result1)) {
        console.warn("[nutrition-gemini] flash result looks bad -> retry flash", {
          litePreview: result1,
          textPreview: String(first.text).slice(0, 600),
        });

        const retryPrompt2 = `
あなたはスポーツ栄養士AI。画像から料理と量を推定し、P/F/Cとkcalを推定する。
必ずJSONのみ。感想禁止。推定で埋める。
{
 "calories": number|null,
 "protein": number|null,
 "fat": number|null,
 "carbs": number|null,
 "menu_items": [{"name": string, "estimated_amount": string, "note": string}],
 "comment_lines": [string,string,string]
}
commentは3行(良い点/不足/次の一手)、110字以内。menu_items最大6。
`.trim();

        const retryParts2 = [
          { inlineData: { mimeType: "image/jpeg", data: body.imageBase64 } },
          {
            text:
              retryPrompt2 +
              (body.context && body.context.trim()
                ? `\n補足:${truncateByChars(body.context.trim(), 220)}`
                : ""),
          },
        ];

        const second2 = await callGemini({
          apiKey: GEMINI_API_KEY,
          model: GEMINI_MODEL_FLASH,
          parts: retryParts2,
          temperature: 0.1,
          maxOutputTokens: 600,
          schema: mealSchema, // ✅ここも
        });

        if (!second2.ok) {
          console.error("[nutrition-gemini] Gemini flash retry error (bad quality)", {
            status: second2.status,
            detail: second2.detail,
          });
          return json({ error: `Gemini error ${second2.status}`, detail: second2.detail }, 502);
        }

        let parsed2: any = null;
        try {
          parsed2 = safeParseJsonFromText(second2.text);
        } catch (e2) {
          console.error("[nutrition-gemini] JSON parse failed (flash retry bad quality)", {
            model: GEMINI_MODEL_FLASH,
            textPreview: String(second2.text).slice(0, 800),
            err: String((e2 as Error)?.message ?? e2),
          });
          return json(
            {
              error: "Failed to parse Gemini JSON",
              detail: String((e2 as Error)?.message ?? e2),
              textPreview: String(second2.text).slice(0, 800),
            },
            422
          );
        }

        const result2 = normalizeAnalyzeMealResult(parsed2);
        return json({
          ok: true,
          result: result2,
          meta: { used_model: GEMINI_MODEL_FLASH, reason: "retry_after_bad_quality" },
        });
      }

      return json({
        ok: true,
        result: result1,
        meta: { used_model: GEMINI_MODEL_FLASH, reason: "lite_ok" },
      });
    }

    // ======= analyze_label（複数商品→合算） =======
    if (body.type === "analyze_label") {
      const imgs = Array.isArray(body.imagesBase64) ? body.imagesBase64 : [];
      if (imgs.length < 1) return json({ error: "imagesBase64 is required" }, 400);

      // 上限：最大6枚（“複数商品”の実用を考えて増やす）
      const imagesBase64 = imgs.slice(0, 6).filter((s) => typeof s === "string" && s.length > 50);
      if (imagesBase64.length < 1) return json({ error: "imagesBase64 is empty" }, 400);

      const prompt = `
あなたは食品ラベル読取AI。画像に写る「栄養成分表示」から、商品ごとにP/F/C(g)とkcalを抽出し、最後に合計を出す。
雑談・感想は禁止。必ずJSONのみ。前置き/説明/コードブロック禁止。
重要：推定は禁止。読めない値は null にする。

必ずこのJSONで返す（キー名変更禁止）:
{
  "items": [
    {
      "name": string,
      "serving_label": string,
      "p": number|null,
      "f": number|null,
      "c": number|null,
      "label_kcal": number|null,
      "confidence": "high"|"med"|"low"
    }
  ],
  "total": {
    "p": number|null,
    "f": number|null,
    "c": number|null,
    "label_kcal": number|null
  },
  "comment_lines": [string,string,string]
}

ルール:
- items は画像ごとに「別商品」として扱う（同じ商品が重複してもOK）
- serving_label は短く（例:"1袋あたり","1本あたり","100gあたり","1食(◯g)あたり"）
- 「炭水化物」が糖質/食物繊維に分かれていても、合算して c にする（合算不可能なら炭水化物の値を優先）
- total は items の合計を基本（ただし画像の都合で読み取りが不完全なら null を許容）
- comment は日本語110字以内で3行:
  1) 取れている/取れていない（注意点） 2) 不足しやすい 3) 次の一手
- “推定”は絶対禁止（読めないものはnull）
`.trim();

      const parts: any[] = [];
      for (const b64 of imagesBase64) {
        parts.push({ inlineData: { mimeType: "image/jpeg", data: b64 } });
      }
      parts.push({
        text:
          prompt +
          (body.context && body.context.trim()
            ? `\n補足:${truncateByChars(body.context.trim(), 220)}`
            : ""),
      });

      // ① lite
      const first = await callGemini({
        apiKey: GEMINI_API_KEY,
        model: GEMINI_MODEL_PRIMARY,
        parts,
        temperature: 0.1,
        maxOutputTokens: 900,
      });

      if (!first.ok) {
        console.error("[nutrition-gemini] analyze_label lite error", {
          status: first.status,
          detail: first.detail,
        });
        return json({ error: `Gemini error ${first.status}`, detail: first.detail }, 502);
      }

      let parsed: any = null;
      try {
        parsed = safeParseJsonFromText(first.text);
      } catch (e) {
        console.error("[nutrition-gemini] analyze_label JSON parse failed (lite) -> retry flash", {
          model: GEMINI_MODEL_FLASH,
          textPreview: String(first.text).slice(0, 900),
          err: String((e as Error)?.message ?? e),
        });

        const retryPrompt = `
あなたは「JSON生成器」。必ず有効なJSONのみを返す。前置き/説明/謝罪は禁止。
推定は禁止。読めない値は null。
スキーマ厳守:
{
  "items": [{"name": string, "serving_label": string, "p": number|null, "f": number|null, "c": number|null, "label_kcal": number|null, "confidence": "high"|"med"|"low"}],
  "total": {"p": number|null, "f": number|null, "c": number|null, "label_kcal": number|null},
  "comment_lines": [string,string,string]
}
`.trim();

        const retryParts: any[] = [];
        for (const b64 of imagesBase64) {
          retryParts.push({ inlineData: { mimeType: "image/jpeg", data: b64 } });
        }
        retryParts.push({
          text:
            retryPrompt +
            (body.context && body.context.trim()
              ? `\n補足:${truncateByChars(body.context.trim(), 220)}`
              : ""),
        });

        const second = await callGemini({
          apiKey: GEMINI_API_KEY,
          model: GEMINI_MODEL_FLASH,
          parts: retryParts,
          temperature: 0.1,
          maxOutputTokens: 1100,
        });

        if (!second.ok) {
          console.error("[nutrition-gemini] analyze_label flash retry error", {
            status: second.status,
            detail: second.detail,
          });
          return json({ error: `Gemini error ${second.status}`, detail: second.detail }, 502);
        }

        try {
          parsed = safeParseJsonFromText(second.text);
        } catch (e2) {
          console.error("[nutrition-gemini] analyze_label JSON parse failed (flash)", {
            model: GEMINI_MODEL_FLASH,
            textPreview: String(second.text).slice(0, 1100),
            err: String((e2 as Error)?.message ?? e2),
          });
          return json(
            {
              error: "FAILED_TO_PARSE_GEMINI_LABEL_JSON",
              message: "ラベル解析JSONの解釈に失敗しました",
              detail: String((e2 as Error)?.message ?? e2),
              model: GEMINI_MODEL_FLASH,
              preview: String(second.text).slice(0, 1100),
              hint: "GeminiがJSON以外を出力した可能性",
            },
            422
          );
          
        }

        const result2 = normalizeAnalyzeLabelMultiResult(parsed);

        // 互換：parseGeminiResultStrict が読む形も出す
        return json({
          ok: true,
          result: result2,
          meta: { used_model: GEMINI_MODEL_FLASH, reason: "retry_after_parse_fail" },
        });
      }

      const result1 = normalizeAnalyzeLabelMultiResult(parsed);

      // ② 中身薄い → flash 再トライ（ただし失敗したら lite を返して進める）
      if (looksBadAnalyzeLabelMulti(result1)) {
        console.warn("[nutrition-gemini] analyze_label lite result looks bad -> retry flash", {
          litePreview: result1,
          textPreview: String(first.text).slice(0, 900),
        });

        const retryPrompt2 = `
あなたは食品ラベル読取AI。栄養成分表示から各商品P/F/C(g)を抽出し合計を出す。
必ずJSONのみ。推定は禁止。読めない値は null。
{
  "items": [{"name": string, "serving_label": string, "p": number|null, "f": number|null, "c": number|null, "label_kcal": number|null, "confidence": "high"|"med"|"low"}],
  "total": {"p": number|null, "f": number|null, "c": number|null, "label_kcal": number|null},
  "comment_lines": [string,string,string]
}
`.trim();

        const retryParts2: any[] = [];
        for (const b64 of imagesBase64) {
          retryParts2.push({ inlineData: { mimeType: "image/jpeg", data: b64 } });
        }
        retryParts2.push({
          text:
            retryPrompt2 +
            (body.context && body.context.trim()
              ? `\n補足:${truncateByChars(body.context.trim(), 220)}`
              : ""),
        });

        const second2 = await callGemini({
          apiKey: GEMINI_API_KEY,
          model: GEMINI_MODEL_FLASH,
          parts: retryParts2,
          temperature: 0.1,
          maxOutputTokens: 1100,
        });

        if (!second2.ok) {
          console.error("[nutrition-gemini] analyze_label flash retry error (bad quality)", {
            status: second2.status,
            detail: second2.detail,
          });
          return json({
            ok: true,
            result: result1,
            meta: { used_model: GEMINI_MODEL_FLASH, reason: "lite_bad_but_returned" },
          });
        }

        let parsed2: any = null;
        try {
          parsed2 = safeParseJsonFromText(second2.text);
        } catch (e2) {
          console.error("[nutrition-gemini] analyze_label JSON parse failed (flash retry bad quality)", {
            model: GEMINI_MODEL_FLASH,
            textPreview: String(second2.text).slice(0, 1100),
            err: String((e2 as Error)?.message ?? e2),
          });
          return json({
            ok: true,
            result: result1,
            meta: { used_model: GEMINI_MODEL_FLASH, reason: "flash_parse_failed_return_lite" },
          });
        }

        const result2 = normalizeAnalyzeLabelMultiResult(parsed2);
        return json({
          ok: true,
          result: result2,
          meta: { used_model: GEMINI_MODEL_FLASH, reason: "retry_after_bad_quality" },
        });
      }

      return json({
        ok: true,
        result: result1,
        meta: { used_model: GEMINI_MODEL_FLASH, reason: "lite_ok" },
      });
    }

    // ======= generate_plan =======
    if (body.type === "generate_plan") {
      const p = body.profile ?? {};
      const prompt = `
必ずJSONのみで返す。説明文は禁止。
{
 "bmr": number|null,
 "tdee": number|null,
 "target": {"protein": number|null, "fat": number|null, "carbs": number|null},
 "advice": string
}
プロフィール:${JSON.stringify(p)}
`.trim();

      const parts = [{ text: prompt }];

      const res = await callGemini({
        apiKey: GEMINI_API_KEY,
        model: (Deno.env.get("GEMINI_MODEL_PLAN") ?? GEMINI_MODEL_FLASH),
        parts,
        temperature: 0.1,
        maxOutputTokens: 700,
      });

      if (!res.ok) {
        console.error("[nutrition-gemini] Gemini plan error", { status: res.status, detail: res.detail });
        return json({ error: `Gemini error ${res.status}`, detail: res.detail }, 502);
      }

      let parsed: any = null;
      try {
        parsed = safeParseJsonFromText(res.text);
      } catch (e) {
        console.error("[nutrition-gemini] plan JSON parse failed", {
          textPreview: String(res.text).slice(0, 800),
          err: String((e as Error)?.message ?? e),
        });
        return json(
          {
            error: "FAILED_TO_PARSE_GEMINI_LABEL_JSON",
            message: "ラベル解析JSONの解釈に失敗しました",
            detail: String((e as Error)?.message ?? e),
            model: GEMINI_MODEL_FLASH,
            preview: String(res.text).slice(0, 1100),
            hint: "GeminiがJSON以外を出力した可能性",
          },
          422
        );
        
      }

      const result = normalizeGeneratePlanResult(parsed);
      return json({ ok: true, result });
    }

    // ======= daily_summary =======
    if (body.type === "daily_summary") {
      if (!safeDateYYYYMMDD(body.date)) {
        return json({ error: "Invalid date format. Use YYYY-MM-DD" }, 400);
      }
      if (!body.target || !body.totals || !body.gaps) {
        return json({ error: "target/totals/gaps are required" }, 400);
      }

      const cal = toNum(body.totals.cal, 0) ?? 0;
      const p = toNum(body.totals.p, 0) ?? 0;
      const f = toNum(body.totals.f, 0) ?? 0;
      const c = toNum(body.totals.c, 0) ?? 0;
      if (Math.abs(cal) < 1 && Math.abs(p) < 0.1 && Math.abs(f) < 0.1 && Math.abs(c) < 0.1) {
        return json({ error: "totals are empty. Please log at least one meal before daily_summary." }, 400);
      }

      let prompt = `
必ずJSONのみで返す。説明文は禁止。
{
 "headline": string,
 "what_went_well": [string,string],
 "one_next_action": string
}
制約:
- headline最大28文字
- what_went_well最大2つ（各最大32文字）
- one_next_action最大24文字
入力:
target=${JSON.stringify(body.target)}
totals=${JSON.stringify(body.totals)}
gaps=${JSON.stringify(body.gaps)}
`.trim();

      if (body.note && body.note.trim()) {
        prompt += `\n補足:${truncateByChars(body.note.trim(), 160)}`;
      }

      const parts = [{ text: prompt }];

      const res = await callGemini({
        apiKey: GEMINI_API_KEY,
        model: (Deno.env.get("GEMINI_MODEL_SUMMARY") ?? GEMINI_MODEL_FLASH),
        parts,
        temperature: 0.1,
        maxOutputTokens: 700,
      });

      if (!res.ok) {
        console.error("[nutrition-gemini] daily_summary gemini error", { status: res.status, detail: res.detail });
        return json({ error: `Gemini error ${res.status}`, detail: res.detail }, 502);
      }

      let parsed: any = null;
      try {
        parsed = safeParseJsonFromText(res.text);
      } catch (e) {
        console.error("[nutrition-gemini] daily_summary JSON parse failed", {
          textPreview: String(res.text).slice(0, 800),
          err: String((e as Error)?.message ?? e),
        });
        return json(
          { error: "Failed to parse Gemini JSON", detail: String((e as Error)?.message ?? e), textPreview: String(res.text).slice(0, 800) },
          422
        );
      }

      const normalized = normalizeDailySummaryResult(parsed);



      const summaryText = buildCompactSummaryText({
        headline: normalized.headline,
        what_went_well: normalized.what_went_well,
      });

      const actionForTomorrow = truncateByChars(normalized.one_next_action, 24);

      const totalCalories = Math.round(toNum(body.totals.cal, 0) ?? 0);
      const p1 = Math.round((toNum(body.totals.p, 0) ?? 0) * 10) / 10;
      const f1 = Math.round((toNum(body.totals.f, 0) ?? 0) * 10) / 10;
      const c1 = Math.round((toNum(body.totals.c, 0) ?? 0) * 10) / 10;

      const upsertPayload = {
        user_id: authedUserId,
        report_date: body.date,
        total_calories: totalCalories,
        p: p1,
        f: f1,
        c: c1,
        score: null,
        summary: summaryText,
        action_for_tomorrow: actionForTomorrow,
      };

      const { data, error } = await supabase
        .from("nutrition_daily_reports")
        .upsert(upsertPayload, { onConflict: "user_id,report_date" })
        .select()
        .single();

      if (error) {
        return json(
          {
            error: "Failed to upsert nutrition_daily_reports",
            detail: String(error.message ?? error),
          },
          500
        );
      }

      return json({
        ok: true,
        result: {
          normalized,
          saved: {
            report_date: body.date,
            total_calories: totalCalories,
            p: p1,
            f: f1,
            c: c1,
            summary: summaryText,
            action_for_tomorrow: actionForTomorrow,
          },
          row: data,
        },
      });
    }

    return json({ error: "Unknown type" }, 400);
  } catch (e) {
    console.error("[nutrition-gemini] Unhandled error", {
      err: String((e as Error)?.message ?? e),
      stack: (e as Error)?.stack ?? null,
    });
    return json(
      {
        error: "UNHANDLED_ERROR",
        message: "Edge Functionで予期しないエラーが発生しました",
        detail: String((e as Error)?.message ?? e),
        stack: (e as Error)?.stack ?? null,
      },
      500
    );
    
  }
});
