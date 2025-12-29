// supabase/functions/calculate-metabolism
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // ✅ JWTからユーザー特定（anon key + Authorization header）
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authed = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: authData, error: authErr } = await authed.auth.getUser();
    if (authErr || !authData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user_id = authData.user.id;

    // ✅ DB操作はService Role
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ✅ request body（user_idは受け取らない）
    const { activity_level = "medium" } = await req.json();

    // ✅ 最新 InBody
    const { data: inbody } = await admin
      .from("inbody_records")
      .select("weight, body_fat_percent, measured_at")
      .eq("user_id", user_id)
      .order("measured_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!inbody?.weight) {
      return new Response(JSON.stringify({ error: "No InBody data" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const weight = inbody.weight;
    const pbf = inbody.body_fat_percent;

    const leanMass =
      pbf != null ? Number((weight * (1 - pbf / 100)).toFixed(1)) : null;

    const bmr = leanMass
      ? Math.round(370 + 21.6 * leanMass)
      : Math.round(22 * weight);

    const factors: Record<string, number> = {
      low: 1.2,
      medium: 1.55,
      high: 1.725,
      elite: 1.9,
    };

    const tdee = Math.round(bmr * (factors[activity_level] ?? 1.55));

    const recordDate = new Date()
      .toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" })
      .replace(/\//g, "-");

    await admin.from("nutrition_metabolism_snapshots").upsert(
      {
        user_id,
        record_date: recordDate,
        weight,
        body_fat_percent: pbf,
        lean_mass: leanMass,
        bmr,
        tdee,
        activity_level,
        calculated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,record_date" }
    );

    return new Response(
      JSON.stringify({
        user_id,
        record_date: recordDate,
        weight,
        body_fat_percent: pbf,
        lean_mass: leanMass,
        bmr,
        tdee,
        activity_level,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});