// src/lib/offlineSupabase.ts
// Supabase ミューテーションのオフライン対応ラッパー
import { supabase } from './supabase';
import { enqueue } from './offlineQueue';

export interface MutationParams {
  table: string;
  operation: 'insert' | 'upsert';
  payload: Record<string, any>;
  onConflict?: string;
}

export interface MutationResult {
  queued: boolean;
}

/** ネットワークエラーかどうか判定 */
function isNetworkError(err: unknown): boolean {
  if (!navigator.onLine) return true;
  const msg = String((err as any)?.message ?? '');
  return (
    msg.includes('Failed to fetch') ||
    msg.includes('NetworkError') ||
    msg.includes('Load failed') ||
    msg.includes('Network request failed') ||
    msg.includes('fetch failed')
  );
}

/**
 * Supabase ミューテーションをオフライン対応で実行する
 *
 * - オンライン時: 通常通りSupabaseに送信
 * - オフライン/ネットワークエラー時: IndexedDBにキューイング
 * - サーバーエラー（4xx等）: そのままスロー
 */
export async function offlineMutation(params: MutationParams): Promise<MutationResult> {
  // 事前にオフラインと分かっている場合は即キューイング
  if (!navigator.onLine) {
    await enqueue(params);
    return { queued: true };
  }

  try {
    const { table, operation, payload, onConflict } = params;

    if (operation === 'upsert') {
      const query = onConflict
        ? (supabase as any).from(table).upsert(payload, { onConflict })
        : (supabase as any).from(table).upsert(payload);
      const { error } = await query;
      if (error) throw error;
    } else {
      const { error } = await (supabase as any).from(table).insert(payload);
      if (error) throw error;
    }

    return { queued: false };
  } catch (err) {
    if (isNetworkError(err)) {
      await enqueue(params);
      return { queued: true };
    }
    throw err;
  }
}
