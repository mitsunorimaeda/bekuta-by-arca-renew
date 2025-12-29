import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ACTIVITY_FACTOR: Record<string, number> = {
  low: 1.4,
  moderate: 1.6,
  high: 1.75,
  very_high: 1.9,
};

serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // 対象日 = 昨日
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const dateStr = d.toISOString().slice(0, 10);

  // athlete の activity level
  const { data: levels } = await supabase
    .from("athlete_activity_level_daily")
    .select("user_id, team_id, activity_level_effective")
    .eq("date", dateStr);

  if (!levels || levels.length === 0) {
    return new Response(JSON.stringify({ ok: true, skipped: true }));
  }

  const userIds = levels.map((l) => l.user_id);

  // InBody（最新）
  const { data: inbodies } = await supabase
    .from("inbody_records")
    .select("user_id, weight, height, body_fat_percent")
    .in("user_id", userIds)
    .order("measured_at", { ascending: false });

  const inbodyMap = new Map<string, any>();
  inbodies?.forEach((r) => {
    if (!inbodyMap.has(r.user_id)) {
      inbodyMap.set(r.user_id, r);
    }
  });

  const rows: any[] = [];

  for (const l of levels) {
    const inb = inbodyMap.get(l.user_id);
    if (!inb) continue;

    const weight = Number(inb.weight);
    const height = Number(inb.height);
    const pbf = Number(inb.body_fat_percent);

    if (!weight || !height || !pbf) continue;

    // Katch–McArdle
    const lbm = weight * (1 - pbf / 100);
    const bmr = 370 + 21.6 * lbm;

    const factor = ACTIVITY_FACTOR[l.activity_level_effective] ?? 1.6;
    const tdee = bmr * factor;

    rows.push({
      user_id: l.user_id,
      team_id: l.team_id,
      date: dateStr,
      weight,
      height_cm: height,
      body_fat_percent: pbf,
      bmr: Math.round(bmr),
      tdee: Math.round(tdee),
      activity_level: l.activity_level_effective,
    });
  }

  if (rows.length > 0) {
    await supabase
      .from("nutrition_daily")
      .upsert(rows, { onConflict: "user_id,date" });
  }

  return new Response(
    JSON.stringify({ ok: true, date: dateStr, rows: rows.length }),
    { headers: { "Content-Type": "application/json" } }
  );
});