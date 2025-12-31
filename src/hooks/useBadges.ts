// src/hooks/useBadges.ts
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const ENABLE_REALTIME = import.meta.env.VITE_ENABLE_REALTIME === 'true';
// ↑ NetlifyのEnvに VITE_ENABLE_REALTIME=false を入れたら realtime完全停止

export function useBadges(userId: string) {
  const [allBadges, setAllBadges] = useState<any[]>([]);
  const [userBadges, setUserBadges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const badgesLoadedRef = useRef(false);
  const inflightRef = useRef(false); // 連打/多重取得ガード

  const cleanupChannel = useCallback(() => {
    if (channelRef.current) {
      try {
        supabase.removeChannel(channelRef.current);
      } catch (e) {
        // removeChannelが例外を投げても落とさない
      }
      channelRef.current = null;
    }
  }, []);

  const fetchBadges = useCallback(async () => {
    const { data, error } = await supabase.from('badges').select('*').order('sort_order');
    if (error) throw error;
    setAllBadges(data ?? []);
  }, []);

  const fetchUserBadges = useCallback(async () => {
    if (!userId) return;

    // DBが重いとき、realtimeイベントで連続呼び出しされるのを抑止
    if (inflightRef.current) return;
    inflightRef.current = true;

    try {
      const { data, error } = await supabase
        .from('user_badges')
        .select(`*, badge:badges(*)`)
        .eq('user_id', userId)
        .order('earned_at', { ascending: false });

      if (error) throw error;

      setUserBadges(data ?? []);
      setError(null);
    } finally {
      inflightRef.current = false;
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      cleanupChannel();
      return;
    }

    let cancelled = false;

    const start = async () => {
      try {
        setLoading(true);

        // 既存チャンネルを確実に破棄（ユーザー切替や再マウント時）
        cleanupChannel();

        // badges は全員共通：初回だけ
        if (!badgesLoadedRef.current) {
          await fetchBadges();
          badgesLoadedRef.current = true;
        }

        await fetchUserBadges();
        if (cancelled) return;

        // ✅ Realtime 無効なら、ここで終了（チャンネルを作らない）
        if (!ENABLE_REALTIME) return;

        const channel = supabase
          .channel(`user-badges:${userId}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'user_badges',
              filter: `user_id=eq.${userId}`,
            },
            () => {
              // 変化が来たら再取得（inflightRefで暴発抑止済み）
              fetchUserBadges();
            }
          )
          .subscribe((status) => {
            if (import.meta.env.DEV) console.log('[useBadges] status', status);

            // ✅ ここが超重要：失敗したら即終了して、無限リトライさせない
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              console.warn('[useBadges] realtime issue:', status);
              try {
                channel.unsubscribe();
              } catch (e) {}
              cleanupChannel();
            }
          });

        channelRef.current = channel;
      } catch (e: any) {
        console.error('Error in useBadges:', e);
        if (!cancelled) setError(e?.message ?? 'バッジの取得に失敗しました');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    start();

    return () => {
      cancelled = true;
      cleanupChannel();
    };
  }, [userId, fetchBadges, fetchUserBadges, cleanupChannel]);

  return {
    allBadges,
    userBadges,
    loading,
    error,
    refresh: async () => {
      await Promise.all([fetchBadges(), fetchUserBadges()]);
    },
  };
}