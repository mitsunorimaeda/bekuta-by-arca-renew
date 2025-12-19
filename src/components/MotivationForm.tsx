import React, { useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Send, X, CheckCircle2, AlertTriangle } from 'lucide-react';

type Props = {
  userId: string;
  highlight?: boolean;
};

type ToastState = {
  open: boolean;
  message: string;
  type: 'success' | 'error';
};

export function ShareStatusButton({ userId, highlight }: Props) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [checked, setChecked] = useState(false);
  const [sending, setSending] = useState(false);

  const [toast, setToast] = useState<ToastState>({
    open: false,
    message: '',
    type: 'success',
  });

  const toastTimerRef = useRef<number | null>(null);

  const canSend = useMemo(() => checked && !sending, [checked, sending]);

  const showToast = (message: string, type: ToastState['type']) => {
    // 連打対策：前のタイマーをクリア
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }

    setToast({ open: true, message, type });

    toastTimerRef.current = window.setTimeout(() => {
      setToast((t) => ({ ...t, open: false }));
      toastTimerRef.current = null;
    }, 2200);
  };

  const resetAndClose = () => {
    setOpen(false);
    setNote('');
    setChecked(false);
  };

  const submit = async () => {
    if (!canSend) return;

    setSending(true);
    try {
      const { error } = await supabase.from('shared_reports').insert({
        user_id: userId,
        note: note.trim() ? note.trim() : null,
      });

      if (error) throw error;

      // ✅ 成功トースト
      showToast('スタッフに共有しました', 'success');

      // モーダルは少しだけ間を置いて閉じる（押した感を残す）
      setTimeout(() => {
        resetAndClose();
      }, 350);
    } catch (e) {
      console.error('[ShareStatusButton] insert failed:', e);
      showToast('共有に失敗しました。通信状況をご確認ください', 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={[
          'w-full rounded-xl px-4 py-3 flex items-center justify-center gap-2 transition-colors',
          'border',
          highlight
            ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700 active:bg-blue-800'
            : 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/60 active:bg-gray-100 dark:active:bg-gray-800',
        ].join(' ')}
      >
        <Send className="w-4 h-4" />
        <span className="font-medium">状態をスタッフに共有する</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50">
          {/* overlay */}
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => !sending && setOpen(false)}
          />

          {/* modal */}
          <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 shadow-2xl overflow-hidden">
            {/* header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <div className="font-semibold text-gray-900 dark:text-white">共有内容の確認</div>
              <button
                type="button"
                onClick={() => !sending && setOpen(false)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 active:bg-gray-200 dark:active:bg-white/15"
                aria-label="閉じる"
              >
                <X className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* what will be shared */}
              <div className="text-sm text-gray-700 dark:text-gray-200 space-y-1">
                <p>スタッフに以下の情報が共有されます：</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>直近の練習負荷（sRPE / ACWR）</li>
                  <li>最近の体重・コンディション</li>
                  <li>現在出ているアラート</li>
                </ul>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  ※記録データ自体は保存せず、共有ログのみ残します。
                </p>
              </div>

              {/* note */}
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                  メモ（任意）
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-white px-3 py-2 text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/60"
                  placeholder="例：膝に違和感、睡眠が浅い、今日はやり切れない感じ など"
                />
              </div>

              {/* confirm row (tapable) */}
              <button
                type="button"
                onClick={() => setChecked((v) => !v)}
                className={[
                  'w-full text-left rounded-xl border px-3 py-3 transition',
                  'flex items-start gap-3',
                  checked
                    ? 'border-blue-500/60 bg-blue-50 dark:bg-blue-500/10'
                    : 'border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10',
                ].join(' ')}
                aria-pressed={checked}
              >
                <span
                  className={[
                    'mt-0.5 w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition',
                    checked
                      ? 'bg-blue-600 border-blue-600'
                      : 'bg-transparent border-gray-400/60 dark:border-gray-300/40',
                  ].join(' ')}
                >
                  {checked && <CheckCircle2 className="w-4 h-4 text-white" />}
                </span>

                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    共有する内容を確認しました{' '}
                    <span className="text-xs text-amber-700 dark:text-amber-300">（必須）</span>
                  </div>
                  {!checked && (
                    <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                      ここをタップして確認すると「共有する」ボタンが有効になります
                    </div>
                  )}
                </div>
              </button>

              {!checked && (
                <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <div>共有するには「共有内容を確認しました（必須）」をONにしてください</div>
                </div>
              )}

              {/* submit */}
              <button
                type="button"
                onClick={submit}
                disabled={!canSend}
                className={[
                  'w-full rounded-xl px-4 py-3 font-semibold transition-colors',
                  canSend
                    ? 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
                    : 'bg-gray-200 text-gray-500 dark:bg-white/10 dark:text-white/40 cursor-not-allowed',
                ].join(' ')}
              >
                {sending ? '送信中...' : '共有する'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✅ bottom toast */}
      <div
        className={[
          'fixed left-1/2 bottom-5 -translate-x-1/2 z-[60]',
          'transition-all duration-200',
          toast.open ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none',
        ].join(' ')}
        role="status"
        aria-live="polite"
      >
        <div
          className={[
            'min-w-[260px] max-w-[92vw] rounded-2xl px-4 py-3 shadow-xl border backdrop-blur',
            toast.type === 'success'
              ? 'bg-emerald-600/90 text-white border-emerald-500/40'
              : 'bg-red-600/90 text-white border-red-500/40',
          ].join(' ')}
        >
          <div className="text-sm font-semibold">{toast.message}</div>
        </div>
      </div>
    </>
  );
}