// supabase/functions/calc-nutrition-targets-daily/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type ActivityLevel = "low" | "moderate" | "high" | "very_high";

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function toDateJP(offsetDays = 0) {
  // Asia/Tokyo の「日付」文字列 YYYY-MM-DD
  const dt = new Date();
  dt.setDate(dt.getDate() + offsetDays);
  const s = dt
    .toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" })
    .replace(/\//g, "-");
  // ja-JP は "YYYY/M/D" になりがちなのでゼロ埋め
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return s;
  const yyyy = m[1];
  const mm = String(Number(m[2])).padStart(2, "0");
  const dd = String(Number(m[3])).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function* dateRangeInclusive(start: string, end: string) {
  const s = new Date(start + "T00:00:00+09:00");
  const e = new Date(end + "T00:00:00+09:00");
  for (let d = new Date(s); d.getTime() <= e.getTime(); d.setDate(d.getDate() + 1)) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    yield `${yyyy}-${mm}-${dd}`;
  }
}

function calcPfc({
  weight,
  tdee,
  isTrainingDay,
  goal,
}: {
  weight: number;
  tdee: number;
  isTrainingDay: boolean;
  goal: "maintain" | "cut" | "bulk";
}) {
  // まずは運用しやすい固定係数（後で調整しやすい）
  let pPerKg = isTrainingDay ? 2.0 : 1.8;
  let fPerKg = isTrainingDay ? 0.9 : 1.0;

  if (goal === "cut") {
    pPerKg = 2.2;
    fPerKg = 0.8;
  } else if (goal === "bulk") {
    pPerKg = isTrainingDay ? 2.0 : 1.8;
    fPerKg = isTrainingDay ? 1.0 : 1.0;
  }

  const protein_g = Math.round(weight * pPerKg);
  const fat_g = Math.round(weight * fPerKg);

  const protein_kcal = protein_g * 4;
  const fat_kcal = fat_g * 9;

  // 残りを炭水化物へ（最低0）
  const carb_kcal = Math.max(0, Math.round(tdee - (protein_kcal + fat_kcal)));
  const carbs_g = Math.round(carb_kcal / 4);

  // 安全ガード（異常値時）
  return {
    protein_g: clamp(protein_g, 0, 999),
    fat_g: clamp(fat_g, 0, 999),
    carbs_g: clamp(carbs_g, 0, 1500),
    protein_kcal: clamp(protein_kcal, 0, 9999),
    fat_kcal: clamp(fat_kcal, 0, 9999),
    carbs_kcal: clamp(carb_kcal, 0, 99999),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // ✅ JWT必須
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

    // ✅ Service Role
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json().catch(() => ({}));
    const mode: "yesterday" | "range" = body?.mode ?? "yesterday";
    const goal: "maintain" | "cut" | "bulk" = body?.goal ?? "maintain";

    // 対象日セット
    let dates: string[] = [];
    if (mode === "range") {
      const start_date = String(body?.start_date ?? "");
      const end_date = String(body?.end_date ?? "");
      if (!start_date || !end_date) {
        return new Response(JSON.stringify({ error: "start_date and end_date are required in range mode" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      dates = Array.from(dateRangeInclusive(start_date, end_date));
    } else {
      // 前日確定
      dates = [toDateJP(-1)];
    }

    // team_id は users から取得（あなたの言う “usersだけ” 前提）
    const { data: userRow, error: userErr } = await admin
      .from("users")
      .select("id, team_id, role")
      .eq("id", user_id)
      .maybeSingle();

    if (userErr) throw userErr;
    if (!userRow?.team_id) {
      return new Response(JSON.stringify({ error: "team_id not found for user" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (userRow.role !== "athlete") {
      return new Response(JSON.stringify({ error: "only athlete role is allowed" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const team_id = userRow.team_id;

    // metabolism snapshots を対象日分まとめて取る
    const { data: snaps, error: snapErr } = await admin
      .from("nutrition_metabolism_snapshots")
      .select("record_date, tdee, weight, activity_level")
      .eq("user_id", user_id)
      .in("record_date", dates);

    if (snapErr) throw snapErr;

    const snapMap = new Map<string, any>();
    (snaps ?? []).forEach((s) => snapMap.set(String(s.record_date), s));

    // training day 判定：training_records の対象日があるか
    const { data: trains, error: trainErr } = await admin
      .from("training_records")
      .select("date, duration_min, load")
      .eq("user_id", user_id)
      .in("date", dates);

    if (trainErr) throw trainErr;

    const trainingMap = new Map<string, { isTraining: boolean }>();
    (trains ?? []).forEach((t) => {
      const d = String(t.date);
      const isTraining = Number(t.duration_min ?? 0) > 0 || Number(t.load ?? 0) > 0;
      trainingMap.set(d, { isTraining });
    });

    const upserts: any[] = [];
    const skipped: any[] = [];

    for (const d of dates) {
      const snap = snapMap.get(d);
      if (!snap?.tdee || !snap?.weight) {
        skipped.push({ date: d, reason: "no metabolism snapshot (tdee/weight)" });
        continue;
      }

      const activity_level = (snap.activity_level ?? "moderate") as ActivityLevel;
      const isTrainingDay = trainingMap.get(d)?.isTraining ?? false;

      const tdee = Number(snap.tdee);
      const weight = Number(snap.weight);

      const pfc = calcPfc({ weight, tdee, isTrainingDay, goal });

      upserts.push({
        user_id,
        team_id,
        date: d,
        activity_level,
        goal,
        is_training_day: isTrainingDay,
        tdee,

        ...pfc,

        updated_at: new Date().toISOString(),
      });
    }

    if (upserts.length > 0) {
      const { error: upErr } = await admin
        .from("nutrition_targets_daily")
        .upsert(upserts, { onConflict: "user_id,date" });

      if (upErr) throw upErr;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        mode,
        goal,
        requested_dates: dates.length,
        upserted: upserts.length,
        skipped_count: skipped.length,
        skipped,
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