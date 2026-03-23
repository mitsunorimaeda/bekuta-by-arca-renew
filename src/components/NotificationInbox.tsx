// src/components/NotificationInbox.tsx
// 選手向けの通知受信ボックス（ヘッダーのベルアイコンから開く）
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Bell, Check, X, History } from 'lucide-react';

interface UserNotification {
  id: string;
  title: string;
  body: string;
  sender_name: string | null;
  is_read: boolean;
  created_at: string;
}

interface NotificationInboxProps {
  userId: string;
}

export function NotificationInbox({ userId }: NotificationInboxProps) {
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // 未読通知のみカウント
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  // 表示する通知（未読のみ or 全件）
  const displayedNotifications = showHistory
    ? notifications
    : notifications.filter((n) => !n.is_read);

  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
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
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // 30秒ごとにポーリング
  useEffect(() => {
    const timer = setInterval(fetchNotifications, 30000);
    return () => clearInterval(timer);
  }, [fetchNotifications]);

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

  // 個別既読（タップで即リストから消える）
  const markAsRead = async (id: string) => {
    // UIから即座に消す
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    // DBに反映
    await supabase.from('user_notifications').update({ is_read: true }).eq('id', id);
  };

  // 全件既読（一括クリア）
  const markAllAsRead = async () => {
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    // UIから即座に全部消す
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    // DBに反映
    await supabase.from('user_notifications').update({ is_read: true }).in('id', unreadIds);
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

  return (
    <div className="relative" ref={panelRef}>
      {/* ベルアイコン */}
      <button
        type="button"
        onClick={() => { setOpen((v) => !v); setShowHistory(false); }}
        className="relative p-2 rounded-lg text-white hover:bg-white/10 transition-colors"
        aria-label="通知"
        title="通知"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* ドロップダウンパネル */}
      {open && (
        <div className="fixed left-4 right-4 top-16 sm:absolute sm:left-auto sm:right-0 sm:top-12 sm:w-80 max-h-96 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden z-50">
          {/* ヘッダー */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              {showHistory ? '過去の通知' : '通知'}
            </h3>
            <div className="flex items-center gap-2">
              {!showHistory && unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
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

          {/* 通知リスト */}
          <div className="overflow-y-auto max-h-[280px]">
            {loading && notifications.length === 0 ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
              </div>
            ) : displayedNotifications.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {showHistory ? '過去の通知はありません' : '新しい通知はありません'}
                </p>
                {!showHistory && (
                  <p className="text-xs text-gray-400 mt-1">🎉</p>
                )}
              </div>
            ) : (
              displayedNotifications.map((n) => (
                <div
                  key={n.id}
                  className={`w-full text-left px-4 py-3 border-b border-gray-100 dark:border-gray-700 last:border-b-0 transition-all ${
                    n.is_read
                      ? 'bg-white dark:bg-gray-800'
                      : 'bg-blue-50 dark:bg-blue-900/20'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* 未読ドット */}
                    <div className="flex-shrink-0 pt-1.5">
                      <div className={`w-2 h-2 rounded-full ${n.is_read ? 'bg-gray-300' : 'bg-blue-500'}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm ${n.is_read ? 'text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-white font-medium'}`}>
                        {n.title}
                      </p>
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
                    {/* 既読ボタン（未読のみ表示） */}
                    {!n.is_read && (
                      <button
                        onClick={(e) => { e.stopPropagation(); markAsRead(n.id); }}
                        className="flex-shrink-0 p-1 text-gray-400 hover:text-blue-600 transition-colors"
                        title="既読にする"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* フッター: 過去の通知を表示/非表示切替 */}
          {notifications.length > 0 && (
            <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-2">
              <button
                onClick={() => setShowHistory((v) => !v)}
                className="w-full text-xs text-gray-500 hover:text-blue-600 flex items-center justify-center gap-1 py-1 transition-colors"
              >
                <History className="w-3 h-3" />
                {showHistory ? '未読のみ表示' : '過去の通知を見る'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
