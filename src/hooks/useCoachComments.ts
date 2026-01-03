// src/hooks/useCoachComments.ts
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { useRealtimeHub } from "./useRealtimeHub";

// 既存の型が別ファイルにあるなら import に置き換えてOK
// export interface CoachComment { ... }

const ENABLE_REALTIME = import.meta.env.VITE_ENABLE_REALTIME === "true";

type UserRole = "athlete" | "staff";

type Options = {
  enabled?: boolean;
  pollMs?: number;            // realtime無効時に使うポーリング間隔（例: 120000）
  pauseWhenHidden?: boolean;  // true推奨
};

export function useCoachComments(
  userId: string,
  userRole: UserRole = "athlete",
  options: Options = {}
) {
  const enabled = options.enabled ?? true;
  const pollMs = options.pollMs ?? 0;
  const pauseWhenHidden = options.pauseWhenHidden ?? true;

  const [comments, setComments] = useState<CoachComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { state, registerPollJob } = useRealtimeHub();

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, [userId, userRole]);

  // hookインスタンス固有ID（衝突回避）
  const instanceIdRef = useRef(
    globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)
  );

  const channelRef = useRef<RealtimeChannel | null>(null);
  const unregisterPollRef = useRef<null | (() => void)>(null);
  const inflightRef = useRef(false);

  const cleanupRealtime = useCallback(() => {
    const ch = channelRef.current;
    if (!ch) return;
    try { ch.unsubscribe?.(); } catch (_) {}
    try { supabase.removeChannel(ch); } catch (_) {}
    channelRef.current = null;
  }, []);

  const cleanupPoll = useCallback(() => {
    if (unregisterPollRef.current) {
      unregisterPollRef.current();
      unregisterPollRef.current = null;
    }
  }, []);

  const fetchComments = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!userId || !enabled) return;
      if (inflightRef.current) return;
      inflightRef.current = true;

      const silent = opts?.silent ?? false;

      try {
        if (!silent && mountedRef.current) setLoading(true);

        const query = supabase
          .from("coach_comments")
          .select(
            `
            *,
            coach:users!coach_comments_coach_id_fkey(id, name, email)
          `
          )
          .order("created_at", { ascending: false });

        if (userRole === "athlete") {
          query.eq("athlete_id", userId);
        } else {
          query.eq("coach_id", userId);
        }

        const { data, error } = await query;
        if (error) throw error;

        if (!mountedRef.current) return;
        setComments((data ?? []) as CoachComment[]);
        setError(null);
      } catch (e: any) {
        if (!mountedRef.current) return;
        console.error("[useCoachComments] fetch error:", e);
        setError(e?.message ?? "コメントの取得に失敗しました");
      } finally {
        inflightRef.current = false;
        if (!silent && mountedRef.current) setLoading(false);
      }
    },
    [userId, userRole, enabled]
  );

  // -----------------------------
  // 初期ロード（ユーザー切替/無効化に強い）
  // -----------------------------
  useEffect(() => {
    cleanupRealtime();
    cleanupPoll();
  
    if (!userId || !enabled) {
      setLoading(false);
      return;
    }
  
    void fetchComments({ silent: false });
  }, [userId, userRole, enabled, fetchComments, cleanupRealtime, cleanupPoll]);

  // -----------------------------
  // ✅ Realtime（Hub許可のときだけ）
  // -----------------------------
  useEffect(() => {
    cleanupRealtime();

    const canUseRealtime =
      !!userId && enabled && ENABLE_REALTIME && state.canRealtime;

    if (!canUseRealtime) return;

    const filter =
      userRole === "athlete"
        ? `athlete_id=eq.${userId}`
        : `coach_id=eq.${userId}`;

    const chName = `coach-comments:${userRole}:${userId}:${instanceIdRef.current}`;

    const ch = supabase
      .channel(chName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "coach_comments", filter },
        () => {
          void fetchComments({ silent: true });
        }
      );

    channelRef.current = ch;

    ch.subscribe((status) => {
      if (import.meta.env.DEV) console.log("[useCoachComments] realtime status", chName, status);
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.warn("[useCoachComments] realtime issue:", status);
        cleanupRealtime();
      }
    });

    return () => cleanupRealtime();
  }, [userId, userRole, enabled, state.canRealtime, fetchComments, cleanupRealtime]);

  // -----------------------------
  // ✅ Hubポーリング（Realtimeが使えない時だけ）
  // -----------------------------
  useEffect(() => {
    cleanupPoll();

    const shouldPoll =
      !!userId &&
      enabled &&
      pollMs > 0 &&
      (!ENABLE_REALTIME || !state.canRealtime);

    if (!shouldPoll) return;

    const key = `coach_comments:${userRole}:${userId}:${instanceIdRef.current}`;

    const unregister = registerPollJob({
      key,
      intervalMs: pollMs,
      run: async () => {
        await fetchComments({ silent: true });
      },
      enabled: true,
      requireVisible: pauseWhenHidden,
      requireOnline: true,
      immediate: false, // 初回は上のuseEffectで取得済み
    });

    unregisterPollRef.current = unregister;

    return () => cleanupPoll();
  }, [
    userId,
    userRole,
    enabled,
    pollMs,
    pauseWhenHidden,
    state.canRealtime,
    registerPollJob,
    fetchComments,
    cleanupPoll,
  ]);

  return {
    comments,
    loading,
    error,
    refresh: async () => {
      await fetchComments({ silent: false });
    },
  };
}