import { supabase } from './supabase';

type LogEventArgs = {
  userId: string;
  eventType: string;
  payload?: Record<string, any>;
};

export async function logEvent({ userId, eventType, payload = {} }: LogEventArgs) {
  try {
    const { error } = await supabase.from('events').insert({
      user_id: userId,
      event_type: eventType,
      payload,
    });

    if (error) throw error;
  } catch (e) {
    // 失敗しても「記録自体」は止めない
    console.warn('[logEvent] failed:', e);
  }
}