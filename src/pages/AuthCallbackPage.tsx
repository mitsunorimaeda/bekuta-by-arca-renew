import React from 'react';
import { supabase } from '../lib/supabase';

/**
 * decodeURIComponent が壊れた値で落ちないようにする
 */
function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * open redirect 対策
 * - 同一オリジンの相対パスのみ許可
 */
function normalizeNext(next: string | null) {
  if (!next) return '/';
  if (next.startsWith('http://') || next.startsWith('https://')) return '/';
  if (!next.startsWith('/')) return '/';
  return next;
}

export function AuthCallbackPage({ onDone }: { onDone: () => void }) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const url = new URL(window.location.href);

  // 🔁 認証完了後の遷移先（用途別）
  const next = normalizeNext(url.searchParams.get('next'));

  // ① 先読み対策用：verify URL をラップして渡す方式
  // /auth/callback?verify=<ENCODED_SUPABASE_VERIFY_URL>&next=/reset-password
  const verify = url.searchParams.get('verify');
  const verifyUrl = verify ? safeDecode(verify) : null;

  // ② PKCE code 方式（Supabaseが code を付けて戻すケース）
  const code = url.searchParams.get('code');

  // ③ 古い recovery hash 方式
  // #access_token=xxx&refresh_token=yyy&type=recovery
  const hash = window.location.hash;
  const hashParams = hash ? new URLSearchParams(hash.replace('#', '')) : null;
  const hashType = hashParams?.get('type');
  const access_token = hashParams?.get('access_token');
  const refresh_token = hashParams?.get('refresh_token');

  const hint = React.useMemo(() => {
    if (verifyUrl) {
      return 'ボタンを押すまで認証リンクを開かないため、メールのリンク先読み対策になります。';
    }
    if (code) {
      return 'セキュリティ上、ボタンを押した時だけ認証を完了します。';
    }
    if (hashType === 'recovery') {
      return 'ボタンを押してセッションを確定します。';
    }
    return 'リンクが失効している可能性があります。';
  }, [verifyUrl, code, hashType]);

  const handleConfirm = async () => {
    setError(null);
    setLoading(true);

    try {
      /**
       * A) verify URL がある場合
       * 👉 ここで初めて Supabase の verify に飛ばす（先読み対策の要）
       */
      if (verifyUrl) {
        window.location.href = verifyUrl;
        return;
      }

      /**
       * B) PKCE code がある場合
       */
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) throw error;

        // code を URL から削除
        window.history.replaceState({}, document.title, url.pathname);

        window.location.href = next;
        return;
      }

      /**
       * C) recovery hash がある場合
       */
      if (hashType === 'recovery' && access_token && refresh_token) {
        const { error } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });
        if (error) throw error;

        // hash を削除
        window.history.replaceState({}, document.title, url.pathname + url.search);

        window.location.href = next;
        return;
      }

      throw new Error(
        '認証情報が見つかりません（リンクが不正、または先読みで失効している可能性があります）'
      );
    } catch (e: any) {
      console.error('[AuthCallback] failed:', e);
      setError(e?.message ?? '認証に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="bg-white rounded-xl shadow p-6 max-w-md w-full space-y-4">
        <h1 className="text-lg font-bold">ログインを完了します</h1>

        <p className="text-sm text-gray-600">
          {hint}
        </p>

        {error && (
          <p className="text-sm text-red-600">
            {error}
          </p>
        )}

        <button
          onClick={handleConfirm}
          disabled={loading}
          className="w-full bg-blue-600 text-white rounded-lg py-2 disabled:opacity-50"
        >
          {loading ? '処理中…' : '認証を確定する'}
        </button>

        {/* どうしてもダメな場合の逃げ道 */}
        <button
          type="button"
          onClick={() => (window.location.href = '/invite-expired')}
          className="w-full text-sm text-gray-600 underline"
        >
          招待リンク切れ（再送）へ
        </button>

        <button
          type="button"
          onClick={() => {
            window.history.replaceState({}, '', '/');
            onDone();
          }}
          className="w-full text-sm text-gray-500 underline"
        >
          トップに戻る
        </button>
      </div>
    </div>
  );
}