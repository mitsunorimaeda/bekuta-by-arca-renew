import React, { useState, useEffect } from 'react';
import { Key, Eye, EyeOff, AlertCircle, CheckCircle, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';

interface PasswordChangeFormProps {
  onPasswordChange: (newPassword: string) => Promise<void>;
  userName: string;
}

export function PasswordChangeForm({ onPasswordChange, userName }: PasswordChangeFormProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [animationStep, setAnimationStep] = useState(0);
  const [progressPercent, setProgressPercent] = useState(0);

  useEffect(() => {
    setTimeout(() => setAnimationStep(1), 100);
    setTimeout(() => setAnimationStep(2), 400);
  }, []);

  useEffect(() => {
    const requirements = [
      passwordValidation.minLength,
      passwordValidation.hasUpperCase,
      passwordValidation.hasLowerCase,
      passwordValidation.hasNumbers,
      passwordValidation.hasSpecialChar
    ];
    const completed = requirements.filter(Boolean).length;
    const newPercent = (completed / requirements.length) * 100;
    setProgressPercent(newPercent);
  }, [newPassword]);

  const validatePassword = (password: string) => {
    const minLength = password.length >= 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    return {
      minLength,
      hasUpperCase,
      hasLowerCase,
      hasNumbers,
      hasSpecialChar,
      isValid: minLength && hasUpperCase && hasLowerCase && hasNumbers && hasSpecialChar
    };
  };

  const passwordValidation = validatePassword(newPassword);
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!passwordValidation.isValid) {
      setError('パスワードが要件を満たしていません。');
      return;
    }

    if (!passwordsMatch) {
      setError('パスワードが一致しません。');
      return;
    }

    setLoading(true);

    try {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });

      setTimeout(() => {
        confetti({
          particleCount: 50,
          angle: 60,
          spread: 55,
          origin: { x: 0 }
        });
        confetti({
          particleCount: 50,
          angle: 120,
          spread: 55,
          origin: { x: 1 }
        });
      }, 250);

      await onPasswordChange(newPassword);
    } catch (err: any) {
      console.error('Password change error:', err);
      setError('パスワードの変更に失敗しました。もう一度お試しください。');
    } finally {
      setLoading(false);
    }
  };

  const getProgressColor = () => {
    if (progressPercent < 40) return 'bg-red-500';
    if (progressPercent < 80) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getStrengthLabel = () => {
    if (progressPercent === 0) return '';
    if (progressPercent < 40) return '弱い';
    if (progressPercent < 80) return '普通';
    return '強い';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-900 dark:to-indigo-900 flex items-center justify-center p-4 transition-colors overflow-hidden">
      <div className={`bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 w-full max-w-md transition-all duration-700 ${
        animationStep >= 1 ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
      }`}>
        <div className="text-center mb-8">
          <div className={`bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900 dark:to-indigo-900 rounded-full p-3 w-16 h-16 mx-auto mb-4 transition-all duration-500 ${
            animationStep >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}>
            <Sparkles className="w-10 h-10 text-blue-600 dark:text-blue-400" />
          </div>
          <h1 className={`text-2xl font-bold text-gray-900 dark:text-white mb-2 transition-all duration-500 delay-100 ${
            animationStep >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}>
            あと1ステップ！
          </h1>
          <p className={`text-lg text-gray-600 dark:text-gray-300 mb-2 transition-all duration-500 delay-200 ${
            animationStep >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}>
            ようこそ、{userName}さん
          </p>
          <div className={`bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-4 transition-all duration-500 delay-300 ${
            animationStep >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}>
            <div className="flex items-center justify-center space-x-2 mb-2">
              <div className="w-8 h-8 bg-blue-600 dark:bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">1</div>
              <div className="w-12 h-1 bg-blue-600 dark:bg-blue-500 rounded"></div>
              <div className="w-8 h-8 bg-blue-600 dark:bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">2</div>
              <div className="w-12 h-1 bg-gray-300 dark:bg-gray-600 rounded"></div>
              <div className="w-8 h-8 bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-400 rounded-full flex items-center justify-center text-sm font-bold">3</div>
            </div>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              セキュリティのため、新しいパスワードを設定してください
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 transition-colors">
              新しいパスワード
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                id="newPassword"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="
                  w-full px-4 py-3 pr-12 border border-gray-300 dark:border-gray-600 rounded-lg 
                  focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-400 focus:border-transparent 
                  transition-colors
                  bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                  placeholder-gray-500 dark:placeholder-gray-400
                "
                placeholder="新しいパスワードを入力"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="
                  absolute right-3 top-1/2 transform -translate-y-1/2 
                  text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 
                  transition-colors
                "
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 transition-colors">
              パスワード確認
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="
                  w-full px-4 py-3 pr-12 border border-gray-300 dark:border-gray-600 rounded-lg 
                  focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-400 focus:border-transparent 
                  transition-colors
                  bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                  placeholder-gray-500 dark:placeholder-gray-400
                "
                placeholder="パスワードを再入力"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="
                  absolute right-3 top-1/2 transform -translate-y-1/2 
                  text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 
                  transition-colors
                "
              >
                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {newPassword && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">パスワード強度</span>
                <span className={`text-sm font-bold ${
                  progressPercent < 40 ? 'text-red-600 dark:text-red-400' :
                  progressPercent < 80 ? 'text-yellow-600 dark:text-yellow-400' :
                  'text-green-600 dark:text-green-400'
                }`}>
                  {getStrengthLabel()}
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                <div
                  className={`h-full ${getProgressColor()} transition-all duration-500 rounded-full`}
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>
            </div>
          )}

          <div className="bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-700 dark:to-blue-900/20 rounded-lg p-4 transition-colors">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 transition-colors">
              パスワード要件
            </h4>
            <div className="space-y-2 text-sm">
              <div className={`flex items-center transition-colors ${
                passwordValidation.minLength 
                  ? 'text-green-600 dark:text-green-400' 
                  : 'text-gray-400 dark:text-gray-500'
              }`}>
                <CheckCircle className="w-4 h-4 mr-2" />
                <span>8文字以上</span>
              </div>
              <div className={`flex items-center transition-colors ${
                passwordValidation.hasUpperCase 
                  ? 'text-green-600 dark:text-green-400' 
                  : 'text-gray-400 dark:text-gray-500'
              }`}>
                <CheckCircle className="w-4 h-4 mr-2" />
                <span>大文字を含む</span>
              </div>
              <div className={`flex items-center transition-colors ${
                passwordValidation.hasLowerCase 
                  ? 'text-green-600 dark:text-green-400' 
                  : 'text-gray-400 dark:text-gray-500'
              }`}>
                <CheckCircle className="w-4 h-4 mr-2" />
                <span>小文字を含む</span>
              </div>
              <div className={`flex items-center transition-colors ${
                passwordValidation.hasNumbers 
                  ? 'text-green-600 dark:text-green-400' 
                  : 'text-gray-400 dark:text-gray-500'
              }`}>
                <CheckCircle className="w-4 h-4 mr-2" />
                <span>数字を含む</span>
              </div>
              <div className={`flex items-center transition-colors ${
                passwordValidation.hasSpecialChar 
                  ? 'text-green-600 dark:text-green-400' 
                  : 'text-gray-400 dark:text-gray-500'
              }`}>
                <CheckCircle className="w-4 h-4 mr-2" />
                <span>特殊文字を含む (!@#$%^&*)</span>
              </div>
            </div>
          </div>

          {/* Password Match Indicator */}
          {confirmPassword.length > 0 && (
            <div className={`flex items-center text-sm transition-colors ${
              passwordsMatch 
                ? 'text-green-600 dark:text-green-400' 
                : 'text-red-600 dark:text-red-400'
            }`}>
              <CheckCircle className="w-4 h-4 mr-2" />
              <span>{passwordsMatch ? 'パスワードが一致しています' : 'パスワードが一致しません'}</span>
            </div>
          )}

          {error && (
            <div className="flex items-center space-x-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 transition-colors">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !passwordValidation.isValid || !passwordsMatch}
            className="
              w-full bg-orange-600 dark:bg-orange-700 text-white py-3 px-4 rounded-lg 
              hover:bg-orange-700 dark:hover:bg-orange-600 
              focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-400 focus:ring-offset-2 dark:focus:ring-offset-gray-800 
              transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium
            "
          >
            {loading ? 'パスワード変更中...' : 'パスワードを変更'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 mb-3">
            <p className="text-sm text-green-700 dark:text-green-300 font-medium">パスワード変更後、チームに参加完了です！</p>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">自動的にシステムにログインされます</p>
        </div>
      </div>
    </div>
  );
}