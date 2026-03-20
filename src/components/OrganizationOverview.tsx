import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Users, UserCheck, UserX, ChevronDown, ChevronRight, UserPlus, Search } from 'lucide-react';
import type { Database } from '../lib/database.types';

type Team = Database['public']['Tables']['teams']['Row'];
type User = Database['public']['Tables']['users']['Row'];

interface OrganizationOverviewProps {
  organizationId: string;
  organizationName: string;
}

interface TeamWithMembers extends Team {
  athletes: User[];
  coaches: User[];
}

export function OrganizationOverview({ organizationId, organizationName }: OrganizationOverviewProps) {
  const [teams, setTeams] = useState<TeamWithMembers[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [organizationMembers, setOrganizationMembers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadTeamsAndMembers();
    loadOrganizationMembers();
  }, [organizationId]);

  const loadTeamsAndMembers = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select('*')
        .eq('organization_id', organizationId)
        .order('name');

      if (teamsError) throw teamsError;

      if (!teamsData || teamsData.length === 0) {
        setTeams([]);
        return;
      }

      const teamsWithMembers = await Promise.all(
        teamsData.map(async (team) => {
          const { data: athletes, error: athletesError } = await supabase
            .from('users')
            .select('*')
            .eq('team_id', team.id)
            .eq('role', 'athlete')
            .eq('status', 'active')
            .order('name');

          if (athletesError) throw athletesError;

          const { data: staffLinks, error: staffError } = await supabase
            .from('staff_team_links')
            .select(`
              staff_user_id,
              users!staff_team_links_staff_user_id_fkey (
                id,
                name,
                email,
                role
              )
            `)
            .eq('team_id', team.id);

          if (staffError) throw staffError;

          const coaches = staffLinks?.map(link => link.users).filter(Boolean) as User[] || [];

          return {
            ...team,
            athletes: athletes || [],
            coaches
          };
        })
      );

      setTeams(teamsWithMembers);
    } catch (err) {
      console.error('Error loading teams and members:', err);
      setError(err instanceof Error ? err.message : '組織データの読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const loadOrganizationMembers = async () => {
    try {
      // Get all user IDs that belong to this organization
      const { data: memberLinks, error: memberLinksError } = await supabase
        .from('organization_members')
        .select('user_id')
        .eq('organization_id', organizationId);

      if (memberLinksError) throw memberLinksError;

      if (!memberLinks || memberLinks.length === 0) {
        console.log('No organization members found');
        setOrganizationMembers([]);
        return;
      }

      const userIds = memberLinks.map(m => m.user_id);

      // Fetch user details
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, name, email, role, team_id')
        .in('id', userIds);

      if (usersError) throw usersError;

      console.log('Organization members loaded:', users);
      console.log('Total members:', users?.length || 0);
      setOrganizationMembers(users || []);
    } catch (err) {
      console.error('Error loading organization members:', err);
    }
  };

  const toggleTeam = (teamId: string) => {
    setExpandedTeams(prev => {
      const next = new Set(prev);
      if (next.has(teamId)) {
        next.delete(teamId);
      } else {
        next.add(teamId);
      }
      return next;
    });
  };

  const handleOpenAddMember = (team: Team) => {
    setSelectedTeam(team);
    setShowAddMemberModal(true);
    setSearchQuery('');
  };

  const handleAssignMember = async (userId: string, memberRole: 'athlete' | 'staff') => {
    if (!selectedTeam) return;

    try {
      if (memberRole === 'athlete') {
        const { data, error } = await supabase.rpc('update_athlete_team', {
          athlete_id: userId,
          new_team_id: selectedTeam.id
        });

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('staff_team_links')
          .insert({
            staff_user_id: userId,
            team_id: selectedTeam.id
          });

        if (error) throw error;
      }

      await loadTeamsAndMembers();
      await loadOrganizationMembers();
      setShowAddMemberModal(false);
      setSelectedTeam(null);
      alert('メンバーをチームに追加しました');
    } catch (err) {
      console.error('Error assigning member:', err);
      alert('メンバーの追加に失敗しました: ' + (err instanceof Error ? err.message : '不明なエラー'));
    }
  };

  const handleRemoveMember = async (userId: string, memberRole: 'athlete' | 'staff', teamId: string) => {
    if (!confirm('このメンバーをチームから削除しますか？')) return;

    try {
      if (memberRole === 'athlete') {
        const { data, error } = await supabase.rpc('update_athlete_team', {
          athlete_id: userId,
          new_team_id: null
        });

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('staff_team_links')
          .delete()
          .eq('staff_user_id', userId)
          .eq('team_id', teamId);

        if (error) throw error;
      }

      await loadTeamsAndMembers();
      alert('メンバーをチームから削除しました');
    } catch (err) {
      console.error('Error removing member:', err);
      alert('メンバーの削除に失敗しました: ' + (err instanceof Error ? err.message : '不明なエラー'));
    }
  };

  const totalAthletes = organizationMembers.filter(m => m.role === 'athlete').length;
  const athletesWithoutTeam = organizationMembers.filter(m => m.role === 'athlete' && !m.team_id).length;
  const totalCoaches = organizationMembers.filter(m => m.role === 'staff').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p className="text-red-800 dark:text-red-200">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {organizationName}
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          組織全体のチームとメンバーの概要
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-700 dark:text-blue-300 mb-1">登録チーム数</p>
              <p className="text-3xl font-bold text-blue-900 dark:text-blue-100">{teams.length}</p>
            </div>
            <Users className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          </div>
        </div>

        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-700 dark:text-green-300 mb-1">選手総数</p>
              <p className="text-3xl font-bold text-green-900 dark:text-green-100">{totalAthletes}</p>
              {athletesWithoutTeam > 0 && (
                <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                  ⚠️ チーム未所属: {athletesWithoutTeam}名
                </p>
              )}
            </div>
            <UserCheck className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
        </div>

        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-purple-700 dark:text-purple-300 mb-1">コーチ総数</p>
              <p className="text-3xl font-bold text-purple-900 dark:text-purple-100">{totalCoaches}</p>
            </div>
            <UserX className="h-8 w-8 text-purple-600 dark:text-purple-400" />
          </div>
        </div>
      </div>

      {athletesWithoutTeam > 0 && (
        <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4 border border-orange-200 dark:border-orange-800">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <UserX className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              <h3 className="text-sm font-semibold text-orange-900 dark:text-orange-100">
                チーム未所属の選手 ({athletesWithoutTeam}名)
              </h3>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {organizationMembers
              .filter(m => m.role === 'athlete' && !m.team_id)
              .map((athlete) => (
                <div
                  key={athlete.id}
                  className="bg-white dark:bg-gray-800 rounded p-2 border border-orange-200 dark:border-orange-600"
                >
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{athlete.name}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">{athlete.email}</p>
                </div>
              ))
            }
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">チーム別メンバー一覧</h3>
        </div>
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {teams.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              この組織にはチームが登録されていません
            </div>
          ) : (
            teams.map((team) => {
              const isExpanded = expandedTeams.has(team.id);
              return (
                <div key={team.id}>
                  <div className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <button
                      onClick={() => toggleTeam(team.id)}
                      className="flex-1 flex items-center gap-3 text-left"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-5 w-5 text-gray-400" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-gray-400" />
                      )}
                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white">{team.name}</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          選手 {team.athletes.length}名 / コーチ {team.coaches.length}名
                        </p>
                      </div>
                    </button>
                    <button
                      onClick={() => handleOpenAddMember(team)}
                      className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm"
                    >
                      <UserPlus className="h-4 w-4" />
                      <span>メンバー追加</span>
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-4 bg-gray-50 dark:bg-gray-700/30">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <div>
                          <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                            <UserCheck className="h-4 w-4" />
                            選手 ({team.athletes.length})
                          </h5>
                          <div className="space-y-2">
                            {team.athletes.length === 0 ? (
                              <p className="text-sm text-gray-500 dark:text-gray-400 italic">選手が登録されていません</p>
                            ) : (
                              team.athletes.map((athlete) => (
                                <div
                                  key={athlete.id}
                                  className="bg-white dark:bg-gray-800 rounded p-2 border border-gray-200 dark:border-gray-600 flex items-center justify-between"
                                >
                                  <div>
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">{athlete.name}</p>
                                    <p className="text-xs text-gray-600 dark:text-gray-400">{athlete.email}</p>
                                  </div>
                                  <button
                                    onClick={() => handleRemoveMember(athlete.id, 'athlete', team.id)}
                                    className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                                    title="削除"
                                  >
                                    <UserX className="h-4 w-4" />
                                  </button>
                                </div>
                              ))
                            )}
                          </div>
                        </div>

                        <div>
                          <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                            <UserX className="h-4 w-4" />
                            コーチ ({team.coaches.length})
                          </h5>
                          <div className="space-y-2">
                            {team.coaches.length === 0 ? (
                              <p className="text-sm text-gray-500 dark:text-gray-400 italic">コーチが割り当てられていません</p>
                            ) : (
                              team.coaches.map((coach) => (
                                <div
                                  key={coach.id}
                                  className="bg-white dark:bg-gray-800 rounded p-2 border border-gray-200 dark:border-gray-600 flex items-center justify-between"
                                >
                                  <div>
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">{coach.name}</p>
                                    <p className="text-xs text-gray-600 dark:text-gray-400">{coach.email}</p>
                                  </div>
                                  <button
                                    onClick={() => handleRemoveMember(coach.id, 'staff', team.id)}
                                    className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                                    title="削除"
                                  >
                                    <UserX className="h-4 w-4" />
                                  </button>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {showAddMemberModal && selectedTeam && (
        <AddMemberToTeamModal
          team={selectedTeam}
          allTeams={teams}
          organizationMembers={organizationMembers}
          currentTeamMembers={[
            ...teams.find(t => t.id === selectedTeam.id)?.athletes || [],
            ...teams.find(t => t.id === selectedTeam.id)?.coaches || []
          ]}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onClose={() => {
            setShowAddMemberModal(false);
            setSelectedTeam(null);
            setSearchQuery('');
          }}
          onAssign={handleAssignMember}
        />
      )}
    </div>
  );
}

function AddMemberToTeamModal({
  team,
  allTeams,
  organizationMembers,
  currentTeamMembers,
  searchQuery,
  onSearchChange,
  onClose,
  onAssign
}: {
  team: Team;
  allTeams: TeamWithMembers[];
  organizationMembers: User[];
  currentTeamMembers: User[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onClose: () => void;
  onAssign: (userId: string, memberRole: 'athlete' | 'staff') => Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);

  const currentTeamMemberIds = new Set(currentTeamMembers.map(m => m.id));

  const availableMembers = organizationMembers.filter(member => {
    if (currentTeamMemberIds.has(member.id)) return false;

    if (member.role === 'athlete' && member.team_id && member.team_id !== team.id) {
      return false;
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const nameMatch = member.name?.toLowerCase().includes(query);
      const emailMatch = member.email?.toLowerCase().includes(query);
      return nameMatch || emailMatch;
    }

    return true;
  });

  const athletes = availableMembers.filter(m => m.role === 'athlete');
  const staff = availableMembers.filter(m => m.role === 'staff');

  const handleAssign = async (userId: string, role: 'athlete' | 'staff', currentTeamId?: string) => {
    if (role === 'athlete' && currentTeamId && currentTeamId !== team.id) {
      const member = organizationMembers.find(m => m.id === userId);
      const currentTeam = allTeams.find(t => t.id === currentTeamId);
      if (!confirm(`${member?.name}は現在「${currentTeam?.name}」に所属しています。このチームに移動しますか？`)) {
        return;
      }
    }

    setSubmitting(true);
    try {
      await onAssign(userId, role);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {team.name} にメンバーを追加
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            組織内のメンバーからチームに割り当てるメンバーを選択してください
          </p>
        </div>

        <div className="p-4 border-b dark:border-gray-700">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="名前またはメールアドレスで検索..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {availableMembers.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              {searchQuery ? '検索結果がありません' : 'このチームに追加できるメンバーがいません'}
            </div>
          ) : (
            <div className="space-y-6">
              {athletes.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                    <UserCheck className="h-4 w-4" />
                    選手 ({athletes.length})
                  </h4>
                  <div className="space-y-2">
                    {athletes.map((athlete) => {
                      const currentTeam = athlete.team_id ? allTeams.find(t => t.id === athlete.team_id) : null;
                      return (
                        <div
                          key={athlete.id}
                          className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {athlete.name}
                            </p>
                            <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                              {athlete.email}
                            </p>
                            {currentTeam && (
                              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                                現在: {currentTeam.name}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => handleAssign(athlete.id, 'athlete', athlete.team_id || undefined)}
                            disabled={submitting}
                            className="ml-4 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm whitespace-nowrap"
                          >
                            {currentTeam ? '移動' : '追加'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {staff.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    スタッフ ({staff.length})
                  </h4>
                  <div className="space-y-2">
                    {staff.map((staffMember) => (
                      <div
                        key={staffMember.id}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {staffMember.name}
                          </p>
                          <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                            {staffMember.email}
                          </p>
                        </div>
                        <button
                          onClick={() => handleAssign(staffMember.id, 'staff')}
                          disabled={submitting}
                          className="ml-4 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm whitespace-nowrap"
                        >
                          追加
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900 rounded-b-lg flex justify-end border-t dark:border-gray-700">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
