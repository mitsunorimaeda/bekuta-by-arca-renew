import { supabase } from './supabase';

/**
 * 統一された日付フォーマット (YYYY-MM-DD)
 */
export function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * prescription_daily_logs の統一書き込み関数。
 * 既存レコードがあればマージして upsert するため、
 * 部分更新で他フィールドが消えることを防ぐ。
 */
export async function upsertDailyLog(params: {
  prescription_id: string;
  athlete_user_id: string;
  log_date: string;
  item_results?: Record<string, string>;
  completed_items?: string[];
  pain_level?: number;
  rpe?: number;
  feedback?: string;
  earned_xp?: number;
}): Promise<{ error: any }> {
  const { prescription_id, athlete_user_id, log_date, ...incoming } = params;

  // 1. 既存レコードを取得
  const { data: existing } = await supabase
    .schema('rehab')
    .from('prescription_daily_logs')
    .select('item_results, completed_items, pain_level, rpe, feedback, earned_xp')
    .eq('prescription_id', prescription_id)
    .eq('log_date', log_date)
    .maybeSingle();

  // 2. 既存値と新しい値をマージ（incoming で指定されたフィールドだけ上書き）
  const merged = {
    prescription_id,
    athlete_user_id,
    log_date,
    item_results: incoming.item_results ?? existing?.item_results ?? {},
    completed_items: incoming.completed_items ?? existing?.completed_items ?? [],
    pain_level: incoming.pain_level ?? existing?.pain_level ?? 0,
    rpe: incoming.rpe ?? existing?.rpe ?? 0,
    feedback: incoming.feedback ?? existing?.feedback ?? null,
    earned_xp: incoming.earned_xp ?? existing?.earned_xp ?? 0,
  };

  // 3. Upsert（同じ prescription_id + log_date なら更新）
  const { error } = await supabase
    .schema('rehab')
    .from('prescription_daily_logs')
    .upsert(merged, { onConflict: 'prescription_id, log_date' });

  return { error };
}
