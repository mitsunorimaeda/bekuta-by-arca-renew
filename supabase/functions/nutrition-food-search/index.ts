//supabase/functions/nutrition-food-search/index.ts

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

    const { query } = await req.json();
    if (!query?.trim()) return jsonResponse({ error: "query required" }, 400);

    const prompt =
      `食品「${query}」の標準的な1人前の栄養価を推定し、JSONのみで返す。
スキーマ:
{ "name": string, "cal": number, "p": number, "f": number, "c": number }`;

    const result = await geminiGenerateJson([{ text: prompt }]);
    return jsonResponse({ ok: true, result });
  } catch (e) {
    console.error(e);
    return jsonResponse({ error: String(e?.message ?? e) }, 500);
  }
});