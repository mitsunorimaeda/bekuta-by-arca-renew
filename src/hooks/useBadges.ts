// src/hooks/useBadges.ts
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { useRealtimeHub } from "./useRealtimeHub";

const ENABLE_REALTIME = import.meta.env.VITE_ENABLE_REALTIME === "true";

type Options = {
  enabled?: boolean;
  pollMs?: number;
  pauseWhenHidden?: boolean;
};

export function useBadges(userId: string, options: Options = {}) {
  const enabled = options.enabled ?? true;
  const pollMs = options.pollMs ?? 0;
  const pauseWhenHidden = options.pauseWhenHidden ?? true;

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, [userId]);

  const [allBadges, setAllBadges] = useState<any[]>([]);
  const [userBadges, setUserBadges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { state, registerPollJob } = useRealtimeHub();

  const instanceId = useMemo(
    () => globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2),
    []
  );

  const channelRef = useRef<RealtimeChannel | null>(null);
  const unregisterPollRef = useRef<null | (() => void)>(null);

  const badgesLoadedRef = useRef(false);
  const inflightRef = useRef(false);

  const cleanupRealtime = useCallback(() => {
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

  const cleanupPoll = useCallback(() => {
    if (unregisterPollRef.current) {
      unregisterPollRef.current();
      unregisterPollRef.current = null;
    }
  }, []);

  const fetchBadges = useCallback(async () => {
    const { data, error } = await supabase.from("badges").select("*").order("sort_order");
    if (error) throw error;
    if (!mountedRef.current) return;
    setAllBadges(data ?? []);
  }, []);

  const fetchUserBadges = useCallback(async () => {
    if (!userId || !enabled) return;

    if (inflightRef.current) return;
    inflightRef.current = true;

    try {
      const { data, error } = await supabase
        .from("user_badges")
        .select(`*, badge:badges(*)`)
        .eq("user_id", userId)
        .order("earned_at", { ascending: false });

      if (error) throw error;

      if (!mountedRef.current) return;
      setUserBadges(data ?? []);
      setError(null);
    } catch (e: any) {
      if (!mountedRef.current) return;
      setError(e?.message ?? "バッジの取得に失敗しました");
    } finally {
      inflightRef.current = false;
    }
  }, [userId, enabled]);

  // ✅ あなたのDB設計では「新規」は is_new
  // （互換として viewed_at / is_viewed / viewed も見ておく）
  const getNewBadges = useCallback(() => {
    return (userBadges ?? []).filter((ub: any) => {
      if (typeof ub?.is_new === "boolean") return ub.is_new === true;

      // 互換（将来/別環境用）
      const viewedAt = ub?.viewed_at;
      const isViewed = ub?.is_viewed ?? ub?.viewed ?? false;
      return !viewedAt && !isViewed;
    });
  }, [userBadges]);

  const getBadgeProgress = useCallback(() => {
    const earned = (userBadges ?? []).length;
    const total = (allBadges ?? []).length;
    const percentage = total > 0 ? Math.round((earned / total) * 100) : 0;
    return { earned, total, percentage };
  }, [userBadges, allBadges]);

  // ✅ 既読化：まず is_new=false（あなたの本番/ローカルの正解）
  // 互換で viewed_at / is_viewed / viewed にもフォールバック
  const markBadgeAsViewed = useCallback(
    async (userBadgeId: string) => {
      if (!userBadgeId) return;

      // ① 正攻法（あなたの schema）
      const r0 = await supabase
        .from("user_badges")
        .update({ is_new: false } as any)
        .eq("id", userBadgeId);

      if (!r0.error) {
        // 体感を良くする：ローカルも先に更新（任意だけどおすすめ）
        setUserBadges((prev) =>
          (prev ?? []).map((ub: any) => (ub?.id === userBadgeId ? { ...ub, is_new: false } : ub))
        );
        await fetchUserBadges();
        return;
      }

      // ② 互換（viewed_at がある世界）
      const r1 = await supabase
        .from("user_badges")
        .update({ viewed_at: new Date().toISOString() } as any)
        .eq("id", userBadgeId);

      if (!r1.error) {
        await fetchUserBadges();
        return;
      }

      // ③ 互換（is_viewed がある世界）
      const r2 = await supabase
        .from("user_badges")
        .update({ is_viewed: true } as any)
        .eq("id", userBadgeId);

      if (!r2.error) {
        await fetchUserBadges();
        return;
      }

      // ④ 互換（viewed がある世界）
      const r3 = await supabase
        .from("user_badges")
        .update({ viewed: true } as any)
        .eq("id", userBadgeId);

      if (r3.error) {
        console.warn("[useBadges] markBadgeAsViewed failed:", r3.error);
        throw r3.error;
      }

      await fetchUserBadges();
    },
    [fetchUserBadges]
  );

  // 初期ロード
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      cleanupRealtime();
      cleanupPoll();

      if (!userId || !enabled) {
        if (mountedRef.current) setLoading(false);
        return;
      }

      try {
        if (mountedRef.current) setLoading(true);

        if (!badgesLoadedRef.current) {
          await fetchBadges();
          badgesLoadedRef.current = true;
        }

        await fetchUserBadges();
      } catch (e: any) {
        if (mountedRef.current) {
          setError(e?.message ?? "バッジの取得に失敗しました");
        }
      } finally {
        if (!cancelled && mountedRef.current) setLoading(false);
      }
    };

    void run();

    return () => {
      cancelled = true;
      cleanupRealtime();
      cleanupPoll();
    };
  }, [userId, enabled, fetchBadges, fetchUserBadges, cleanupRealtime, cleanupPoll]);

  // Realtime
  useEffect(() => {
    cleanupRealtime();

    const canUseRealtime = !!userId && enabled && ENABLE_REALTIME && state.canRealtime;
    if (!canUseRealtime) return;

    const channel = supabase
      .channel(`user-badges:${userId}:${instanceId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_badges", filter: `user_id=eq.${userId}` },
        () => {
          void fetchUserBadges();
        }
      );

    channelRef.current = channel;

    channel.subscribe((status) => {
      if (import.meta.env.DEV) console.log("[useBadges] realtime status", status);
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.warn("[useBadges] realtime issue:", status);
        cleanupRealtime();
      }
    });

    return () => cleanupRealtime();
  }, [userId, enabled, state.canRealtime, fetchUserBadges, cleanupRealtime, instanceId]);

  // Polling（Realtime無い時のみ）
  useEffect(() => {
    cleanupPoll();

    const shouldPoll =
      !!userId && enabled && pollMs > 0 && (!ENABLE_REALTIME || !state.canRealtime);

    if (!shouldPoll) return;

    const key = `badges:${userId}:${instanceId}`;
    const unregister = registerPollJob({
      key,
      intervalMs: pollMs,
      run: async () => {
        await fetchUserBadges();
      },
      enabled: true,
      requireVisible: pauseWhenHidden,
      requireOnline: true,
      immediate: false,
    });

    unregisterPollRef.current = unregister;
    return () => cleanupPoll();
  }, [
    userId,
    enabled,
    pollMs,
    pauseWhenHidden,
    state.canRealtime,
    registerPollJob,
    fetchUserBadges,
    cleanupPoll,
    instanceId,
  ]);

  return {
    allBadges,
    userBadges,
    loading,
    error,
    getNewBadges,
    getBadgeProgress,
    markBadgeAsViewed,
    refresh: async () => {
      await Promise.all([fetchBadges(), fetchUserBadges()]);
    },
  };
}