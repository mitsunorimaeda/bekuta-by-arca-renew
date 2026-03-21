import { supabase } from "./supabase";
import { offlineMutation } from "./offlineSupabase";

export async function upsertDailyEnergySnapshot(params: {
  userId: string;
  date: string; // yyyy-mm-dd
  rpe: number;
  durationMin: number;
}) {
  const { userId, date, rpe, durationMin } = params;
  const srpe = (rpe ?? 0) * (durationMin ?? 0);

  // ✅ 最新BMRを取得（あなたのDBにある前提：nutrition_metabolism_snapshots）
  // オフライン時はスキップ（BMR取得にはネットワーク必要）
  let bmr: number | null = null;
  try {
    const { data: meta, error: metaErr } = await supabase
      .from("nutrition_metabolism_snapshots")
      .select("bmr")
      .eq("user_id", userId)
      .order("calculated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (metaErr) throw metaErr;
    bmr = meta?.bmr ?? null;
  } catch (e) {
    // オフラインやネットワークエラー時はスキップ
    console.warn('[EnergySnapshot] BMR取得失敗（オフライン？）- スキップ:', e);
    return;
  }

  // BMR未計算ならスキップ（UIは死なせない）
  if (!bmr) return;

  // ✅ activity factor（まずは簡易）
  const activityFactor =
    srpe === 0 ? 1.2 :
    srpe < 300 ? 1.4 :
    srpe < 600 ? 1.6 :
    srpe < 900 ? 1.8 : 2.0;

  const tdee = Math.round(bmr * activityFactor);

  // ✅ 1日1行で upsert（onConflictは user_id,date）— オフライン対応
  await offlineMutation({
    table: 'daily_energy_snapshots',
    operation: 'upsert',
    payload: {
      user_id: userId,
      date,
      bmr,
      srpe,
      activity_factor: activityFactor,
      tdee,
    },
    onConflict: 'user_id,date',
  });
}