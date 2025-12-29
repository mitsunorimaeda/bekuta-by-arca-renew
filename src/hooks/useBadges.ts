// src/hooks/useBadges.ts
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export function useBadges(userId: string) {
  const [allBadges, setAllBadges] = useState<any[]>([]);
  const [userBadges, setUserBadges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const badgesLoadedRef = useRef(false);

  const fetchBadges = useCallback(async () => {
    const { data, error } = await supabase.from('badges').select('*').order('sort_order');
    if (error) throw error;
    setAllBadges(data ?? []);
  }, []);

  const fetchUserBadges = useCallback(async () => {
    if (!userId) return;

    const { data, error } = await supabase
      .from('user_badges')
      .select(`*, badge:badges(*)`)
      .eq('user_id', userId)
      .order('earned_at', { ascending: false });

    if (error) throw error;

    setUserBadges(data ?? []);
    setError(null);
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const start = async () => {
      try {
        setLoading(true);

        // badges は全員共通：初回だけ（必要なら外してOK）
        if (!badgesLoadedRef.current) {
          await fetchBadges();
          badgesLoadedRef.current = true;
        }

        await fetchUserBadges();
        if (cancelled) return;

        // 既存チャンネルを確実に破棄
        if (channelRef.current) {
          supabase.removeChannel(channelRef.current);
          channelRef.current = null;
        }

        const channel = supabase
          .channel(`user-badges:${userId}`) // ★固定名
          .on(
            'postgres_changes',
            {
              event: '*', // ★ INSERTだけでなく更新/削除も拾うなら
              schema: 'public',
              table: 'user_badges',
              filter: `user_id=eq.${userId}`,
            },
            () => {
              // 変化が来たら再取得（必要なら payload で差分反映でもOK）
              fetchUserBadges();
            }
          )
          .subscribe((status) => {
            if (import.meta.env.DEV) console.log('[useBadges] status', status);
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              // ここで警告だけ（自動再購読はsupabase側がやることが多い）
              console.warn('[useBadges] realtime issue:', status);
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
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [userId, fetchBadges, fetchUserBadges]);

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