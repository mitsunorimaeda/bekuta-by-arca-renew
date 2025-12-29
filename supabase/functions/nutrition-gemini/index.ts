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
  // JSTのYYYY-MM-DD（フロントで作る想定）
  date: string;
  // buildDailyTargetsのtargetをそのまま
  target: { cal: number; p: number; f: number; c: number };
  // useTodayNutritionTotalsの合計
  totals: { cal: number; p: number; f: number; c: number };
  // calcGapsの結果
  gaps: { cal: number; p: number; f: number; c: number };
  // 任意：補足（短く）
  note?: string;
};

type NutritionRequest =
  | { type: "analyze_meal"; imageBase64: string; context?: string }
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

// Geminiが返した text からJSONだけ抜き出してparse（混在対策）
function safeParseJsonFromText(text: string) {
  const cleaned = String(text).replace(/```json/gi, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      const slice = cleaned.slice(start, end + 1);
      return JSON.parse(slice);
    }
    throw new Error(`JSON parse failed: ${cleaned.slice(0, 200)}...`);
  }
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
 * analyze_meal の出力を「必ず同じ形」に正規化する
 */
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

  const commentSource =
    (isNonEmptyString(raw?.comment) && raw.comment) ||
    (isNonEmptyString(raw?.advice_markdown) && raw.advice_markdown) ||
    (isNonEmptyString(raw?.advice) && raw.advice) ||
    "";

  const comment = truncateByChars(commentSource, 100);

  return {
    calories: calories === null ? null : clamp(calories, 0, 5000),
    protein: protein === null ? null : clamp(protein, 0, 300),
    fat: fat === null ? null : clamp(fat, 0, 300),
    carbs: carbs === null ? null : clamp(carbs, 0, 800),
    menu_items,
    comment,
  };
}

/**
 * generate_plan の出力を正規化する
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

/**
 * daily_summary の出力を正規化（短文化・壊れない）
 */
function normalizeDailySummaryResult(raw: any) {
  const headlineSource =
    (isNonEmptyString(raw?.headline) && raw.headline) ||
    (isNonEmptyString(raw?.title) && raw.title) ||
    (isNonEmptyString(raw?.summary) && raw.summary) ||
    "";

  const headline = truncateByChars(headlineSource, 28);

  const wRaw = Array.isArray(raw?.what_went_well)
    ? raw.what_went_well
    : Array.isArray(raw?.highlights)
      ? raw.highlights
      : [];

  const what_went_well = wRaw
    .filter((x: any) => isNonEmptyString(x))
    .slice(0, 2)
    .map((s: string) => truncateByChars(s, 32));

  const oneNextSource =
    (isNonEmptyString(raw?.one_next_action) && raw.one_next_action) ||
    (isNonEmptyString(raw?.next_action) && raw.next_action) ||
    (isNonEmptyString(raw?.action_for_tomorrow) && raw.action_for_tomorrow) ||
    "";

  const one_next_action = truncateByChars(oneNextSource, 24);

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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method Not Allowed" }, 405);

  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  if (!GEMINI_API_KEY) return json({ error: "Gemini config missing: GEMINI_API_KEY" }, 500);

  // ✅ 役割ごとのモデルを分ける（envで上書き可能）
  const GEMINI_MODEL_LITE =
    Deno.env.get("GEMINI_MODEL_LITE") ?? "gemini-2.5-flash-lite";
  const GEMINI_MODEL_FLASH =
    Deno.env.get("GEMINI_MODEL_FLASH") ?? "gemini-2.5-flash";

  // ✅ Supabase（RLSを効かせて「本人として」upsertするため anon + JWT）
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

  // Gemini入力
  let prompt = "";
  let parts: any[] = [];
  let modelToUse = GEMINI_MODEL_LITE;
  let maxOutputTokens = 220;

  if (body.type === "analyze_meal") {
    if (!body.imageBase64) return json({ error: "imageBase64 is required" }, 400);

    modelToUse = GEMINI_MODEL_LITE;
    maxOutputTokens = 220;

    prompt = `
必ずJSONのみで返す。
{
 "calories": number|null,
 "protein": number|null,
 "fat": number|null,
 "carbs": number|null,
 "menu_items": [{"name": string, "estimated_amount": string, "note": string}],
 "comment": string
}
制約:
- commentは日本語100文字以内
- menu_items最大6
- 不明はnull（数値）/空文字（文字列）
`.trim();

    parts = [
      { inlineData: { mimeType: "image/jpeg", data: body.imageBase64 } },
      {
        text:
          prompt +
          (body.context && body.context.trim()
            ? `\n補足:${truncateByChars(body.context.trim(), 200)}`
            : ""),
      },
    ];
  } else if (body.type === "generate_plan") {
    modelToUse = GEMINI_MODEL_LITE;
    maxOutputTokens = 380;

    const p = body.profile ?? {};
    prompt = `
必ずJSONのみで返す。
出力:
{
 "bmr": number|null,
 "tdee": number|null,
 "target": {"protein": number|null, "fat": number|null, "carbs": number|null},
 "advice": string
}
プロフィール:${JSON.stringify(p)}
`.trim();

    parts = [{ text: prompt }];
  } else if (body.type === "daily_summary") {
    if (!safeDateYYYYMMDD(body.date)) {
      return json({ error: "Invalid date format. Use YYYY-MM-DD" }, 400);
    }
    if (!body.target || !body.totals || !body.gaps) {
      return json({ error: "target/totals/gaps are required" }, 400);
    }

    // ✅ 空送信ガード（誤押し／空データ）
    const cal = toNum(body.totals.cal, 0) ?? 0;
    const p = toNum(body.totals.p, 0) ?? 0;
    const f = toNum(body.totals.f, 0) ?? 0;
    const c = toNum(body.totals.c, 0) ?? 0;
    if (Math.abs(cal) < 1 && Math.abs(p) < 0.1 && Math.abs(f) < 0.1 && Math.abs(c) < 0.1) {
      return json({ error: "totals are empty. Please log at least one meal before daily_summary." }, 400);
    }

    modelToUse = GEMINI_MODEL_FLASH;
    maxOutputTokens = 220;

    prompt = `
必ずJSONのみで返す。説明文は禁止。
出力:
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

    parts = [{ text: prompt }];
  } else {
    return json({ error: "Unknown type" }, 400);
  }

  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2,
          maxOutputTokens,
        },
      }),
    }
  );

  if (!geminiRes.ok) {
    const t = await geminiRes.text();
    return json({ error: `Gemini error ${geminiRes.status}`, detail: t.slice(0, 1000) }, 502);
  }

  const raw = await geminiRes.json();

  const text =
    raw?.candidates?.[0]?.content?.parts?.[0]?.text ??
    raw?.candidates?.[0]?.content?.text ??
    "";

  let parsed: any = null;
  try {
    parsed = safeParseJsonFromText(text);
  } catch (e) {
    return json(
      {
        error: "Failed to parse Gemini JSON",
        detail: String((e as Error)?.message ?? e),
        textPreview: String(text).slice(0, 500),
        raw,
      },
      422
    );
  }

  if (body.type === "analyze_meal") {
    const result = normalizeAnalyzeMealResult(parsed);
    return json({ ok: true, result, raw });
  }

  if (body.type === "generate_plan") {
    const result = normalizeGeneratePlanResult(parsed);
    return json({ ok: true, result, raw });
  }

  if (body.type === "daily_summary") {
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
      raw,
    });
  }

  return json({ error: "Unhandled type" }, 400);
});