// src/lib/engineClient.ts
import { supabase } from './supabaseClient';

export type EngineEventType =
  | 'training_saved'
  | 'weight_saved'
  | 'sleep_saved'
  | 'motivation_saved'
  | 'cycle_saved'
  | 'reflection_saved';

export async function emitEvent(params: {
  userId: string;
  eventType: EngineEventType;
  eventDate: string; // 'YYYY-MM-DD'
  payload?: Record<string, any>;
}) {
  const { userId, eventType, eventDate, payload = {} } = params;

  const { error } = await supabase.from('engine_events').insert({
    user_id: userId,
    event_type: eventType,
    event_date: eventDate,
    payload,
  });

  if (error) {
    console.error('[emitEvent] failed:', error);
    // エンジン失敗で本体保存を落としたくないので throw しない方針でもOK
    return { ok: false as const, error };
  }
  return { ok: true as const };
}