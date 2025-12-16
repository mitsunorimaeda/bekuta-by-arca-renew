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

  // ✅ hookインスタンス固有ID（同名channel衝突防止）
  const instanceIdRef = useRef(
    (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2))
  );

  // ✅ Realtime channel の参照
  const channelRef = useRef<any>(null);

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
      setLoading(true);
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
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    fetchBadges();
    fetchUserBadges();

    // ✅ 既存channelが残ってたら必ず破棄
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    // ✅ userId + instanceId で完全ユニーク化
    const channel = supabase
      .channel(`user-badges:${userId}:${instanceIdRef.current}`)
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

    channel.subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
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
    refresh: fetchUserBadges,
  };
}ß