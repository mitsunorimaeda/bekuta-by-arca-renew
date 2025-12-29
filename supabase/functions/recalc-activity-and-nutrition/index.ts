import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Level = "low" | "moderate" | "high" | "very_high";
type Goal = "maintain" | "cut" | "bulk";

function tokyoYmd(d: Date) {
  // YYYY-MM-DD（JST）
  const s = d
    .toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" })
    .replace(/\//g, "-");
  // ja-JP は "2025-12-27" 形式
  return s;
}

function addDaysYmd(ymd: string, delta: number) {
  // ymd: YYYY-MM-DD を UTC で扱う（ズレ回避のためT00:00:00Z）
  const dt = new Date(`${ymd}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + delta);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function quantile(sorted: number[], q: number) {
  // q: 0..1
  if (!sorted.length) return 0;
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const a = sorted[base];
  const b = sorted[Math.min(base + 1, sorted.length - 1)];
  return a + (b - a) * rest;
}

function levelFromPercentiles(v: number, p25: number, p50: number, p75: number): Level {
  if (v <= p25) return "low";
  if (v <= p50) return "moderate";
  if (v <= p75) return "high";
  return "very_high";
}

function activityFactor(level: Level) {
  // あなたの運用に合わせた係数（前に合意したやつ）
  const factors: Record<Level, number> = {
    low: 1.2,
    moderate: 1.55,
    high: 1.725,
    very_high: 1.9,
  };
  return factors[level];
}

function calcLeanMass(weight: number, pbf: number | null) {
  if (pbf == null) return null;
  const v = weight * (1 - pbf / 100);
  return Number.isFinite(v) ? Math.round(v * 10) / 10 : null;
}

function calcBmr(weight: number, leanMass: number | null) {
  // 体脂肪率あり → Katch-McArdle
  // なければざっくり 22*体重（日本の現場での簡便近似として）
  if (leanMass != null) return Math.round(370 + 21.6 * leanMass);
  return Math.round(22 * weight);
}

function clampDeltaKcal(delta: number, maxAbs: number) {
  if (delta > maxAbs) return maxAbs;
  if (delta < -maxAbs) return -maxAbs;
  return delta;
}

function buildMacros(weightKg: number, tdee: number, goal: Goal) {
  // ざっくり運用用の推奨（後でUI/学習で更新しやすい形）
  // cut: -10%（最大 -500kcal）
  // bulk: +10%（最大 +500kcal）
  let kcalTarget = tdee;
  if (goal === "cut") {
    const delta = clampDeltaKcal(-(tdee * 0.10), 500);
    kcalTarget = Math.round(tdee + delta);
  } else if (goal === "bulk") {
    const delta = clampDeltaKcal(tdee * 0.10, 500);
    kcalTarget = Math.round(tdee + delta);
  }

  // タンパク質：現場運用のデフォルト（後で個別調整可能）
  const proteinPerKg = goal === "cut" ? 2.0 : 1.8;
  const fatPerKg = goal === "cut" ? 0.8 : goal === "bulk" ? 1.0 : 0.9;

  const protein_g = Math.round(weightKg * proteinPerKg);
  const fat_g = Math.round(weightKg * fatPerKg);

  const protein_kcal = protein_g * 4;
  const fat_kcal = fat_g * 9;

  const carbs_kcal = Math.max(0, kcalTarget - protein_kcal - fat_kcal);
  const carbs_g = Math.round(carbs_kcal / 4);

  return {
    kcalTarget,
    protein_g,
    fat_g,
    carbs_g,
    protein_kcal,
    fat_kcal,
    carbs_kcal: Math.round(carbs_g * 4),
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
    // ✅ Cron運用/管理者実行どちらでも使えるようにする
    // - 1) Authorization: Bearer <JWT> があるならそのまま
    // - 2) ないなら x-admin-secret で保護（SUPABASE_EDGE_ADMIN_SECRET）
    const authHeader = req.headers.get("Authorization") || "";
    const secret = req.headers.get("x-admin-secret") || "";

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (!authHeader.startsWith("Bearer ")) {
      const expected = Deno.env.get("SUPABASE_EDGE_ADMIN_SECRET") || "";
      if (!expected || secret !== expected) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const body = await req.json().catch(() => ({}));
    const backfillDays: number = Number.isFinite(Number(body?.backfill_days))
      ? Number(body.backfill_days)
      : 30;

    const defaultGoal: Goal =
      body?.default_goal === "cut" || body?.default_goal === "bulk" || body?.default_goal === "maintain"
        ? body.default_goal
        : "maintain";

    // ✅ 対象日：前日確定（JST）
    const todayTokyo = tokyoYmd(new Date());
    const endDate = addDaysYmd(todayTokyo, -1); // 昨日
    const startDate = addDaysYmd(endDate, -(Math.max(1, backfillDays) - 1));

    // 1) athletes 取得（role='athlete'）
    const { data: athletes, error: aErr } = await admin
      .from("users")
      .select("id, team_id, role, height_cm, phone_number")
      .eq("role", "athlete")
      .not("team_id", "is", null);

    if (aErr) throw aErr;

    const athleteList = (athletes ?? []).map((x) => ({
      user_id: x.id as string,
      team_id: x.team_id as string,
      height_cm: x.height_cm as number | null,
    }));

    if (!athleteList.length) {
      return new Response(
        JSON.stringify({ ok: true, message: "No athlete users found", startDate, endDate }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userIds = athleteList.map((a) => a.user_id);

    // 2) training_records を範囲＋13日分余裕見て取得（14日平均に必要）
    const loadStart = addDaysYmd(startDate, -13);

    const { data: tr, error: trErr } = await admin
      .from("training_records")
      .select("user_id, date, load")
      .in("user_id", userIds)
      .gte("date", loadStart)
      .lte("date", endDate);

    if (trErr) throw trErr;

    // daily load map: user_id -> date -> load
    const dailyLoad = new Map<string, Map<string, number>>();
    for (const r of tr ?? []) {
      const uid = r.user_id as string;
      const d = String(r.date);
      const v = Number(r.load ?? 0);
      if (!dailyLoad.has(uid)) dailyLoad.set(uid, new Map());
      dailyLoad.get(uid)!.set(d, Number.isFinite(v) ? v : 0);
    }

    // 3) InBody 最新（ユーザー単位で最新1件）
    const { data: inb, error: inbErr } = await admin
      .from("inbody_records")
      .select("user_id, measured_at, measured_at_ts, height, weight, body_fat_percent")
      .in("user_id", userIds)
      .order("measured_at_ts", { ascending: false });

    if (inbErr) throw inbErr;

    const latestInbody = new Map<string, {
      height: number | null;
      weight: number | null;
      body_fat_percent: number | null;
    }>();

    for (const r of inb ?? []) {
      const uid = r.user_id as string;
      if (latestInbody.has(uid)) continue;
      latestInbody.set(uid, {
        height: r.height != null ? Number(r.height) : null,
        weight: r.weight != null ? Number(r.weight) : null,
        body_fat_percent: r.body_fat_percent != null ? Number(r.body_fat_percent) : null,
      });
    }

    // helper: 14日平均（欠損は0扱い）
    function avg14(uid: string, endYmd: string) {
      let sum = 0;
      for (let i = 0; i < 14; i++) {
        const d = addDaysYmd(endYmd, -i);
        const v = dailyLoad.get(uid)?.get(d) ?? 0;
        sum += v;
      }
      return Math.round((sum / 14) * 10) / 10;
    }

    // 4) 日別に「全選手のavg_load_14d」を作る
    const dates: string[] = [];
    {
      let cur = startDate;
      while (cur <= endDate) {
        dates.push(cur);
        cur = addDaysYmd(cur, 1);
      }
    }

    // date -> team_id -> array of avg14
    const teamValsByDate = new Map<string, Map<string, number[]>>();
    // date -> user_id -> avg14
    const userAvgByDate = new Map<string, Map<string, number>>();

    for (const d of dates) {
      const teamMap = new Map<string, number[]>();
      const userMap = new Map<string, number>();

      for (const a of athleteList) {
        const v = avg14(a.user_id, d);
        userMap.set(a.user_id, v);

        if (!teamMap.has(a.team_id)) teamMap.set(a.team_id, []);
        teamMap.get(a.team_id)!.push(v);
      }

      // sort arrays (for quantiles)
      for (const arr of teamMap.values()) arr.sort((x, y) => x - y);

      teamValsByDate.set(d, teamMap);
      userAvgByDate.set(d, userMap);
    }

    // 5) athlete_activity_level_daily upsert rows作成
    const activityRows: any[] = [];

    for (const d of dates) {
      const teamMap = teamValsByDate.get(d)!;
      const userMap = userAvgByDate.get(d)!;

      for (const a of athleteList) {
        const arr = teamMap.get(a.team_id) ?? [];
        const p25 = quantile(arr, 0.25);
        const p50 = quantile(arr, 0.50);
        const p75 = quantile(arr, 0.75);

        const v = userMap.get(a.user_id) ?? 0;
        const systemLevel: Level = arr.length >= 3
          ? levelFromPercentiles(v, p25, p50, p75)
          : "moderate";

        // 今は override 運用がまだなので effective=system
        const effectiveLevel: Level = systemLevel;

        activityRows.push({
          user_id: a.user_id,
          team_id: a.team_id,
          date: d,
          avg_load_14d: v,
          team_p25: Math.round(p25 * 10) / 10,
          team_p50: Math.round(p50 * 10) / 10,
          team_p75: Math.round(p75 * 10) / 10,
          activity_level_system: systemLevel,
          activity_level_effective: effectiveLevel,
          created_at: new Date().toISOString(),
        });
      }
    }

    // chunk upsert
    const CHUNK = 500;
    for (let i = 0; i < activityRows.length; i += CHUNK) {
      const chunk = activityRows.slice(i, i + CHUNK);
      const { error } = await admin
        .from("athlete_activity_level_daily")
        .upsert(chunk, { onConflict: "user_id,date" });
      if (error) throw error;
    }

    // 6) nutrition_daily + nutrition_targets_daily を作る
    const nutritionDailyRows: any[] = [];
    const targetRows: any[] = [];

    for (const d of dates) {
      // activity level は当日分を使う（前日確定の運用）
      // すでに activityRows にあるのでそれを参照する
      for (const a of athleteList) {
        const inb = latestInbody.get(a.user_id);
        const weight = inb?.weight ?? null;
        if (weight == null) continue; // InBodyなしは作らない（後で対応拡張可）

        const height_cm = (inb?.height ?? a.height_cm ?? null);
        if (height_cm == null) continue;

        const pbf = inb?.body_fat_percent ?? null;

        // effective level は activityRows から引く
        const act = activityRows.find((x) => x.user_id === a.user_id && x.date === d);
        const level: Level = (act?.activity_level_effective ?? "moderate") as Level;

        const lean = calcLeanMass(weight, pbf);
        const bmr = calcBmr(weight, lean);
        const tdee = Math.round(bmr * activityFactor(level));

        nutritionDailyRows.push({
          user_id: a.user_id,
          team_id: a.team_id,
          date: d,
          weight,
          height_cm,
          body_fat_percent: pbf,
          bmr,
          tdee,
          activity_level: level,
          created_at: new Date().toISOString(),
        });

        const macros = buildMacros(weight, tdee, defaultGoal);

        targetRows.push({
          user_id: a.user_id,
          team_id: a.team_id,
          date: d,
          tdee,
          goal: defaultGoal,
          protein_g: macros.protein_g,
          fat_g: macros.fat_g,
          carbs_g: macros.carbs_g,
          protein_kcal: macros.protein_kcal,
          fat_kcal: macros.fat_kcal,
          carbs_kcal: macros.carbs_kcal,
          created_at: new Date().toISOString(),
        });
      }
    }

    // upsert nutrition_daily
    for (let i = 0; i < nutritionDailyRows.length; i += CHUNK) {
      const chunk = nutritionDailyRows.slice(i, i + CHUNK);
      const { error } = await admin
        .from("nutrition_daily")
        .upsert(chunk, { onConflict: "user_id,date" });
      if (error) throw error;
    }

    // upsert nutrition_targets_daily
    for (let i = 0; i < targetRows.length; i += CHUNK) {
      const chunk = targetRows.slice(i, i + CHUNK);
      const { error } = await admin
        .from("nutrition_targets_daily")
        .upsert(chunk, { onConflict: "user_id,date" });
      if (error) throw error;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        startDate,
        endDate,
        athletes: athleteList.length,
        activity_upserted: activityRows.length,
        nutrition_daily_upserted: nutritionDailyRows.length,
        nutrition_targets_upserted: targetRows.length,
        default_goal: defaultGoal,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[recalc-activity-and-nutrition]", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});