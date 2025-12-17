import React from 'react';
import { supabase } from '../lib/supabase';

export function AuthCallbackPage({ onDone }: { onDone: () => void }) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const url = new URL(window.location.href);
  const code = url.searchParams.get('code');

  const handleConfirm = async () => {
    setError(null);

    if (!code) {
      setError('URLに code がありません（リンクが不正か、既に消費されている可能性）');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) throw error;

      // code を URL から消す（/auth/callback のままでOK）
      window.history.replaceState({}, document.title, url.pathname);

      onDone();
    } catch (e: any) {
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
          セキュリティ上、ボタンを押した時だけ認証を完了します。
        </p>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          onClick={handleConfirm}
          disabled={loading}
          className="w-full bg-blue-600 text-white rounded-lg py-2 disabled:opacity-50"
        >
          {loading ? '処理中…' : 'ログインを完了する'}
        </button>
      </div>
    </div>
  );
}