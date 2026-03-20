// src/hooks/useOfflineQueue.ts
// オフラインキューの状態管理 + 自動同期フック
import { useState, useEffect, useCallback, useRef } from 'react';
import { count, flush } from '../lib/offlineQueue';

const SYNC_INTERVAL_MS = 30_000; // 30秒ごとに再試行

export function useOfflineQueue() {
  const [pendingCount, setPendingCount] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const syncingRef = useRef(false);

  // ペンディング件数を更新
  const refreshCount = useCallback(async () => {
    try {
      const c = await count();
      setPendingCount(c);
    } catch {
      // IndexedDB unavailable
    }
  }, []);

  // 同期実行
  const doFlush = useCallback(async () => {
    if (syncingRef.current || !navigator.onLine) return;
    syncingRef.current = true;
    setIsSyncing(true);

    try {
      const remaining = await flush();
      setPendingCount(remaining);
    } catch (err) {
      console.warn('[OfflineQueue] sync error:', err);
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
    }
  }, []);

  // オンライン/オフライン監視
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      doFlush(); // オンライン復帰で即同期
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [doFlush]);

  // 初回マウント時にカウント取得
  useEffect(() => {
    refreshCount();
  }, [refreshCount]);

  // 定期的にペンディングがあれば同期を試行
  useEffect(() => {
    const timer = setInterval(() => {
      if (navigator.onLine && pendingCount > 0) {
        doFlush();
      } else {
        refreshCount(); // カウントだけ更新（他のタブでキューに追加された場合用）
      }
    }, SYNC_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [doFlush, pendingCount, refreshCount]);

  return {
    pendingCount,
    isOnline,
    isSyncing,
    flush: doFlush,
    refreshCount,
  };
}
