// src/components/TeamManagementPanel.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  Plus,
  Users,
  ArrowRight,
  X,
  Pencil,
  Check,
  ChevronDown,
  Loader2,
  UsersRound,
} from 'lucide-react';

interface Member {
  membershipId: string;
  userId: string;
  name: string;
  nickname: string | null;
  role: string;
}

interface TeamWithMembers {
  id: string;
  name: string;
  members: Member[];
}

interface TeamManagementPanelProps {
  organizationId: string;
}

export function TeamManagementPanel({ organizationId }: TeamManagementPanelProps) {
  const [teams, setTeams] = useState<TeamWithMembers[]>([]);
  const [orgMembers, setOrgMembers] = useState<{ id: string; name: string; nickname: string | null; role: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Team creation state
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [creating, setCreating] = useState(false);

  // Team rename state
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [renaming, setRenaming] = useState(false);

  // Move member state
  const [movingMember, setMovingMember] = useState<{ membershipId: string; userId: string; name: string; fromTeamId: string } | null>(null);
  const [moveTargetTeamId, setMoveTargetTeamId] = useState('');
  const [moving, setMoving] = useState(false);

  // Add member state
  const [addingToTeamId, setAddingToTeamId] = useState<string | null>(null);
  const [addMemberUserId, setAddMemberUserId] = useState('');
  const [addingMember, setAddingMember] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. teams
      const { data: teamsData, error: tErr } = await supabase
        .from('teams')
        .select('id, name')
        .eq('organization_id', organizationId)
        .order('name');
      if (tErr) throw tErr;

      const teamIds = (teamsData ?? []).map((t) => t.id);

      // 2. memberships (end_date IS NULL = active)
      const { data: memberships, error: mErr } = await supabase
        .from('user_team_memberships')
        .select('id, team_id, user_id, users!inner(id, name, nickname, role)')
        .in('team_id', teamIds.length ? teamIds : ['__none__'])
        .is('end_date', null);
      if (mErr) throw mErr;

      const teamsWithMembers: TeamWithMembers[] = (teamsData ?? []).map((team) => ({
        id: team.id,
        name: team.name,
        members: (memberships ?? [])
          .filter((m) => m.team_id === team.id)
          .map((m) => {
            const u = m.users as any;
            return {
              membershipId: m.id,
              userId: m.user_id,
              name: u?.name ?? '名前未設定',
              nickname: u?.nickname ?? null,
              role: u?.role ?? 'athlete',
            };
          }),
      }));
      setTeams(teamsWithMembers);

      // 3. All org users (for add-member dropdown)
      const { data: orgUsers } = await supabase
        .from('users')
        .select('id, name, nickname, role')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('name');
      setOrgMembers(orgUsers ?? []);
    } catch (e: any) {
      setError(e.message ?? 'データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    load();
  }, [load]);

  // ── Create team ──────────────────────────────────────────────────────────────
  const handleCreateTeam = async () => {
    const name = newTeamName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const { error: e } = await supabase
        .from('teams')
        .insert({ name, organization_id: organizationId });
      if (e) throw e;
      setNewTeamName('');
      setShowCreateTeam(false);
      await load();
    } catch (e: any) {
      alert(e.message ?? 'チームの作成に失敗しました');
    } finally {
      setCreating(false);
    }
  };

  // ── Rename team ──────────────────────────────────────────────────────────────
  const handleRenameTeam = async (teamId: string) => {
    const name = editingName.trim();
    if (!name) return;
    setRenaming(true);
    try {
      const { error: e } = await supabase
        .from('teams')
        .update({ name })
        .eq('id', teamId);
      if (e) throw e;
      setEditingTeamId(null);
      await load();
    } catch (e: any) {
      alert(e.message ?? 'チーム名の変更に失敗しました');
    } finally {
      setRenaming(false);
    }
  };

  // ── Move member ──────────────────────────────────────────────────────────────
  const handleMove = async () => {
    if (!movingMember || !moveTargetTeamId) return;
    setMoving(true);
    try {
      // Update membership to new team
      const { error: e } = await supabase
        .from('user_team_memberships')
        .update({ team_id: moveTargetTeamId, updated_at: new Date().toISOString() })
        .eq('id', movingMember.membershipId);
      if (e) throw e;
      setMovingMember(null);
      setMoveTargetTeamId('');
      await load();
    } catch (e: any) {
      alert(e.message ?? 'メンバーの移動に失敗しました');
    } finally {
      setMoving(false);
    }
  };

  // ── Add member to team ───────────────────────────────────────────────────────
  const handleAddMember = async (teamId: string) => {
    if (!addMemberUserId) return;
    setAddingMember(true);
    try {
      // Remove existing active membership if any
      await supabase
        .from('user_team_memberships')
        .update({ end_date: new Date().toISOString().split('T')[0] })
        .eq('user_id', addMemberUserId)
        .is('end_date', null);

      // Add new membership
      const { error: e } = await supabase
        .from('user_team_memberships')
        .insert({ user_id: addMemberUserId, team_id: teamId, role: 'athlete' });
      if (e) throw e;
      setAddingToTeamId(null);
      setAddMemberUserId('');
      await load();
    } catch (e: any) {
      alert(e.message ?? 'メンバーの追加に失敗しました');
    } finally {
      setAddingMember(false);
    }
  };

  const displayName = (m: { name: string; nickname: string | null }) =>
    m.nickname || m.name;

  const roleLabel = (role: string) => {
    if (role === 'athlete') return null;
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">
        {role === 'coach' ? 'コーチ' : role === 'staff' ? 'スタッフ' : role}
      </span>
    );
  };

  // Members not in this team (for add dropdown)
  const unassignedForTeam = (team: TeamWithMembers) => {
    const assignedIds = new Set(teams.flatMap((t) => t.members.map((m) => m.userId)));
    return orgMembers.filter((u) => !assignedIds.has(u.id));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <UsersRound className="w-5 h-5" />
            チーム管理
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            チームの作成・メンバーのチーム間移動
          </p>
        </div>
        <button
          onClick={() => { setShowCreateTeam(true); setNewTeamName(''); }}
          className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          新規チーム作成
        </button>
      </div>

      {/* Create team inline form */}
      {showCreateTeam && (
        <div className="p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl">
          <p className="text-sm font-medium text-orange-900 dark:text-orange-100 mb-3">新しいチームを作成</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateTeam()}
              placeholder="チーム名を入力..."
              autoFocus
              className="flex-1 px-3 py-2 text-sm border border-orange-300 dark:border-orange-700 rounded-lg focus:ring-2 focus:ring-orange-500 bg-white dark:bg-gray-800 dark:text-white"
            />
            <button
              onClick={handleCreateTeam}
              disabled={creating || !newTeamName.trim()}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 text-sm font-medium flex items-center gap-1.5"
            >
              {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              作成
            </button>
            <button
              onClick={() => setShowCreateTeam(false)}
              className="px-3 py-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Teams */}
      {teams.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400 text-sm">
          チームがありません。「新規チーム作成」から追加してください。
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {teams.map((team) => {
            const candidates = unassignedForTeam(team);
            return (
              <div
                key={team.id}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden"
              >
                {/* Team header */}
                <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700">
                  {editingTeamId === team.id ? (
                    <div className="flex-1 flex items-center gap-2">
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRenameTeam(team.id);
                          if (e.key === 'Escape') setEditingTeamId(null);
                        }}
                        autoFocus
                        className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      />
                      <button
                        onClick={() => handleRenameTeam(team.id)}
                        disabled={renaming}
                        className="p-1 text-green-600 hover:bg-green-50 rounded"
                      >
                        {renaming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => setEditingTeamId(null)}
                        className="p-1 text-gray-400 hover:text-gray-600 rounded"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <Users className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span className="flex-1 font-semibold text-gray-900 dark:text-white text-sm">
                        {team.name}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {team.members.length}名
                      </span>
                      <button
                        onClick={() => { setEditingTeamId(team.id); setEditingName(team.name); }}
                        className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        title="チーム名を変更"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                    </>
                  )}
                </div>

                {/* Member list */}
                <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
                  {team.members.length === 0 ? (
                    <div className="px-4 py-3 text-xs text-gray-400 dark:text-gray-500 text-center">
                      メンバーなし
                    </div>
                  ) : (
                    team.members.map((member) => (
                      <div key={member.membershipId} className="flex items-center gap-3 px-4 py-2.5">
                        <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                            {displayName(member).charAt(0)}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {displayName(member)}
                            </span>
                            {roleLabel(member.role)}
                          </div>
                        </div>
                        {/* Move button */}
                        <button
                          onClick={() =>
                            setMovingMember({
                              membershipId: member.membershipId,
                              userId: member.userId,
                              name: displayName(member),
                              fromTeamId: team.id,
                            })
                          }
                          className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-md transition-colors border border-gray-200 dark:border-gray-600 dark:hover:border-orange-500"
                          title="他のチームへ移動"
                        >
                          <ArrowRight className="w-3 h-3" />
                          移動
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {/* Add member */}
                <div className="px-4 py-2.5 border-t border-gray-100 dark:border-gray-700/50">
                  {addingToTeamId === team.id ? (
                    <div className="flex items-center gap-2">
                      <select
                        value={addMemberUserId}
                        onChange={(e) => setAddMemberUserId(e.target.value)}
                        className="flex-1 px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 bg-white dark:bg-gray-700 dark:text-white"
                      >
                        <option value="">メンバーを選択...</option>
                        {candidates.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.nickname || u.name}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleAddMember(team.id)}
                        disabled={addingMember || !addMemberUserId}
                        className="px-2.5 py-1.5 bg-orange-600 text-white rounded-lg text-xs hover:bg-orange-700 disabled:opacity-50 flex items-center gap-1"
                      >
                        {addingMember ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                        追加
                      </button>
                      <button
                        onClick={() => { setAddingToTeamId(null); setAddMemberUserId(''); }}
                        className="p-1.5 text-gray-400 hover:text-gray-600 rounded"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setAddingToTeamId(team.id); setAddMemberUserId(''); }}
                      className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-gray-400 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/10 rounded-lg transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      メンバーを追加
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Move member modal */}
      {movingMember && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-sm w-full p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-white">メンバーを移動</h3>
              <button
                onClick={() => { setMovingMember(null); setMoveTargetTeamId(''); }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <p className="text-sm font-medium text-gray-900 dark:text-white">{movingMember.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                現在: {teams.find((t) => t.id === movingMember.fromTeamId)?.name}
              </p>
            </div>

            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                移動先チーム
              </label>
              <select
                value={moveTargetTeamId}
                onChange={(e) => setMoveTargetTeamId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 bg-white dark:bg-gray-700 dark:text-white"
              >
                <option value="">チームを選択...</option>
                {teams
                  .filter((t) => t.id !== movingMember.fromTeamId)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setMovingMember(null); setMoveTargetTeamId(''); }}
                disabled={moving}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleMove}
                disabled={moving || !moveTargetTeamId}
                className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm hover:bg-orange-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {moving ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> 移動中...</>
                ) : (
                  <><ArrowRight className="w-4 h-4" /> 移動する</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
