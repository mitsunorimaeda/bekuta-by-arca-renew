import React, { useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Send, X } from 'lucide-react';

type Props = {
  userId: string;
  // 画面側で「アラートがある時だけ目立たせる」等に使える
  highlight?: boolean;
};

export function ShareStatusButton({ userId, highlight }: Props) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [checked, setChecked] = useState(false);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const canSend = useMemo(() => checked && !sending, [checked, sending]);

  const submit = async () => {
    if (!canSend) return;
    setSending(true);
    try {
      const { error } = await supabase.from('shared_reports').insert({
        user_id: userId,
        note: note.trim() ? note.trim() : null,
      });

      if (error) throw error;

      setDone(true);
      // 完了メッセージを少し見せて閉じる
      setTimeout(() => {
        setOpen(false);
        setDone(false);
        setNote('');
        setChecked(false);
      }, 900);
    } catch (e) {
      console.error('[ShareStatusButton] insert failed:', e);
      alert('共有に失敗しました。通信状況を確認してもう一度お試しください。');
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
            ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
            : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/40',
        ].join(' ')}
      >
        <Send className="w-4 h-4" />
        <span className="font-medium">状態をスタッフに共有する</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => !sending && setOpen(false)}
          />
          <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-2xl">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div className="font-semibold text-gray-900 dark:text-white">共有内容の確認</div>
              <button
                type="button"
                onClick={() => !sending && setOpen(false)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                aria-label="閉じる"
              >
                <X className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              </button>
            </div>

            <div className="p-4 space-y-4">
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

              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                  メモ（任意）
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 text-sm"
                  placeholder="例：膝に違和感、睡眠が浅い、今日はやり切れない感じ など"
                />
              </div>

              <label className="flex items-start gap-3 text-sm text-gray-800 dark:text-gray-200">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => setChecked(e.target.checked)}
                  className="mt-1"
                />
                <span>共有する内容を確認しました</span>
              </label>

              <button
                type="button"
                onClick={submit}
                disabled={!canSend}
                className={[
                  'w-full rounded-xl px-4 py-3 font-semibold transition-colors',
                  canSend
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-200 text-gray-500 dark:bg-gray-800 dark:text-gray-500',
                ].join(' ')}
              >
                {done ? '共有しました' : sending ? '送信中...' : '共有する'}
              </button>

              {done && (
                <div className="text-center text-sm text-gray-700 dark:text-gray-200">
                  スタッフに共有しました。状態を伝えることは、コンディションを守る行動です。
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}