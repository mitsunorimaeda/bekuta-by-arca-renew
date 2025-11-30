import React, { useState } from 'react';
import { Lock, AlertCircle, CheckCircle, Eye, EyeOff } from 'lucide-react';

interface PasswordResetConfirmProps {
  onResetComplete: () => void;
}

export function PasswordResetConfirm({ onResetComplete }: PasswordResetConfirmProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const validatePassword = (password: string): string | null => {
    if (password.length < 8) {
      return 'パスワードは8文字以上である必要があります。';
    }
    if (!/[A-Z]/.test(password)) {
      return 'パスワードには大文字を含める必要があります。';
    }
    if (!/[a-z]/.test(password)) {
      return 'パスワードには小文字を含める必要があります。';
    }
    if (!/[0-9]/.test(password)) {
      return 'パスワードには数字を含める必要があります。';
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      return 'パスワードには特殊文字を含める必要があります。';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('パスワードが一致しません。');
      return;
    }

    setLoading(true);

    try {
      const { supabase } = await import('../lib/supabase');

      // Update the password and clear the requires_password_change flag
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
        data: { requires_password_change: false }
      });

      if (updateError) throw updateError;

      setSuccess(true);

      // Clear URL hash to prevent recovery mode from persisting
      window.history.replaceState({}, '', '/');

      // Wait a moment for the state to update before redirecting
      setTimeout(() => {
        onResetComplete();
      }, 1500);
    } catch (err: any) {
      console.error('Password reset error:', err);
      setError(err.message || 'パスワードのリセットに失敗しました。');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="bg-blue-100 dark:bg-blue-900 rounded-full p-3 w-16 h-16 mx-auto mb-4">
            <Lock className="w-10 h-10 text-blue-600 dark:text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            パスワードをリセット
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            新しいパスワードを設定してください
          </p>
        </div>

        {success ? (
          <div className="space-y-4">
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                <div>
                  <p className="font-medium text-green-800 dark:text-green-300">
                    パスワードをリセットしました
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-400 mt-1">
                    ログイン画面に戻ります...
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                新しいパスワード
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-12 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent dark:bg-gray-700 dark:text-white transition-colors"
                  placeholder="新しいパスワードを入力"
                  disabled={loading}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  disabled={loading}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                パスワードを確認
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-12 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent dark:bg-gray-700 dark:text-white transition-colors"
                  placeholder="パスワードを再入力"
                  disabled={loading}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  disabled={loading}
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-2">
                パスワードの要件：
              </p>
              <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1">
                <li className="flex items-center space-x-2">
                  <span className={newPassword.length >= 8 ? 'text-green-600 dark:text-green-400' : ''}>
                    • 8文字以上
                  </span>
                </li>
                <li className="flex items-center space-x-2">
                  <span className={/[A-Z]/.test(newPassword) ? 'text-green-600 dark:text-green-400' : ''}>
                    • 大文字を含む
                  </span>
                </li>
                <li className="flex items-center space-x-2">
                  <span className={/[a-z]/.test(newPassword) ? 'text-green-600 dark:text-green-400' : ''}>
                    • 小文字を含む
                  </span>
                </li>
                <li className="flex items-center space-x-2">
                  <span className={/[0-9]/.test(newPassword) ? 'text-green-600 dark:text-green-400' : ''}>
                    • 数字を含む
                  </span>
                </li>
                <li className="flex items-center space-x-2">
                  <span className={/[!@#$%^&*(),.?":{}|<>]/.test(newPassword) ? 'text-green-600 dark:text-green-400' : ''}>
                    • 特殊文字を含む (!@#$%^&* など)
                  </span>
                </li>
              </ul>
            </div>

            {error && (
              <div className="flex items-start space-x-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <p className="text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 dark:bg-blue-700 text-white py-3 px-4 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {loading ? 'リセット中...' : 'パスワードをリセット'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
