// src/pages/JoinPage.tsx
// チーム別シェアリンク自己登録ページ
// URL: /join?token=<token>

import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { trackEvent } from '../lib/posthog';

interface TokenInfo {
  valid: boolean;
  role: 'athlete' | 'staff';
  teamId: string | null;
  teamName: string | null;
  organizationId: string;
  organizationName: string;
  label: string | null;
  requiresApproval: boolean;
}

const ROLE_LABEL: Record<string, string> = {
  athlete: '選手',
  staff: 'スタッフ（コーチ・トレーナー）',
};

interface Props {
  onLoginSuccess: () => void;
}

export function JoinPage({ onLoginSuccess }: Props) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

  const token = new URL(window.location.href).searchParams.get('token') ?? '';

  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [tokenLoading, setTokenLoading] = useState(true);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState<{ requiresApproval: boolean } | null>(null);

  // トークン検証
  useEffect(() => {
    if (!token) {
      setTokenError('招待トークンが見つかりません。招待リンクを確認してください。');
      setTokenLoading(false);
      return;
    }

    (async () => {
      try {
        const res = await fetch(
          `${supabaseUrl}/functions/v1/join-with-token?token=${encodeURIComponent(token)}`,
          {
            headers: {
              apikey: supabaseAnonKey,
              Authorization: `Bearer ${supabaseAnonKey}`,
            },
          }
        );
        const data = await res.json();
        if (!res.ok) {
          setTokenError(data.error ?? '招待リンクが無効です');
        } else {
          setTokenInfo(data);
        }
      } catch {
        setTokenError('招待リンクの検証に失敗しました。ネットワーク接続を確認してください。');
      } finally {
        setTokenLoading(false);
      }
    })();
  }, [token, supabaseUrl, supabaseAnonKey]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (password !== passwordConfirm) {
      setSubmitError('パスワードが一致しません');
      return;
    }
    if (password.length < 8) {
      setSubmitError('パスワードは8文字以上で設定してください');
      return;
    }

    setSubmitting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const authToken = sessionData?.session?.access_token ?? supabaseAnonKey;

      const res = await fetch(`${supabaseUrl}/functions/v1/join-with-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ token, name, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setSubmitError(data.error ?? '登録に失敗しました');
        return;
      }

      if (data.requiresApproval) {
        // スタッフ: 承認待ち画面を表示
        trackEvent('user_registered', { role: 'staff', requires_approval: true });
        setDone({ requiresApproval: true });
      } else {
        // 選手: そのままログイン
        trackEvent('user_registered', { role: 'athlete', requires_approval: false });
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) {
          setSubmitError('登録は完了しましたが、自動ログインに失敗しました。ログインページからログインしてください。');
          return;
        }
        setDone({ requiresApproval: false });
        // App.tsx 側でセッションを検知してダッシュボードに遷移させる
        window.history.replaceState({}, '', '/');
        onLoginSuccess();
      }
    } catch {
      setSubmitError('エラーが発生しました。しばらく待ってから再試行してください。');
    } finally {
      setSubmitting(false);
    }
  };

  // ===== 読み込み中 =====
  if (tokenLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">招待リンクを確認中...</p>
        </div>
      </div>
    );
  }

  // ===== トークンエラー =====
  if (tokenError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-xl shadow p-8 max-w-md w-full text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">招待リンクが無効です</h1>
          <p className="text-gray-600 text-sm mb-6">{tokenError}</p>
          <p className="text-xs text-gray-500">
            問題が続く場合は、招待を送った管理者にお問い合わせください。
          </p>
        </div>
      </div>
    );
  }

  // ===== 登録完了（承認待ち） =====
  if (done?.requiresApproval) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-xl shadow p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">登録申請を受け付けました</h1>
          <p className="text-gray-600 text-sm mt-2">
            管理者が承認するとログインできるようになります。
            承認完了後、登録したメールアドレスに連絡が届く場合があります。
          </p>
          <p className="text-xs text-gray-400 mt-6">
            このページは閉じても構いません。
          </p>
        </div>
      </div>
    );
  }

  const info = tokenInfo!;

  // ===== 登録フォーム =====
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-xl shadow p-8 max-w-md w-full">
        {/* ヘッダー */}
        <div className="text-center mb-6">
          <img
            src="/bekuta-logo.png"
            alt="Bekuta"
            className="h-10 mx-auto mb-3"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <h1 className="text-2xl font-bold text-gray-900">Bekuta に参加する</h1>
          <p className="text-sm text-gray-500 mt-1">アカウントを作成してチームに参加しましょう</p>
        </div>

        {/* チーム情報バッジ */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6 text-sm">
          <div className="flex items-center gap-2 text-blue-800">
            <span>🏅</span>
            <span className="font-medium">
              {info.teamName ?? info.organizationName} への参加
            </span>
          </div>
          <div className="text-blue-600 mt-1 text-xs">
            役割: {ROLE_LABEL[info.role] ?? info.role}
            {info.requiresApproval && '（管理者の承認が必要です）'}
          </div>
        </div>

        {/* 登録フォーム */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              氏名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="田中 太郎"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              メールアドレス <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="tanaka@example.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              パスワード <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="8文字以上"
              minLength={8}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              パスワード（確認） <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              required
              placeholder="もう一度入力してください"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>

          {submitError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
              {submitError}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
            )}
            {submitting
              ? '登録中...'
              : info.requiresApproval
              ? '参加を申請する'
              : '登録してすぐに始める'}
          </button>
        </form>

        <p className="text-xs text-gray-400 text-center mt-4">
          登録することで利用規約およびプライバシーポリシーに同意したものとみなされます。
        </p>
      </div>
    </div>
  );
}
