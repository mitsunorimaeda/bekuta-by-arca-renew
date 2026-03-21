// logEvent.ts
import { supabase } from './supabase';
import { trackEvent } from './posthog';

type LogEventArgs = {
  userId?: string | null; // ← optional にする
  eventType: string;
  payload?: Record<string, any>;
};

export async function logEvent({
  userId,
  eventType,
  payload = {},
}: LogEventArgs) {
  // ✅ PostHog にも送信（userId不要でも送れる）
  trackEvent(eventType, { ...payload, user_id: userId });

  // ✅ ガード：userId が無いなら Supabase には送らない
  if (!userId) {
    console.warn('[logEvent] skipped supabase: missing userId', {
      eventType,
      payload,
    });
    return;
  }

  try {
    const { error } = await supabase.from('events').insert({
      user_id: userId,
      event_type: eventType,
      payload,
    });

    if (error) throw error;
  } catch (e) {
    // ログ失敗では UX を壊さない
    console.warn('[logEvent] failed:', e);
  }
}
