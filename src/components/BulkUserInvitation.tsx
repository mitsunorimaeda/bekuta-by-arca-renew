import React, { useState } from 'react';
import { Team, supabase } from '../lib/supabase';
import { Upload, Download, Users, CheckCircle, AlertCircle, FileSpreadsheet, Mail } from 'lucide-react';
import { generateInvitationEmailHTML, generateInvitationEmailText } from '../lib/emailTemplates';

interface BulkUserInvitationProps {
  teams: Team[];
  onUsersInvited: () => void;
  restrictToOrganizationId?: string;
  allowAdminInvite?: boolean;
}

interface CSVUser {
  name: string;
  email: string;
  role: 'athlete' | 'staff' | 'admin';
  teamName?: string;
}

interface ProcessedUser extends CSVUser {
  status: 'success' | 'error';
  message: string;
  user_id?: string;
  teamId?: string;
}

export function BulkUserInvitation({ teams, onUsersInvited, restrictToOrganizationId, allowAdminInvite = true }: BulkUserInvitationProps) {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [processedUsers, setProcessedUsers] = useState<ProcessedUser[]>([]);
  const [showResults, setShowResults] = useState(false);

  const downloadTemplate = () => {
    const headers = ['name', 'email', 'role', 'team_name'];
    const sampleData = allowAdminInvite
      ? [
          ['田中太郎', 'tanaka@example.com', 'athlete', 'サッカー部'],
          ['佐藤花子', 'sato@example.com', 'staff', 'バスケットボール部'],
          ['管理者', 'admin@example.com', 'admin', '']
        ]
      : [
          ['田中太郎', 'tanaka@example.com', 'athlete', 'サッカー部'],
          ['佐藤花子', 'sato@example.com', 'staff', 'バスケットボール部']
        ];

    const csvContent = [
      '# ACWR Monitor ユーザー一括招待テンプレート',
      '# 注意事項:',
      allowAdminInvite
        ? '# - role は athlete, staff, admin のいずれかを指定してください'
        : '# - role は athlete, staff のいずれかを指定してください',
      '# - athlete の場合は team_name を必ず指定してください',
      allowAdminInvite && '# - admin の場合は team_name は空白にしてください',
      '# - staff の場合は team_name を指定してください（指定したチームを管理します）',
      '',
      headers.join(','),
      ...sampleData.map(row => row.join(','))
    ].filter(Boolean).join('\n');

    const bom = '\uFEFF';
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'ユーザー一括招待テンプレート.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const parseCSV = (text: string): CSVUser[] => {
    const lines = text.split('\n').filter(line => line.trim() && !line.startsWith('#'));
    const headers = lines[0].split(',').map(h => h.trim());
    
    const nameIndex = headers.findIndex(h => h.toLowerCase().includes('name'));
    const emailIndex = headers.findIndex(h => h.toLowerCase().includes('email'));
    const roleIndex = headers.findIndex(h => h.toLowerCase().includes('role'));
    const teamIndex = headers.findIndex(h => h.toLowerCase().includes('team'));

    if (nameIndex === -1 || emailIndex === -1 || roleIndex === -1) {
      throw new Error('CSV must contain name, email, and role columns');
    }

    const users: CSVUser[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
      
      if (values.length < 3) continue;
      
      const role = values[roleIndex].toLowerCase();
      const validRoles = allowAdminInvite ? ['athlete', 'staff', 'admin'] : ['athlete', 'staff'];
      if (!validRoles.includes(role)) {
        continue;
      }

      users.push({
        name: values[nameIndex],
        email: values[emailIndex],
        role: role as 'athlete' | 'staff' | 'admin',
        teamName: teamIndex !== -1 ? values[teamIndex] : undefined
      });
    }

    return users;
  };

  const processUsers = async (users: CSVUser[]) => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      throw new Error('認証が必要です');
    }

    const results: ProcessedUser[] = [];

    for (const user of users) {
      try {
        // Find team ID if team name is provided
        let teamId: string | undefined;
        if (user.teamName) {
          const team = teams.find(t => 
            t.name.toLowerCase() === user.teamName.toLowerCase()
          );
          if (!team) {
            results.push({
              ...user,
              status: 'error',
              message: `チーム "${user.teamName}" が見つかりません`
            });
            continue;
          }
          teamId = team.id;
        }

        // Validate team requirement
        if (user.role === 'athlete' && !teamId) {
          results.push({
            ...user,
            status: 'error',
            message: '選手にはチームの指定が必要です'
          });
          continue;
        }

        // Call create-user function - let Edge Function generate password
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

        console.log('🚀 Creating user:', user.email);

        const response = await fetch(`${supabaseUrl}/functions/v1/create-user`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: user.name,
            email: user.email,
            role: user.role,
            teamId: teamId,
            redirectUrl: window.location.origin
          }),
        });

        const result = await response.json();

        if (response.ok) {
          // Get password setup link from Edge Function
          const passwordSetupLink = result.passwordSetupLink;
          console.log('🔗 Password setup link received for', user.email);

          if (!passwordSetupLink) {
            results.push({
              ...user,
              status: 'error',
              message: 'Edge Functionからパスワード設定リンクが返されませんでした'
            });
            continue;
          }
          const teamName = teams.find(t => t.id === teamId)?.name;

          // Generate invitation email using template
          const emailHTML = generateInvitationEmailHTML({
            name: user.name,
            email: user.email,
            role: user.role,
            teamName: teamName,
            passwordSetupLink: passwordSetupLink,
            expiresInHours: 24,
          });

          const emailText = generateInvitationEmailText({
            name: user.name,
            email: user.email,
            role: user.role,
            teamName: teamName,
            passwordSetupLink: passwordSetupLink,
            expiresInHours: 24,
          });

          // Send email
          let emailSent = false;
          let emailErrorMsg = '';

          try {
            console.log('📧 Sending invitation email to:', user.email);

            const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                to: user.email,
                subject: `🎉 ${teamName || 'Bekuta'}への招待`,
                html: emailHTML,
                text: emailText,
              }),
            });

            const emailResult = await emailResponse.json();
            emailSent = emailResponse.ok;

            if (!emailSent) {
              emailErrorMsg = emailResult.error || 'Unknown error';
              console.error('❌ Email sending failed for', user.email, {
                status: emailResponse.status,
                error: emailErrorMsg,
                result: emailResult
              });
            } else {
              console.log('✅ Email sent successfully to:', user.email);
            }
          } catch (emailError: any) {
            emailErrorMsg = emailError.message || 'Network error';
            console.error('❌ Email sending exception for', user.email, emailError);
          }

          results.push({
            ...user,
            status: 'success',
            message: emailSent
              ? '招待メール送信完了'
              : `ユーザー作成完了（メール送信失敗: ${emailErrorMsg}）`,
            user_id: result.user?.user_id,
            teamId: teamId
          });
        } else {
          results.push({
            ...user,
            status: 'error',
            message: result.error || '招待に失敗しました'
          });
        }

      } catch (error: any) {
        results.push({
          ...user,
          status: 'error',
          message: error.message || 'エラーが発生しました'
        });
      }

      // Add small delay to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return results;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setCsvFile(file || null);
    setShowResults(false);
    setProcessedUsers([]);
  };

  const handleBulkInvite = async () => {
    if (!csvFile) return;

    setLoading(true);
    try {
      const text = await csvFile.text();
      const users = parseCSV(text);
      
      if (users.length === 0) {
        throw new Error('有効なユーザーデータが見つかりませんでした');
      }

      const results = await processUsers(users);
      setProcessedUsers(results);
      setShowResults(true);
      
      // Call onUsersInvited if there were any successful invitations
      const successCount = results.filter(r => r.status === 'success').length;
      if (successCount > 0) {
        onUsersInvited();
      }

    } catch (error: any) {
      console.error('Bulk invitation error:', error);
      alert(`一括招待エラー: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const downloadResults = () => {
    if (processedUsers.length === 0) return;

    const headers = ['名前', 'メールアドレス', '役割', 'チーム', 'ユーザーID', '状態', 'メッセージ'];
    const csvContent = [
      `# 一括招待結果 - ${new Date().toLocaleString('ja-JP')}`,
      `# 成功: ${processedUsers.filter(u => u.status === 'success').length}件`,
      `# 失敗: ${processedUsers.filter(u => u.status === 'error').length}件`,
      '',
      headers.join(','),
      ...processedUsers.map(user => [
        user.name,
        user.email,
        user.role === 'athlete' ? '選手' : user.role === 'staff' ? 'スタッフ' : '管理者',
        user.teamName || '-',
        user.user_id || '-',
        user.status === 'success' ? '成功' : '失敗',
        user.message
      ].join(','))
    ].join('\n');

    const bom = '\uFEFF';
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `一括招待結果_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const successCount = processedUsers.filter(u => u.status === 'success').length;
  const errorCount = processedUsers.filter(u => u.status === 'error').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Users className="w-6 h-6 text-purple-600" />
          <h2 className="text-xl font-semibold text-gray-900">ユーザー一括招待</h2>
        </div>
        <button
          onClick={downloadTemplate}
          className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-2 rounded-lg transition-colors flex items-center space-x-2 text-sm"
        >
          <Download className="w-4 h-4" />
          <span>CSVテンプレート</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Upload Section */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="text-center">
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">CSVファイルアップロード</h3>
            <p className="text-sm text-gray-600 mb-6">
              ユーザー情報を含むCSVファイルを選択してください
            </p>

            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
              id="csv-upload"
            />
            <label
              htmlFor="csv-upload"
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg cursor-pointer transition-colors inline-flex items-center space-x-2"
            >
              <FileSpreadsheet className="w-5 h-5" />
              <span>CSVファイルを選択</span>
            </label>

            {csvFile && (
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-700">
                  選択されたファイル: <strong>{csvFile.name}</strong>
                </p>
              </div>
            )}

            {csvFile && (
              <button
                onClick={handleBulkInvite}
                disabled={loading}
                className="mt-4 w-full bg-purple-600 hover:bg-purple-700 text-white py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                ) : (
                  <Mail className="w-5 h-5 mr-2" />
                )}
                {loading ? '招待処理中...' : '一括招待実行'}
              </button>
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-3">CSVファイル形式</h4>
            <div className="text-sm text-blue-700 space-y-2">
              <p>CSVファイルには以下の列が必要です：</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li><strong>name:</strong> ユーザー名</li>
                <li><strong>email:</strong> メールアドレス</li>
                <li><strong>role:</strong> athlete, staff, admin のいずれか</li>
                <li><strong>team_name:</strong> チーム名（選手とスタッフのみ）</li>
              </ul>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h4 className="font-medium text-amber-900 mb-3">注意事項</h4>
            <div className="text-sm text-amber-700 space-y-1">
              <p>• 各ユーザーに招待メールが送信されます</p>
              <p>• ユーザーはメール内のリンクからパスワードを設定します</p>
              <p>• 重複するメールアドレスはスキップされます</p>
              <p>• 処理には時間がかかる場合があります</p>
            </div>
          </div>

          {/* Results */}
          {showResults && (
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-medium text-gray-900">処理結果</h4>
                <button
                  onClick={downloadResults}
                  className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm flex items-center space-x-1"
                >
                  <Download className="w-3 h-3" />
                  <span>結果ダウンロード</span>
                </button>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-green-50 rounded p-3 text-center">
                  <div className="text-2xl font-bold text-green-600">{successCount}</div>
                  <div className="text-sm text-green-700">成功</div>
                </div>
                <div className="bg-red-50 rounded p-3 text-center">
                  <div className="text-2xl font-bold text-red-600">{errorCount}</div>
                  <div className="text-sm text-red-700">失敗</div>
                </div>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {processedUsers.map((user, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded border ${
                      user.status === 'success'
                        ? 'bg-green-50 border-green-200'
                        : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          {user.status === 'success' ? (
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-red-600" />
                          )}
                          <span className="font-medium">{user.name}</span>
                          {user.user_id && (
                            <span className="font-mono bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">
                              {user.user_id}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          {user.email} • {user.role} 
                          {user.teamName && ` • ${user.teamName}`}
                        </div>
                        <div className={`text-xs mt-1 ${
                          user.status === 'success' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {user.message}
                        </div>
                      </div>
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