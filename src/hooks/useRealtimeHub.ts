// src/hooks/useRealtimeHub.ts
import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

type Handlers = {
  onPointsChanged?: () => void;
  onBadgesChanged?: () => void;
  onGoalsChanged?: () => void;
  onStreaksChanged?: () => void;
  onTeamAchievementNoti?: () => void;
  onRankingsChanged?: () => void;
  onGraphsChanged?: () => void;
};

export function useRealtimeHub(userId: string | null | undefined, handlers: Handlers) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!userId) return;

    // 既存があれば必ず破棄
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel(`realtime-hub:${userId}`)

      // ---- ポイント即反映（user_points / point_transactions）----
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_points', filter: `user_id=eq.${userId}` },
        () => handlers.onPointsChanged?.()
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'point_transactions', filter: `user_id=eq.${userId}` },
        () => handlers.onPointsChanged?.()
      )

      // ---- バッジ（user_badges）----
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'user_badges', filter: `user_id=eq.${userId}` },
        () => handlers.onBadgesChanged?.()
      )

      // ---- 目標（user_goals）----
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_goals', filter: `user_id=eq.${userId}` },
        () => handlers.onGoalsChanged?.()
      )

      // ---- ストリーク（user_streaks）----
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_streaks', filter: `user_id=eq.${userId}` },
        () => handlers.onStreaksChanged?.()
      )

      // ---- チーム達成通知（team_achievement_notifications）----
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'team_achievement_notifications', filter: `user_id=eq.${userId}` },
        () => handlers.onTeamAchievementNoti?.()
      );

    channel.subscribe((status) => {
      // console.log('[RealtimeHub]', status);
    });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [userId]);
}