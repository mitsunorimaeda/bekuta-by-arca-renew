// src/hooks/useRankings.ts
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { useRealtimeHub } from "./useRealtimeHub";

export type WeeklyRanking = any;  // 既存型があるなら置き換えOK
export type PointsRanking = any;  // 既存型があるなら置き換えOK

type Options = {
  enabled?: boolean;
  pollMs?: number;            // ポーリング間隔（例: 120000）
  pauseWhenHidden?: boolean;  // true推奨
};

export function useRankings(teamId: string | null | undefined, options: Options = {}) {
  const enabled = options.enabled ?? true;
  const pollMs = options.pollMs ?? 120000;
  const pauseWhenHidden = options.pauseWhenHidden ?? true;

  const [weeklyRankings, setWeeklyRankings] = useState<WeeklyRanking[]>([]);
  const [pointsRankings, setPointsRankings] = useState<PointsRanking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { registerPollJob } = useRealtimeHub();

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // hookインスタンス固有ID（poll key 衝突回避）
  const instanceIdRef = useRef(
    globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)
  );

  const unregisterPollRef = useRef<null | (() => void)>(null);
  const inflightRef = useRef(false);

  const cleanupPoll = useCallback(() => {
    if (unregisterPollRef.current) {
      unregisterPollRef.current();
      unregisterPollRef.current = null;
    }
  }, []);

  const fetchRankings = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!teamId || !enabled) return;
      if (inflightRef.current) return;
      inflightRef.current = true;

      const silent = opts?.silent ?? false;

      try {
        if (!silent && mountedRef.current) setLoading(true);

        const [w, p] = await Promise.all([
          supabase
            .from("team_weekly_rankings")
            .select("*")
            .eq("team_id", teamId)
            .order("rank", { ascending: true }),
          supabase
            .from("team_points_rankings")
            .select("*")
            .eq("team_id", teamId)
            .order("rank", { ascending: true }),
        ]);

        if (w.error) throw w.error;
        if (p.error) throw p.error;

        if (!mountedRef.current) return;
        setWeeklyRankings((w.data ?? []) as WeeklyRanking[]);
        setPointsRankings((p.data ?? []) as PointsRanking[]);
        setError(null);
      } catch (e: any) {
        if (!mountedRef.current) return;
        console.error("[useRankings] fetch error:", e);
        setError(e?.message ?? "ランキングの取得に失敗しました");
      } finally {
        inflightRef.current = false;
        if (!silent && mountedRef.current) setLoading(false);
      }
    },
    [teamId, enabled]
  );

  // -----------------------------
  // 初期ロード（team切替/無効化に強い）
  // -----------------------------
  useEffect(() => {
    cleanupPoll();

    if (!teamId || !enabled) {
      // 表示対象なしなら空にして終了
      setWeeklyRankings([]);
      setPointsRankings([]);
      setError(null);
      setLoading(false);
      return;
    }

    void fetchRankings({ silent: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, enabled]);

  // -----------------------------
  // ✅ ポーリング（VIEW前提の正攻法）
  // -----------------------------
  useEffect(() => {
    cleanupPoll();

    const shouldPoll = !!teamId && enabled && pollMs > 0;
    if (!shouldPoll) return;

    const key = `rankings:${teamId}:${instanceIdRef.current}`;

    const unregister = registerPollJob({
      key,
      intervalMs: pollMs,
      run: async () => {
        await fetchRankings({ silent: true });
      },
      enabled: true,
      requireVisible: pauseWhenHidden,
      requireOnline: true,
      immediate: false, // 初回は上の useEffect で取得済み
    });

    unregisterPollRef.current = unregister;
    return () => cleanupPoll();
  }, [teamId, enabled, pollMs, pauseWhenHidden, registerPollJob, fetchRankings, cleanupPoll]);

  return {
    weeklyRankings,
    pointsRankings,
    loading,
    error,
    refresh: async () => {
      await fetchRankings({ silent: false });
    },
  };
}