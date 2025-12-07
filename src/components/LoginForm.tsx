import React, { useState } from 'react';
import { LogIn, AlertCircle, Info, Eye, EyeOff } from 'lucide-react';

interface LoginFormProps {
  onLogin: (email: string, password: string) => Promise<void>;
}

export function LoginForm({ onLogin }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [resetError, setResetError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim() || !password) {
      setError('メールアドレスとパスワードを入力してください。');
      return;
    }

    if (!email.includes('@')) {
      setError('有効なメールアドレスを入力してください。');
      return;
    }

    setLoading(true);
    setError('');

    try {
      console.log('🔐 Login attempt for:', email.trim());
      await onLogin(email.trim(), password);
      console.log('✅ Login successful');
    } catch (err: any) {
      console.error('❌ Login error:', err);
      console.error('Error message:', err.message);
      console.error('Error details:', err);

      if (
        err.message?.includes('Invalid login credentials') ||
        err.message?.includes('メールアドレスまたはパスワードが正しくありません')
      ) {
        setError(
          'メールアドレスまたはパスワードが正しくありません。\n\n考えられる原因：\n• アカウントが作成されていない\n• パスワードが間違っている\n• メールアドレスが間違っている\n\n管理者にアカウント作成を依頼してください。'
        );
      } else if (err.message?.includes('Email not confirmed')) {
        setError('メールアドレスが確認されていません。管理者にお問い合わせください。');
      } else if (err.message?.includes('Too many requests')) {
        setError('ログイン試行回数が多すぎます。5分程度待ってから再試行してください。');
      } else if (err.message?.includes('Missing Supabase environment variables')) {
        setError('システム設定エラー：データベース接続が設定されていません。管理者に連絡してください。');
      } else {
        setError(
          err.message ||
            'ログインに失敗しました。しばらく待ってから再試行するか、管理者にお問い合わせください。'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const togglePasswordVisibility = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowPassword((prev) => !prev);
  };

  /**
   * 🔐 パスワードリセット：
   *   Supabase の Edge Function `request-password-reset`
   *   ＋ Resend 経由でメール送信
   */
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');
    setResetSent(false);
  
    const trimmedEmail = resetEmail.trim();
  
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setResetError('有効なメールアドレスを入力してください。');
      return;
    }
  
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('❌ VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY is not set');
      setResetError(
        'システム設定エラー：パスワードリセットが現在利用できません。管理者に連絡してください。'
      );
      return;
    }
  
    setLoading(true);
  
    try {
      console.log('🔐 Requesting password reset for:', trimmedEmail);
  
      const response = await fetch(`${supabaseUrl}/functions/v1/request-password-reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          email: trimmedEmail,
          // Supabase の hosted パスワード変更ページ → 完了後にここへ戻る
          redirectUrl: window.location.origin,
        }),
      });
  
      const result = await response.json().catch(() => ({}));
  
      if (!response.ok) {
        console.error('❌ request-password-reset error:', response.status, result);
  
        if (response.status === 404) {
          setResetError(
            'このメールアドレスは登録されていない可能性があります。入力内容を確認するか、管理者にお問い合わせください。'
          );
        } else {
          setResetError(
            result?.error ||
              'パスワードリセットメールの送信に失敗しました。時間をおいて再度お試しください。'
          );
        }
        return;
      }
  
      console.log('✅ Password reset request accepted:', result);
      setResetSent(true);
    } catch (err: any) {
      console.error('❌ Password reset request failed:', err);
      setResetError(
        'パスワードリセットメールの送信に失敗しました。ネットワーク環境を確認するか、管理者にお問い合わせください。'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4 transition-colors">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 w-full max-w-md transition-colors">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="bg-blue-100 dark:bg-blue-900 rounded-full p-3 w-16 h-16 mx-auto mb-4 transition-colors">
            <LogIn className="w-10 h-10 text-blue-600 dark:text-blue-400" />
          </div>
          <h1 className="flex items-baseline justify-center space-x-2 mb-2 transition-colors">
            <span
              className="text-2xl font-bold text-gray-900 dark:text-white"
              style={{
                fontFamily:
                  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                letterSpacing: '-0.02em',
              }}
            >
              Bekuta
            </span>
            <span
              className="text-sm font-medium text-gray-500 dark:text-gray-400"
              style={{ letterSpacing: '0.05em' }}
            >
              by ARCA
            </span>
          </h1>
          <p className="text-gray-600 dark:text-gray-300 transition-colors">
            トレーニング負荷管理システムへログイン
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Email */}
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 transition-colors"
            >
              メールアドレス
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="
                w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg 
                focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent 
                transition-colors text-base
                bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                placeholder-gray-500 dark:placeholder-gray-400
              "
              placeholder="your-email@example.com"
              required
              disabled={loading}
              autoComplete="email"
              style={{
                fontSize: '16px',
                WebkitAppearance: 'none',
                WebkitBorderRadius: '0.5rem',
              }}
            />
          </div>

          {/* Password */}
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 transition-colors"
            >
              パスワード
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="
                  w-full px-4 py-3 pr-12 border border-gray-300 dark:border-gray-600 rounded-lg 
                  focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent 
                  transition-colors text-base
                  bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                  placeholder-gray-500 dark:placeholder-gray-400
                "
                placeholder="••••••••"
                required
                disabled={loading}
                autoComplete="current-password"
                style={{
                  fontSize: '16px',
                  WebkitAppearance: 'none',
                  WebkitBorderRadius: '0.5rem',
                }}
              />
              <button
                type="button"
                onClick={togglePasswordVisibility}
                className="
                  absolute right-3 top-1/2 transform -translate-y-1/2 
                  text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 
                  transition-colors touch-target
                "
                disabled={loading}
                style={{
                  WebkitTapHighlightColor: 'transparent',
                  touchAction: 'manipulation',
                }}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Login Error */}
          {error && (
            <div className="flex items-start space-x-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 transition-colors">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium mb-1">ログインエラー</p>
                <p className="whitespace-pre-line">{error}</p>
              </div>
            </div>
          )}

          {/* Login Button */}
          <button
            type="submit"
            disabled={loading}
            className="
              w-full bg-blue-600 dark:bg-blue-700 text-white py-3 px-4 rounded-lg
              hover:bg-blue-700 dark:hover:bg-blue-600
              focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:ring-offset-2 dark:focus:ring-offset-gray-800
              transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium touch-target
            "
            style={{
              WebkitTapHighlightColor: 'transparent',
              touchAction: 'manipulation',
            }}
          >
            {loading ? 'ログイン中...' : 'ログイン'}
          </button>

          {/* Forgot password link */}
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => {
                setShowForgotPassword(true);
                setResetEmail(email);
                setResetError('');
                setResetSent(false);
              }}
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
            >
              パスワードを忘れた場合
            </button>
          </div>
        </form>

        {/* Info blocks */}
        <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400 transition-colors">
          {/* 初回利用案内（招待メール＋パスワード設定リンク版） */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 transition-colors">
            <div className="flex items-start space-x-2">
              <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-medium text-blue-900 dark:text-blue-300 mb-2">初回利用の方へ</h3>
                <div className="text-blue-700 dark:text-blue-400 space-y-1 text-left text-xs">
                  <p>1. 管理者から「Bekuta 招待メール」を受け取る</p>
                  <p>2. メール内の「パスワードを設定する」ボタンを押す</p>
                  <p>3. 表示される画面でパスワードを設定し、その後この画面からログイン</p>
                </div>
              </div>
            </div>
          </div>

          {/* トラブルシュート */}
          <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg transition-colors">
            <div className="flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="text-amber-700 dark:text-amber-400 text-xs text-left">
                <p className="font-medium mb-1">ログインできない場合</p>
                <p>管理者に以下の情報をお伝えください：</p>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li>使用しているメールアドレス</li>
                  <li>「招待メール」または「パスワードリセットメール」を受け取っているか</li>
                  <li>パスワード設定（変更）画面が表示されるかどうか</li>
                  <li>エラーメッセージの内容</li>
                </ul>
              </div>
            </div>
          </div>

          <p className="mt-4 text-xs">ログイン情報が不明な場合は管理者にお問い合わせください</p>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 w-full max-w-md">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              パスワードをリセット
            </h2>

            {resetSent ? (
              <div className="space-y-4">
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <p className="text-green-800 dark:text-green-300 text-sm">
                    パスワードリセット用のメールを送信しました。
                  </p>
                  <p className="text-green-700 dark:text-green-400 text-sm mt-2">
                    メールに記載されたリンクを押して、表示された画面で新しいパスワードを設定してください。
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowForgotPassword(false);
                    setResetSent(false);
                    setResetEmail('');
                  }}
                  className="w-full bg-blue-600 dark:bg-blue-700 text-white py-3 px-4 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
                >
                  閉じる
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  登録されているメールアドレスを入力してください。パスワードリセット用のリンクをお送りします。
                </p>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    メールアドレス
                  </label>
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent dark:bg-gray-700 dark:text-white transition-colors"
                    placeholder="email@example.com"
                    disabled={loading}
                  />
                </div>

                {resetError && (
                  <div className="flex items-start space-x-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400">
                    <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <p className="text-sm whitespace-pre-line">{resetError}</p>
                  </div>
                )}

                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotPassword(false);
                      setResetError('');
                      setResetEmail('');
                    }}
                    className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 py-3 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                    disabled={loading}
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-blue-600 dark:bg-blue-700 text-white py-3 px-4 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? '送信中...' : 'リセットメールを送信'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}