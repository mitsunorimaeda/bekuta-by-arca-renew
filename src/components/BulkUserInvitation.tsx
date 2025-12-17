import React, { useState } from 'react';
import { getTodayJSTString } from '../lib/date';
import { Team, supabase } from '../lib/supabase';
import {
  Upload,
  Download,
  Users,
  CheckCircle,
  AlertCircle,
  FileSpreadsheet,
  Mail,
} from 'lucide-react';

interface BulkUserInvitationProps {
  teams: Team[];
  onUsersInvited: () => void;
  restrictToOrganizationId?: string;
  allowAdminInvite?: boolean;
}

interface CsvUserRow {
  name: string;
  email: string;
  role: 'athlete' | 'staff' | 'admin';
  organizationName: string;
  teamName?: string;
}

interface ProcessedUser extends CsvUserRow {
  status: 'success' | 'error';
  message: string;
  user_id?: string;
  teamId?: string;
}

export function BulkUserInvitation({
  teams,
  onUsersInvited,
  restrictToOrganizationId,
  allowAdminInvite = true,
}: BulkUserInvitationProps) {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [processedUsers, setProcessedUsers] = useState<ProcessedUser[]>([]);
  const [showResults, setShowResults] = useState(false);

  // ===========================
  //  CSVテンプレートダウンロード
  // ===========================
  const downloadTemplate = () => {
    const headers = ['name', 'email', 'role', 'organizationName', 'team_name'];

    const sampleData = (
      [
        ['田中太郎', 'tanaka@example.com', 'athlete', '愛工大名電高校', 'サッカー部'],
        ['佐藤花子', 'sato@example.com', 'staff', '愛工大名電高校', 'バスケットボール部'],
        allowAdminInvite
          ? ['管理者', 'admin@example.com', 'admin', '愛工大名電高校', '']
          : null,
      ].filter(Boolean) as string[][]
    );

    const csvContent = [
      '# Bekuta ユーザー一括招待テンプレート',
      '# 注意事項:',
      allowAdminInvite
        ? '# - role は athlete, staff, admin のいずれかを指定してください'
        : '# - role は athlete, staff のいずれかを指定してください',
      '# - organizationName は管理画面に表示されている組織名と完全に同じ文字列で入力してください',
      '# - athlete の場合は team_name を必ず指定してください',
      '# - staff の場合も team_name を指定することを推奨します（指定したチームを管理します）',
      '# - admin の場合は team_name は空白でも構いません',
      '',
      headers.join(','),
      ...sampleData.map((row) => row.join(',')),
    ]
      .filter(Boolean)
      .join('\n');

    const bom = '\uFEFF';
    const blob = new Blob([bom + csvContent], {
      type: 'text/csv;charset=utf-8;',
    });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'ユーザー一括招待テンプレート.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ===========================
  //  CSVパース（organizationName必須）
  // ===========================
  const parseCSV = (text: string): CsvUserRow[] => {
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter((line) => line && !line.startsWith('#'));

    if (lines.length < 2) {
      throw new Error('CSVにデータ行がありません（ヘッダー＋1行以上必要です）');
    }

    const header = lines[0]
      .split(',')
      .map((h) => h.trim().replace(/^"|"$/g, ''));

    const findCol = (keys: string[]) =>
      header.findIndex((h) =>
        keys.some((k) => h.toLowerCase() === k.toLowerCase())
      );

    const nameIdx = findCol(['name']);
    const emailIdx = findCol(['email']);
    const roleIdx = findCol(['role']);
    const orgIdx = findCol(['organizationname', 'organization', 'organization_name']);
    const teamIdx = findCol(['team_name', 'team']);

    if (nameIdx === -1 || emailIdx === -1 || roleIdx === -1 || orgIdx === -1) {
      throw new Error(
        'CSVには name, email, role, organizationName の4列が必要です'
      );
    }

    const users: CsvUserRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i]
        .split(',')
        .map((c) => c.trim().replace(/^"|"$/g, ''));

      if (!cols[nameIdx] || !cols[emailIdx] || !cols[roleIdx] || !cols[orgIdx]) {
        continue;
      }

      const roleRaw = cols[roleIdx].toLowerCase();
      const validRoles = allowAdminInvite
        ? ['athlete', 'staff', 'admin']
        : ['athlete', 'staff'];

      if (!validRoles.includes(roleRaw)) continue;

      users.push({
        name: cols[nameIdx],
        email: cols[emailIdx],
        role: roleRaw as 'athlete' | 'staff' | 'admin',
        organizationName: cols[orgIdx],
        teamName: teamIdx !== -1 ? cols[teamIdx] || undefined : undefined,
      });
    }

    if (users.length === 0) {
      throw new Error('CSVに有効なユーザーデータがありません');
    }

    return users;
  };

  // ===========================
  //  一括処理本体
  // ===========================
  const processBulkInvites = async (
    rows: CsvUserRow[]
  ): Promise<ProcessedUser[]> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      throw new Error('認証が必要です（ログインし直してください）');
    }

    // 組織一覧の取得（restrictがあればそのIDに絞る）
    let orgQuery = supabase.from('organizations').select('id, name');

    if (restrictToOrganizationId) {
      orgQuery = orgQuery.eq('id', restrictToOrganizationId);
    }

    const { data: orgs, error: orgErr } = await orgQuery;

    if (orgErr || !orgs || orgs.length === 0) {
      throw new Error('組織リストの取得に失敗しました');
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) {
      throw new Error('VITE_SUPABASE_URL が設定されていません');
    }

    const results: ProcessedUser[] = [];

    for (const row of rows) {
      try {
        // === ① 組織名 完全一致チェック ===
        const org = orgs.find((o) => o.name === row.organizationName);

        if (!org) {
          results.push({
            ...row,
            status: 'error',
            message: `組織 "${row.organizationName}" が見つかりません`,
          });
          continue;
        }

        // restrictToOrganizationId がある場合は組織IDの整合性も確認
        if (restrictToOrganizationId && org.id !== restrictToOrganizationId) {
          results.push({
            ...row,
            status: 'error',
            message: `この画面からは組織ID "${restrictToOrganizationId}" のユーザーのみ招待できます（CSV上の組織: ${row.organizationName}）`,
          });
          continue;
        }

        // === ② チーム名チェック ===
        let teamId: string | undefined;

        if (row.teamName) {
          const team = teams.find(
            (t) => t.name === row.teamName && t.organization_id === org.id
          );

          if (!team) {
            results.push({
              ...row,
              status: 'error',
              message: `組織 "${org.name}" にチーム "${row.teamName}" は存在しません`,
            });
            continue;
          }

          teamId = team.id;
        }

        if (row.role === 'athlete' && !teamId) {
          results.push({
            ...row,
            status: 'error',
            message: 'athlete（選手）には team_name（チーム名）の指定が必須です',
          });
          continue;
        }

        // === ③ create-user Edge Function 呼び出し ===
        console.log('🚀 Creating user:', row.email);

        const response = await fetch(
          `${supabaseUrl}/functions/v1/create-user`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name: row.name,
              email: row.email,
              role: row.role,
              teamId: teamId,
              organizationId: org.id,
              redirectUrl: `${window.location.origin}/reset-password`,
            }),
          }
        );

        const result = await response.json();

        if (!response.ok) {
          console.error('❌ create-user error:', result);
          results.push({
            ...row,
            status: 'error',
            message: result.error || 'ユーザー作成に失敗しました',
          });
          continue;
        }

        const passwordSetupLink = result.passwordSetupLink;
        if (!passwordSetupLink) {
          results.push({
            ...row,
            status: 'error',
            message: 'Edge Function からパスワード設定リンクが返されませんでした',
          });
          continue;
        }

        // === ④ send-email (テンプレート版) 呼び出し ===
        let emailSent = false;
        let emailErrorMsg = '';

        try {
          console.log('📧 Sending invitation email to:', row.email);

          const emailResponse = await fetch(
            `${supabaseUrl}/functions/v1/send-email`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                to: row.email,
                type: 'invitation',
                data: {
                  name: row.name,
                  email: row.email,
                  role: row.role,
                  teamName: row.teamName,
                  passwordSetupLink,
                  expiresInHours: 24,
                },
              }),
            }
          );

          const emailResult = await emailResponse.json();
          emailSent = emailResponse.ok;

          if (!emailSent) {
            emailErrorMsg = emailResult.error || 'Unknown error';
            console.error('❌ Invitation email failed:', {
              status: emailResponse.status,
              error: emailErrorMsg,
              result: emailResult,
            });
          } else {
            console.log('✅ Email sent successfully to:', row.email);
          }
        } catch (emailError: any) {
          emailErrorMsg = emailError.message || 'Network error';
          console.error('❌ Invitation email exception:', emailError);
        }

        results.push({
          ...row,
          status: emailSent ? 'success' : 'error',
          message: emailSent
            ? '招待メール送信完了'
            : `ユーザー作成完了（メール送信失敗: ${emailErrorMsg}）`,
          user_id: result.user?.user_id,
          teamId,
        });
      } catch (err: any) {
        console.error('❌ Bulk invite error for row:', row, err);
        results.push({
          ...row,
          status: 'error',
          message: err.message || 'エラーが発生しました',
        });
      }

      // サーバーに優しいように少しウェイト
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return results;
  };

  // ===========================
  //  イベントハンドラ
  // ===========================
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setCsvFile(file);
    setShowResults(false);
    setProcessedUsers([]);
  };

  const handleBulkInvite = async () => {
    if (!csvFile) return;

    setLoading(true);
    try {
      const text = await csvFile.text();
      const users = parseCSV(text);

      const results = await processBulkInvites(users);
      setProcessedUsers(results);
      setShowResults(true);

      const successCount = results.filter((r) => r.status === 'success').length;
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

    const headers = [
      '名前',
      'メールアドレス',
      '役割',
      '組織',
      'チーム',
      'ユーザーID',
      '状態',
      'メッセージ',
    ];
    const csvContent = [
      `# 一括招待結果 - ${new Date().toLocaleString('ja-JP')}`,
      `# 成功: ${processedUsers.filter((u) => u.status === 'success').length}件`,
      `# 失敗: ${processedUsers.filter((u) => u.status === 'error').length}件`,
      '',
      headers.join(','),
      ...processedUsers.map((user) =>
        [
          user.name,
          user.email,
          user.role === 'athlete'
            ? '選手'
            : user.role === 'staff'
            ? 'スタッフ'
            : '管理者',
          user.organizationName,
          user.teamName || '-',
          user.user_id || '-',
          user.status === 'success' ? '成功' : '失敗',
          user.message,
        ].join(',')
      ),
    ].join('\n');

    const bom = '\uFEFF';
    const blob = new Blob([bom + csvContent], {
      type: 'text/csv;charset=utf-8;',
    });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `一括招待結果_${getTodayJSTString()}.csv`
    );
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const successCount = processedUsers.filter((u) => u.status === 'success').length;
  const errorCount = processedUsers.filter((u) => u.status === 'error').length;

  // ===========================
  //  JSX
  // ===========================
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
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              CSVファイルアップロード
            </h3>
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
                  選択されたファイル:{' '}
                  <strong>{csvFile.name}</strong>
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
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
                ) : (
                  <Mail className="w-5 h-5 mr-2" />
                )}
                {loading ? '招待処理中...' : '一括招待実行'}
              </button>
            )}
          </div>
        </div>

        {/* Instructions & Results */}
        <div className="space-y-6">
          {/* CSV format info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-3">CSVファイル形式</h4>
            <div className="text-sm text-blue-700 space-y-2">
              <p>CSVファイルには以下の列が必要です：</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>
                  <strong>name:</strong> ユーザー名
                </li>
                <li>
                  <strong>email:</strong> メールアドレス
                </li>
                <li>
                  <strong>role:</strong> athlete, staff, admin のいずれか
                </li>
                <li>
                  <strong>organizationName:</strong> 組織名（管理画面に表示される名称と完全一致）
                </li>
                <li>
                  <strong>team_name:</strong> チーム名（athlete は必須 / staff 推奨）
                </li>
              </ul>
            </div>
          </div>

          {/* 注意事項 */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h4 className="font-medium text-amber-900 mb-3">注意事項</h4>
            <div className="text-sm text-amber-700 space-y-1">
              <p>• 各ユーザーに招待メールが送信されます</p>
              <p>• ユーザーはメール内のリンクからパスワードを設定します</p>
              <p>• 組織名とチーム名はシステム上の名称と完全に一致している必要があります</p>
              <p>• 処理には時間がかかる場合があります</p>
            </div>
          </div>

          {/* 処理結果 */}
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
                  <div className="text-2xl font-bold text-green-600">
                    {successCount}
                  </div>
                  <div className="text-sm text-green-700">成功</div>
                </div>
                <div className="bg-red-50 rounded p-3 text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {errorCount}
                  </div>
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
                          {user.email} • {user.role}{' '}
                          • {user.organizationName}
                          {user.teamName && ` • ${user.teamName}`}
                        </div>
                        <div
                          className={`text-xs mt-1 ${
                            user.status === 'success'
                              ? 'text-green-600'
                              : 'text-red-600'
                          }`}
                        >
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