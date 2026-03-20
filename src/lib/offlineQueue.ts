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

/**
 * キュー内の全ミューテーションを順次実行して同期する
 * @returns 残りのペンディング件数
 */
export async function flush(): Promise<number> {
  // 認証チェック
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    console.warn('[OfflineQueue] セッション無効 — 同期スキップ');
    return await count();
  }

  const mutations = await dequeueAll();
  if (mutations.length === 0) return 0;

  for (const mutation of mutations) {
    try {
      await executeMutation(mutation);
      await remove(mutation.id!);
    } catch (err) {
      if (isNetworkError(err)) {
        // ネットワークエラー → 中断、残りは後で再試行
        console.warn('[OfflineQueue] ネットワークエラー — 同期中断');
        return await count();
      }
      // サーバーエラー（4xx: 制約違反等）→ Sentryに記録して削除（無限リトライ防止）
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

  return await count();
}
