import React, { useState } from 'react';
import { useOrganizations, useOrganizationTeams } from '../hooks/useOrganizations';
import { Building2, Plus, Edit2, Trash2, Users } from 'lucide-react';
import type { Database } from '../lib/database.types';

type Organization = Database['public']['Tables']['organizations']['Row'];
type Team = Database['public']['Tables']['teams']['Row'];

interface OrganizationManagementProps {
  userId: string;
}

export function OrganizationManagement({ userId }: OrganizationManagementProps) {
  const { organizations, loading, error, createOrganization, updateOrganization, deleteOrganization } = useOrganizations(userId);
  const [selectedOrgId, setSelectedOrgId] = useState<string | undefined>();
  const [showCreateOrgModal, setShowCreateOrgModal] = useState(false);
  const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-medium text-red-800 mb-2">組織の読み込みに失敗しました</h3>
            <p className="text-sm text-red-700 mb-3">{error}</p>
            <details className="text-xs text-red-600">
              <summary className="cursor-pointer hover:text-red-800 font-medium mb-1">デバッグ情報</summary>
              <div className="mt-2 bg-red-100 p-2 rounded border border-red-200 font-mono">
                <p>User ID: {userId}</p>
                <p>Error: {error}</p>
                <p className="mt-2 text-red-700">
                  考えられる原因:
                  <br />• データベースのRLSポリシーでアクセスがブロックされている
                  <br />• ユーザーのroleが正しく設定されていない
                  <br />• auth.uid()とusers.idのマッピングに問題がある
                </p>
              </div>
            </details>
            <button
              onClick={() => window.location.reload()}
              className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
            >
              ページを再読み込み
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Building2 className="h-6 w-6" />
            組織管理
          </h2>
          <p className="text-gray-600 mt-1">組織とチームの作成・管理</p>
        </div>
        <button
          onClick={() => setShowCreateOrgModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          組織を追加
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-6 border-b">
            <h3 className="text-lg font-semibold text-gray-900">組織一覧</h3>
          </div>
          <div className="divide-y">
            {organizations.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                組織が登録されていません
              </div>
            ) : (
              organizations.map((org) => (
                <OrganizationCard
                  key={org.id}
                  organization={org}
                  isSelected={selectedOrgId === org.id}
                  onSelect={() => setSelectedOrgId(org.id)}
                  onEdit={() => setEditingOrg(org)}
                  onDelete={async () => {
                    if (confirm(`${org.name}を削除しますか？関連するチームも削除されます。`)) {
                      try {
                        await deleteOrganization(org.id);
                        if (selectedOrgId === org.id) {
                          setSelectedOrgId(undefined);
                        }
                      } catch (err) {
                        alert('組織の削除に失敗しました: ' + (err instanceof Error ? err.message : 'Unknown error'));
                      }
                    }
                  }}
                />
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border">
          {selectedOrgId ? (
            <TeamPanel
              organizationId={selectedOrgId}
              onCreateClick={() => setShowCreateTeamModal(true)}
            />
          ) : (
            <div className="p-6 text-center text-gray-500">
              左側から組織を選択してください
            </div>
          )}
        </div>
      </div>

      {showCreateOrgModal && (
        <CreateOrganizationModal
          onClose={() => setShowCreateOrgModal(false)}
          onCreate={async (name, description) => {
            try {
              await createOrganization(name, description);

              // 成功通知を表示
              const notification = document.createElement('div');
              notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 flex items-center gap-2';
              notification.innerHTML = `
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
                <span>組織「${name}」を作成しました</span>
              `;
              document.body.appendChild(notification);

              // 3秒後に通知を削除
              setTimeout(() => {
                notification.style.opacity = '0';
                notification.style.transition = 'opacity 0.3s';
                setTimeout(() => notification.remove(), 300);
              }, 3000);

              setShowCreateOrgModal(false);
            } catch (err) {
              alert('組織の作成に失敗しました: ' + (err instanceof Error ? err.message : 'Unknown error'));
            }
          }}
        />
      )}

      {editingOrg && (
        <EditOrganizationModal
          organization={editingOrg}
          onClose={() => setEditingOrg(null)}
          onUpdate={async (updates) => {
            try {
              await updateOrganization(editingOrg.id, updates);

              // 成功通知を表示
              const notification = document.createElement('div');
              notification.className = 'fixed top-4 right-4 bg-blue-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 flex items-center gap-2';
              notification.innerHTML = `
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
                <span>組織を更新しました</span>
              `;
              document.body.appendChild(notification);

              // 3秒後に通知を削除
              setTimeout(() => {
                notification.style.opacity = '0';
                notification.style.transition = 'opacity 0.3s';
                setTimeout(() => notification.remove(), 300);
              }, 3000);

              setEditingOrg(null);
            } catch (err) {
              alert('組織の更新に失敗しました: ' + (err instanceof Error ? err.message : 'Unknown error'));
            }
          }}
        />
      )}

      {showCreateTeamModal && selectedOrgId && (
        <CreateTeamModal
          organizationId={selectedOrgId}
          onClose={() => setShowCreateTeamModal(false)}
        />
      )}
    </div>
  );
}

function OrganizationCard({
  organization,
  isSelected,
  onSelect,
  onEdit,
  onDelete
}: {
  organization: Organization;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={`p-4 cursor-pointer transition-colors ${
        isSelected ? 'bg-blue-50 border-l-4 border-blue-600' : 'hover:bg-gray-50'
      }`}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-gray-900 truncate">{organization.name}</h4>
          {organization.description && (
            <p className="text-sm text-gray-600 mt-1 line-clamp-2">{organization.description}</p>
          )}
          <p className="text-xs text-gray-500 mt-2">
            作成日: {new Date(organization.created_at).toLocaleDateString('ja-JP')}
          </p>
        </div>
        <div className="flex items-center gap-2 ml-4" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onEdit}
            className="p-1 text-gray-600 hover:text-blue-600 transition-colors"
            title="編集"
          >
            <Edit2 className="h-4 w-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-1 text-gray-600 hover:text-red-600 transition-colors"
            title="削除"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function TeamPanel({
  organizationId,
  onCreateClick
}: {
  organizationId: string;
  onCreateClick: () => void;
}) {
  const { teams, loading, deleteTeam } = useOrganizationTeams(organizationId);

  console.log('TeamPanel render:', { organizationId, loading, teamsCount: teams.length, teams });

  return (
    <>
      <div className="p-6 border-b flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Users className="h-5 w-5" />
          チーム一覧 ({teams.length})
        </h3>
        <button
          onClick={onCreateClick}
          className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          チームを追加
        </button>
      </div>
      <div className="divide-y max-h-[500px] overflow-y-auto">
        {loading ? (
          <div className="p-6 text-center">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
        ) : teams.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            チームが登録されていません
          </div>
        ) : (
          teams.map((team: any) => (
            <TeamCard
              key={team.id}
              team={team}
              onDelete={async () => {
                if (confirm(`${team.name}を削除しますか？所属する選手とコーチのデータも削除されます。`)) {
                  try {
                    await deleteTeam(team.id);
                  } catch (err) {
                    alert('チームの削除に失敗しました: ' + (err instanceof Error ? err.message : 'Unknown error'));
                  }
                }
              }}
            />
          ))
        )}
      </div>
    </>
  );
}

function TeamCard({
  team,
  onDelete
}: {
  team: any;
  onDelete: () => void;
}) {
  return (
    <div className="p-4 hover:bg-gray-50 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-gray-900 truncate">{team.name}</h4>
          {team.description && (
            <p className="text-sm text-gray-600 mt-1 line-clamp-2">{team.description}</p>
          )}
          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              選手: {team.member_count || 0}名
            </span>
            <span className="flex items-center gap-1">
              コーチ: {team.staff_count || 0}名
            </span>
          </div>
        </div>
        <button
          onClick={onDelete}
          className="p-1 text-gray-600 hover:text-red-600 transition-colors ml-4"
          title="削除"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function CreateOrganizationModal({
  onClose,
  onCreate
}: {
  onClose: () => void;
  onCreate: (name: string, description: string) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);
    try {
      await onCreate(name.trim(), description.trim());
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <form onSubmit={handleSubmit}>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">組織を追加</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  組織名 <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="例: 株式会社サンプル"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  説明
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="組織の説明を入力（任意）"
                />
              </div>
            </div>
          </div>
          <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
              disabled={submitting}
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              disabled={submitting || !name.trim()}
            >
              {submitting ? '作成中...' : '作成'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditOrganizationModal({
  organization,
  onClose,
  onUpdate
}: {
  organization: Organization;
  onClose: () => void;
  onUpdate: (updates: { name?: string; description?: string }) => Promise<void>;
}) {
  const [name, setName] = useState(organization.name);
  const [description, setDescription] = useState(organization.description || '');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);
    try {
      await onUpdate({
        name: name.trim(),
        description: description.trim()
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <form onSubmit={handleSubmit}>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">組織を編集</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  組織名 <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  説明
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              </div>
            </div>
          </div>
          <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
              disabled={submitting}
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              disabled={submitting || !name.trim()}
            >
              {submitting ? '更新中...' : '更新'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CreateTeamModal({
  organizationId,
  onClose
}: {
  organizationId: string;
  onClose: () => void;
}) {
  const { createTeam } = useOrganizationTeams(organizationId);
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);
    try {
      const team = await createTeam(name.trim());
      console.log('Team created successfully, closing modal:', team);

      // 成功通知を表示
      const notification = document.createElement('div');
      notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 flex items-center gap-2';
      notification.innerHTML = `
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
        </svg>
        <span>チーム「${name.trim()}」を作成しました</span>
      `;
      document.body.appendChild(notification);

      // 3秒後に通知を削除
      setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transition = 'opacity 0.3s';
        setTimeout(() => notification.remove(), 300);
      }, 3000);

      onClose();
    } catch (err) {
      alert('チームの作成に失敗しました: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <form onSubmit={handleSubmit}>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">チームを追加</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  チーム名 <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="例: U-15サッカーチーム"
                  required
                  autoFocus
                />
              </div>
            </div>
          </div>
          <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
              disabled={submitting}
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
              disabled={submitting || !name.trim()}
            >
              {submitting ? '作成中...' : '作成'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
