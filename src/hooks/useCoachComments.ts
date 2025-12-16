import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export function useCoachComments(
  userId: string,
  userRole: 'athlete' | 'staff' = 'athlete'
) {
  const [comments, setComments] = useState<CoachComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ✅ hookインスタンス固有ID
  const instanceIdRef = useRef(
    globalThis.crypto?.randomUUID?.() ??
      Math.random().toString(36).slice(2)
  );

  // ✅ channel参照
  const channelRef = useRef<any>(null);

  const fetchComments = useCallback(async () => {
    if (!userId) return;

    try {
      setLoading(true);

      const query = supabase
        .from('coach_comments')
        .select(`
          *,
          coach:users!coach_comments_coach_id_fkey(id, name, email)
        `)
        .order('created_at', { ascending: false });

      userRole === 'athlete'
        ? query.eq('athlete_id', userId)
        : query.eq('coach_id', userId);

      const { data, error } = await query;
      if (error) throw error;

      setComments(data || []);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('コメントの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [userId, userRole]);

  useEffect(() => {
    if (!userId) return;

    fetchComments();

    // ✅ 既存channelは必ず破棄
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    // ✅ userId + role + instanceId で完全ユニーク
    const channel = supabase
      .channel(
        `coach-comments:${userRole}:${userId}:${instanceIdRef.current}`
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'coach_comments',
          filter:
            userRole === 'athlete'
              ? `athlete_id=eq.${userId}`
              : `coach_id=eq.${userId}`,
        },
        fetchComments
      );

    channel.subscribe();
    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [userId, userRole, fetchComments]);

  return {
    comments,
    loading,
    error,
    refresh: fetchComments,
  };
}