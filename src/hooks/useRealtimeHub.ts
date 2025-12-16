// src/hooks/useRealtimeHub.ts
import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

type HubHandlers = {
  onPointsChanged?: () => void;
  onBadgesChanged?: () => void;
  onGoalsChanged?: () => void;
  onStreaksChanged?: () => void;
  onTeamAchievementNoti?: () => void;
};

export function useRealtimeHub(userId: string, handlers: HubHandlers = {}) {
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (!userId) return;

    // 既存があれば破棄
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    // いったん「まとめる箱」を作る（中身は後で増やす）
    const channel = supabase.channel(`realtime-hub:${userId}`);

    // 例：目標
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'user_goals', filter: `user_id=eq.${userId}` },
      () => handlers.onGoalsChanged?.(),
    );

    // 例：ストリーク
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'user_streaks', filter: `user_id=eq.${userId}` },
      () => handlers.onStreaksChanged?.(),
    );

    // （必要ならここにpoints/badges等も足していく）

    channel.subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [userId]); // handlersは依存に入れない（毎回作られて再subscribeしがち）
}