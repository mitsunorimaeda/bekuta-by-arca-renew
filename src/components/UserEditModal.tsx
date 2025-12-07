import React, { useState, useEffect } from 'react';
import { User, Team, supabase } from '../lib/supabase';
import { X, Save, AlertCircle, CheckCircle, AlertTriangle, Users } from 'lucide-react';

interface UserEditModalProps {
  user: User;
  teams: Team[];
  onClose: () => void;
  onUserUpdated: () => void;
}

export function UserEditModal({ user, teams, onClose, onUserUpdated }: UserEditModalProps) {
  const [formData, setFormData] = useState({
    name: user.name,
    email: user.email,
    role: user.role,
    teamId: user.team_id || ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [staffTeams, setStaffTeams] = useState<Team[]>([]);
  const [isMultiTeamStaff, setIsMultiTeamStaff] = useState(false);

  // Fetch current teams for staff users
  useEffect(() => {
    if (user.role === 'staff') {
      fetchStaffTeams();
    }
  }, [user.id, user.role]);

  const fetchStaffTeams = async () => {
    try {
      const { data, error } = await supabase
        .from('staff_team_links')
        .select(`
          team_id,
          teams (
            id,
            name
          )
        `)
        .eq('staff_user_id', user.id);

      if (error) {
        console.error('Error fetching staff teams:', error);
        return;
      }

      const userTeams = data?.map(link => link.teams).filter(Boolean) as Team[];
      setStaffTeams(userTeams || []);
      setIsMultiTeamStaff((userTeams || []).length > 1);

      // Set the first team as default if multiple teams exist
      if (userTeams && userTeams.length > 0) {
        setFormData(prev => ({ ...prev, teamId: userTeams[0].id }));
      }
    } catch (error) {
      console.error('Error fetching staff teams:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('認証が必要です');
      }

      // Call the update-user Edge Function
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

      const response = await fetch(`${supabaseUrl}/functions/v1/update-user`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          name: formData.name,
          email: formData.email,
          role: formData.role,
          teamId: formData.teamId || undefined
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'ユーザーの更新に失敗しました');
      }

      setMessage({
        type: 'success',
        text: 'ユーザー情報を更新しました。'
      });

      setTimeout(() => {
        onUserUpdated();
      }, 1000);

    } catch (error: any) {
      console.error('Error updating user:', error);
      setMessage({
        type: 'error',
        text: `更新に失敗しました: ${error.message}`
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-blue-600 text-white p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">ユーザー編集</h2>
            <button
              onClick={onClose}
              className="bg-blue-500 hover:bg-blue-400 rounded-full p-2 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Multi-team Staff Warning */}
          {isMultiTeamStaff && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
              <div className="flex items-start">
                <AlertTriangle className="w-5 h-5 text-amber-600 mr-3 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="font-medium text-amber-900 mb-2 flex items-center">
                    <Users className="w-4 h-4 mr-1" />
                    複数チーム管理スタッフ
                  </h3>
                  <div className="text-sm text-amber-700 space-y-2">
                    <p>このスタッフは複数のチームを管理しています：</p>
                    <div className="bg-amber-100 rounded p-2">
                      {staffTeams.map((team, index) => (
                        <div key={team.id} className="flex items-center">
                          <span className="w-2 h-2 bg-amber-600 rounded-full mr-2"></span>
                          <span className="font-medium">{team.name}</span>
                        </div>
                      ))}
                    </div>
                    <div className="bg-white border border-amber-300 rounded p-3 mt-3">
                      <p className="font-medium text-amber-900 mb-1">⚠️ 編集時の注意</p>
                      <ul className="text-xs space-y-1">
                        <li>• チーム変更は最初のチームのみ設定されます</li>
                        <li>• 複数チーム管理を維持するにはSupabase側で設定が必要</li>
                        <li>• 役割変更時は全てのチーム関連付けが削除されます</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

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
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                役割
                {isMultiTeamStaff && (
                  <span className="ml-2 text-xs text-amber-600 font-normal">
                    ⚠️ 変更すると複数チーム管理が解除されます
                  </span>
                )}
              </label>
              <select
                value={formData.role}
                onChange={(e) => {
                  const newRole = e.target.value as 'athlete' | 'staff' | 'admin';
                  setFormData(prev => ({ 
                    ...prev, 
                    role: newRole,
                    teamId: newRole === 'admin' ? '' : prev.teamId
                  }));
                }}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  isMultiTeamStaff ? 'border-amber-300 bg-amber-50' : 'border-gray-300'
                }`}
              >
                <option value="athlete">選手</option>
                <option value="staff">スタッフ</option>
                <option value="admin">管理者</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                チーム
                {isMultiTeamStaff && formData.role === 'staff' && (
                  <span className="ml-2 text-xs text-amber-600 font-normal">
                    ⚠️ 最初のチームのみ設定されます
                  </span>
                )}
              </label>
              <select
                value={formData.teamId}
                onChange={(e) => setFormData(prev => ({ ...prev, teamId: e.target.value }))}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  isMultiTeamStaff && formData.role === 'staff' ? 'border-amber-300 bg-amber-50' : 'border-gray-300'
                }`}
                required={formData.role === 'athlete'}
                disabled={formData.role === 'admin'}
              >
                <option value="">
                  {formData.role === 'admin' ? '管理者はチーム不要' : 'チームを選択'}
                </option>
                {teams.map(team => (
                  <option key={team.id} value={team.id}>{team.name}</option>
                ))}
              </select>
              {formData.role === 'admin' && (
                <p className="text-xs text-gray-500 mt-1">
                  管理者は全てのチームにアクセスできます
                </p>
              )}
              {formData.role === 'staff' && !isMultiTeamStaff && (
                <p className="text-xs text-gray-500 mt-1">
                  スタッフは選択したチームを管理できます
                </p>
              )}
              {isMultiTeamStaff && formData.role === 'staff' && (
                <p className="text-xs text-amber-600 mt-1">
                  複数チーム管理を維持するには、Supabase側で再設定が必要です
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

            <div className="flex space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-4 rounded-lg transition-colors"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={loading}
                className={`flex-1 py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center ${
                  isMultiTeamStaff 
                    ? 'bg-amber-600 hover:bg-amber-700 text-white' 
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                {loading ? '更新中...' : (isMultiTeamStaff ? '注意して更新' : '更新')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}