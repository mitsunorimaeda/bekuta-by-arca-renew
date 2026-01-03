// src/hooks/useStreaks.ts
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { supabase } from "../lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useRealtimeHub } from "./useRealtimeHub";

const ENABLE_REALTIME = import.meta.env.VITE_ENABLE_REALTIME === "true";

export interface Streak {
  id: string;
  user_id: string;
  streak_type: "training" | "weight" | "sleep" | "motivation" | "all";
  current_streak: number;
  longest_streak: number;
  last_recorded_date: string | null;
  streak_freeze_count: number;
  total_records: number;
}

type Options = {
  enabled?: boolean;          // falseなら取得/購読/ポーリングを止める（stateは保持）
  pollMs?: number;            // realtime無効時のポーリング間隔（例: 120000）
  pauseWhenHidden?: boolean;  // trueならタブ非表示でポーリング停止
};

export function useStreaks(userId: string, options: Options = {}) {
  const enabled = options.enabled ?? true;
  const pollMs = options.pollMs ?? 0;
  const pauseWhenHidden = options.pauseWhenHidden ?? true;

  const [streaks, setStreaks] = useState<Streak[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { state, registerPollJob } = useRealtimeHub();

  const mountedRef = useRef(true);
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // hookインスタンス固有ID（同名channel/キー衝突防止）
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

  const fetchStreaks = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!userId || !enabled) return;
      if (inflightRef.current) return;
      inflightRef.current = true;

      const silent = opts?.silent ?? false;

      try {
        if (!silent && mountedRef.current) setLoading(true);

        const { data, error } = await supabase
          .from("user_streaks")
          .select("*")
          .eq("user_id", userId)
          .order("streak_type");

        if (error) throw error;

        if (!mountedRef.current) return;
        setStreaks((data ?? []) as Streak[]);
        setError(null);
      } catch (e: any) {
        if (!mountedRef.current) return;
        setError(e?.message ?? "ストリークの取得に失敗しました");
      } finally {
        inflightRef.current = false;
        if (!silent && mountedRef.current) setLoading(false);
      }
    },
    [userId, enabled]
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

    void fetchStreaks({ silent: false });
    }, [userId, enabled, fetchStreaks, cleanupRealtime, cleanupPoll]);

    // cleanup は別effectが担当（Realtime/Poll）
    // eslint-disable-next-line react-hooks/exhaustive-deps


  // -----------------------------
  // ✅ Realtime（Hub許可のときだけ）
  // -----------------------------
  useEffect(() => {
    cleanupRealtime();

    const canUseRealtime = !!userId && enabled && ENABLE_REALTIME && state.canRealtime;
    if (!canUseRealtime) return;

    const channel = supabase
      .channel(`user-streaks:${userId}:${instanceIdRef.current}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_streaks", filter: `user_id=eq.${userId}` },
        () => {
          // Realtime更新は「静かに」再取得（loading立てない）
          void fetchStreaks({ silent: true });
        }
      );

    channelRef.current = channel;

    channel.subscribe((status) => {
      if (import.meta.env.DEV) console.log("[useStreaks] realtime status", status);
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.warn("[useStreaks] realtime issue:", status);
        cleanupRealtime();
      }
    });

    return () => cleanupRealtime();
  }, [userId, enabled, state.canRealtime, fetchStreaks, cleanupRealtime]);

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

    const key = `streaks:${userId}:${instanceIdRef.current}`;
    const unregister = registerPollJob({
      key,
      intervalMs: pollMs,
      run: async () => {
        await fetchStreaks({ silent: true });
      },
      enabled: true,
      requireVisible: pauseWhenHidden,
      requireOnline: true,
      immediate: false, // 初回は上で fetch 済み
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
    fetchStreaks,
    cleanupPoll,
  ]);

  const getStreakByType = useCallback(
    (type: Streak["streak_type"]) => streaks.find((s) => s.streak_type === type) || null,
    [streaks]
  );

  const getTotalStreak = useCallback(
    () => streaks.find((s) => s.streak_type === "all") || null,
    [streaks]
  );

  const updateStreak = useCallback(
    async (type: Streak["streak_type"], recordDate: string) => {
      if (!userId) return;

      const { error } = await supabase.rpc("update_user_streak", {
        p_user_id: userId,
        p_streak_type: type,
        p_record_date: recordDate,
      });

      if (error) throw error;

      // RPC後は即反映したいので silent でリフレッシュ
      await fetchStreaks({ silent: true });
    },
    [userId, fetchStreaks]
  );

  const isStreakAtRisk = useCallback((streak: Streak | null) => {
    if (!streak?.last_recorded_date) return false;
    const lastDate = new Date(streak.last_recorded_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    lastDate.setHours(0, 0, 0, 0);
    const daysDiff = Math.floor((today.getTime() - lastDate.getTime()) / 86400000);
    return daysDiff >= 1;
  }, []);

  const getStreakStatus = useCallback((streak: Streak | null): "safe" | "at_risk" | "broken" => {
    if (!streak?.last_recorded_date) return "broken";
    const lastDate = new Date(streak.last_recorded_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    lastDate.setHours(0, 0, 0, 0);
    const daysDiff = Math.floor((today.getTime() - lastDate.getTime()) / 86400000);
    if (daysDiff === 0) return "safe";
    if (daysDiff === 1) return "at_risk";
    return "broken";
  }, []);

  return {
    streaks,
    loading,
    error,
    getStreakByType,
    getTotalStreak,
    updateStreak,
    isStreakAtRisk,
    getStreakStatus,
    refresh: async () => {
      await fetchStreaks({ silent: false });
    },
  };
}