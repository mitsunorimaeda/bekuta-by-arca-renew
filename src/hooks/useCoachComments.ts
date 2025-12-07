import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface CoachComment {
  id: string;
  athlete_id: string;
  coach_id: string;
  related_record_type: 'training' | 'performance' | 'weight' | 'sleep' | 'motivation' | 'general' | null;
  related_record_id: string | null;
  comment: string;
  is_read: boolean;
  sentiment: 'positive' | 'neutral' | 'constructive';
  created_at: string;
  updated_at: string;
  coach?: {
    id: string;
    name: string;
    email: string;
  };
}

export function useCoachComments(userId: string, userRole: 'athlete' | 'staff' = 'athlete') {
  const [comments, setComments] = useState<CoachComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;

    fetchComments();

    const subscription = supabase
      .channel('coach_comments_changes')
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
        () => {
          fetchComments();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [userId, userRole]);

  const fetchComments = async () => {
    try {
      setLoading(true);

      const query = supabase
        .from('coach_comments')
        .select(`
          *,
          coach:users!coach_comments_coach_id_fkey(id, name, email)
        `)
        .order('created_at', { ascending: false });

      if (userRole === 'athlete') {
        query.eq('athlete_id', userId);
      } else {
        query.eq('coach_id', userId);
      }

      const { data, error } = await query;

      if (error) throw error;

      setComments(data || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching coach comments:', err);
      setError(err instanceof Error ? err.message : 'コメントの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const addComment = async (
    athleteId: string,
    comment: string,
    sentiment: CoachComment['sentiment'] = 'neutral',
    relatedRecordType?: CoachComment['related_record_type'],
    relatedRecordId?: string
  ) => {
    try {
      const { data, error } = await supabase
        .from('coach_comments')
        .insert({
          athlete_id: athleteId,
          coach_id: userId,
          comment,
          sentiment,
          related_record_type: relatedRecordType || null,
          related_record_id: relatedRecordId || null,
        })
        .select()
        .single();

      if (error) throw error;

      await fetchComments();
      return { data, error: null };
    } catch (err) {
      console.error('Error adding comment:', err);
      return {
        data: null,
        error: err instanceof Error ? err.message : 'コメントの追加に失敗しました',
      };
    }
  };

  const markAsRead = async (commentId: string) => {
    try {
      const { error } = await supabase
        .from('coach_comments')
        .update({ is_read: true })
        .eq('id', commentId)
        .eq('athlete_id', userId);

      if (error) throw error;

      await fetchComments();
    } catch (err) {
      console.error('Error marking comment as read:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      const { error } = await supabase
        .from('coach_comments')
        .update({ is_read: true })
        .eq('athlete_id', userId)
        .eq('is_read', false);

      if (error) throw error;

      await fetchComments();
    } catch (err) {
      console.error('Error marking all comments as read:', err);
    }
  };

  const deleteComment = async (commentId: string) => {
    try {
      const { error } = await supabase
        .from('coach_comments')
        .delete()
        .eq('id', commentId)
        .eq('coach_id', userId);

      if (error) throw error;

      await fetchComments();
      return { error: null };
    } catch (err) {
      console.error('Error deleting comment:', err);
      return {
        error: err instanceof Error ? err.message : 'コメントの削除に失敗しました',
      };
    }
  };

  const getUnreadComments = () => {
    return comments.filter((c) => !c.is_read);
  };

  const getUnreadCount = () => {
    return getUnreadComments().length;
  };

  const getCommentsByRecordType = (type: CoachComment['related_record_type']) => {
    return comments.filter((c) => c.related_record_type === type);
  };

  const getCommentsBySentiment = (sentiment: CoachComment['sentiment']) => {
    return comments.filter((c) => c.sentiment === sentiment);
  };

  const getCommentsForRecord = (recordType: CoachComment['related_record_type'], recordId: string) => {
    return comments.filter(
      (c) => c.related_record_type === recordType && c.related_record_id === recordId
    );
  };

  return {
    comments,
    loading,
    error,
    addComment,
    markAsRead,
    markAllAsRead,
    deleteComment,
    getUnreadComments,
    getUnreadCount,
    getCommentsByRecordType,
    getCommentsBySentiment,
    getCommentsForRecord,
    refresh: fetchComments,
  };
}
