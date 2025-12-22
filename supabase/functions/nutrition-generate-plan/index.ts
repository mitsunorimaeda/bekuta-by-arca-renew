import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { createAuthedSupabaseClient } from "../_shared/supabaseClient.ts";
import { geminiGenerateJson } from "../_shared/geminiClient.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const supabase = createAuthedSupabaseClient(req);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) return jsonResponse({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const {
      weight,
      body_fat_percent, // 任意（なければ体重から推定）
      activity_level,
      goal_type,
      target_weight,
      target_date,
      user_name = "user",
    } = body ?? {};

    if (!weight || !activity_level || !goal_type) {
      return jsonResponse({ error: "weight, activity_level, goal_type required" }, 400);
    }

    const prompt =
      `あなたはスポーツ栄養士。以下から安全な目標PFCを作成しJSONのみで返す。
選手:${user_name}
体重:${weight}kg
体脂肪率:${body_fat_percent ?? "不明"}%
活動:${activity_level}
目的:${goal_type}
目標体重:${target_weight ?? "未設定"}kg
目標日:${target_date ?? "未設定"}

スキーマ:
{
  "bmr": number,
  "tdee": number,
  "daily_target": { "cal": number, "p": number, "f": number, "c": number },
  "feasibility": "safe" | "challenging" | "risky",
  "ai_advice": string,
  "action_goals": string[]
}`;

    const result = await geminiGenerateJson([{ text: prompt }]);

    return jsonResponse({ ok: true, result });
  } catch (e) {
    console.error(e);
    return jsonResponse({ error: String(e?.message ?? e) }, 500);
  }
});