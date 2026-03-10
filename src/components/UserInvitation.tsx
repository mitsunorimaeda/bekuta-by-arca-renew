import React, { useState, useEffect } from 'react';
import { Team, supabase } from '../lib/supabase';
import { UserPlus, Mail, CheckCircle, AlertCircle, Download, Info, Eye, EyeOff, Copy, Link as LinkIcon, Building2 } from 'lucide-react';
import { generateInvitationEmailHTML, generateInvitationEmailText } from '../lib/emailTemplates';
import { organizationQueries } from '../lib/organizationQueries';
import { getTodayJSTString } from '../lib/date';


interface UserInvitationProps {
  teams: Team[];
  onUserInvited: () => void;
  restrictToOrganizationId?: string;
  allowAdminInvite?: boolean;
}

interface InvitedUser {
  name: string;
  email: string;
  role: string;
  teamName?: string;
  organizationName?: string;
  user_id?: string;
  temporaryPassword?: string;
  invitedAt: string;
  emailSent: boolean;
  inviteUrl?: string;
  token?: string;
}

interface Organization {
  id: string;
  name: string;
  description?: string;
}

export function UserInvitation({ teams:_teams, onUserInvited, restrictToOrganizationId, allowAdminInvite = true }: UserInvitationProps) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationTeams, setOrganizationTeams] = useState<Team[]>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'athlete' as 'athlete' | 'staff' | 'global_admin',
    organizationId: restrictToOrganizationId || '',
    teamId: '',
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [invitedUsers, setInvitedUsers] = useState<InvitedUser[]>([]);
  const [showPassword, setShowPassword] = useState<{ [key: number]: boolean }>({});
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Load organizations on mount
  useEffect(() => {
    const loadOrganizations = async () => {
      try {
        setLoadingOrgs(true);
        const orgs = await organizationQueries.getOrganizations();
        const mappedOrgs: Organization[] = (orgs || []).map((org: any) => ({
          id: org.id,
          name: org.name,
          description: org.description ?? undefined,
        }))
        setOrganizations(mappedOrgs);

        // If restricted to specific organization, auto-select it
        if (restrictToOrganizationId) {
          setFormData(prev => ({ ...prev, organizationId: restrictToOrganizationId }));
        }
      } catch (error) {
        console.error('Failed to load organizations:', error);
      } finally {
        setLoadingOrgs(false);
      }
    };

    loadOrganizations();
  }, [restrictToOrganizationId]);

  // Load teams when organization changes
  useEffect(() => {
    const loadTeamsForOrganization = async () => {
      if (!formData.organizationId) {
        setOrganizationTeams([]);
        return;
      }

      try {
        const teamsData = await organizationQueries.getOrganizationTeams(formData.organizationId);
        setOrganizationTeams(teamsData);
      } catch (error) {
        console.error('Failed to load organization teams:', error);
        setOrganizationTeams([]);
      }
    };

    loadTeamsForOrganization();
  }, [formData.organizationId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('認証が必要です');
      }

      const { data: currentUser } = await supabase
        .from('users')
        .select('name')
        .eq('id', session.user.id)
        .single();

      const teamName = organizationTeams.find(t => t.id === formData.teamId)?.name;
      const organizationName = organizations.find(o => o.id === formData.organizationId)?.name;


      console.log('🚀 Starting user creation process...');

      // Step 1: Create user - let Edge Function generate password
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const payload = {
        name: formData.name,
        email: formData.email,
        role: formData.role,
        teamId: formData.role === 'athlete' || formData.role === 'staff' ? formData.teamId : undefined,
        organizationId: formData.organizationId || undefined,
        redirectUrl: `${window.location.origin}/reset-password`,
      };

      console.log('📤 Sending user creation request...');

      const userResponse = await fetch(`${supabaseUrl}/functions/v1/create-user`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const userResult = await userResponse.json();
      

      if (!userResponse.ok) {
        throw new Error(userResult.error || 'ユーザーの作成に失敗しました');
      }

      console.log('✅ User created successfully');

      // Get password setup link from Edge Function
      const passwordSetupLink = userResult.passwordSetupLink;

      console.log('🔗 Password setup link received');

      if (!passwordSetupLink) {
        throw new Error('Edge Functionからパスワード設定リンクが返されませんでした');
      }

      // Step 2: No need to save invitation token - password setup link is self-contained
      console.log('✅ Skipping token storage - using Supabase native password reset flow');

      // Step 3: Send email with password setup link
      console.log('📧 Preparing to send invitation email...');

      const inviteExpiredUrl = `${window.location.origin}/invite-expired`;

      // メールクライアントのプリフェッチ対策:
      // Supabase の action_link をそのまま埋め込むと、GmailやOutlookが
      // スパム対策でリンクを自動クロールし、ワンタイムトークンが消費される。
      // /auth/callback?verify=... でラップすることで、ユーザーがボタンを
      // 押すまでトークンが消費されないようにする。
      const wrappedSetupLink =
        `${window.location.origin}/auth/callback` +
        `?verify=${encodeURIComponent(passwordSetupLink)}` +
        `&next=/reset-password`;

      const emailHTML = generateInvitationEmailHTML({
        name: formData.name,
        email: formData.email,
        role: formData.role,
        teamName: teamName || organizationName,
        passwordSetupLink: wrappedSetupLink,
        inviteExpiredUrl,
        inviterName: currentUser?.name,
        expiresInHours: 24,
      });

      const emailText = generateInvitationEmailText({
        name: formData.name,
        email: formData.email,
        role: formData.role,
        teamName: teamName || organizationName,
        passwordSetupLink: wrappedSetupLink,
        inviteExpiredUrl,
        inviterName: currentUser?.name,
        expiresInHours: 24,
      });

      let emailSent = false;
      let emailError = '';

      try {
        console.log('📧 Sending invitation email to:', formData.email);

        const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: formData.email,
            subject: `【Bekuta】 ${teamName || organizationName || 'Bekuta'}初回ログイン設定のご案内`,
            html: emailHTML,
            text: emailText,
          }),
        });

        const emailResult = await emailResponse.json();
        emailSent = emailResponse.ok;

        if (!emailSent) {
          emailError = emailResult.error || 'Unknown error';
          console.error('❌ Email sending failed:', {
            status: emailResponse.status,
            error: emailError,
            result: emailResult
          });
        } else {
          console.log('✅ Email sent successfully to:', formData.email);
        }
      } catch (emailErr: any) {
        emailError = emailErr.message || 'Network error';
        console.error('❌ Email sending exception:', emailErr);
      }

      const newInvitedUser: InvitedUser = {
        name: formData.name,
        email: formData.email,
        role: formData.role,
        teamName,
        organizationName,
        user_id: userResult.user?.user_id,
        invitedAt: new Date().toLocaleString('ja-JP'),
        emailSent,
        inviteUrl: wrappedSetupLink,
        
      };

      setInvitedUsers(prev => [newInvitedUser, ...prev]);

      setMessage({
        type: 'success',
        text: emailSent
          ? `${formData.name}さん（${formData.email}）を招待しました。招待メールを送信しました。`
          : `${formData.name}さん（${formData.email}）を招待しました。メール送信に失敗したため、招待URLを直接共有してください。`
      });

      setFormData({
        name: '',
        email: '',
        role: 'athlete',
        organizationId: '',
        teamId: '',
      });

      onUserInvited();

    } catch (error: any) {
      console.error('User invitation error:', error);
      setMessage({
        type: 'error',
        text: error.message || 'ユーザーの作成に失敗しました'
      });
    } finally {
      setLoading(false);
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'athlete': return '選手';
      case 'staff': return 'スタッフ';
      case 'global_admin': return '管理者';
      default: return role;
    }
  };

  const copyPassword = async (password: string, index: number) => {
    try {
      await navigator.clipboard.writeText(password);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error('Failed to copy password:', err);
    }
  };

  const copyInviteUrl = async (url: string, index: number) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedIndex(index + 1000);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error('Failed to copy URL:', err);
    }
  };

  const downloadInvitedUsersCSV = () => {
    if (invitedUsers.length === 0) return;

    const headers = ['名前', 'メールアドレス', '役割', '組織', 'チーム', 'ユーザーID', '初回パスワード', '招待URL', '招待日時', 'メール送信'];
    const csvContent = [
      headers.join(','),
      ...invitedUsers.map(user => [
        user.name,
        user.email,
        getRoleLabel(user.role),
        user.organizationName || '-',
        user.teamName || '-',
        user.user_id || '生成中',
        user.temporaryPassword || '-',
        user.inviteUrl || '-',
        user.invitedAt,
        user.emailSent ? '送信済み' : '未送信'
      ].join(','))
    ].join('\n');

    const bom = '\uFEFF';
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `招待済みユーザー_${getTodayJSTString()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <UserPlus className="w-6 h-6 text-blue-600" />
          <h2 className="text-xl font-semibold text-gray-900">新規ユーザー招待</h2>
        </div>
        {invitedUsers.length > 0 && (
          <button
            onClick={downloadInvitedUsersCSV}
            className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg transition-colors flex items-center space-x-2 text-sm"
          >
            <Download className="w-4 h-4" />
            <span>招待履歴ダウンロード</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Invitation Form */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center mb-6">
            <Mail className="w-5 h-5 text-blue-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900">ユーザー招待フォーム</h3>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                名前
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="田中太郎"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                メールアドレス
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="tanaka@example.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                役割
              </label>
              <select
                value={formData.role}
                onChange={(e) => {
                  const newRole = e.target.value as 'athlete' | 'staff' | 'global_admin';
                  setFormData(prev => ({
                    ...prev,
                    role: newRole,
                    teamId: newRole === 'global_admin' ? '' : prev.teamId
                  }));
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="athlete">選手</option>
                <option value="staff">スタッフ</option>
                {allowAdminInvite && <option value="global_admin">管理者</option>}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center space-x-2">
                <Building2 className="w-4 h-4 text-blue-600" />
                <span>組織</span>
              </label>
              <select
                value={formData.organizationId}
                onChange={(e) => setFormData(prev => ({ ...prev, organizationId: e.target.value, teamId: '' }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
                disabled={loadingOrgs || !!restrictToOrganizationId}
              >
                <option value="">
                  {loadingOrgs ? '読み込み中...' : '組織を選択'}
                </option>
                {organizations
                  .filter(org => !restrictToOrganizationId || org.id === restrictToOrganizationId)
                  .map(org => (
                    <option key={org.id} value={org.id}>{org.name}</option>
                  ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                ユーザーはこの組織のメンバーとして登録されます
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                チーム
              </label>
              <select
                value={formData.teamId}
                onChange={(e) => setFormData(prev => ({ ...prev, teamId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required={formData.role === 'athlete'}
                disabled={formData.role === 'global_admin' || !formData.organizationId}
              >
                <option value="">
                  {formData.role === 'global_admin'
                    ? '管理者はチーム不要'
                    : !formData.organizationId
                    ? '先に組織を選択してください'
                    : 'チームを選択'}
                </option>
                {organizationTeams.map(team => (
                  <option key={team.id} value={team.id}>{team.name}</option>
                ))}
              </select>
              {formData.role === 'global_admin' && (
                <p className="text-xs text-gray-500 mt-1">
                  管理者は全てのチームにアクセスできます
                </p>
              )}
              {formData.role !== 'global_admin' && !formData.organizationId && (
                <p className="text-xs text-amber-600 mt-1">
                  先に組織を選択してください
                </p>
              )}
            </div>


            {message && (
              <div className={`flex items-center space-x-3 p-3 rounded-lg ${
                message.type === 'success' 
                  ? 'bg-green-50 border border-green-200 text-green-600'
                  : 'bg-red-50 border border-red-200 text-red-600'
              }`}>
                {message.type === 'success' ? (
                  <CheckCircle className="w-5 h-5 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                )}
                <span className="text-sm">{message.text}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
              ) : (
                <Mail className="w-5 h-5 mr-2" />
              )}
              {loading ? '招待メール送信中...' : '招待メールを送信'}
            </button>
          </form>
        </div>

        {/* Information Panel */}
        <div className="space-y-6">
          {/* Account Setup Information */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <Info className="w-5 h-5 text-blue-600 mr-3 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-medium text-blue-900 mb-2">ユーザー招待について</h3>
                <div className="text-sm text-blue-700 space-y-2">
                  <p>1. ユーザーのメールアドレスにウェルカムメールが送信されます。</p>
                  <p>2. メールには「パスワード設定用リンク」が記載されています。</p>
                  <p>3. ユーザーはリンク先で自分のパスワードを設定します。</p>
                  <p>4.  パスワードはシステム上にも表示されません。再発行は再度「パスワードリセット」を行ってください。</p>
                  <p>5. 招待リンクの有効期限は24時間です。有効期限切れの場合は再度招待してください。</p>
                </div>
              </div>
            </div>
          </div>

          {/* Role Information */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-3">役割の説明</h4>
            <div className="space-y-3 text-sm text-gray-700">
              <div className="flex items-start">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                <div>
                  <strong>選手:</strong> 自分の練習記録の入力と閲覧のみ可能
                </div>
              </div>
              <div className="flex items-start">
                <div className="w-2 h-2 bg-green-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                <div>
                  <strong>スタッフ:</strong> 担当チームの選手データを閲覧・管理可能
                </div>
              </div>
              <div className="flex items-start">
                <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                <div>
                  <strong>管理者:</strong> 全てのデータとユーザー管理が可能
                </div>
              </div>
            </div>
          </div>

          {/* Invited Users List */}
          {invitedUsers.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-medium text-gray-900">最近の招待履歴</h4>
                <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs">
                  {invitedUsers.length}件
                </span>
              </div>
              
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {invitedUsers.slice(0, 10).map((user, index) => (
                  <div key={index} className="bg-gray-50 rounded p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-gray-900">{user.name}</span>
                      <span className="text-xs text-gray-500">{user.invitedAt}</span>
                    </div>
                    <div className="text-sm text-gray-600 space-y-2">
                      <p>{user.email}</p>
                      <div className="flex items-center flex-wrap gap-2">
                        <span>{getRoleLabel(user.role)}</span>
                        {user.organizationName && (
                          <span className="flex items-center gap-1">
                            • <Building2 className="w-3 h-3" /> {user.organizationName}
                          </span>
                        )}
                        {user.teamName && <span>• {user.teamName}</span>}
                        {user.user_id && (
                          <span className="font-mono bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">
                            {user.user_id}
                          </span>
                        )}
                        {user.emailSent ? (
                          <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs flex items-center space-x-1">
                            <Mail className="w-3 h-3" />
                            <span>メール送信済み</span>
                          </span>
                        ) : (
                          <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs flex items-center space-x-1">
                            <AlertCircle className="w-3 h-3" />
                            <span>メール未送信</span>
                          </span>
                        )}
                      </div>
                      {user.temporaryPassword && (
                        <div className="flex items-center space-x-2 bg-yellow-50 border border-yellow-200 p-2 rounded">
                          <span className="text-xs font-medium text-yellow-800">初回パスワード:</span>
                          <code className="flex-1 text-xs font-mono bg-white px-2 py-1 rounded border border-yellow-300">
                            {showPassword[index] ? user.temporaryPassword : '••••••••••••'}
                          </code>
                          <button
                            onClick={() => setShowPassword(prev => ({ ...prev, [index]: !prev[index] }))}
                            className="p-1 hover:bg-yellow-100 rounded transition-colors"
                            title={showPassword[index] ? 'パスワードを隠す' : 'パスワードを表示'}
                          >
                            {showPassword[index] ? (
                              <EyeOff className="w-4 h-4 text-yellow-700" />
                            ) : (
                              <Eye className="w-4 h-4 text-yellow-700" />
                            )}
                          </button>
                          <button
                            onClick={() => copyPassword(user.temporaryPassword!, index)}
                            className="p-1 hover:bg-yellow-100 rounded transition-colors"
                            title="パスワードをコピー"
                          >
                            <Copy className={`w-4 h-4 ${copiedIndex === index ? 'text-green-600' : 'text-yellow-700'}`} />
                          </button>
                        </div>
                      )}
                      {user.inviteUrl && (
                        <div className="flex items-center space-x-2 bg-blue-50 border border-blue-200 p-2 rounded">
                          <span className="text-xs font-medium text-blue-800">招待URL:</span>
                          <code className="flex-1 text-xs font-mono bg-white px-2 py-1 rounded border border-blue-300 truncate">
                            {user.inviteUrl}
                          </code>
                          <button
                            onClick={() => copyInviteUrl(user.inviteUrl!, index)}
                            className="p-1 hover:bg-blue-100 rounded transition-colors"
                            title="招待URLをコピー"
                          >
                            <Copy className={`w-4 h-4 ${copiedIndex === index + 1000 ? 'text-green-600' : 'text-blue-700'}`} />
                          </button>
                          <a
                            href={user.inviteUrl}
                            className="p-1 hover:bg-blue-100 rounded transition-colors"
                            title="招待ページを開く（同じタブで開きます）"
                          >
                            <LinkIcon className="w-4 h-4 text-blue-700" />
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}