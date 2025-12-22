// /supabase/functions/calculate-metabolism/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { user_id, activity_level = "medium" } = await req.json();

  // 最新InBody取得
  const { data: inbody } = await supabase
    .from("inbody_records")
    .select("weight, body_fat_percent")
    .eq("user_id", user_id)
    .order("measured_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!inbody?.weight) {
    return Response.json({ error: "No InBody data" }, { status: 400 });
  }

  const weight = inbody.weight;
  const pbf = inbody.body_fat_percent;

  // --- LBM計算 ---
  const leanMass = pbf != null
    ? weight * (1 - pbf / 100)
    : null;

  // --- BMR計算 ---
  const bmr = leanMass
    ? Math.round(370 + 21.6 * leanMass) // Katch-McArdle
    : Math.round(22 * weight);          // 簡易体重式

  // --- TDEE ---
  const factors: Record<string, number> = {
    low: 1.2,
    medium: 1.55,
    high: 1.725,
    elite: 1.9,
  };

  const tdee = Math.round(bmr * (factors[activity_level] ?? 1.55));

  return Response.json({
    weight,
    body_fat_percent: pbf,
    leanMass,
    bmr,
    tdee,
  });
});