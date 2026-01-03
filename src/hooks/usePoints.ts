// src/hooks/usePoints.ts
import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { useRealtimeHub } from "./useRealtimeHub";

const ENABLE_REALTIME = import.meta.env.VITE_ENABLE_REALTIME === "true";

// 必要ならあなたの型に置換してOK
export type UserPoints = any;
export type PointTransaction = any;

type Options = {
  includeTransactions?: boolean; // 初回で履歴も取るか（デフォ false）
  transactionsLimit?: number; // 例: 50
};

export function usePoints(userId: string | null | undefined, options: Options = {}) {
  const includeTransactions = options.includeTransactions ?? false;
  const transactionsLimit = options.transactionsLimit ?? 50;

  const [userPoints, setUserPoints] = useState<UserPoints | null>(null);
  const [transactions, setTransactions] = useState<PointTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ✅ 「一度でも履歴を取ったか」を state でも持つ（UI/分岐に使える）
  const [hasLoadedTransactions, setHasLoadedTransactions] = useState(false);

  const { state } = useRealtimeHub();

  const mountedRef = useRef(true);
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const instanceIdRef = useRef(
    globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)
  );

  const pointsChannelRef = useRef<RealtimeChannel | null>(null);
  const txChannelRef = useRef<RealtimeChannel | null>(null);

  const fetchedTxOnceRef = useRef(false);
  const inflightPointsRef = useRef(false);
  const inflightTxRef = useRef(false);

  const cleanupPointsRealtime = useCallback(() => {
    const ch = pointsChannelRef.current;
    if (!ch) return;
    try { ch.unsubscribe?.(); } catch (_) {}
    try { supabase.removeChannel(ch); } catch (_) {}
    pointsChannelRef.current = null;
  }, []);

  const cleanupTxRealtime = useCallback(() => {
    const ch = txChannelRef.current;
    if (!ch) return;
    try { ch.unsubscribe?.(); } catch (_) {}
    try { supabase.removeChannel(ch); } catch (_) {}
    txChannelRef.current = null;
  }, []);

  const fetchUserPoints = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!userId) return;
      if (inflightPointsRef.current) return;
      inflightPointsRef.current = true;

      const silent = opts?.silent ?? false;

      try {
        if (!silent && mountedRef.current) setLoading(true);

        const res = await supabase
          .from("user_points")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle();

        if (res.error) throw res.error;

        if (!mountedRef.current) return;
        setUserPoints(res.data ?? null);
        setError(null);
      } catch (e: any) {
        if (!mountedRef.current) return;
        console.error("[usePoints] fetch user_points error:", e);
        setError(e?.message ?? "ポイント情報の取得に失敗しました");
      } finally {
        inflightPointsRef.current = false;
        if (!silent && mountedRef.current) setLoading(false);
      }
    },
    [userId]
  );

  const fetchTransactions = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!userId) return;
      if (inflightTxRef.current) return;
      inflightTxRef.current = true;

      const silent = opts?.silent ?? false;

      try {
        if (!silent && mountedRef.current) setTransactionsLoading(true);

        // ✅ ここが400の原因になりやすいので、存在するカラムだけを列挙（あなたの一覧に合わせ済み）
        const res = await supabase
          .from("point_transactions")
          .select("id,user_id,points,reason,category,metadata,created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(transactionsLimit);

        if (res.error) throw res.error;

        if (!mountedRef.current) return;
        setTransactions((res.data ?? []) as PointTransaction[]);
        setError(null);

        fetchedTxOnceRef.current = true;
        setHasLoadedTransactions(true);
      } catch (e: any) {
        if (!mountedRef.current) return;
        console.error("[usePoints] fetch point_transactions error:", e);
        setError(e?.message ?? "ポイント履歴の取得に失敗しました");
      } finally {
        inflightTxRef.current = false;
        if (!silent && mountedRef.current) setTransactionsLoading(false);
      }
    },
    [userId, transactionsLimit]
  );

  // ✅ 外部から「必要なときだけ」呼ぶ用
  const loadTransactions = useCallback(
    async (opts?: { silent?: boolean }) => {
      await fetchTransactions({ silent: opts?.silent ?? false });
    },
    [fetchTransactions]
  );

  // 初期ロード：user_points は必須 / transactions は任意
  useEffect(() => {
    cleanupPointsRealtime();
    cleanupTxRealtime();

    if (!userId) {
      setLoading(false);
      setTransactions([]);
      setHasLoadedTransactions(false);
      fetchedTxOnceRef.current = false;
      return;
    }

    void fetchUserPoints({ silent: false });

    if (includeTransactions) {
      void fetchTransactions({ silent: false });
    } else {
      setTransactions([]);
      setHasLoadedTransactions(false);
      fetchedTxOnceRef.current = false;
    }
  }, [
    userId,
    includeTransactions,
    fetchUserPoints,
    fetchTransactions,
    cleanupPointsRealtime,
    cleanupTxRealtime,
  ]);

  // Realtime：user_points
  useEffect(() => {
    cleanupPointsRealtime();

    const canUseRealtime = !!userId && ENABLE_REALTIME && state.canRealtime;
    if (!canUseRealtime) return;

    const chName = `user-points:${userId}:${instanceIdRef.current}`;
    const ch = supabase
      .channel(chName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_points", filter: `user_id=eq.${userId}` },
        () => { void fetchUserPoints({ silent: true }); }
      );

    pointsChannelRef.current = ch;

    ch.subscribe((status) => {
      if (import.meta.env.DEV) console.log("[usePoints] realtime status", chName, status);
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.warn("[usePoints] realtime issue:", chName, status);
        cleanupPointsRealtime();
      }
    });

    return () => cleanupPointsRealtime();
  }, [userId, state.canRealtime, fetchUserPoints, cleanupPointsRealtime]);

  // Realtime：transactions は「一度でも読み込んだ後」だけ購読
  useEffect(() => {
    cleanupTxRealtime();

    const canUseRealtime =
      !!userId &&
      ENABLE_REALTIME &&
      state.canRealtime &&
      fetchedTxOnceRef.current;

    if (!canUseRealtime) return;

    const chName = `point-tx:${userId}:${instanceIdRef.current}`;
    const ch = supabase
      .channel(chName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "point_transactions", filter: `user_id=eq.${userId}` },
        () => { void fetchTransactions({ silent: true }); }
      );

    txChannelRef.current = ch;

    ch.subscribe((status) => {
      if (import.meta.env.DEV) console.log("[usePoints] tx realtime status", chName, status);
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.warn("[usePoints] tx realtime issue:", chName, status);
        cleanupTxRealtime();
      }
    });

    return () => cleanupTxRealtime();
  }, [userId, state.canRealtime, fetchTransactions, cleanupTxRealtime]);

  const getLevelProgress = useCallback(() => {
    const p = (userPoints as any)?.current_points ?? 0;
    const next = (userPoints as any)?.points_to_next ?? 0;
    if (!next) return 0;
    return Math.max(0, Math.min(100, Math.round((p / next) * 100)));
  }, [userPoints]);

  const awardPoints = useCallback(
    async (payload: any) => {
      const { error } = await supabase.rpc("award_points", payload);
      if (error) throw error;

      await fetchUserPoints({ silent: true });
      if (fetchedTxOnceRef.current) {
        await fetchTransactions({ silent: true });
      }
    },
    [fetchUserPoints, fetchTransactions]
  );

  return {
    userPoints,
    transactions,
    loading,
    transactionsLoading,
    error,

    getLevelProgress,
    awardPoints,

    loadTransactions,
    hasLoadedTransactions,
  };
}