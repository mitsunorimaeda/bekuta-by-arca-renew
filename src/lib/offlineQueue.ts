// src/lib/offlineQueue.ts
// IndexedDB ベースのオフラインミューテーションキュー
import { openDB, type IDBPDatabase } from 'idb';
import { supabase } from './supabase';
import * as Sentry from '@sentry/react';

// ミューテーションの型
export interface PendingMutation {
  id?: number; // auto-increment
  table: string;
  operation: 'insert' | 'upsert';
  payload: Record<string, any>;
  onConflict?: string; // upsert 用
  createdAt: string;
  retryCount: number;
}

const DB_NAME = 'bekuta-offline';
const DB_VERSION = 1;
const STORE_NAME = 'pending_mutations';
const MAX_QUEUE_SIZE = 100;

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, {
            keyPath: 'id',
            autoIncrement: true,
          });
        }
      },
    });
  }
  return dbPromise;
}

/** キューにミューテーションを追加 */
export async function enqueue(
  mutation: Omit<PendingMutation, 'id' | 'createdAt' | 'retryCount'>
): Promise<void> {
  const db = await getDB();
  const currentCount = await db.count(STORE_NAME);
  if (currentCount >= MAX_QUEUE_SIZE) {
    console.warn('[OfflineQueue] キューが上限に達しました（100件）');
    throw new Error('オフラインキューが満杯です。接続を回復してデータを同期してください。');
  }
  await db.add(STORE_NAME, {
    ...mutation,
    createdAt: new Date().toISOString(),
    retryCount: 0,
  });
}

/** 全てのペンディングミューテーションを取得（作成順） */
export async function dequeueAll(): Promise<PendingMutation[]> {
  const db = await getDB();
  return db.getAll(STORE_NAME);
}

/** 指定IDのミューテーションを削除 */
export async function remove(id: number): Promise<void> {
  const db = await getDB();
  await db.delete(STORE_NAME, id);
}

/** ペンディング件数を取得 */
export async function count(): Promise<number> {
  const db = await getDB();
  return db.count(STORE_NAME);
}

/** Supabase ミューテーションを実行 */
async function executeMutation(mutation: PendingMutation): Promise<void> {
  const { table, operation, payload, onConflict } = mutation;

  if (operation === 'upsert') {
    const query = onConflict
      ? (supabase as any).from(table).upsert(payload, { onConflict })
      : (supabase as any).from(table).upsert(payload);
    const { error } = await query;
    if (error) throw error;
  } else {
    // insert
    const { error } = await (supabase as any).from(table).insert(payload);
    if (error) throw error;
  }
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

/** 認証エラーかどうか判定（リトライ可能） */
function isAuthError(err: unknown): boolean {
  const msg = String((err as any)?.message ?? '');
  const code = String((err as any)?.code ?? '');
  return (
    msg.includes('JWT expired') ||
    msg.includes('token is expired') ||
    msg.includes('invalid claim') ||
    msg.includes('認証が必要です') ||
    code === 'PGRST301' ||
    code === '401'
  );
}

/**
 * キュー内の全ミューテーションを順次実行して同期する
 * @returns 残りのペンディング件数
 */
export async function flush(): Promise<number> {
  // セッションリフレッシュを試行（期限切れトークンの更新）
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (!session) {
      // セッションがない場合はrefreshを試行
      const { error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        console.warn('[OfflineQueue] セッション無効 — 同期スキップ:', refreshError.message);
        return await count();
      }
    }
    if (sessionError) {
      console.warn('[OfflineQueue] セッション取得エラー — 同期スキップ');
      return await count();
    }
  } catch {
    console.warn('[OfflineQueue] セッション確認失敗 — 同期スキップ');
    return await count();
  }

  const mutations = await dequeueAll();
  if (mutations.length === 0) return 0;

  console.log(`[OfflineQueue] ${mutations.length}件の同期を開始`);

  for (const mutation of mutations) {
    try {
      await executeMutation(mutation);
      await remove(mutation.id!);
      console.log(`[OfflineQueue] 同期成功: ${mutation.table}`);
    } catch (err) {
      if (isNetworkError(err)) {
        console.warn('[OfflineQueue] ネットワークエラー — 同期中断');
        return await count();
      }
      if (isAuthError(err)) {
        // 認証エラー → セッションリフレッシュ後にリトライ（データは消さない）
        console.warn('[OfflineQueue] 認証エラー — セッション更新後にリトライ:', err);
        try {
          await supabase.auth.refreshSession();
          // リフレッシュ成功 → もう一度試行
          await executeMutation(mutation);
          await remove(mutation.id!);
          console.log(`[OfflineQueue] リトライ成功: ${mutation.table}`);
        } catch (retryErr) {
          console.warn('[OfflineQueue] リトライも失敗 — 次回に持ち越し:', retryErr);
          return await count(); // 残りは次回
        }
        continue;
      }
      // サーバーエラー（制約違反等）→ Sentryに記録して削除（無限リトライ防止）
      Sentry.captureException(err, {
        extra: {
          table: mutation.table,
          operation: mutation.operation,
          payload: mutation.payload,
          retryCount: mutation.retryCount,
        },
      });
      console.error('[OfflineQueue] 永続エラー — スキップ:', mutation.table, err);
      await remove(mutation.id!);
    }
  }

  console.log('[OfflineQueue] 全件同期完了');
  return await count();
}
