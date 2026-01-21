import React, { useState, useEffect, useCallback } from 'react';
import { User, Team, supabase } from '../lib/supabase';
import { PaginatedTable } from './PaginatedTable';
import { UserEditModal } from './UserEditModal';
import { UserDeleteModal } from './UserDeleteModal';
import { Users, Edit, Trash2, AlertCircle, Search, Filter } from 'lucide-react';

interface UserManagementProps {
  teams: Team[];
  // ✅ "ALL" も来うる前提で扱う
  restrictToOrganizationId?: string; // undefined / null / "ALL" -> 全ユーザー
}

export function UserManagement({ teams, restrictToOrganizationId }: UserManagementProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  const isAllMode = !restrictToOrganizationId || restrictToOrganizationId === 'ALL';

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
  
    try {
      // ✅ 組織で絞る場合：organization_members -> users をJOINで取得
      if (restrictToOrganizationId) {
        const { data, error } = await supabase
          .from('organization_members')
          .select(`
            role,
            users:users (
              id,
              user_id,
              name,
              nickname,
              email,
              role,
              team_id,
              created_at
            )
          `)
          .eq('organization_id', restrictToOrganizationId);
  
        if (error) throw error;
  
        // organization_members の行から users を取り出して平坦化
        const mapped = (data ?? [])
          .map((row: any) => row.users)
          .filter(Boolean);
  
        // 重複排除（複数行JOIN等に備えて）
        const uniq = Array.from(new Map(mapped.map((u: any) => [u.id, u])).values());
  
        // created_at desc
        uniq.sort((a: any, b: any) => (b.created_at || '').localeCompare(a.created_at || ''));
  
        setUsers(uniq as any);
        return;
      }
  
      // ✅ 全件（global admin）
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });
  
      if (error) throw error;
      setUsers(data || []);
    } catch (err: any) {
      console.error('Error fetching users:', err);
      setError('ユーザーの取得に失敗しました: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [restrictToOrganizationId]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Filter users based on search term and role filter
  useEffect(() => {
    let filtered = users;

    // Apply search filter（null安全）
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter((user: any) => {
        const name = (user?.name ?? '').toLowerCase();
        const email = (user?.email ?? '').toLowerCase();
        const userId = (user?.user_id ?? '').toLowerCase();
        return name.includes(q) || email.includes(q) || userId.includes(q);
      });
    }

    // Apply role filter
    if (roleFilter !== 'all') {
      filtered = filtered.filter((user) => user.role === roleFilter);
    }

    setFilteredUsers(filtered);
  }, [users, searchTerm, roleFilter]);

  const handleUserUpdated = () => {
    setShowEditModal(false);
    setSelectedUser(null);
    fetchUsers();
  };

  const handleUserDeleted = () => {
    setShowDeleteModal(false);
    setSelectedUser(null);
    fetchUsers();
  };

  const handleEditClick = (user: User) => {
    setSelectedUser(user);
    setShowEditModal(true);
  };

  const handleDeleteClick = (user: User) => {
    setSelectedUser(user);
    setShowDeleteModal(true);
  };

  const getTeamName = (teamId: string | null) => {
    if (!teamId) return '-';
    const team = teams.find((t) => t.id === teamId);
    return team ? team.name : '不明なチーム';
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'athlete':
        return '選手';
      case 'staff':
        return 'スタッフ';
      case 'global_admin':
        return '管理者';
      default:
        return role;
    }
  };

  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case 'global_admin':
        return 'bg-purple-100 text-purple-800';
      case 'staff':
        return 'bg-green-100 text-green-800';
      case 'athlete':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const renderUserRow = (user: User, index: number) => (
    <div
      key={user.id}
      className="bg-white border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
    >
      {/* Mobile Layout */}
      <div className="block sm:hidden space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-1">
              <span className="font-mono text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                {(user as any).user_id || 'N/A'}
              </span>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleBadgeStyle(user.role)}`}>
                {getRoleLabel(user.role)}
              </span>
            </div>
            <h3 className="font-semibold text-gray-900 truncate">{(user as any).name ?? '-'}</h3>
            <p className="text-sm text-gray-600 truncate">{(user as any).email ?? '-'}</p>
            <p className="text-xs text-gray-500">{getTeamName((user as any).team_id ?? null)}</p>
          </div>
          <div className="flex space-x-2 ml-2">
            <button
              onClick={() => handleEditClick(user)}
              className="p-2 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-600 transition-colors"
              title="編集"
            >
              <Edit className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleDeleteClick(user)}
              className="p-2 rounded-full bg-red-50 hover:bg-red-100 text-red-600 transition-colors"
              title="削除"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Desktop Layout */}
      <div className="hidden sm:grid grid-cols-6 gap-4 items-center">
        {/* User ID */}
        <div>
          <div className="text-xs font-medium text-gray-500 mb-1">ユーザーID</div>
          <div className="font-mono text-sm bg-gray-100 text-gray-700 px-2 py-1 rounded inline-block">
            {(user as any).user_id || 'N/A'}
          </div>
        </div>

        {/* Name */}
        <div>
          <div className="text-xs font-medium text-gray-500 mb-1">名前</div>
          <div className="font-semibold text-gray-900">{(user as any).name ?? '-'}</div>
        </div>

        {/* Email */}
        <div>
          <div className="text-xs font-medium text-gray-500 mb-1">メール</div>
          <div className="text-sm text-gray-700 break-all">{(user as any).email ?? '-'}</div>
        </div>

        {/* Role */}
        <div>
          <div className="text-xs font-medium text-gray-500 mb-1">役割</div>
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleBadgeStyle(user.role)}`}>
            {getRoleLabel(user.role)}
          </span>
        </div>

        {/* Team */}
        <div>
          <div className="text-xs font-medium text-gray-500 mb-1">チーム</div>
          <div className="text-sm text-gray-700">{getTeamName((user as any).team_id ?? null)}</div>
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-2">
          <button
            onClick={() => handleEditClick(user)}
            className="p-2 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-600 transition-colors"
            title="編集"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDeleteClick(user)}
            className="p-2 rounded-full bg-red-50 hover:bg-red-100 text-red-600 transition-colors"
            title="削除"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Users className="w-6 h-6 text-purple-600" />
          <h2 className="text-xl font-semibold text-gray-900">ユーザー管理</h2>
        </div>
        <div className="text-sm text-gray-600">{users.length}名のユーザーが登録されています</div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="名前、メール、またはユーザーIDで検索..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Role Filter */}
          <div className="sm:w-48">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
              >
                <option value="all">全ての役割</option>
                <option value="global_admin">管理者</option>
                <option value="staff">スタッフ</option>
                <option value="athlete">選手</option>
              </select>
            </div>
          </div>
        </div>

        {/* Filter Summary */}
        {(searchTerm || roleFilter !== 'all') && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <div className="flex items-center justify-between text-sm">
              <div className="text-gray-600">
                フィルター結果: {filteredUsers.length}名
                {searchTerm && <span className="ml-2">「{searchTerm}」で検索</span>}
                {roleFilter !== 'all' && <span className="ml-2">役割: {getRoleLabel(roleFilter)}</span>}
              </div>
              <button
                onClick={() => {
                  setSearchTerm('');
                  setRoleFilter('all');
                }}
                className="text-blue-600 hover:text-blue-700 underline"
              >
                フィルターをクリア
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="flex items-center space-x-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* User Statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-purple-600">{users.filter((u) => u.role === 'global_admin').length}</div>
          <div className="text-sm text-purple-700">管理者</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{users.filter((u) => u.role === 'staff').length}</div>
          <div className="text-sm text-green-700">スタッフ</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{users.filter((u) => u.role === 'athlete').length}</div>
          <div className="text-sm text-blue-700">選手</div>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-gray-600">{users.length}</div>
          <div className="text-sm text-gray-700">合計</div>
        </div>
      </div>

      {/* User Table */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-medium text-gray-900">ユーザー一覧</h3>
        </div>

        <div className="p-4">
          <PaginatedTable
            data={filteredUsers}
            itemsPerPage={10}
            renderItem={renderUserRow}
            loading={loading}
            emptyMessage={
              searchTerm || roleFilter !== 'all'
                ? 'フィルター条件に該当するユーザーが見つかりません。'
                : 'ユーザーが登録されていません。'
            }
          />
        </div>
      </div>

      {/* Modals */}
      {selectedUser && showEditModal && (
        <UserEditModal
          user={selectedUser}
          teams={teams}
          onClose={() => {
            setShowEditModal(false);
            setSelectedUser(null);
          }}
          onUserUpdated={handleUserUpdated}
        />
      )}

      {selectedUser && showDeleteModal && (
        <UserDeleteModal
          user={selectedUser}
          onClose={() => {
            setShowDeleteModal(false);
            setSelectedUser(null);
          }}
          onUserDeleted={handleUserDeleted}
        />
      )}
    </div>
  );
}