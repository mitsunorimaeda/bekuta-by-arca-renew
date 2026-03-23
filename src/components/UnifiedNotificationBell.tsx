// src/components/UnifiedNotificationBell.tsx
// アラート + 通知を1つのベルアイコンで表示する統合コンポーネント
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Bell, Check, X, History, AlertTriangle, Info, MessageCircle } from 'lucide-react';
import type { Alert } from '../lib/alerts';

interface UserNotification {
  id: string;
  title: string;
  body: string;
  sender_name: string | null;
  is_read: boolean;
  created_at: string;
}

type UnifiedItem =
  | { kind: 'alert'; data: Alert }
  | { kind: 'notification'; data: UserNotification };

interface UnifiedNotificationBellProps {
  userId: string;
  alerts: Alert[];
  alertUnreadCount: number;
  onMarkAlertRead: (id: string) => void;
  onDismissAlert: (id: string) => void;
  onMarkAllAlertsRead: () => void;
}

export function UnifiedNotificationBell({
  userId,
  alerts,
  alertUnreadCount,
  onMarkAlertRead,
  onDismissAlert,
  onMarkAllAlertsRead,
}: UnifiedNotificationBellProps) {
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'alerts' | 'notifications'>('all');
  const [showHistory, setShowHistory] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const notifUnreadCount = notifications.filter((n) => !n.is_read).length;
  const totalUnread = alertUnreadCount + notifUnreadCount;

  // 通知取得
  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('user_notifications')
        .select('id, title, body, sender_name, is_read, created_at')
        .eq('user_id', userId)
        .gte('created_at', thirtyDaysAgo)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      setNotifications(data ?? []);
    } catch (e) {
      console.error('Failed to fetch notifications:', e);
    }
  }, [userId]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);
  useEffect(() => {
    const timer = setInterval(fetchNotifications, 30000);
    return () => clearInterval(timer);
  }, [fetchNotifications]);

  // パネルを開いた時に3秒後に通知を自動既読
  useEffect(() => {
    if (!open || notifUnreadCount === 0) return;
    const timer = setTimeout(() => { markAllNotifsRead(); }, 3000);
    return () => clearTimeout(timer);
  }, [open, notifUnreadCount]);

  // パネル外クリックで閉じる
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
        setShowHistory(false);
      }
    };
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const markNotifAsRead = async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    await supabase.from('user_notifications').update({ is_read: true }).eq('id', id);
  };

  const markAllNotifsRead = async () => {
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    await supabase.from('user_notifications').update({ is_read: true }).in('id', unreadIds);
  };

  const handleMarkAllRead = () => {
    onMarkAllAlertsRead();
    markAllNotifsRead();
  };

  const relativeTime = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'たった今';
    if (mins < 60) return `${mins}分前`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}時間前`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}日前`;
    return new Date(iso).toLocaleDateString('ja-JP');
  };

  // 統合リスト作成
  const buildUnifiedList = (): UnifiedItem[] => {
    const items: UnifiedItem[] = [];

    const filteredAlerts = showHistory
      ? alerts
      : alerts.filter((a) => !a.is_read && !a.is_dismissed);

    const filteredNotifs = showHistory
      ? notifications
      : notifications.filter((n) => !n.is_read);

    if (activeTab === 'all' || activeTab === 'alerts') {
      for (const a of filteredAlerts) {
        items.push({ kind: 'alert', data: a });
      }
    }

    if (activeTab === 'all' || activeTab === 'notifications') {
      for (const n of filteredNotifs) {
        items.push({ kind: 'notification', data: n });
      }
    }

    // 日時でソート（新しい順）
    items.sort((a, b) => {
      const dateA = a.kind === 'alert' ? a.data.created_at : a.data.created_at;
      const dateB = b.kind === 'alert' ? b.data.created_at : b.data.created_at;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });

    return items;
  };

  const unifiedItems = open ? buildUnifiedList() : [];

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': case 'high': return 'bg-red-500';
      case 'medium': return 'bg-amber-500';
      default: return 'bg-blue-500';
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* 統合ベルアイコン */}
      <button
        type="button"
        onClick={() => { setOpen((v) => !v); setShowHistory(false); }}
        className="relative p-2 rounded-lg text-white hover:bg-white/10 transition-colors"
        aria-label="通知・アラート"
        title="通知・アラート"
      >
        <Bell className="w-5 h-5" />
        {totalUnread > 0 && (
          <span className={`absolute -top-0.5 -right-0.5 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 ${
            alertUnreadCount > 0 ? 'bg-red-500' : 'bg-blue-500'
          }`}>
            {totalUnread > 99 ? '99+' : totalUnread}
          </span>
        )}
      </button>

      {/* ドロップダウンパネル */}
      {open && (
        <div className="fixed left-4 right-4 top-16 sm:absolute sm:left-auto sm:right-0 sm:top-12 sm:w-96 max-h-[80vh] bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden z-50">
          {/* ヘッダー */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              通知・アラート
            </h3>
            <div className="flex items-center gap-2">
              {totalUnread > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                >
                  <Check className="w-3 h-3" />
                  すべて既読
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* タブ */}
          <div className="flex border-b border-gray-200 dark:border-gray-700">
            {([
              { key: 'all' as const, label: 'すべて', count: totalUnread },
              { key: 'alerts' as const, label: 'アラート', count: alertUnreadCount },
              { key: 'notifications' as const, label: 'お知らせ', count: notifUnreadCount },
            ]).map(({ key, label, count }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex-1 py-2 text-xs font-medium transition-colors relative ${
                  activeTab === key
                    ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                }`}
              >
                {label}
                {count > 0 && (
                  <span className="ml-1 bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 text-[10px] rounded-full px-1.5">
                    {count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* リスト */}
          <div className="overflow-y-auto max-h-[50vh]">
            {unifiedItems.length === 0 ? (
              <div className="text-center py-8">
                <Bell className="w-8 h-8 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {showHistory ? '履歴はありません' : '新しい通知はありません'}
                </p>
              </div>
            ) : (
              unifiedItems.map((item) => {
                if (item.kind === 'alert') {
                  const a = item.data;
                  return (
                    <div
                      key={`alert-${a.id}`}
                      className={`px-4 py-3 border-b border-gray-100 dark:border-gray-700 last:border-b-0 ${
                        a.is_read ? 'bg-white dark:bg-gray-800' : 'bg-red-50 dark:bg-red-900/10'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`flex-shrink-0 w-2 h-2 rounded-full mt-2 ${getPriorityColor(a.priority)}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                            <p className={`text-sm ${a.is_read ? 'text-gray-500' : 'text-gray-900 dark:text-white font-medium'}`}>
                              {a.title}
                            </p>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                            {a.message}
                          </p>
                          <span className="text-[10px] text-gray-400 mt-1 block">
                            {relativeTime(a.created_at)}
                          </span>
                        </div>
                        {!a.is_read && (
                          <div className="flex gap-1 flex-shrink-0">
                            <button
                              onClick={() => onMarkAlertRead(a.id)}
                              className="p-1 text-gray-400 hover:text-blue-600"
                              title="既読"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => onDismissAlert(a.id)}
                              className="p-1 text-gray-400 hover:text-red-600"
                              title="非表示"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                } else {
                  const n = item.data;
                  return (
                    <div
                      key={`notif-${n.id}`}
                      className={`px-4 py-3 border-b border-gray-100 dark:border-gray-700 last:border-b-0 ${
                        n.is_read ? 'bg-white dark:bg-gray-800' : 'bg-blue-50 dark:bg-blue-900/10'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`flex-shrink-0 w-2 h-2 rounded-full mt-2 ${n.is_read ? 'bg-gray-300' : 'bg-blue-500'}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <Info className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                            <p className={`text-sm ${n.is_read ? 'text-gray-500' : 'text-gray-900 dark:text-white font-medium'}`}>
                              {n.title}
                            </p>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                            {n.body}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            {n.sender_name && (
                              <span className="text-[10px] text-gray-400">{n.sender_name}</span>
                            )}
                            <span className="text-[10px] text-gray-400">{relativeTime(n.created_at)}</span>
                          </div>
                        </div>
                        {!n.is_read && (
                          <button
                            onClick={() => markNotifAsRead(n.id)}
                            className="flex-shrink-0 p-1 text-gray-400 hover:text-blue-600"
                            title="既読"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                }
              })
            )}
          </div>

          {/* フッター */}
          <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-2">
            <button
              onClick={() => setShowHistory((v) => !v)}
              className="w-full text-xs text-gray-500 hover:text-blue-600 flex items-center justify-center gap-1 py-1 transition-colors"
            >
              <History className="w-3 h-3" />
              {showHistory ? '未読のみ表示' : '過去の通知を見る'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
