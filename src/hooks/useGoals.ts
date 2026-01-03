// src/hooks/useGoals.ts
import { useState, useEffect, useRef, useCallback } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { normalizeGoalMetadata } from "../lib/goalMetadata";
import { getGoalProgress } from "../lib/goalUtils";
import { useRealtimeHub } from "./useRealtimeHub";

const ENABLE_REALTIME = import.meta.env.VITE_ENABLE_REALTIME === "true";

export interface Goal {
  id: string;
  user_id: string;
  goal_type: "performance" | "weight" | "streak" | "habit" | "custom";
  title: string;
  description: string | null;
  target_value: number | null;
  current_value: number;
  unit: string | null;
  deadline: string | null;
  status: "active" | "completed" | "failed" | "abandoned";
  completed_at: string | null;
  metadata: any;
  created_at: string;
  updated_at: string;
}

type Options = {
  enabled?: boolean;
  pollMs?: number;            // realtime無効時のポーリング間隔（例: 300000）
  pauseWhenHidden?: boolean;  // trueならタブ非表示で止める
};

export function useGoals(userId: string, options: Options = {}) {
  const enabled = options.enabled ?? true;
  const pollMs = options.pollMs ?? 0;
  const pauseWhenHidden = options.pauseWhenHidden ?? true;

  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { state, registerPollJob } = useRealtimeHub();

  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

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

  const fetchGoals = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!userId || !enabled) return;
      if (inflightRef.current) return;
      inflightRef.current = true;

      const silent = opts?.silent ?? false;

      try {
        if (!silent && mountedRef.current) setLoading(true);

        const { data, error } = await supabase
          .from("user_goals")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });

        if (error) throw error;

        const normalized = (data ?? []).map((g: any) => ({
          ...g,
          metadata: normalizeGoalMetadata(g.metadata),
        }));

        if (!mountedRef.current) return;
        setGoals(normalized as Goal[]);
        setError(null);
      } catch (e: any) {
        if (!mountedRef.current) return;
        console.error("[useGoals] fetch error:", e);
        setError(e?.message ?? "目標の取得に失敗しました");
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
  
    void fetchGoals({ silent: false });
  }, [userId, enabled, fetchGoals, cleanupRealtime, cleanupPoll]);

  // -----------------------------
  // ✅ Realtime（Hub許可のときだけ）
  // -----------------------------
  useEffect(() => {
    cleanupRealtime();

    const canUseRealtime =
      !!userId && enabled && ENABLE_REALTIME && state.canRealtime;

    if (!canUseRealtime) return;

    const chName = `goals:${userId}:${instanceIdRef.current}`;

    const ch = supabase
      .channel(chName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_goals", filter: `user_id=eq.${userId}` },
        () => {
          void fetchGoals({ silent: true });
        }
      );

    channelRef.current = ch;

    ch.subscribe((status) => {
      if (import.meta.env.DEV) console.log("[useGoals] realtime status", chName, status);
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.warn("[useGoals] realtime issue:", status);
        cleanupRealtime();
      }
    });

    return () => cleanupRealtime();
  }, [userId, enabled, state.canRealtime, fetchGoals, cleanupRealtime]);

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

    const key = `goals:${userId}:${instanceIdRef.current}`;
    const unregister = registerPollJob({
      key,
      intervalMs: pollMs,
      run: async () => {
        await fetchGoals({ silent: true });
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
    enabled,
    pollMs,
    pauseWhenHidden,
    state.canRealtime,
    registerPollJob,
    fetchGoals,
    cleanupPoll,
  ]);

  // -----------------------------
  // CRUD
  // -----------------------------
  const createGoal = async (goalData: Partial<Goal>) => {
    try {
      const { data, error } = await supabase
        .from("user_goals")
        .insert({
          user_id: userId,
          ...goalData,
          current_value: goalData.current_value ?? 0,
          status: "active",
          metadata: normalizeGoalMetadata(goalData.metadata),
        })
        .select()
        .single();

      if (error) throw error;

      await fetchGoals({ silent: true });
      return { data, error: null };
    } catch (err) {
      console.error(err);
      return { data: null, error: "目標の作成に失敗しました" };
    }
  };

  const updateGoal = async (goalId: string, updates: Partial<Goal>) => {
    try {
      const { error } = await supabase
        .from("user_goals")
        .update({
          ...updates,
          metadata: updates.metadata ? normalizeGoalMetadata(updates.metadata) : undefined,
        })
        .eq("id", goalId)
        .eq("user_id", userId);

      if (error) throw error;

      await fetchGoals({ silent: true });
      return { error: null };
    } catch {
      return { error: "目標の更新に失敗しました" };
    }
  };

  const updateGoalProgress = async (goalId: string, currentValue: number) => {
    const goal = goals.find((g) => g.id === goalId);
    if (!goal) return { error: "目標が見つかりません" };

    const progress = getGoalProgress({ ...goal, current_value: currentValue });

    const updates: Partial<Goal> = {
      current_value: currentValue,
      ...(progress.is_completed
        ? { status: "completed", completed_at: new Date().toISOString() }
        : {}),
    };

    return await updateGoal(goalId, updates);
  };

  const deleteGoal = async (goalId: string) => {
    try {
      const { error } = await supabase
        .from("user_goals")
        .delete()
        .eq("id", goalId)
        .eq("user_id", userId);

      if (error) throw error;

      await fetchGoals({ silent: true });
      return { error: null };
    } catch {
      return { error: "目標の削除に失敗しました" };
    }
  };

  function getActiveGoals() {
    return goals.filter((g) => g.status === "active");
  }

  function calculateGoalProgress(goal: Goal) {
    return getGoalProgress(goal);
  }

  function getDaysUntilDeadline(goal: Goal) {
    if (!goal.deadline) return null;
    const now = new Date();
    const deadline = new Date(goal.deadline);
    const diff = deadline.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  function isGoalOverdue(goal: Goal) {
    if (!goal.deadline) return false;
    return new Date(goal.deadline) < new Date() && goal.status !== "completed";
  }

  async function completeGoal(goalId: string) {
    return await updateGoal(goalId, {
      status: "completed",
      completed_at: new Date().toISOString(),
    });
  }

  return {
    goals,
    loading,
    error,
    createGoal,
    updateGoal,
    updateGoalProgress,
    deleteGoal,
    refresh: async () => {
      await fetchGoals({ silent: false });
    },
    getActiveGoals,
    getGoalProgress: calculateGoalProgress,
    getDaysUntilDeadline,
    isGoalOverdue,
    completeGoal,
  };
}