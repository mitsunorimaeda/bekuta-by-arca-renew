import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Alert, AlertRule, DEFAULT_ALERT_RULES, generateAlerts, filterActiveAlerts, sortAlertsByPriority } from '../lib/alerts';
import { calculateACWR } from '../lib/acwr';
import { sendAlertEmail } from '../lib/emailService';

export function useAlerts(userId: string, userRole: 'athlete' | 'staff' | 'admin') {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [alertRules, setAlertRules] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const sendAlertEmailsForNewAlerts = async (newAlerts: Alert[]) => {
    const highPriorityAlerts = newAlerts.filter(alert => alert.priority === 'high');

    if (highPriorityAlerts.length === 0) {
      return;
    }

    const userAlertsMap = new Map<string, Alert[]>();
    for (const alert of highPriorityAlerts) {
      if (!userAlertsMap.has(alert.user_id)) {
        userAlertsMap.set(alert.user_id, []);
      }
      userAlertsMap.get(alert.user_id)!.push(alert);
    }

    for (const [alertUserId, userAlerts] of userAlertsMap) {
      try {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('email, name, email_notifications, last_alert_email_sent')
          .eq('id', alertUserId)
          .single();

        if (userError || !userData) {
          console.error('Error fetching user data for alert email:', userError);
          continue;
        }

        const emailPrefs = userData.email_notifications as Record<string, boolean> | null;
        if (emailPrefs && emailPrefs.alerts === false) {
          console.log(`Skipping alert email for ${userData.email} - notifications disabled`);
          continue;
        }

        const lastEmailSent = userData.last_alert_email_sent
          ? new Date(userData.last_alert_email_sent)
          : null;
        const now = new Date();
        const hoursSinceLastEmail = lastEmailSent
          ? (now.getTime() - lastEmailSent.getTime()) / (1000 * 60 * 60)
          : Infinity;

        if (hoursSinceLastEmail < 6) {
          console.log(`Skipping alert email for ${userData.email} - last email sent ${hoursSinceLastEmail.toFixed(1)} hours ago`);
          continue;
        }

        for (const alert of userAlerts) {
          const result = await sendAlertEmail(userData.email, userData.name, alert);

          if (result.success) {
            console.log(`Alert email sent to ${userData.email}`);

            await supabase
              .from('users')
              .update({ last_alert_email_sent: now.toISOString() })
              .eq('id', alertUserId);

            break;
          } else {
            console.error(`Failed to send alert email to ${userData.email}:`, result.error);
          }
        }
      } catch (error) {
        console.error('Error sending alert email:', error);
      }
    }
  };

  // メモ化されたアラートチェック関数
  const checkAndGenerateAlerts = useCallback(async () => {
    if (!userId || !userRole) return;

    try {
      let usersToCheck: Array<{ id: string; name: string }> = [];

      if (userRole === 'athlete') {
        // 選手の場合は自分のみ
        const { data: userData } = await supabase
          .from('users')
          .select('id, name')
          .eq('id', userId)
          .single();
        
        if (userData) {
          usersToCheck = [userData];
        }
      } else if (userRole === 'staff') {
        // スタッフの場合は担当チームの選手
        const { data: teamData } = await supabase
          .from('staff_team_links')
          .select(`
            team_id,
            teams!inner (
              users!inner (
                id,
                name
              )
            )
          `)
          .eq('staff_user_id', userId);

        if (teamData) {
          usersToCheck = teamData.flatMap(link => 
            (link.teams as any)?.users || []
          );
        }
      } else if (userRole === 'admin') {
        // 管理者の場合は全選手
        const { data: allAthletes } = await supabase
          .from('users')
          .select('id, name')
          .eq('role', 'athlete');

        usersToCheck = allAthletes || [];
      }

      const newAlerts: Alert[] = [];

      for (const user of usersToCheck) {
        // 練習記録を取得
        const { data: trainingRecords } = await supabase
          .from('training_records')
          .select('*')
          .eq('user_id', user.id)
          .order('date', { ascending: true });

        if (trainingRecords) {
          // ACWRデータを計算
          const acwrData = calculateACWR(trainingRecords);
          
          // アラートを生成
          const userAlerts = generateAlerts(
            user.id,
            user.name,
            acwrData,
            trainingRecords,
            alertRules
          );

          newAlerts.push(...userAlerts);
        }
      }

      // 既存のアラートと重複チェック
      setAlerts(prev => {
        const existingAlertKeys = new Set(
          prev.map(alert => `${alert.user_id}-${alert.type}-${alert.created_at.split('T')[0]}`)
        );

        const uniqueNewAlerts = newAlerts.filter(alert =>
          !existingAlertKeys.has(`${alert.user_id}-${alert.type}-${alert.created_at.split('T')[0]}`)
        );

        if (uniqueNewAlerts.length > 0) {
          sendAlertEmailsForNewAlerts(uniqueNewAlerts).catch(error => {
            console.error('Error sending alert emails:', error);
          });

          const combined = [...prev, ...uniqueNewAlerts];
          return sortAlertsByPriority(filterActiveAlerts(combined));
        }

        return filterActiveAlerts(prev);
      });

    } catch (error) {
      console.error('Error checking and generating alerts:', error);
    }
  }, [userId, userRole, alertRules]);

  // アラートルールの初期化
  const loadAlertRules = useCallback(async () => {
    try {
      // アラートルールテーブルが存在しない場合はデフォルトルールを使用
      const rules = DEFAULT_ALERT_RULES.map((rule, index) => ({
        id: `default-${index}`,
        ...rule
      }));
      setAlertRules(rules);
    } catch (error) {
      console.error('Error loading alert rules:', error);
      // フォールバック: デフォルトルールを使用
      const rules = DEFAULT_ALERT_RULES.map((rule, index) => ({
        id: `default-${index}`,
        ...rule
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

  // アラートルールが設定された後にアラートチェックを実行
  useEffect(() => {
    if (alertRules.length > 0 && userId && userRole) {
      checkAndGenerateAlerts();
    }
  }, [alertRules, checkAndGenerateAlerts]);

  // 定期的なアラートチェック（30分ごとに変更）
  useEffect(() => {
    if (alertRules.length > 0 && userId && userRole) {
      const interval = setInterval(checkAndGenerateAlerts, 30 * 60 * 1000); // 30分ごと
      return () => clearInterval(interval);
    }
  }, [alertRules, checkAndGenerateAlerts]);

  // 未読数の更新
  useEffect(() => {
    const unread = alerts.filter(alert => !alert.is_read && !alert.is_dismissed).length;
    setUnreadCount(unread);
  }, [alerts]);

  const markAsRead = useCallback(async (alertId: string) => {
    setAlerts(prev => 
      prev.map(alert => 
        alert.id === alertId 
          ? { ...alert, is_read: true }
          : alert
      )
    );
  }, []);

  const dismissAlert = useCallback(async (alertId: string) => {
    setAlerts(prev => 
      prev.map(alert => 
        alert.id === alertId 
          ? { ...alert, is_dismissed: true }
          : alert
      )
    );
  }, []);

  const markAllAsRead = useCallback(async () => {
    setAlerts(prev => 
      prev.map(alert => ({ ...alert, is_read: true }))
    );
  }, []);

  const clearDismissedAlerts = useCallback(() => {
    setAlerts(prev => prev.filter(alert => !alert.is_dismissed));
  }, []);

  const getActiveAlerts = useCallback(() => {
    return filterActiveAlerts(alerts);
  }, [alerts]);

  const getUnreadAlerts = useCallback(() => {
    return alerts.filter(alert => !alert.is_read && !alert.is_dismissed);
  }, [alerts]);

  const getAlertsByPriority = useCallback((priority: Alert['priority']) => {
    return getActiveAlerts().filter(alert => alert.priority === priority);
  }, [getActiveAlerts]);

  const getAlertsByUser = useCallback((targetUserId: string) => {
    return getActiveAlerts().filter(alert => alert.user_id === targetUserId);
  }, [getActiveAlerts]);

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
    refreshAlerts: checkAndGenerateAlerts
  };
}