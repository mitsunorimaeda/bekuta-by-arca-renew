// src/pages/InviteExpired.tsx
import React, { useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Mail, RefreshCcw, AlertTriangle, CheckCircle, ArrowLeft } from 'lucide-react';

type Status = 'idle' | 'sending' | 'success' | 'error';

function normalizeEmail(v: string) {
  return v.trim().toLowerCase();
}

export default function InviteExpired() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState<string>('');

  const canSubmit = useMemo(() => {
    const e = normalizeEmail(email);
    return e.includes('@') && e.includes('.') && status !== 'sending';
  }, [email, status]);

  const handleSend = async () => {
    const e = normalizeEmail(email);
    if (!e) return;

    setStatus('sending');
    setMessage('');

    try {
      // ✅ Edge Function: request-password-reset を叩く
      // - これは「recoveryリンクを発行→Resend送信」までやってくれる想定
      const { data, error } = await supabase.functions.invoke('request-password-reset', {
        body: {
          email: e,
          redirectUrl: `${window.location.origin}/reset-password`,
        },
      });

      if (error) {
        console.error('[InviteExpired] request-password-reset error:', error);
        setStatus('error');
        setMessage('送信に失敗しました。時間をおいて再度お試しください。');
        return;
      }

      // 関数側は「存在しない場合も success」で返す設計（存在漏洩防止）なので、
      // フロントも一律成功メッセージにしてOK
      console.log('[InviteExpired] request-password-reset result:', data);
      setStatus('success');
      setMessage('再設定メールを送信しました。受信箱をご確認ください。迷惑メールも確認してください。');
    } catch (err: any) {
      console.error('[InviteExpired] exception:', err);
      setStatus('error');
      setMessage(err?.message || '送信に失敗しました。');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-start space-x-3">
            <div className="mt-1">
              <AlertTriangle className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                招待リンクの有効期限が切れました
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                下のフォームから、パスワード再設定（= 新しいログイン手段）を発行できます。
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 text-sm text-amber-900 dark:text-amber-200">
            <p className="font-medium mb-1">こういう時の救済ルートです</p>
            <ul className="list-disc list-inside space-y-1">
              <li>招待メールのリンクが切れてしまった</li>
              <li>会社のセキュリティでリンクが先読みされて無効になった</li>
              <li>時間が経ってしまった</li>
            </ul>
          </div>

          <label className="block">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
              登録メールアドレス
            </span>
            <div className="mt-2 flex items-center space-x-2">
              <div className="relative flex-1">
                <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="例）tanaka@example.com"
                  className="w-full pl-10 pr-3 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900
                             text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  type="email"
                  autoComplete="email"
                />
              </div>
              <button
                onClick={handleSend}
                disabled={!canSubmit}
                className="px-4 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium
                           disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                type="button"
              >
                {status === 'sending' ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    <span>送信中</span>
                  </>
                ) : (
                  <>
                    <RefreshCcw className="w-4 h-4" />
                    <span>再送</span>
                  </>
                )}
              </button>
            </div>
          </label>

          {message && (
            <div
              className={`rounded-lg p-3 text-sm border ${
                status === 'success'
                  ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-200'
                  : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-200'
              }`}
            >
              <div className="flex items-start space-x-2">
                {status === 'success' ? (
                  <CheckCircle className="w-4 h-4 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 mt-0.5" />
                )}
                <p>{message}</p>
              </div>
            </div>
          )}

          <div className="text-xs text-gray-600 dark:text-gray-300 space-y-1">
            <p>• メールが届かない場合は「迷惑メール」「プロモーション」も確認してください。</p>
            <p>• それでも届かない場合、時間をおいて再度お試しください。</p>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                window.history.replaceState({}, '', '/');
                window.location.reload();
              }}
              className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white flex items-center space-x-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>ログイン画面に戻る</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}