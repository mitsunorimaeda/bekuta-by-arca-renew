// src/hooks/useAlerts.ts
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";
import type { AppRole } from "../lib/roles";
import {
  Alert,
  AlertRule,
  DEFAULT_ALERT_RULES,
  generateAlerts,
  filterActiveAlerts,
  sortAlertsByPriority,
} from "../lib/alerts";
import { calculateACWR } from "../lib/acwr";
import { useRealtimeHub } from "./useRealtimeHub";

type UserRole = AppRole;

// DB row → フロントエンドのAlert型に変換
function dbRowToAlert(row: any): Alert {
  return {
    id: row.id,
    user_id: row.athlete_user_id,
    user_name: row.metadata?.athlete_name || '',
    type: row.alert_type as Alert['type'],
    priority: row.priority as Alert['priority'],
    title: row.title,
    message: row.message,
    acwr_value: row.metadata?.acwr_value,
    threshold_exceeded: row.metadata?.threshold_exceeded,
    last_training_date: row.metadata?.last_training_date,
    days_since_last_training: row.metadata?.days_since_last_training,
    srpe_value: row.metadata?.srpe_value,
    srpe_avg_7d: row.metadata?.srpe_avg_7d,
    srpe_spike_ratio: row.metadata?.srpe_spike_ratio,
    is_read: row.status === 'read' || row.status === 'dismissed' || row.status === 'resolved',
    is_dismissed: row.status === 'dismissed' || row.status === 'resolved',
    created_at: row.created_at,
    expires_at: row.metadata?.expires_at,
  };
}

export function useAlerts(userId: string, userRole: UserRole) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [alertRules, setAlertRules] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const { registerPollJob } = useRealtimeHub();
  const instanceIdRef = useRef(
    globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)
  );
  const unregisterPollRef = useRef<null | (() => void)>(null);

  // -----------------------------
  // DB からアラートを読み込み
  // -----------------------------
  const loadAlertsFromDB = useCallback(async () => {
    if (!userId) return [];

    // activeのみ取得（readやdismissedは表示しない）
    const { data, error } = await supabase
      .from('staff_alerts')
      .select('*')
      .eq('staff_user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('[useAlerts] DB load error:', error);
      return [];
    }

    return (data || []).map(dbRowToAlert);
  }, [userId]);

  // -----------------------------
  // Users取得（staff/admin含む）
  // -----------------------------
  const loadUsersToCheck = useCallback(async () => {
    if (!userId || !userRole) return [];

    let usersToCheck: Array<{ id: string; name: string }> = [];

    if (userRole === "athlete") {
      const { data: userData } = await supabase
        .from("users")
        .select("id, name")
        .eq("id", userId)
        .single();
      if (userData) usersToCheck = [userData];
    }

    if (userRole === "staff") {
      const { data: teamData, error } = await supabase
        .from("staff_team_links")
        .select(`team_id, teams!inner ( users!inner ( id, name ) )`)
        .eq("staff_user_id", userId);

      if (error) console.error("[useAlerts] staff team fetch error:", error);

      const rawUsers =
        teamData?.flatMap((link: any) => (link.teams as any)?.users || []) || [];
      const deduped = new Map<string, { id: string; name: string }>();
      for (const u of rawUsers) {
        if (!u?.id) continue;
        if (!deduped.has(u.id)) deduped.set(u.id, { id: u.id, name: u.name ?? "" });
      }
      usersToCheck = Array.from(deduped.values());
    }

    if (userRole === "global_admin") {
      const { data: allAthletes, error } = await supabase
        .from("users")
        .select("id, name")
        .eq("role", "athlete");
      if (error) console.error("[useAlerts] admin athletes fetch error:", error);
      const deduped = new Map<string, { id: string; name: string }>();
      for (const u of allAthletes || []) {
        if (!u?.id) continue;
        if (!deduped.has(u.id)) deduped.set(u.id, { id: u.id, name: u.name ?? "" });
      }
      usersToCheck = Array.from(deduped.values());
    }

    return usersToCheck;
  }, [userId, userRole]);

  // -----------------------------
  // Alert生成 → DBにupsert
  // -----------------------------
  const checkAndGenerateAlerts = useCallback(async () => {
    if (!userId || !userRole) return;

    try {
      const usersToCheck = await loadUsersToCheck();
      if (!usersToCheck.length) return;

      const effectiveRules = (alertRules ?? []).filter((rule) => {
        if (userRole !== "athlete" && rule.type === "no_data") return false;
        return true;
      });

      const fetchPromises = usersToCheck.map(async (u) => {
        const { data: trainingRecords, error } = await supabase
          .from("training_records")
          .select("*")
          .eq("user_id", u.id)
          .order("date", { ascending: true });
        if (error) throw { user: u, error };
        return { user: u, trainingRecords: trainingRecords || [] };
      });

      const results = await Promise.allSettled(fetchPromises);
      const generatedAlerts: Alert[] = [];

      for (const r of results) {
        if (r.status === "rejected") {
          console.error("[useAlerts] training_records fetch failed:", r.reason);
          continue;
        }
        const { user, trainingRecords } = r.value;
        const acwrData = calculateACWR(trainingRecords);
        const userAlerts = generateAlerts(user.id, user.name, acwrData, trainingRecords, effectiveRules);
        generatedAlerts.push(...userAlerts);
      }

      // DB upsert: 同じスタッフ×選手×タイプでactiveなものがなければ挿入
      for (const alert of generatedAlerts) {
        // 既にactive/dismissed（既読済み）のアラートがあれば再生成しない
        const { data: existingRows } = await supabase
          .from('staff_alerts')
          .select('id, status')
          .eq('staff_user_id', userId)
          .eq('athlete_user_id', alert.user_id)
          .eq('alert_type', alert.type)
          .in('status', ['active', 'dismissed'])
          .limit(1);

        if (!existingRows || existingRows.length === 0) {
          // 新規挿入
          await supabase.from('staff_alerts').insert({
            staff_user_id: userId,
            athlete_user_id: alert.user_id,
            alert_type: alert.type,
            priority: alert.priority,
            title: alert.title,
            message: alert.message,
            status: 'active',
            metadata: {
              athlete_name: alert.user_name,
              acwr_value: alert.acwr_value,
              threshold_exceeded: alert.threshold_exceeded,
              last_training_date: alert.last_training_date,
              days_since_last_training: alert.days_since_last_training,
              srpe_value: alert.srpe_value,
              srpe_avg_7d: alert.srpe_avg_7d,
              srpe_spike_ratio: alert.srpe_spike_ratio,
              expires_at: alert.expires_at,
            },
          });
        }
      }

      // 条件が解消されたアラートを自動resolveする
      // 例: ACWRが安全圏に戻った選手のhigh_riskアラート
      const generatedKeys = new Set(
        generatedAlerts.map(a => `${a.user_id}:${a.type}`)
      );

      const { data: activeAlerts } = await supabase
        .from('staff_alerts')
        .select('id, athlete_user_id, alert_type')
        .eq('staff_user_id', userId)
        .in('status', ['active', 'dismissed'])
        .in('alert_type', ['high_risk', 'caution', 'srpe_high', 'srpe_spike']);

      for (const active of (activeAlerts || [])) {
        const key = `${active.athlete_user_id}:${active.alert_type}`;
        if (!generatedKeys.has(key)) {
          // この選手のこのアラートタイプは今回生成されなかった → 解消された
          await supabase
            .from('staff_alerts')
            .update({ status: 'resolved', resolved_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            .eq('id', active.id);
        }
      }

      // DBから最新を読み込み
      const dbAlerts = await loadAlertsFromDB();
      setAlerts(sortAlertsByPriority(filterActiveAlerts(dbAlerts)));
    } catch (error) {
      console.error("Error checking and generating alerts:", error);
    }
  }, [userId, userRole, alertRules, loadUsersToCheck, loadAlertsFromDB]);

  // Alertルール初期化
  const loadAlertRules = useCallback(async () => {
    const rules = DEFAULT_ALERT_RULES.map((rule, index) => ({
      id: `default-${index}`,
      ...rule,
    }));
    setAlertRules(rules);
  }, []);

  // 初期化: DBから読み込み
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      if (!userId || !userRole) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        await loadAlertRules();
        const dbAlerts = await loadAlertsFromDB();
        if (!cancelled) {
          setAlerts(sortAlertsByPriority(filterActiveAlerts(dbAlerts)));
        }
      } catch (e) {
        console.error("Error loading alerts:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    init();
    return () => { cancelled = true; };
  }, [userId, userRole, loadAlertRules, loadAlertsFromDB]);

  // ルール設定後に即1回チェック
  useEffect(() => {
    if (alertRules.length > 0 && userId && userRole) {
      checkAndGenerateAlerts();
    }
  }, [alertRules.length, userId, userRole, checkAndGenerateAlerts]);

  // Hubポーリング（30分）
  useEffect(() => {
    if (unregisterPollRef.current) {
      unregisterPollRef.current();
      unregisterPollRef.current = null;
    }
    if (!userId || !userRole) return;
    if (alertRules.length === 0) return;

    const key = `alerts:${userId}:${userRole}:${instanceIdRef.current}`;
    const unregister = registerPollJob({
      key,
      intervalMs: 30 * 60 * 1000,
      run: async () => { await checkAndGenerateAlerts(); },
      enabled: true,
      requireVisible: true,
      requireOnline: true,
      immediate: false,
    });
    unregisterPollRef.current = unregister;

    return () => {
      if (unregisterPollRef.current) {
        unregisterPollRef.current();
        unregisterPollRef.current = null;
      }
    };
  }, [userId, userRole, alertRules.length, registerPollJob, checkAndGenerateAlerts]);

  // DB同期ポーリング（60秒）— 他デバイスでの既読操作を反映
  useEffect(() => {
    if (!userId || !userRole) return;

    const syncInterval = setInterval(async () => {
      try {
        const dbAlerts = await loadAlertsFromDB();
        setAlerts(sortAlertsByPriority(filterActiveAlerts(dbAlerts)));
      } catch (e) {
        // silent fail
      }
    }, 60 * 1000);

    return () => clearInterval(syncInterval);
  }, [userId, userRole, loadAlertsFromDB]);

  // 未読数更新
  useEffect(() => {
    const unread = alerts.filter((a) => !a.is_read && !a.is_dismissed).length;
    setUnreadCount(unread);
  }, [alerts]);

  // 既読 → dismissedに変更してリストから消す
  const markAsRead = useCallback(async (alertId: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== alertId));

    await supabase
      .from('staff_alerts')
      .update({ status: 'dismissed', updated_at: new Date().toISOString() })
      .eq('id', alertId)
      .eq('staff_user_id', userId);
  }, [userId]);

  // 非表示（DB更新）
  const dismissAlert = useCallback(async (alertId: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== alertId));

    await supabase
      .from('staff_alerts')
      .update({ status: 'dismissed', updated_at: new Date().toISOString() })
      .eq('id', alertId)
      .eq('staff_user_id', userId);
  }, [userId]);

  // 全て既読 → dismissed（リストから全て消す）
  const markAllAsRead = useCallback(async () => {
    setAlerts([]);

    await supabase
      .from('staff_alerts')
      .update({ status: 'dismissed', updated_at: new Date().toISOString() })
      .eq('staff_user_id', userId)
      .eq('status', 'active');
  }, [userId]);

  const clearDismissedAlerts = useCallback(() => {
    setAlerts((prev) => prev.filter((a) => !a.is_dismissed));
  }, []);

  const getActiveAlerts = useCallback(() => {
    return filterActiveAlerts(alerts);
  }, [alerts]);

  const getUnreadAlerts = useCallback(() => {
    return alerts.filter((a) => !a.is_read && !a.is_dismissed);
  }, [alerts]);

  const getAlertsByPriority = useCallback(
    (priority: Alert["priority"]) => getActiveAlerts().filter((a) => a.priority === priority),
    [getActiveAlerts]
  );

  const getAlertsByUser = useCallback(
    (targetUserId: string) => getActiveAlerts().filter((a) => a.user_id === targetUserId),
    [getActiveAlerts]
  );

  return {
    alerts: getActiveAlerts(),
    alertRules,
    loading,
    unreadCount,
    markAsRead,
    dismissAlert,
    markAllAsRead,
    clearDismissedAlerts,
    getUnreadAlerts,
    getAlertsByPriority,
    getAlertsByUser,
    refreshAlerts: checkAndGenerateAlerts,
  };
}
