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
    const { totals, meals, target } = body ?? {};
    if (!totals) return jsonResponse({ error: "totals required" }, 400);

    const prompt =
      `あなたはスポーツ栄養のコーチ。今日の食事を評価し、JSONのみで返す。
目標: ${JSON.stringify(target ?? {})}
合計: ${JSON.stringify(totals)}
食事一覧: ${JSON.stringify(meals ?? [])}

スキーマ:
{ "score": number, "summary": string, "action_for_tomorrow": string }`;

    const result = await geminiGenerateJson([{ text: prompt }]);
    return jsonResponse({ ok: true, result });
  } catch (e) {
    console.error(e);
    return jsonResponse({ error: String(e?.message ?? e) }, 500);
  }
});