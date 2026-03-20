import React, { useState, useEffect } from 'react';
import { Users, Sparkles, ArrowRight, Clock, CheckCircle2 } from 'lucide-react';
import confetti from 'canvas-confetti';

interface WelcomePageProps {
  onContinue: () => void;
}




interface InvitationData {
  email: string;
  name: string;
  role: string;
  team_name?: string;
  organization_name?: string;
  invited_by_name?: string;
  expires_at: string;
}

export function WelcomePage({ onContinue }: WelcomePageProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invitationData, setInvitationData] = useState<InvitationData | null>(null);
  const [animationStep, setAnimationStep] = useState(0);

  // ✅ URL から token を取得（/welcome?token=xxx）
  const url = new URL(window.location.href);
  const token = url.searchParams.get('token') ?? '';

  useEffect(() => {
    const fetchInvitationData = async () => {
      try {
        if (!token) {
          setError('招待トークンが見つかりません（URLに token がありません）');
          setLoading(false);
          return;
        }

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/invitation_tokens?token=eq.${token}&select=email,name,role,team_id,organization_id,invited_by,expires_at`,
          {
            headers: {
              apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json',
              Prefer: 'return=representation',
            },
          },
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ API Error:', errorText);
          setError(`招待情報の取得に失敗しました (${response.status})`);
          setLoading(false);
          return;
        }

        const data = await response.json();

        if (!data || data.length === 0) {
          console.warn('⚠️ No invitation found for token');
          setError('招待リンクが無効または期限切れです');
          setLoading(false);
          return;
        }

        const invitation = data[0];

        let teamName: string | undefined = undefined;
        if (invitation.team_id) {
          const teamResponse = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/teams?id=eq.${invitation.team_id}&select=name`,
            {
              headers: {
                apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
                Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
              },
            },
          );

          if (teamResponse.ok) {
            const teamData = await teamResponse.json();
            if (teamData && teamData.length > 0) {
              teamName = teamData[0].name;
            }
          }
        }

        let organizationName: string | undefined = undefined;
        if (invitation.organization_id) {
          const orgResponse = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/organizations?id=eq.${invitation.organization_id}&select=name`,
            {
              headers: {
                apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
                Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
              },
            },
          );

          if (orgResponse.ok) {
            const orgData = await orgResponse.json();
            if (orgData && orgData.length > 0) {
              organizationName = orgData[0].name;
            }
          }
        }

        setInvitationData({
          email: invitation.email,
          name: invitation.name,
          role: invitation.role,
          team_name: teamName,
          organization_name: organizationName,
          expires_at: invitation.expires_at,
        });

        setLoading(false);

        setTimeout(() => setAnimationStep(1), 100);
        setTimeout(() => setAnimationStep(2), 400);
        setTimeout(() => setAnimationStep(3), 800);

        setTimeout(() => {
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
          });
        }, 1200);
      } catch (err) {
        console.error('❌ Error fetching invitation:', err);
        setError('招待情報の取得に失敗しました。ネットワーク接続を確認してください。');
        setLoading(false);
      }
    };

    fetchInvitationData();
  }, [token]);

  const handleContinue = () => {
    if (invitationData) {
      confetti({
        particleCount: 50,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
      });
      confetti({
        particleCount: 50,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
      });

      setTimeout(() => {
        // ✅ ここでは onContinue() だけ呼ぶ
        // （App.tsx 側で /auth/callback?next=... に誘導する運用が安全）
        onContinue();
      }, 500);
    }
  };

  const getRoleDisplay = (role: string) => {
    switch (role) {
      case 'athlete':
        return 'アスリート';
      case 'staff':
        return 'スタッフ';
      case 'global_admin':
        return '管理者';
      default:
        return role;
    }
  };

  const getTimeRemaining = (expiresAt: string) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diffMs = expiry.getTime() - now.getTime();
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffHrs > 0) return `あと${diffHrs}時間`;
    if (diffMins > 0) return `あと${diffMins}分`;
    return '間もなく期限切れ';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-900 dark:to-indigo-900 flex items-center justify-center p-4 transition-colors">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 dark:border-blue-400 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300 text-lg">招待情報を確認中...</p>
        </div>
      </div>
    );
  }

  if (error || !invitationData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 dark:from-gray-900 dark:to-red-900 flex items-center justify-center p-4 transition-colors">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="bg-red-100 dark:bg-red-900 rounded-full p-4 w-16 h-16 mx-auto mb-4">
            <Clock className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">招待リンクが無効です</h1>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            {error || '招待リンクが見つからないか、期限切れです'}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            管理者に新しい招待リンクをリクエストしてください
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-900 dark:to-indigo-900 flex items-center justify-center p-4 transition-colors overflow-hidden">
      <div className="max-w-2xl w-full">
        <div
          className={`bg-white dark:bg-gray-800 rounded-3xl shadow-2xl overflow-hidden transform transition-all duration-700 ${
            animationStep >= 1 ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
          }`}
        >
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-700 dark:to-indigo-700 px-8 py-12 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-white dark:bg-gray-900 opacity-10">
              <div
                className="absolute top-0 left-0 w-full h-full"
                style={{
                  backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
                  backgroundSize: '30px 30px',
                }}
              />
            </div>

            <div
              className={`transform transition-all duration-700 delay-200 ${
                animationStep >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              }`}
            >
              <div className="bg-white dark:bg-gray-800 rounded-full p-4 w-20 h-20 mx-auto mb-6 shadow-lg">
                <Sparkles className="w-12 h-12 text-indigo-600 dark:text-indigo-400" />
              </div>

              <h1 className="text-4xl font-bold text-white mb-3">ようこそ、{invitationData.name}さん！</h1>

              {(invitationData.organization_name || invitationData.team_name) && (
                <div className="space-y-2">
                  {invitationData.organization_name && (
                    <div className="flex items-center justify-center space-x-2 text-blue-100 dark:text-blue-200 text-lg">
                      <Users className="w-5 h-5" />
                      <span className="font-semibold">{invitationData.organization_name}</span>
                      {invitationData.team_name && <span>-</span>}
                      {invitationData.team_name && <span className="font-semibold">{invitationData.team_name}</span>}
                      <span>があなたを待っています</span>
                    </div>
                  )}
                  {!invitationData.organization_name && invitationData.team_name && (
                    <div className="flex items-center justify-center space-x-2 text-blue-100 dark:text-blue-200 text-lg">
                      <Users className="w-5 h-5" />
                      <span className="font-semibold">{invitationData.team_name}</span>
                      <span>があなたを待っています</span>
                    </div>
                  )}
                </div>
              )}

              <p className="text-blue-100 dark:text-blue-200 text-lg mt-2">Bekuta への招待</p>
            </div>
          </div>

          <div className="px-8 py-10">
            <div
              className={`transform transition-all duration-700 delay-400 ${
                animationStep >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              }`}
            >
              <div className="space-y-6 mb-8">
                <div className="flex items-start space-x-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                  <div className="flex-shrink-0 mt-1">
                    <CheckCircle2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-1">あなたの役割</h3>
                    <p className="text-gray-600 dark:text-gray-300">{getRoleDisplay(invitationData.role)}として参加します</p>
                  </div>
                </div>

                <div className="flex items-start space-x-4 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl">
                  <div className="flex-shrink-0 mt-1">
                    <CheckCircle2 className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-1">メールアドレス</h3>
                    <p className="text-gray-600 dark:text-gray-300">{invitationData.email}</p>
                  </div>
                </div>

                <div className="flex items-start space-x-4 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
                  <div className="flex-shrink-0 mt-1">
                    <Clock className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-1">招待の有効期限</h3>
                    <p className="text-gray-600 dark:text-gray-300">{getTimeRemaining(invitationData.expires_at)}</p>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-6 mb-8">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3 text-center">次のステップ</h3>
                <ol className="space-y-2 text-gray-600 dark:text-gray-300 text-sm">
                  <li className="flex items-start space-x-2">
                    <span className="flex-shrink-0 w-6 h-6 bg-blue-600 dark:bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                      1
                    </span>
                    <span>メールに記載された一時パスワードでログイン</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="flex-shrink-0 w-6 h-6 bg-blue-600 dark:bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                      2
                    </span>
                    <span>セキュリティのため新しいパスワードに変更</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="flex-shrink-0 w-6 h-6 bg-blue-600 dark:bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                      3
                    </span>
                    <span>チームに参加完了！</span>
                  </li>
                </ol>
              </div>

              <button
                onClick={handleContinue}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-700 dark:to-indigo-700 text-white py-4 px-6 rounded-xl hover:from-blue-700 hover:to-indigo-700 dark:hover:from-blue-600 dark:hover:to-indigo-600 transition-all duration-300 font-semibold text-lg flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                <span>ログインして始める</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-6">
          問題が発生した場合は、招待を送った管理者にお問い合わせください
        </p>
      </div>
    </div>
  );
}