import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface MessageThread {
  id: string;
  participant1_id: string;
  participant2_id: string;
  last_message_at: string;
  created_at: string;
  other_user?: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  unread_count?: number;
  last_message_preview?: string;
}

export interface Message {
  id: string;
  thread_id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
  updated_at: string;
  sender?: {
    id: string;
    name: string;
    email: string;
  };
}

export function useMessages(userId: string) {
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);

  // Fetch all threads for the user
  const fetchThreads = useCallback(async () => {
    try {
      setLoading(true);

      const { data: threadsData, error: threadsError } = await supabase
        .from('message_threads')
        .select(`
          id,
          participant1_id,
          participant2_id,
          last_message_at,
          created_at
        `)
        .or(`participant1_id.eq.${userId},participant2_id.eq.${userId}`)
        .order('last_message_at', { ascending: false });

      if (threadsError) throw threadsError;

      // Fetch other user details and unread counts for each thread
      const threadsWithDetails = await Promise.all(
        (threadsData || []).map(async (thread) => {
          const otherUserId =
            thread.participant1_id === userId
              ? thread.participant2_id
              : thread.participant1_id;

          // Fetch other user details
          const { data: userData } = await supabase
            .from('users')
            .select('id, name, email, role')
            .eq('id', otherUserId)
            .single();

          // Fetch unread count
          const { count } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('thread_id', thread.id)
            .eq('receiver_id', userId)
            .eq('is_read', false);

          // Fetch last message preview
          const { data: lastMessage } = await supabase
            .from('messages')
            .select('content')
            .eq('thread_id', thread.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          return {
            ...thread,
            other_user: userData || undefined,
            unread_count: count || 0,
            last_message_preview: lastMessage?.content,
          };
        })
      );

      setThreads(threadsWithDetails);
      setError(null);
    } catch (err) {
      console.error('Error fetching threads:', err);
      setError(err instanceof Error ? err.message : 'スレッドの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Fetch messages for a specific thread
  const fetchMessages = useCallback(async (threadId: string) => {
    try {
      const { data: messagesData, error: messagesError } = await supabase
        .from('messages')
        .select(`
          id,
          thread_id,
          sender_id,
          receiver_id,
          content,
          is_read,
          created_at,
          updated_at,
          sender:users!messages_sender_id_fkey(id, name, email)
        `)
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true })
        .limit(100); // Limit to last 100 messages for performance

      if (messagesError) throw messagesError;

      setMessages((prev) => ({
        ...prev,
        [threadId]: messagesData || [],
      }));
    } catch (err) {
      console.error('Error fetching messages:', err);
      setError(err instanceof Error ? err.message : 'メッセージの取得に失敗しました');
    }
  }, []);

  // Create or get existing thread with another user
  const getOrCreateThread = useCallback(
    async (otherUserId: string) => {
      try {
        // Determine participant order (smaller id first using string comparison)
        const [participant1, participant2] = [userId, otherUserId].sort();

        console.log('Creating/finding thread:', {
          userId,
          otherUserId,
          participant1,
          participant2
        });

        // Check if both users are in the same organization
        const { data: userOrgs } = await supabase
          .from('organization_members')
          .select('organization_id')
          .eq('user_id', userId);

        const { data: otherUserOrgs } = await supabase
          .from('organization_members')
          .select('organization_id')
          .eq('user_id', otherUserId);

        console.log('User organizations:', {
          userOrgs,
          otherUserOrgs
        });

        if (!userOrgs || userOrgs.length === 0) {
          throw new Error('あなたは組織に所属していません。メッセージを送信するには組織に所属する必要があります。');
        }

        if (!otherUserOrgs || otherUserOrgs.length === 0) {
          throw new Error('相手が組織に所属していません。');
        }

        const userOrgIds = userOrgs.map(o => o.organization_id);
        const otherUserOrgIds = otherUserOrgs.map(o => o.organization_id);
        const commonOrgs = userOrgIds.filter(id => otherUserOrgIds.includes(id));

        if (commonOrgs.length === 0) {
          throw new Error('相手と同じ組織に所属していません。同じ組織のメンバーとのみメッセージのやり取りができます。');
        }

        // Try to find existing thread
        const { data: existingThread, error: findError } = await supabase
          .from('message_threads')
          .select('id')
          .eq('participant1_id', participant1)
          .eq('participant2_id', participant2)
          .maybeSingle();

        if (findError) {
          console.error('Error finding thread:', findError);
          throw new Error('既存のスレッド検索に失敗しました: ' + findError.message);
        }

        if (existingThread) {
          console.log('Found existing thread:', existingThread.id);
          return existingThread.id;
        }

        // Create new thread if it doesn't exist
        console.log('Creating new thread...');
        const { data: newThread, error: createError } = await supabase
          .from('message_threads')
          .insert({
            participant1_id: participant1,
            participant2_id: participant2,
          })
          .select('id')
          .single();

        if (createError) {
          console.error('Error creating thread:', createError);
          throw new Error('スレッド作成に失敗しました: ' + createError.message);
        }

        console.log('Created new thread:', newThread.id);

        // Refresh threads list
        await fetchThreads();

        return newThread.id;
      } catch (err) {
        console.error('Error in getOrCreateThread:', err);
        throw err;
      }
    },
    [userId, fetchThreads]
  );

  // Send a message
  const sendMessage = useCallback(
    async (threadId: string, content: string, receiverId: string) => {
      try {
        const trimmedContent = content.trim();
        if (!trimmedContent) {
          throw new Error('メッセージを入力してください');
        }

        if (trimmedContent.length > 2000) {
          throw new Error('メッセージは2000文字以内で入力してください');
        }

        const { error: sendError } = await supabase.from('messages').insert({
          thread_id: threadId,
          sender_id: userId,
          receiver_id: receiverId,
          content: trimmedContent,
        });

        if (sendError) throw sendError;

        // Refresh messages for this thread
        await fetchMessages(threadId);
        await fetchThreads(); // Update thread list with new last message

        return { success: true, error: null };
      } catch (err) {
        console.error('Error sending message:', err);
        return {
          success: false,
          error: err instanceof Error ? err.message : 'メッセージの送信に失敗しました',
        };
      }
    },
    [userId, fetchMessages, fetchThreads]
  );

  // Mark message as read
  const markAsRead = useCallback(async (messageId: string) => {
    try {
      const { error } = await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('id', messageId)
        .eq('receiver_id', userId);

      if (error) throw error;
    } catch (err) {
      console.error('Error marking message as read:', err);
    }
  }, [userId]);

  // Mark all messages in a thread as read
  const markThreadAsRead = useCallback(async (threadId: string) => {
    try {
      const { error } = await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('thread_id', threadId)
        .eq('receiver_id', userId)
        .eq('is_read', false);

      if (error) throw error;

      // Refresh threads to update unread counts
      await fetchThreads();
    } catch (err) {
      console.error('Error marking thread as read:', err);
    }
  }, [userId, fetchThreads]);

  // Subscribe to realtime updates for active thread only
  useEffect(() => {
    if (!activeThreadId) return;

    let channel: RealtimeChannel;

    const setupRealtimeSubscription = async () => {
      channel = supabase
        .channel(`messages:${activeThreadId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `thread_id=eq.${activeThreadId}`,
          },
          () => {
            fetchMessages(activeThreadId);
            fetchThreads(); // Update thread list
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'messages',
            filter: `thread_id=eq.${activeThreadId}`,
          },
          () => {
            fetchMessages(activeThreadId);
          }
        )
        .subscribe();
    };

    setupRealtimeSubscription();

    return () => {
      if (channel) {
        channel.unsubscribe();
      }
    };
  }, [activeThreadId, fetchMessages, fetchThreads]);

  // Initial fetch
  useEffect(() => {
    if (userId) {
      fetchThreads();
    }
  }, [userId, fetchThreads]);

  // Get total unread count across all threads
  const totalUnreadCount = useMemo(() => {
    return threads.reduce((sum, thread) => sum + (thread.unread_count || 0), 0);
  }, [threads]);

  return {
    threads,
    messages,
    loading,
    error,
    activeThreadId,
    setActiveThreadId,
    totalUnreadCount,
    getOrCreateThread,
    sendMessage,
    markAsRead,
    markThreadAsRead,
    fetchMessages,
    refreshThreads: fetchThreads,
  };
}
