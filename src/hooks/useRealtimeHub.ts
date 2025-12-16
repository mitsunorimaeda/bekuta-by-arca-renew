// src/hooks/useRealtimeHub.ts
import { useEffect } from 'react';

export function useRealtimeHub(userId: string) {
  useEffect(() => {
    if (!userId) return;
    // いったん何もしない（ここに集約subscribeを後で入れる）
  }, [userId]);
}