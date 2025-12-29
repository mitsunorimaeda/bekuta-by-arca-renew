import { supabase } from "./supabase";

export async function upsertDailyEnergySnapshot(params: {
  userId: string;
  date: string; // yyyy-mm-dd
  rpe: number;
  durationMin: number;
}) {
  const { userId, date, rpe, durationMin } = params;
  const srpe = (rpe ?? 0) * (durationMin ?? 0);

  // ✅ 最新BMRを取得（あなたのDBにある前提：nutrition_metabolism_snapshots）
  const { data: meta, error: metaErr } = await supabase
    .from("nutrition_metabolism_snapshots")
    .select("bmr")
    .eq("user_id", userId)
    .order("calculated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (metaErr) throw metaErr;

  // BMR未計算ならスキップ（UIは死なせない）
  const bmr = meta?.bmr;
  if (!bmr) return;

  // ✅ activity factor（まずは簡易）
  const activityFactor =
    srpe === 0 ? 1.2 :
    srpe < 300 ? 1.4 :
    srpe < 600 ? 1.6 :
    srpe < 900 ? 1.8 : 2.0;

  const tdee = Math.round(bmr * activityFactor);

  // ✅ 1日1行で upsert（onConflictは user_id,date）
  const { error } = await supabase
    .from("daily_energy_snapshots")
    .upsert(
      {
        user_id: userId,
        date,
        bmr,
        srpe,
        activity_factor: activityFactor,
        tdee,
      },
      { onConflict: "user_id,date" }
    );

  if (error) throw error;
}