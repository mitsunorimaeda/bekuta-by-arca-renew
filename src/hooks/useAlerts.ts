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

const ENABLE_REALTIME_ALERT_EMAILS = false;
type UserRole = AppRole;

// --------------------------------------------------
// localStorage によるアラート既読/非表示の永続化
// キー: `${user_id}-${type}-${date}` （アラートの安定キー）
// --------------------------------------------------
const STORAGE_KEY = 'bekuta_alert_state';
const STATE_TTL_DAYS = 14; // 14日で古いエントリを自動削除

type PersistedAlertState = {
  read: Record<string, number>;      // stableKey → timestamp
  dismissed: Record<string, number>; // stableKey → timestamp
};

function getAlertStableKey(alert: { user_id: string; type: string; created_at: string }): string {
  return `${alert.user_id}-${alert.type}-${alert.created_at.split("T")[0]}`;
}

function loadPersistedState(): PersistedAlertState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { read: {}, dismissed: {} };
    return JSON.parse(raw) as PersistedAlertState;
  } catch {
    return { read: {}, dismissed: {} };
  }
}

function savePersistedState(state: PersistedAlertState): void {
  try {
    // 古いエントリを掃除
    const cutoff = Date.now() - STATE_TTL_DAYS * 24 * 60 * 60 * 1000;
    for (const key of Object.keys(state.read)) {
      if (state.read[key] < cutoff) delete state.read[key];
    }
    for (const key of Object.keys(state.dismissed)) {
      if (state.dismissed[key] < cutoff) delete state.dismissed[key];
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

/** 生成されたアラートに永続化された既読/非表示状態を適用 */
function applyPersistedState(alerts: Alert[]): Alert[] {
  const state = loadPersistedState();
  return alerts.map((a) => {
    const key = getAlertStableKey(a);
    return {
      ...a,
      is_read: a.is_read || !!state.read[key],
      is_dismissed: a.is_dismissed || !!state.dismissed[key],
    };
  });
}

export function useAlerts(userId: string, userRole: UserRole) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [alertRules, setAlertRules] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const { registerPollJob } = useRealtimeHub();

  // ✅ hookインスタンス固有（job key衝突回避）
  const instanceIdRef = useRef(
    globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)
  );

  // ✅ Poll unregister を保持
  const unregisterPollRef = useRef<null | (() => void)>(null);

  const sendAlertEmailsForNewAlerts = async (newAlerts: Alert[]) => {
    // フロント側からのアラートメール送信は停止中
    if (import.meta.env.DEV) {
      console.info(
        "[useAlerts] sendAlertEmailsForNewAlerts is disabled. New alerts count:",
        newAlerts.length
      );
    }
  };

  // -----------------------------
  // ✅ Users取得（staff/admin含む） + dedupe
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
        .select(
          `
          team_id,
          teams!inner (
            users!inner (
              id,
              name
            )
          )
        `
        )
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
  // ✅ Alert生成（並列化）
  // -----------------------------
  const checkAndGenerateAlerts = useCallback(async () => {
    if (!userId || !userRole) return;

    try {
      const usersToCheck = await loadUsersToCheck();
      if (!usersToCheck.length) return;

      // ★ roleごとのルール調整：staff/admin には no_data を出さない
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

      const newAlerts: Alert[] = [];

      for (const r of results) {
        if (r.status === "rejected") {
          console.error("[useAlerts] training_records fetch failed:", r.reason);
          continue;
        }

        const { user, trainingRecords } = r.value;
        const acwrData = calculateACWR(trainingRecords);

        const userAlerts = generateAlerts(
          user.id,
          user.name,
          acwrData,
          trainingRecords,
          effectiveRules
        );

        newAlerts.push(...userAlerts);
      }

      setAlerts((prev) => {
        const existingAlertKeys = new Set(
          prev.map((a) => getAlertStableKey(a))
        );

        const uniqueNewAlerts = newAlerts.filter(
          (a) => !existingAlertKeys.has(getAlertStableKey(a))
        );

        if (uniqueNewAlerts.length > 0) {
          if (ENABLE_REALTIME_ALERT_EMAILS) {
            sendAlertEmailsForNewAlerts(uniqueNewAlerts).catch((error) => {
              console.error("Error sending alert emails:", error);
            });
          }

          const combined = [...prev, ...uniqueNewAlerts];
          // 永続化された既読/非表示状態を適用
          return sortAlertsByPriority(filterActiveAlerts(applyPersistedState(combined)));
        }

        return filterActiveAlerts(applyPersistedState(prev));
      });
    } catch (error) {
      console.error("Error checking and generating alerts:", error);
    }
  }, [userId, userRole, alertRules, loadUsersToCheck]);

  // -----------------------------
  // Alertルール初期化
  // -----------------------------
  const loadAlertRules = useCallback(async () => {
    const rules = DEFAULT_ALERT_RULES.map((rule, index) => ({
      id: `default-${index}`,
      ...rule,
    }));
    setAlertRules(rules);
  }, []);

  // 初期化
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
      } catch (e) {
        console.error("Error loading alert rules:", e);
        // fallback（同じ内容でOK）
        await loadAlertRules();
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    init();
    return () => {
      cancelled = true;
    };
  }, [userId, userRole, loadAlertRules]);

  // ルール設定後に即1回チェック
  useEffect(() => {
    if (alertRules.length > 0 && userId && userRole) {
      checkAndGenerateAlerts();
    }
  }, [alertRules.length, userId, userRole, checkAndGenerateAlerts]);

  // ✅ Hubポーリング（30分）へ移管
  useEffect(() => {
    // 既存jobを必ず解除
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
      run: async () => {
        await checkAndGenerateAlerts();
      },
      enabled: true,
      requireVisible: true, // ✅ 背景は止める
      requireOnline: true,
      immediate: false, // ✅ 直前の「即1回チェック」と二重にしない
    });

    unregisterPollRef.current = unregister;

    return () => {
      if (unregisterPollRef.current) {
        unregisterPollRef.current();
        unregisterPollRef.current = null;
      }
    };
  }, [userId, userRole, alertRules.length, registerPollJob, checkAndGenerateAlerts]);

  // 未読数更新
  useEffect(() => {
    const unread = alerts.filter((a) => !a.is_read && !a.is_dismissed).length;
    setUnreadCount(unread);
  }, [alerts]);

  const markAsRead = useCallback(async (alertId: string) => {
    setAlerts((prev) => {
      const target = prev.find((a) => a.id === alertId);
      if (target) {
        const state = loadPersistedState();
        state.read[getAlertStableKey(target)] = Date.now();
        savePersistedState(state);
      }
      return prev.map((a) => (a.id === alertId ? { ...a, is_read: true } : a));
    });
  }, []);

  const dismissAlert = useCallback(async (alertId: string) => {
    setAlerts((prev) => {
      const target = prev.find((a) => a.id === alertId);
      if (target) {
        const state = loadPersistedState();
        state.dismissed[getAlertStableKey(target)] = Date.now();
        savePersistedState(state);
      }
      return prev.map((a) => (a.id === alertId ? { ...a, is_dismissed: true } : a));
    });
  }, []);

  const markAllAsRead = useCallback(async () => {
    setAlerts((prev) => {
      const state = loadPersistedState();
      for (const a of prev) {
        state.read[getAlertStableKey(a)] = Date.now();
      }
      savePersistedState(state);
      return prev.map((a) => ({ ...a, is_read: true }));
    });
  }, []);

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