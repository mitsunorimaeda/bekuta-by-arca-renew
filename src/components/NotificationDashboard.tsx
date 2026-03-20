// src/components/NotificationDashboard.tsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  Bell,
  Send,
  CheckCircle,
  XCircle,
  AlertCircle,
  Users,
  Clock,
  ChevronDown,
  Loader2,
} from 'lucide-react';

interface Athlete {
  id: string;
  name: string;
}

interface BroadcastRecord {
  id: string;
  title: string;
  body: string;
  recipient_type: 'all' | 'selected';
  recipients_count: number;
  delivered_count: number;
  failed_count: number;
  created_at: string;
}

interface PushStatus {
  user_id: string;
  user_name: string;
  has_push: boolean;
}

interface NotificationDashboardProps {
  teamId: string;
  teamName: string;
  athletes: Athlete[];
  userId: string;
}

export function NotificationDashboard({ teamId, teamName, athletes, userId }: NotificationDashboardProps) {
  // --- Broadcast form state ---
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [recipientType, setRecipientType] = useState<'all' | 'selected'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // --- History state ---
  const [history, setHistory] = useState<BroadcastRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [showAllHistory, setShowAllHistory] = useState(false);

  // --- Push status state ---
  const [pushStatus, setPushStatus] = useState<PushStatus[]>([]);
  const [pushStatusLoading, setPushStatusLoading] = useState(true);

  // --- Load data ---
  useEffect(() => {
    loadHistory();
    loadPushStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const { data, error } = await supabase
        .from('notification_broadcasts')
        .select('id, title, body, recipient_type, recipients_count, delivered_count, failed_count, created_at')
        .eq('team_id', teamId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      setHistory((data ?? []) as BroadcastRecord[]);
    } catch (e) {
      console.error('Failed to load broadcast history:', e);
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadPushStatus = async () => {
    setPushStatusLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_team_push_status', { p_team_id: teamId });
      if (error) throw error;
      setPushStatus((data ?? []) as PushStatus[]);
    } catch (e) {
      console.error('Failed to load push status:', e);
    } finally {
      setPushStatusLoading(false);
    }
  };

  // --- Recipient logic ---
  const targetAthletes = useMemo(() => {
    if (recipientType === 'all') return athletes;
    return athletes.filter((a) => selectedIds.has(a.id));
  }, [recipientType, athletes, selectedIds]);

  const toggleAthlete = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === athletes.length) return new Set();
      return new Set(athletes.map((a) => a.id));
    });
  }, [athletes]);

  // --- Send broadcast ---
  const canSend = title.trim().length > 0 && body.trim().length > 0 && targetAthletes.length > 0;

  const handleSend = async () => {
    if (!canSend || sending) return;
    setSending(true);
    setSendResult(null);

    let delivered = 0;
    let failed = 0;

    try {
      // Send push to each target athlete via existing Edge Function
      for (const athlete of targetAthletes) {
        try {
          const { error } = await supabase.functions.invoke('send-web-push', {
            body: {
              user_id: athlete.id,
              title: title.trim(),
              body: body.trim(),
              url: '/',
            },
          });
          if (error) {
            failed++;
          } else {
            delivered++;
          }
        } catch {
          failed++;
        }
      }

      // Record broadcast in DB
      await supabase.from('notification_broadcasts').insert({
        team_id: teamId,
        sender_user_id: userId,
        title: title.trim(),
        body: body.trim(),
        recipient_type: recipientType,
        recipient_user_ids: targetAthletes.map((a) => a.id),
        recipients_count: targetAthletes.length,
        delivered_count: delivered,
        failed_count: failed,
      });

      setSendResult({
        type: failed === targetAthletes.length ? 'error' : 'success',
        text: `${delivered}人に送信完了${failed > 0 ? `（${failed}人失敗）` : ''}`,
      });

      // Reset form
      setTitle('');
      setBody('');
      setSelectedIds(new Set());
      setRecipientType('all');

      // Reload history
      loadHistory();
    } catch (e: any) {
      setSendResult({ type: 'error', text: e.message || '送信に失敗しました' });
    } finally {
      setSending(false);
      setTimeout(() => setSendResult(null), 5000);
    }
  };

  // --- Push status summary ---
  const pushEnabled = pushStatus.filter((p) => p.has_push);
  const pushDisabled = pushStatus.filter((p) => !p.has_push);

  // --- Relative time ---
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

  const displayedHistory = showAllHistory ? history : history.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* --- Section 1: 一斉通知送信 --- */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 transition-colors">
        <div className="flex items-center gap-2 mb-4">
          <Send className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">一斉通知を送信</h3>
        </div>

        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              タイトル
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 100))}
              placeholder="例: 明日の練習について"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            />
            <p className="text-xs text-gray-400 mt-1 text-right">{title.length}/100</p>
          </div>

          {/* Body */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              本文
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, 500))}
              placeholder="通知の内容を入力してください"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none"
            />
            <p className="text-xs text-gray-400 mt-1 text-right">{body.length}/500</p>
          </div>

          {/* Recipient type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              送信先
            </label>
            <div className="flex gap-3">
              <button
                onClick={() => setRecipientType('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  recipientType === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                全員（{athletes.length}人）
              </button>
              <button
                onClick={() => setRecipientType('selected')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  recipientType === 'selected'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                選択（{selectedIds.size}人）
              </button>
            </div>
          </div>

          {/* Athlete selection */}
          {recipientType === 'selected' && (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 max-h-48 overflow-y-auto">
              <button
                onClick={toggleAll}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline mb-2"
              >
                {selectedIds.size === athletes.length ? 'すべて解除' : 'すべて選択'}
              </button>
              <div className="space-y-1">
                {athletes.map((a) => (
                  <label
                    key={a.id}
                    className="flex items-center gap-2 py-1 px-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(a.id)}
                      onChange={() => toggleAthlete(a.id)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-900 dark:text-white">{a.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Send button */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleSend}
              disabled={!canSend || sending}
              className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600
                text-white px-6 py-2.5 rounded-lg font-medium transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {sending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  送信中...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  送信する
                </>
              )}
            </button>

            {sendResult && (
              <div className={`flex items-center gap-1.5 text-sm ${
                sendResult.type === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              }`}>
                {sendResult.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                {sendResult.text}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* --- Section 2: 送信履歴 --- */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 transition-colors">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">送信履歴</h3>
        </div>

        {historyLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          </div>
        ) : history.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">
            まだ通知を送信していません
          </p>
        ) : (
          <div className="space-y-3">
            {displayedHistory.map((b) => (
              <div
                key={b.id}
                className="border border-gray-100 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900 dark:text-white text-sm truncate">{b.title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{b.body}</p>
                  </div>
                  <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap flex-shrink-0">
                    {relativeTime(b.created_at)}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-2 text-xs">
                  <span className="text-gray-500 dark:text-gray-400">
                    {b.recipient_type === 'all' ? '全員' : '選択'} · {b.recipients_count}人
                  </span>
                  {b.delivered_count > 0 && (
                    <span className="text-green-600 dark:text-green-400 flex items-center gap-0.5">
                      <CheckCircle className="w-3 h-3" /> {b.delivered_count}
                    </span>
                  )}
                  {b.failed_count > 0 && (
                    <span className="text-red-500 dark:text-red-400 flex items-center gap-0.5">
                      <XCircle className="w-3 h-3" /> {b.failed_count}
                    </span>
                  )}
                </div>
              </div>
            ))}

            {history.length > 5 && (
              <button
                onClick={() => setShowAllHistory((v) => !v)}
                className="w-full text-center text-sm text-blue-600 dark:text-blue-400 hover:underline py-2 flex items-center justify-center gap-1"
              >
                <ChevronDown className={`w-4 h-4 transition-transform ${showAllHistory ? 'rotate-180' : ''}`} />
                {showAllHistory ? '閉じる' : `すべて表示（${history.length}件）`}
              </button>
            )}
          </div>
        )}
      </div>

      {/* --- Section 3: Push通知ステータス --- */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 transition-colors">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">プッシュ通知ステータス</h3>
          {!pushStatusLoading && (
            <span className="text-xs text-gray-400 ml-auto">
              {pushEnabled.length}/{pushStatus.length}人が有効
            </span>
          )}
        </div>

        {pushStatusLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          </div>
        ) : pushStatus.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">
            チームに選手がいません
          </p>
        ) : (
          <div className="space-y-4">
            {/* Enabled */}
            {pushEnabled.length > 0 && (
              <div>
                <p className="text-xs font-medium text-green-600 dark:text-green-400 mb-2 flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" />
                  有効（{pushEnabled.length}人）
                </p>
                <div className="flex flex-wrap gap-2">
                  {pushEnabled.map((p) => (
                    <span
                      key={p.user_id}
                      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium
                        bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300
                        border border-green-200 dark:border-green-800"
                    >
                      {p.user_name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Disabled */}
            {pushDisabled.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  未登録（{pushDisabled.length}人）
                </p>
                <div className="flex flex-wrap gap-2">
                  {pushDisabled.map((p) => (
                    <span
                      key={p.user_id}
                      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium
                        bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400
                        border border-gray-200 dark:border-gray-600"
                    >
                      {p.user_name}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                  ※ 未登録の選手には通知が届きません。設定画面でプッシュ通知をONにするよう案内してください。
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
