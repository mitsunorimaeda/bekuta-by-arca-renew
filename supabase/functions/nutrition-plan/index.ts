import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { createAuthedSupabaseClient } from "../_shared/supabaseClient.ts";
import { geminiGenerateJson } from "../_shared/geminiClient.ts";

type Feasibility = "safe" | "challenging" | "risky";

type PlanResult = {
  bmr: number;
  tdee: number;
  daily_target: { cal: number; p: number; f: number; c: number };
  feasibility: Feasibility;
  ai_advice: string;
  action_goals: string[];
};

function toNumber(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

function isValidResult(x: any): x is PlanResult {
  return (
    x &&
    typeof x.bmr === "number" &&
    typeof x.tdee === "number" &&
    x.daily_target &&
    typeof x.daily_target.cal === "number" &&
    typeof x.daily_target.p === "number" &&
    typeof x.daily_target.f === "number" &&
    typeof x.daily_target.c === "number" &&
    (x.feasibility === "safe" || x.feasibility === "challenging" || x.feasibility === "risky") &&
    typeof x.ai_advice === "string" &&
    Array.isArray(x.action_goals)
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const supabase = createAuthedSupabaseClient(req);

    // ✅ 認証チェック
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) return jsonResponse({ error: "Unauthorized" }, 401);

    const body = await req.json();

    const weight = toNumber(body?.weight);
    const bodyFat = toNumber(body?.body_fat_percent);
    const targetWeight = toNumber(body?.target_weight);

    const activityLevel = String(body?.activity_level ?? "").trim();
    const goalType = String(body?.goal_type ?? "").trim();
    const targetDate = body?.target_date ? String(body.target_date).trim() : null;
    const userName = String(body?.user_name ?? "user");

    if (weight == null || weight <= 0) {
      return jsonResponse({ error: "weight must be a positive number" }, 400);
    }
    if (!activityLevel) return jsonResponse({ error: "activity_level required" }, 400);
    if (!goalType) return jsonResponse({ error: "goal_type required" }, 400);

    // ✅ できれば activity_level / goal_type はフロント側で選択式にするのが理想
    // 例: activity_level = low|medium|high / goal_type = gain|maintain|loss
    const prompt = `あなたはスポーツ栄養士。以下から安全な目標PFCを作成し、JSONのみで返してください。

選手:${userName}
体重:${weight}kg
体脂肪率:${bodyFat ?? "不明"}%
活動レベル:${activityLevel}
目的:${goalType}
目標体重:${targetWeight ?? "未設定"}kg
目標日:${targetDate ?? "未設定"}

要件:
- 未成年/成長期を想定し「安全性優先」
- 無理な減量は"risky"にする
- 数字は現実的範囲（Pは体重あたり目安を使ってよい）

必ずこのスキーマ:
{
  "bmr": number,
  "tdee": number,
  "daily_target": { "cal": number, "p": number, "f": number, "c": number },
  "feasibility": "safe" | "challenging" | "risky",
  "ai_advice": string,
  "action_goals": string[]
}`;

    const result = await geminiGenerateJson([{ text: prompt }]);

    // ✅ 最低限バリデーション（崩れ対策）
    if (!isValidResult(result)) {
      return jsonResponse({ error: "Invalid AI response", raw: result }, 422);
    }

    return jsonResponse({ ok: true, result });
  } catch (e) {
    console.error(e);
    return jsonResponse({ error: String((e as any)?.message ?? e) }, 500);
  }
});