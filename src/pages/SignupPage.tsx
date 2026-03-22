import { useState } from 'react';
import { Shield, ArrowLeft, ArrowRight, Check, Eye, EyeOff, Copy, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { trackEvent } from '../lib/posthog';

interface SignupPageProps {
  onLoginSuccess: () => void;
  onNavigateToLogin: () => void;
  onNavigateToLanding: () => void;
}

export function SignupPage({ onLoginSuccess, onNavigateToLogin, onNavigateToLanding }: SignupPageProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);

  // Step 1
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [passwordConfirm, setPasswordConfirm] = useState('');

  // Step 2
  const [organizationName, setOrganizationName] = useState('');
  const [teamName, setTeamName] = useState('');

  // Step 3 result
  const [inviteLink, setInviteLink] = useState('');

  const validateStep1 = () => {
    if (!name.trim()) return '名前を入力してください';
    if (!email.trim()) return 'メールアドレスを入力してください';
    if (!/\S+@\S+\.\S+/.test(email)) return '正しいメールアドレスを入力してください';
    if (password.length < 8) return 'パスワードは8文字以上で設定してください';
    if (password !== passwordConfirm) return 'パスワードが一致しません';
    return null;
  };

  const validateStep2 = () => {
    if (!organizationName.trim()) return '組織名を入力してください';
    if (!teamName.trim()) return 'チーム名を入力してください';
    return null;
  };

  const handleNext = () => {
    setError('');
    if (step === 1) {
      const err = validateStep1();
      if (err) { setError(err); return; }
      setStep(2);
    }
  };

  const handleSubmit = async () => {
    setError('');
    const err = validateStep2();
    if (err) { setError(err); return; }

    setLoading(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/self-signup`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password, organizationName, teamName }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || '登録に失敗しました');
        setLoading(false);
        return;
      }

      // 招待リンク生成
      const link = `${window.location.origin}/join?token=${data.inviteToken}`;
      setInviteLink(link);

      // 自動ログイン
      const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
      if (loginError) {
        console.error('Auto-login failed:', loginError);
      }

      trackEvent('user_registered', {
        method: 'self_signup',
        organization: organizationName,
        team: teamName,
      });

      setStep(3);
    } catch (err) {
      setError('予期しないエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <Shield size={28} className="text-blue-600" />
            <span className="text-2xl font-bold text-blue-600" style={{ letterSpacing: '-0.02em' }}>
              Bekuta
            </span>
          </div>
          <p className="text-gray-500 text-sm">データで選手を守るプラットフォーム</p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                  s < step
                    ? 'bg-blue-600 text-white'
                    : s === step
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {s < step ? <Check size={16} /> : s}
              </div>
              {s < 3 && (
                <div className={`w-8 h-0.5 ${s < step ? 'bg-blue-600' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Step 1: Basic Info */}
          {step === 1 && (
            <>
              <h2 className="text-xl font-bold text-gray-900 mb-1">アカウント作成</h2>
              <p className="text-sm text-gray-500 mb-6">コーチ・トレーナーの方はこちら</p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">名前</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                    placeholder="山田 太郎"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">メールアドレス</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                    placeholder="coach@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">パスワード</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base pr-12"
                      placeholder="8文字以上"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">パスワード（確認）</label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                    placeholder="もう一度入力"
                  />
                </div>
              </div>

              {error && (
                <div className="mt-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>
              )}

              <button
                onClick={handleNext}
                className="w-full mt-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                次へ <ArrowRight size={18} />
              </button>

              <div className="mt-4 text-center">
                <span className="text-sm text-gray-500">既にアカウントをお持ちですか？</span>{' '}
                <button
                  onClick={onNavigateToLogin}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  ログイン
                </button>
              </div>
            </>
          )}

          {/* Step 2: Team Info */}
          {step === 2 && (
            <>
              <h2 className="text-xl font-bold text-gray-900 mb-1">チーム情報</h2>
              <p className="text-sm text-gray-500 mb-6">組織名とチーム名を入力してください</p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">組織名（学校名・クラブ名）</label>
                  <input
                    type="text"
                    value={organizationName}
                    onChange={(e) => setOrganizationName(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                    placeholder="○○高等学校"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">チーム名（部活名）</label>
                  <input
                    type="text"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                    placeholder="サッカー部"
                  />
                </div>
              </div>

              {error && (
                <div className="mt-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>
              )}

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => { setStep(1); setError(''); }}
                  className="px-4 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1"
                >
                  <ArrowLeft size={18} /> 戻る
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex-1 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? '作成中...' : 'チームを作成'}
                </button>
              </div>
            </>
          )}

          {/* Step 3: Complete */}
          {step === 3 && (
            <>
              <div className="text-center mb-6">
                <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-4">
                  <Check size={32} className="text-green-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">チームが作成されました！</h2>
                <p className="text-sm text-gray-500 mt-1">次に、選手を招待しましょう</p>
              </div>

              {/* Invite Link */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <p className="text-sm font-medium text-gray-700 mb-2">選手招待リンク</p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={inviteLink}
                    className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-600 truncate"
                  />
                  <button
                    onClick={handleCopyLink}
                    className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1 transition-colors ${
                      copied
                        ? 'bg-green-100 text-green-700'
                        : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                    }`}
                  >
                    {copied ? <><Check size={16} /> コピー済み</> : <><Copy size={16} /> コピー</>}
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  このリンクを選手に共有してください。リンクから登録できます。
                </p>
              </div>

              <button
                onClick={onLoginSuccess}
                className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                ダッシュボードへ <ExternalLink size={18} />
              </button>
            </>
          )}
        </div>

        {/* Back to LP */}
        {step !== 3 && (
          <div className="mt-6 text-center">
            <button
              onClick={onNavigateToLanding}
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              &larr; Bekutaについて詳しく見る
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
