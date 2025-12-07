import React, { useState, useEffect } from 'react';
import { organizationQueries } from '../lib/organizationQueries';
import { supabase } from '../lib/supabase';
import { Users, Plus, Trash2, Shield, Eye, Search, UserPlus } from 'lucide-react';
import type { Database } from '../lib/database.types';

type OrganizationMember = Database['public']['Tables']['organization_members']['Row'];
type User = Database['public']['Tables']['users']['Row'];

interface OrganizationMembersManagementProps {
  organizationId: string;
  organizationName: string;
}

export function OrganizationMembersManagement({
  organizationId,
  organizationName
}: OrganizationMembersManagementProps) {
  const [members, setMembers] = useState<any[]>([]);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [organizationTeams, setOrganizationTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAssignTeamModal, setShowAssignTeamModal] = useState(false);
  const [selectedMemberForTeam, setSelectedMemberForTeam] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadMembers();
    loadAvailableUsers();
    loadOrganizationTeams();
  }, [organizationId]);

  const loadMembers = async () => {
    try {
      setLoading(true);
      const data = await organizationQueries.getOrganizationMembers(organizationId);
      setMembers(data || []);
    } catch (error) {
      console.error('Error loading members:', error);
      alert('メンバーの読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('name');

      if (error) throw error;
      setAvailableUsers(data || []);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const loadOrganizationTeams = async () => {
    try {
      const teams = await organizationQueries.getOrganizationTeams(organizationId);
      setOrganizationTeams(teams || []);
    } catch (error) {
      console.error('Error loading organization teams:', error);
    }
  };

  const handleAssignToTeam = async (userId: string, teamId: string) => {
    try {
      const { error } = await supabase.rpc('assign_user_to_team', {
        p_user_id: userId,
        p_team_id: teamId,
        p_organization_id: organizationId,
        p_assignment_type: 'primary'
      });

      if (error) throw error;

      await loadMembers();
      setShowAssignTeamModal(false);
      setSelectedMemberForTeam(null);
      alert('チームへの割り当てが完了しました');
    } catch (error) {
      console.error('Error assigning to team:', error);
      alert('チームへの割り当てに失敗しました: ' + (error instanceof Error ? error.message : '不明なエラー'));
    }
  };

  const handleAddMember = async (userId: string, role: OrganizationMember['role']) => {
    try {
      await organizationQueries.addOrganizationMember({
        user_id: userId,
        organization_id: organizationId,
        role
      });
      await loadMembers();
      setShowAddModal(false);
      alert('メンバーを追加しました');
    } catch (error) {
      console.error('Error adding member:', error);
      alert('メンバーの追加に失敗しました: ' + (error instanceof Error ? error.message : '不明なエラー'));
    }
  };

  const handleUpdateRole = async (memberId: string, newRole: OrganizationMember['role']) => {
    try {
      await organizationQueries.updateOrganizationMemberRole(memberId, newRole);
      await loadMembers();
      alert('権限を更新しました');
    } catch (error) {
      console.error('Error updating role:', error);
      alert('権限の更新に失敗しました');
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('このメンバーを削除しますか？')) return;

    try {
      await organizationQueries.removeOrganizationMember(memberId);
      await loadMembers();
      alert('メンバーを削除しました');
    } catch (error) {
      console.error('Error removing member:', error);
      alert('メンバーの削除に失敗しました');
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'organization_admin':
        return <Shield className="h-4 w-4 text-blue-600" />;
      case 'member':
        return <Users className="h-4 w-4 text-gray-600" />;
      default:
        return <Users className="h-4 w-4 text-gray-600" />;
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'organization_admin':
        return '組織管理者';
      case 'member':
        return '一般メンバー';
      default:
        return role;
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'organization_admin':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'member':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredMembers = members.filter(member => {
    if (!searchQuery) return true;
    const user = member.users;
    if (!user) return false;
    const searchLower = searchQuery.toLowerCase();
    return (
      user.name?.toLowerCase().includes(searchLower) ||
      user.email?.toLowerCase().includes(searchLower)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Users className="h-6 w-6" />
            組織メンバー管理
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {organizationName}のメンバーと権限を管理
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          メンバーを追加
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="名前またはメールアドレスで検索..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700">
        <div className="p-6 border-b dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              メンバー一覧 ({filteredMembers.length})
            </h3>
          </div>
        </div>

        <div className="divide-y dark:divide-gray-700">
          {filteredMembers.length === 0 ? (
            <div className="p-6 text-center text-gray-500 dark:text-gray-400">
              {searchQuery ? '検索結果がありません' : 'メンバーが登録されていません'}
            </div>
          ) : (
            filteredMembers.map((member) => (
              <MemberCard
                key={member.id}
                member={member}
                onUpdateRole={handleUpdateRole}
                onRemove={handleRemoveMember}
                onAssignTeam={(member) => {
                  setSelectedMemberForTeam(member);
                  setShowAssignTeamModal(true);
                }}
                getRoleIcon={getRoleIcon}
                getRoleLabel={getRoleLabel}
                getRoleBadgeColor={getRoleBadgeColor}
              />
            ))
          )}
        </div>
      </div>

      {showAddModal && (
        <AddMemberModal
          organizationId={organizationId}
          existingMembers={members}
          availableUsers={availableUsers}
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddMember}
          getRoleIcon={getRoleIcon}
          getRoleLabel={getRoleLabel}
        />
      )}

      {showAssignTeamModal && selectedMemberForTeam && (
        <AssignTeamModal
          member={selectedMemberForTeam}
          teams={organizationTeams}
          onClose={() => {
            setShowAssignTeamModal(false);
            setSelectedMemberForTeam(null);
          }}
          onAssign={handleAssignToTeam}
        />
      )}
    </div>
  );
}

function MemberCard({
  member,
  onUpdateRole,
  onRemove,
  onAssignTeam,
  getRoleIcon,
  getRoleLabel,
  getRoleBadgeColor
}: {
  member: any;
  onUpdateRole: (memberId: string, role: OrganizationMember['role']) => void;
  onRemove: (memberId: string) => void;
  onAssignTeam: (member: any) => void;
  getRoleIcon: (role: string) => React.ReactNode;
  getRoleLabel: (role: string) => string;
  getRoleBadgeColor: (role: string) => string;
}) {
  const user = member.users;
  if (!user) return null;

  return (
    <div className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="flex-shrink-0 w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
            <span className="text-blue-600 dark:text-blue-200 font-semibold">
              {user.name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || '?'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-gray-900 dark:text-white truncate">
                {user.name || 'Unknown User'}
              </h4>
              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${getRoleBadgeColor(member.role)}`}>
                {getRoleIcon(member.role)}
                {getRoleLabel(member.role)}
              </span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
              {user.email}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              追加日: {new Date(member.created_at).toLocaleDateString('ja-JP')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 ml-4">
          <button
            onClick={() => onAssignTeam(member)}
            className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-1"
            title="チームに割り当て"
          >
            <UserPlus className="h-4 w-4" />
            <span className="hidden sm:inline">チーム割当</span>
          </button>
          <select
            value={member.role}
            onChange={(e) => onUpdateRole(member.id, e.target.value as OrganizationMember['role'])}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="organization_admin">組織管理者</option>
            <option value="member">一般メンバー</option>
          </select>
          <button
            onClick={() => onRemove(member.id)}
            className="p-2 text-gray-600 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 transition-colors"
            title="削除"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function AddMemberModal({
  organizationId,
  existingMembers,
  availableUsers,
  onClose,
  onAdd,
  getRoleIcon,
  getRoleLabel
}: {
  organizationId: string;
  existingMembers: any[];
  availableUsers: User[];
  onClose: () => void;
  onAdd: (userId: string, role: OrganizationMember['role']) => Promise<void>;
  getRoleIcon: (role: string) => React.ReactNode;
  getRoleLabel: (role: string) => string;
}) {
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState<OrganizationMember['role']>('organization_admin');
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const existingMemberUserIds = new Set(existingMembers.map(m => m.user_id));
  const availableUsersFiltered = availableUsers.filter(user => !existingMemberUserIds.has(user.id));

  const filteredUsers = availableUsersFiltered.filter(user => {
    if (!searchQuery) return true;
    const searchLower = searchQuery.toLowerCase();
    return (
      user.name?.toLowerCase().includes(searchLower) ||
      user.email?.toLowerCase().includes(searchLower)
    );
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) {
      alert('ユーザーを選択してください');
      return;
    }

    setSubmitting(true);
    try {
      await onAdd(selectedUserId, selectedRole);
    } finally {
      setSubmitting(false);
    }
  };

  const roles: { value: OrganizationMember['role']; label: string; description: string }[] = [
    {
      value: 'organization_admin',
      label: '組織管理者',
      description: '組織内のすべてのデータと設定を管理できます（監督、GM、統括コーチなど）'
    },
    {
      value: 'member',
      label: '一般メンバー',
      description: '通常のコーチ/選手として活動します（管理権限なし）'
    }
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <div className="p-6 border-b dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              メンバーを追加
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              組織にメンバーを追加して権限を設定します
            </p>
          </div>

          <div className="p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                ユーザーを検索 <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="名前またはメールアドレスで検索..."
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white mb-3"
              />
              <div className="border dark:border-gray-600 rounded-lg max-h-60 overflow-y-auto">
                {filteredUsers.length === 0 ? (
                  <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                    {searchQuery ? '該当するユーザーが見つかりません' : '追加可能なユーザーがいません'}
                  </div>
                ) : (
                  <div className="divide-y dark:divide-gray-700">
                    {filteredUsers.map((user) => (
                      <label
                        key={user.id}
                        className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                          selectedUserId === user.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                        }`}
                      >
                        <input
                          type="radio"
                          name="user"
                          value={user.id}
                          checked={selectedUserId === user.id}
                          onChange={(e) => setSelectedUserId(e.target.value)}
                          className="h-4 w-4 text-blue-600"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 dark:text-white truncate">
                            {user.name || 'Unknown User'}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400 truncate">
                            {user.email}
                          </div>
                          {user.role && (
                            <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                              現在のシステムロール: {user.role}
                            </div>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                権限を選択 <span className="text-red-600">*</span>
              </label>
              <div className="space-y-3">
                {roles.map((role) => (
                  <label
                    key={role.value}
                    className={`flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                      selectedRole === role.value
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-400'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={role.value}
                      checked={selectedRole === role.value}
                      onChange={(e) => setSelectedRole(e.target.value as OrganizationMember['role'])}
                      className="mt-1 h-4 w-4 text-blue-600"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {getRoleIcon(role.value)}
                        <span className="font-medium text-gray-900 dark:text-white">
                          {role.label}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {role.description}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900 rounded-b-lg flex justify-end gap-3 border-t dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
              disabled={submitting}
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              disabled={submitting || !selectedUserId}
            >
              {submitting ? '追加中...' : 'メンバーを追加'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AssignTeamModal({
  member,
  teams,
  onClose,
  onAssign
}: {
  member: any;
  teams: any[];
  onClose: () => void;
  onAssign: (userId: string, teamId: string) => Promise<void>;
}) {
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const user = member.users;
  if (!user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeamId) {
      alert('チームを選択してください');
      return;
    }

    setSubmitting(true);
    try {
      await onAssign(user.id, selectedTeamId);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
        <form onSubmit={handleSubmit}>
          <div className="p-6 border-b dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              チームに割り当て
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {user.name}さんをチームに割り当てます
            </p>
          </div>

          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                チームを選択 <span className="text-red-600">*</span>
              </label>
              <select
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                required
              >
                <option value="">チームを選択...</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
              {teams.length === 0 && (
                <p className="text-sm text-amber-600 dark:text-amber-400 mt-2">
                  この組織にはまだチームがありません。先にチームを作成してください。
                </p>
              )}
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>注意:</strong> このユーザーは選択したチームに主要メンバーとして割り当てられます。
              </p>
            </div>
          </div>

          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900 rounded-b-lg flex justify-end gap-3 border-t dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
              disabled={submitting}
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              disabled={submitting || !selectedTeamId || teams.length === 0}
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>割り当て中...</span>
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" />
                  <span>チームに割り当て</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
