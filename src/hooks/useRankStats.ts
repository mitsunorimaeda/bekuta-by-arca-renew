// src/hooks/useRankStats.ts
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { useRealtimeHub } from "./useRealtimeHub";

export type RankScope = "global" | "organization" | "team";

export type RankDistRow = {
  rank_title: string;
  count: number;
};

export type RankStats = {
  scope: RankScope;
  total_users: number;
  my_rank: number | null;
  top_percent: number | null;
  my_points: number;
  distribution: RankDistRow[];
};

type Options = {
  enabled?: boolean;
  pollMs?: number;
  pauseWhenHidden?: boolean;
  defaultScope?: RankScope;
};

type UserMini = {
  id: string;
  team_id: string | null;
  organization_id: string | null;
};

export function useRankStats(userId: string, userTeamId?: string | null, options: Options = {}) {
  const enabled = options.enabled ?? true;
  const pollMs = options.pollMs ?? 120000;
  const pauseWhenHidden = options.pauseWhenHidden ?? true;
  const defaultScope = options.defaultScope ?? "global";

  const [scope, setScope] = useState<RankScope>(defaultScope);

  const [userMini, setUserMini] = useState<UserMini | null>(null);
  const [statsByScope, setStatsByScope] = useState<Record<RankScope, RankStats | null>>({
    global: null,
    organization: null,
    team: null,
  });

  const [loading, setLoading] = useState(false);
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

  // ✅ userMini を取得（organization_id が必要。team_idは props 優先）
  const loadUserMini = useCallback(async () => {
    if (!enabled || !userId) return;
    try {
      const { data, error } = await supabase
        .from("users")
        .select("id, team_id, organization_id")
        .eq("id", userId)
        .maybeSingle();

      if (error) throw error;

      const team_id = (userTeamId ?? data?.team_id ?? null) as string | null;

      if (!mountedRef.current) return;
      setUserMini({
        id: userId,
        team_id,
        organization_id: (data?.organization_id ?? null) as string | null,
      });
    } catch (e: any) {
      console.error("[useRankStats] loadUserMini error:", e);
      if (!mountedRef.current) return;
      // ここで落としても global は動かせるので、致命的扱いにしない
      setUserMini({
        id: userId,
        team_id: userTeamId ?? null,
        organization_id: null,
      });
    }
  }, [enabled, userId, userTeamId]);

  useEffect(() => {
    void loadUserMini();
  }, [loadUserMini]);

  const canUseOrg = !!userMini?.organization_id;
  const canUseTeam = !!userMini?.team_id;

  // UI用：押せるスコープ一覧（organization/team が null の場合は出さない）
  const availableScopes = useMemo(() => {
    const scopes: RankScope[] = ["global"];
    if (canUseOrg) scopes.push("organization");
    if (canUseTeam) scopes.push("team");
    return scopes;
  }, [canUseOrg, canUseTeam]);

  // scope が使えない状態なら global に戻す
  useEffect(() => {
    if (!enabled) return;
    if (scope === "organization" && !canUseOrg) setScope("global");
    if (scope === "team" && !canUseTeam) setScope("global");
  }, [enabled, scope, canUseOrg, canUseTeam]);

  const fetchRankStats = useCallback(
    async (targetScope: RankScope, opts?: { silent?: boolean }) => {
      if (!enabled) return;

      // global はID不要、organization/team は必要
      if (targetScope === "organization" && !userMini?.organization_id) return;
      if (targetScope === "team" && !userMini?.team_id) return;

      if (inflightRef.current) return;
      inflightRef.current = true;

      const silent = opts?.silent ?? false;

      try {
        if (!silent && mountedRef.current) setLoading(true);

        const payload: any = { p_scope: targetScope };
        if (targetScope === "organization") payload.p_org_id = userMini!.organization_id;
        if (targetScope === "team") payload.p_team_id = userMini!.team_id;

        const { data, error } = await supabase.rpc("get_rank_stats", payload);
        if (error) throw error;

        const s = (data ?? null) as RankStats | null;

        if (!mountedRef.current) return;
        setStatsByScope((prev) => ({ ...prev, [targetScope]: s }));
        setError(null);
      } catch (e: any) {
        console.error("[useRankStats] fetch error:", e);
        if (!mountedRef.current) return;
        setError(e?.message ?? "順位情報の取得に失敗しました");
      } finally {
        inflightRef.current = false;
        if (!silent && mountedRef.current) setLoading(false);
      }
    },
    [enabled, userMini]
  );

  // 初回：現在 scope のデータだけ取る
  useEffect(() => {
    cleanupPoll();
    if (!enabled) return;
    if (!userMini) return;

    void fetchRankStats(scope, { silent: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, userMini, scope]);

  // ポーリング（現在の scope だけ）
  useEffect(() => {
    cleanupPoll();

    const shouldPoll = enabled && pollMs > 0 && !!userMini;
    if (!shouldPoll) return;

    const key = `rankstats:${scope}:${instanceIdRef.current}`;

    const unregister = registerPollJob({
      key,
      intervalMs: pollMs,
      run: async () => {
        await fetchRankStats(scope, { silent: true });
      },
      enabled: true,
      requireVisible: pauseWhenHidden,
      requireOnline: true,
      immediate: false,
    });

    unregisterPollRef.current = unregister;
    return () => cleanupPoll();
  }, [enabled, pollMs, pauseWhenHidden, registerPollJob, fetchRankStats, cleanupPoll, scope, userMini]);

  const current = statsByScope[scope];

  const refresh = useCallback(async () => {
    await fetchRankStats(scope, { silent: false });
  }, [fetchRankStats, scope]);

  return {
    scope,
    setScope,
    availableScopes,
    canUseOrg,
    canUseTeam,
    data: current,
    loading,
    error,
    refresh,
  };
}