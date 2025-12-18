import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'streak' | 'performance' | 'consistency' | 'milestone' | 'special' | 'team';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  criteria: any;
  points_reward: number;
  sort_order: number;
  is_hidden: boolean;
  created_at: string;
}

export interface UserBadge {
  id: string;
  user_id: string;
  badge_id: string;
  earned_at: string;
  is_new: boolean;
  metadata: any;
  badge?: Badge;
}

export function useBadges(userId: string) {
  const [allBadges, setAllBadges] = useState<Badge[]>([]);
  const [userBadges, setUserBadges] = useState<UserBadge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ✅ hookインスタンス固有ID（タブ内衝突回避）
  const instanceIdRef = useRef(
    (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2))
  );

  // ✅ effect再実行ごとにユニークなrunIdを採番（subscribe二重呼びを構造的に防ぐ）
  const runSeqRef = useRef(0);

  // ✅ Realtime channel の参照
  const channelRef = useRef<any>(null);

  // ✅ badges は全員共通なので、初回だけ取れればOK（必要なら手動refreshで更新）
  const badgesLoadedRef = useRef(false);

  const fetchBadges = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('badges')
        .select('*')
        .order('sort_order');

      if (error) throw error;
      setAllBadges(data || []);
    } catch (err) {
      console.error('Error fetching badges:', err);
    }
  }, []);

  const fetchUserBadges = useCallback(async () => {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from('user_badges')
        .select(
          `
          *,
          badge:badges(*)
        `
        )
        .eq('user_id', userId)
        .order('earned_at', { ascending: false });

      if (error) throw error;

      setUserBadges(data || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching user badges:', err);
      setError(err instanceof Error ? err.message : 'バッジの取得に失敗しました');
    }
  }, [userId]);

  useEffect(() => {
    let cancelled = false;

    const setup = async () => {
      if (!userId) {
        setLoading(false);
        return;
      }

      setLoading(true);

      // ✅ badgesは初回だけ取得（毎回取りたいならこのifを消してOK）
      if (!badgesLoadedRef.current) {
        await fetchBadges();
        badgesLoadedRef.current = true;
      }

      await fetchUserBadges();
      if (cancelled) return;

      setLoading(false);

      // ✅ 既存チャンネルを確実に閉じる（unsubscribe → remove）
      if (channelRef.current) {
        try {
          await channelRef.current.unsubscribe?.();
        } catch (e) {
          // noop
        }
        try {
          supabase.removeChannel(channelRef.current);
        } catch (e) {
          // noop
        }
        channelRef.current = null;
      }

      // ✅ 今回のrunId（毎回変わる）
      runSeqRef.current += 1;
      const runId = runSeqRef.current;

      const chName = `user-badges:${userId}:${instanceIdRef.current}:${runId}`;

      const ch = supabase
        .channel(chName)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'user_badges',
            filter: `user_id=eq.${userId}`,
          },
          () => {
            fetchUserBadges();
          }
        );

      channelRef.current = ch;

      ch.subscribe((status: string) => {
        // SUBSCRIBED / TIMED_OUT / CLOSED / CHANNEL_ERROR
        // console.log('[useBadges] channel status:', chName, status);
        if (status === 'CHANNEL_ERROR') {
          console.warn('[useBadges] Realtime channel error:', chName);
        }
      });
    };

    setup();

    return () => {
      cancelled = true;

      const ch = channelRef.current;
      if (ch) {
        try {
          ch.unsubscribe?.();
        } catch (e) {
          // noop
        }
        try {
          supabase.removeChannel(ch);
        } catch (e) {
          // noop
        }
        channelRef.current = null;
      }
    };
  }, [userId, fetchBadges, fetchUserBadges]);

  const earnBadge = async (badgeName: string, metadata: any = {}) => {
    try {
      const { data, error } = await supabase.rpc('earn_badge', {
        p_user_id: userId,
        p_badge_name: badgeName,
        p_metadata: metadata,
      });

      if (error) throw error;

      if (data) {
        await fetchUserBadges();
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error earning badge:', err);
      return false;
    }
  };

  const markBadgeAsViewed = async (userBadgeId: string) => {
    try {
      const { error } = await supabase
        .from('user_badges')
        .update({ is_new: false })
        .eq('id', userBadgeId)
        .eq('user_id', userId);

      if (error) throw error;

      await fetchUserBadges();
    } catch (err) {
      console.error('Error marking badge as viewed:', err);
    }
  };

  const getNewBadges = () => userBadges.filter((ub) => ub.is_new);

  const hasBadge = (badgeName: string) =>
    userBadges.some((ub) => ub.badge?.name === badgeName);

  const getBadgesByCategory = (category: Badge['category']) =>
    userBadges.filter((ub) => ub.badge?.category === category);

  const getBadgesByRarity = (rarity: Badge['rarity']) =>
    userBadges.filter((ub) => ub.badge?.rarity === rarity);

  const getEarnedBadgeIds = () => new Set(userBadges.map((ub) => ub.badge_id));

  const getUnearnedBadges = () => {
    const earnedIds = getEarnedBadgeIds();
    return allBadges.filter((b) => !earnedIds.has(b.id) && !b.is_hidden);
  };

  const getBadgeProgress = () => {
    const total = allBadges.filter((b) => !b.is_hidden).length;
    const earned = userBadges.length;
    return {
      earned,
      total,
      percentage: total > 0 ? (earned / total) * 100 : 0,
    };
  };

  return {
    allBadges,
    userBadges,
    loading,
    error,
    earnBadge,
    markBadgeAsViewed,
    getNewBadges,
    hasBadge,
    getBadgesByCategory,
    getBadgesByRarity,
    getUnearnedBadges,
    getBadgeProgress,
    refresh: async () => {
      // ✅ 手動更新（allBadgesも更新したいなら両方）
      await Promise.all([fetchBadges(), fetchUserBadges()]);
    },
  };
}