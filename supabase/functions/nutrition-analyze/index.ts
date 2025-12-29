//supabase/functions/nutrition-analyze/index.ts

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { createAuthedSupabaseClient } from "../_shared/supabaseClient.ts";
import { geminiGenerateJson } from "../_shared/geminiClient.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const supabase = createAuthedSupabaseClient(req);

    // ✅ 認証チェック
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) return jsonResponse({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const {
      meal_type,
      target_calories,
      image_base64, // "..." (base64のみ)
      mime_type = "image/jpeg",
      user_name = "user",
    } = body ?? {};

    if (!meal_type || !image_base64) {
      return jsonResponse({ error: "meal_type and image_base64 are required" }, 400);
    }

    const prompt =
      `あなたはスポーツ栄養の専門家。画像の食事を推定し、JSONのみで返す。
ユーザー:${user_name}
食事区分:${meal_type}
目標:${target_calories ?? "未設定"}kcal

必ず次のJSONスキーマ：
{
  "total_calories": number,
  "nutrients": { "p": number, "f": number, "c": number },
  "menu_items": [ { "name": string, "cal": number } ],
  "advice_markdown": string
}

注意:
- 推定でOK。曖昧なら「推定」表現で安全側に。
- 数字は現実的範囲に。`;

    const result = await geminiGenerateJson([
      { text: prompt },
      { inlineData: { mimeType: mime_type, data: image_base64 } },
    ]);
    // 最低限バリデーション（崩れ対策）
    if (typeof result?.total_calories !== "number" || !result?.nutrients) {
      return jsonResponse({ error: "Invalid AI response", raw: result }, 422);
    }

    return jsonResponse({ ok: true, result });
  } catch (e) {
    console.error(e);
    return jsonResponse({ error: String(e?.message ?? e) }, 500);
  }
});