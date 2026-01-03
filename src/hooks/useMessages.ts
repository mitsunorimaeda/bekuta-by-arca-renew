// src/hooks/useMessages.ts
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "../lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useRealtimeHub } from "./useRealtimeHub";

const ENABLE_REALTIME = import.meta.env.VITE_ENABLE_REALTIME === "true";

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

  const { state, registerPollJob } = useRealtimeHub();

  // ✅ active thread の realtime channel（多重subscribe防止）
  const channelRef = useRef<RealtimeChannel | null>(null);

  // ✅ Hub poll unregister
  const unregisterThreadsPollRef = useRef<null | (() => void)>(null);
  const unregisterActivePollRef = useRef<null | (() => void)>(null);

  // ✅ hookインスタンス固有ID（key衝突回避）
  const instanceIdRef = useRef(
    globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)
  );

  // ✅ 多重fetchガード（Hub tickの並列実行対策）
  const inflightThreadsRef = useRef(false);
  const inflightMessagesRef = useRef<Record<string, boolean>>({});

  const cleanupChannel = useCallback(() => {
    const ch = channelRef.current;
    if (!ch) return;
    try {
      ch.unsubscribe?.();
    } catch (_) {}
    try {
      supabase.removeChannel(ch);
    } catch (_) {}
    channelRef.current = null;
  }, []);

  // -----------------------------
  // Fetch threads
  // -----------------------------
  const fetchThreads = useCallback(async () => {
    if (!userId) return;
    if (inflightThreadsRef.current) return;
    inflightThreadsRef.current = true;

    try {
      const { data: threadsData, error: threadsError } = await supabase
        .from("message_threads")
        .select(
          `
          id,
          participant1_id,
          participant2_id,
          last_message_at,
          created_at
        `
        )
        .or(`participant1_id.eq.${userId},participant2_id.eq.${userId}`)
        .order("last_message_at", { ascending: false });

      if (threadsError) throw threadsError;

      // N+1は将来 view/RPC で最適化できる。今は安全性優先で現状踏襲。
      const threadsWithDetails = await Promise.all(
        (threadsData || []).map(async (thread) => {
          const otherUserId =
            thread.participant1_id === userId ? thread.participant2_id : thread.participant1_id;

          const { data: userData } = await supabase
            .from("users")
            .select("id, name, email, role")
            .eq("id", otherUserId)
            .single();

          const { count } = await supabase
            .from("messages")
            .select("*", { count: "exact", head: true })
            .eq("thread_id", thread.id)
            .eq("receiver_id", userId)
            .eq("is_read", false);

          const { data: lastMessage } = await supabase
            .from("messages")
            .select("content")
            .eq("thread_id", thread.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

          return {
            ...thread,
            other_user: userData || undefined,
            unread_count: count || 0,
            last_message_preview: lastMessage?.content,
          } as MessageThread;
        })
      );

      setThreads(threadsWithDetails);
      setError(null);
    } catch (err) {
      console.error("[useMessages] fetchThreads error:", err);
      setError(err instanceof Error ? err.message : "スレッドの取得に失敗しました");
    } finally {
      inflightThreadsRef.current = false;
    }
  }, [userId]);

  // -----------------------------
  // Fetch messages（thread単位）
  // -----------------------------
  const fetchMessages = useCallback(async (threadId: string) => {
    if (!threadId) return;

    if (inflightMessagesRef.current[threadId]) return;
    inflightMessagesRef.current[threadId] = true;

    try {
      const { data: messagesData, error: messagesError } = await supabase
        .from("messages")
        .select(
          `
          id,
          thread_id,
          sender_id,
          receiver_id,
          content,
          is_read,
          created_at,
          updated_at,
          sender:users!messages_sender_id_fkey(id, name, email)
        `
        )
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true })
        .limit(100);

      if (messagesError) throw messagesError;

      setMessages((prev) => ({
        ...prev,
        [threadId]: messagesData || [],
      }));
    } catch (err) {
      console.error("[useMessages] fetchMessages error:", err);
      setError(err instanceof Error ? err.message : "メッセージの取得に失敗しました");
    } finally {
      inflightMessagesRef.current[threadId] = false;
    }
  }, []);

  // -----------------------------
  // Create or get thread
  // -----------------------------
  const getOrCreateThread = useCallback(
    async (otherUserId: string) => {
      const [participant1, participant2] = [userId, otherUserId].sort();

      const { data: userOrgs } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", userId);

      const { data: otherUserOrgs } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", otherUserId);

      if (!userOrgs || userOrgs.length === 0) {
        throw new Error(
          "あなたは組織に所属していません。メッセージを送信するには組織に所属する必要があります。"
        );
      }
      if (!otherUserOrgs || otherUserOrgs.length === 0) {
        throw new Error("相手が組織に所属していません。");
      }

      const userOrgIds = userOrgs.map((o) => o.organization_id);
      const otherUserOrgIds = otherUserOrgs.map((o) => o.organization_id);
      const commonOrgs = userOrgIds.filter((id) => otherUserOrgIds.includes(id));
      if (commonOrgs.length === 0) {
        throw new Error(
          "相手と同じ組織に所属していません。同じ組織のメンバーとのみメッセージのやり取りができます。"
        );
      }

      const { data: existingThread, error: findError } = await supabase
        .from("message_threads")
        .select("id")
        .eq("participant1_id", participant1)
        .eq("participant2_id", participant2)
        .maybeSingle();

      if (findError) throw new Error("既存のスレッド検索に失敗しました: " + findError.message);
      if (existingThread) return existingThread.id;

      const { data: newThread, error: createError } = await supabase
        .from("message_threads")
        .insert({
          participant1_id: participant1,
          participant2_id: participant2,
        })
        .select("id")
        .single();

      if (createError) throw new Error("スレッド作成に失敗しました: " + createError.message);

      await fetchThreads();
      return newThread.id;
    },
    [userId, fetchThreads]
  );

  // -----------------------------
  // Send message
  // -----------------------------
  const sendMessage = useCallback(
    async (threadId: string, content: string, receiverId: string) => {
      try {
        const trimmedContent = content.trim();
        if (!trimmedContent) throw new Error("メッセージを入力してください");
        if (trimmedContent.length > 2000) throw new Error("メッセージは2000文字以内で入力してください");

        const { error: sendError } = await supabase.from("messages").insert({
          thread_id: threadId,
          sender_id: userId,
          receiver_id: receiverId,
          content: trimmedContent,
        });

        if (sendError) throw sendError;

        await Promise.all([fetchMessages(threadId), fetchThreads()]);
        return { success: true, error: null };
      } catch (err) {
        console.error("[useMessages] sendMessage error:", err);
        return {
          success: false,
          error: err instanceof Error ? err.message : "メッセージの送信に失敗しました",
        };
      }
    },
    [userId, fetchMessages, fetchThreads]
  );

  // -----------------------------
  // Read
  // -----------------------------
  const markAsRead = useCallback(
    async (messageId: string) => {
      try {
        const { error } = await supabase
          .from("messages")
          .update({ is_read: true })
          .eq("id", messageId)
          .eq("receiver_id", userId);

        if (error) throw error;
      } catch (err) {
        console.error("[useMessages] markAsRead error:", err);
      }
    },
    [userId]
  );

  const markThreadAsRead = useCallback(
    async (threadId: string) => {
      try {
        const { error } = await supabase
          .from("messages")
          .update({ is_read: true })
          .eq("thread_id", threadId)
          .eq("receiver_id", userId)
          .eq("is_read", false);

        if (error) throw error;
        await fetchThreads();
      } catch (err) {
        console.error("[useMessages] markThreadAsRead error:", err);
      }
    },
    [userId, fetchThreads]
  );

  // -----------------------------
  // 初回ロード
  // -----------------------------
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!userId) {
        setLoading(false);
        setThreads([]);
        setMessages({});
        setActiveThreadId(null);
        setError(null);
        return;
      }

      setLoading(true);
      await fetchThreads();
      if (!cancelled) setLoading(false);
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [userId, fetchThreads]);

  // -----------------------------
  // Hubポーリング：threads（120秒）
  // -----------------------------
  useEffect(() => {
    if (unregisterThreadsPollRef.current) {
      unregisterThreadsPollRef.current();
      unregisterThreadsPollRef.current = null;
    }
    if (!userId) return;

    const key = `messages:threads:${userId}:${instanceIdRef.current}`;
    const unregister = registerPollJob({
      key,
      intervalMs: 120000,
      run: fetchThreads,
      enabled: true,
      requireVisible: true,
      requireOnline: true,
      immediate: false,
    });

    unregisterThreadsPollRef.current = unregister;

    return () => {
      if (unregisterThreadsPollRef.current) {
        unregisterThreadsPollRef.current();
        unregisterThreadsPollRef.current = null;
      }
    };
  }, [userId, registerPollJob, fetchThreads]);

  // -----------------------------
  // Hubポーリング：active thread（30秒）
  // ✅ Realtimeが使える時は止めて、落ちた時だけ保険で動く
  // -----------------------------
  const canUseRealtime =
    !!userId && !!activeThreadId && ENABLE_REALTIME && state.canRealtime;

  useEffect(() => {
    if (unregisterActivePollRef.current) {
      unregisterActivePollRef.current();
      unregisterActivePollRef.current = null;
    }

    if (!userId || !activeThreadId) return;

    const key = `messages:active:${activeThreadId}:${instanceIdRef.current}`;
    const unregister = registerPollJob({
      key,
      intervalMs: 30000,
      run: async () => {
        await fetchMessages(activeThreadId);
      },
      enabled: !canUseRealtime,     // ✅ ここが大事
      requireVisible: true,
      requireOnline: true,
      immediate: true,              // active切替時は即取得
    });

    unregisterActivePollRef.current = unregister;

    return () => {
      if (unregisterActivePollRef.current) {
        unregisterActivePollRef.current();
        unregisterActivePollRef.current = null;
      }
    };
  }, [userId, activeThreadId, registerPollJob, fetchMessages, canUseRealtime]);

  // -----------------------------
  // Realtime：active thread のみ（Hub許可のときだけ）
  // -----------------------------
  useEffect(() => {
    cleanupChannel();

    if (!canUseRealtime) return;

    const channel = supabase
      .channel(`messages:${activeThreadId}:${instanceIdRef.current}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `thread_id=eq.${activeThreadId}`,
        },
        () => {
          fetchMessages(activeThreadId);
          fetchThreads();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `thread_id=eq.${activeThreadId}`,
        },
        () => {
          fetchMessages(activeThreadId);
        }
      );

    channelRef.current = channel;

    channel.subscribe((status) => {
      if (import.meta.env.DEV) console.log("[useMessages] realtime status", status);

      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.warn("[useMessages] realtime issue:", status);
        cleanupChannel(); // pollが保険で生きる
      }
    });

    return () => {
      cleanupChannel();
    };
  }, [activeThreadId, canUseRealtime, fetchMessages, fetchThreads, cleanupChannel]);

  // -----------------------------
  // Unread count
  // -----------------------------
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