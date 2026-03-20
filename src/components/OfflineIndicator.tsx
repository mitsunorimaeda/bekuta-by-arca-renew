// src/components/OfflineIndicator.tsx
// オフライン状態 + 未送信データのインジケーター
import { WifiOff, UploadCloud, Loader2, Check } from 'lucide-react';
import { useOfflineQueue } from '../hooks/useOfflineQueue';
import { useState, useEffect } from 'react';

export function OfflineIndicator() {
  const { pendingCount, isOnline, isSyncing } = useOfflineQueue();
  const [showSyncDone, setShowSyncDone] = useState(false);
  const [prevPending, setPrevPending] = useState(pendingCount);

  // 同期完了時に一時的に「同期完了」を表示
  useEffect(() => {
    if (prevPending > 0 && pendingCount === 0 && !isSyncing) {
      setShowSyncDone(true);
      const timer = setTimeout(() => setShowSyncDone(false), 3000);
      return () => clearTimeout(timer);
    }
    setPrevPending(pendingCount);
  }, [pendingCount, isSyncing, prevPending]);

  // 表示する必要がない場合は非表示
  if (isOnline && pendingCount === 0 && !isSyncing && !showSyncDone) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
      {!isOnline && (
        <div className="flex items-center gap-2 bg-gray-800 text-white px-4 py-2 rounded-full shadow-lg text-sm">
          <WifiOff className="w-4 h-4" />
          <span>オフライン</span>
          {pendingCount > 0 && (
            <span className="bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full">
              未送信 {pendingCount}件
            </span>
          )}
        </div>
      )}

      {isOnline && isSyncing && (
        <div className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>同期中...</span>
        </div>
      )}

      {isOnline && !isSyncing && pendingCount > 0 && (
        <div className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2 rounded-full shadow-lg text-sm">
          <UploadCloud className="w-4 h-4" />
          <span>未送信 {pendingCount}件</span>
        </div>
      )}

      {showSyncDone && isOnline && !isSyncing && pendingCount === 0 && (
        <div className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-full shadow-lg text-sm animate-fade-in">
          <Check className="w-4 h-4" />
          <span>同期完了</span>
        </div>
      )}
    </div>
  );
}
