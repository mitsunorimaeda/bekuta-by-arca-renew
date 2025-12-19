// src/hooks/useAlerts.ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  Alert,
  AlertRule,
  DEFAULT_ALERT_RULES,
  generateAlerts,
  filterActiveAlerts,
  sortAlertsByPriority,
} from '../lib/alerts';
import { calculateACWR } from '../lib/acwr';

const ENABLE_REALTIME_ALERT_EMAILS = false;

type UserRole = 'athlete' | 'staff' | 'admin';

export function useAlerts(userId: string, userRole: UserRole) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [alertRules, setAlertRules] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const sendAlertEmailsForNewAlerts = async (newAlerts: Alert[]) => {
    // フロント側からのアラートメール送信は停止中
    if (import.meta.env.DEV) {
      console.info(
        '[useAlerts] sendAlertEmailsForNewAlerts is disabled. New alerts count:',
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

    if (userRole === 'athlete') {
      const { data: userData } = await supabase
        .from('users')
        .select('id, name')
        .eq('id', userId)
        .single();

      if (userData) usersToCheck = [userData];
    }

    if (userRole === 'staff') {
      const { data: teamData, error } = await supabase
        .from('staff_team_links')
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
        .eq('staff_user_id', userId);

      if (error) {
        console.error('[useAlerts] staff team fetch error:', error);
      }

      // ここが重複しやすい（複数team linkで同じ選手が混ざる）
      const rawUsers =
        teamData?.flatMap((link: any) => (link.teams as any)?.users || []) || [];

      // ✅ dedupe (id)
      const deduped = new Map<string, { id: string; name: string }>();
      for (const u of rawUsers) {
        if (!u?.id) continue;
        if (!deduped.has(u.id)) deduped.set(u.id, { id: u.id, name: u.name ?? '' });
      }

      usersToCheck = Array.from(deduped.values());
    }

    if (userRole === 'admin') {
      const { data: allAthletes, error } = await supabase
        .from('users')
        .select('id, name')
        .eq('role', 'athlete');

      if (error) console.error('[useAlerts] admin athletes fetch error:', error);

      // admin は基本重複しにくいけど念のためdedupe
      const deduped = new Map<string, { id: string; name: string }>();
      for (const u of allAthletes || []) {
        if (!u?.id) continue;
        if (!deduped.has(u.id)) deduped.set(u.id, { id: u.id, name: u.name ?? '' });
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
      const effectiveRules = alertRules.filter((rule) => {
        if (userRole !== 'athlete' && rule.type === 'no_data') return false;
        return true;
      });

      // ✅ training_records を並列取得
      const fetchPromises = usersToCheck.map(async (u) => {
        const { data: trainingRecords, error } = await supabase
          .from('training_records')
          .select('*')
          .eq('user_id', u.id)
          .order('date', { ascending: true });

        if (error) {
          // ここで throw すると全体が落ちるので、呼び出し側で握る
          throw { user: u, error };
        }

        return { user: u, trainingRecords: trainingRecords || [] };
      });

      // ✅ 一部失敗しても全体は生かす
      const results = await Promise.allSettled(fetchPromises);

      const newAlerts: Alert[] = [];

      for (const r of results) {
        if (r.status === 'rejected') {
          console.error('[useAlerts] training_records fetch failed:', r.reason);
          continue;
        }

        const { user, trainingRecords } = r.value;

        // ACWRデータを計算
        const acwrData = calculateACWR(trainingRecords);

        // アラート生成（有効ルールのみ）
        const userAlerts = generateAlerts(
          user.id,
          user.name,
          acwrData,
          trainingRecords,
          effectiveRules
        );

        newAlerts.push(...userAlerts);
      }

      // 既存アラートと重複チェック（既存ロジック維持）
      setAlerts((prev) => {
        const existingAlertKeys = new Set(
          prev.map((a) => `${a.user_id}-${a.type}-${a.created_at.split('T')[0]}`)
        );

        const uniqueNewAlerts = newAlerts.filter(
          (a) => !existingAlertKeys.has(`${a.user_id}-${a.type}-${a.created_at.split('T')[0]}`)
        );

        if (uniqueNewAlerts.length > 0) {
          if (ENABLE_REALTIME_ALERT_EMAILS) {
            sendAlertEmailsForNewAlerts(uniqueNewAlerts).catch((error) => {
              console.error('Error sending alert emails:', error);
            });
          }

          const combined = [...prev, ...uniqueNewAlerts];
          return sortAlertsByPriority(filterActiveAlerts(combined));
        }

        return filterActiveAlerts(prev);
      });
    } catch (error) {
      console.error('Error checking and generating alerts:', error);
    }
  }, [userId, userRole, alertRules, loadUsersToCheck]);

  // -----------------------------
  // Alertルール初期化
  // -----------------------------
  const loadAlertRules = useCallback(async () => {
    try {
      const rules = DEFAULT_ALERT_RULES.map((rule, index) => ({
        id: `default-${index}`,
        ...rule,
      }));
      setAlertRules(rules);
    } catch (error) {
      console.error('Error loading alert rules:', error);
      const rules = DEFAULT_ALERT_RULES.map((rule, index) => ({
        id: `default-${index}`,
        ...rule,
      }));
      setAlertRules(rules);
    }
  }, []);

  // 初期化
  useEffect(() => {
    if (userId && userRole) {
      const initializeAlerts = async () => {
        try {
          await loadAlertRules();
          setLoading(false);
        } catch (error) {
          console.error('Error initializing alerts:', error);
          setLoading(false);
        }
      };
      initializeAlerts();
    }
  }, [userId, userRole, loadAlertRules]);

  // ルール設定後にチェック
  useEffect(() => {
    if (alertRules.length > 0 && userId && userRole) {
      checkAndGenerateAlerts();
    }
  }, [alertRules, checkAndGenerateAlerts, userId, userRole]);

  // 定期チェック（30分）
  useEffect(() => {
    if (alertRules.length > 0 && userId && userRole) {
      const interval = setInterval(checkAndGenerateAlerts, 30 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [alertRules, checkAndGenerateAlerts, userId, userRole]);

  // 未読数更新
  useEffect(() => {
    const unread = alerts.filter((a) => !a.is_read && !a.is_dismissed).length;
    setUnreadCount(unread);
  }, [alerts]);

  const markAsRead = useCallback(async (alertId: string) => {
    setAlerts((prev) => prev.map((a) => (a.id === alertId ? { ...a, is_read: true } : a)));
  }, []);

  const dismissAlert = useCallback(async (alertId: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, is_dismissed: true } : a))
    );
  }, []);

  const markAllAsRead = useCallback(async () => {
    setAlerts((prev) => prev.map((a) => ({ ...a, is_read: true })));
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
    (priority: Alert['priority']) => getActiveAlerts().filter((a) => a.priority === priority),
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