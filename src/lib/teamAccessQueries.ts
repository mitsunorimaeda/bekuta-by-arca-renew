// src/lib/teamAccessQueries.ts
import { supabase } from './supabase';
import type { AppRole } from './roles';

export interface TeamAccessRequest {
  id: string;
  requester_id: string;
  team_id: string;
  organization_id: string;
  status: 'pending' | 'approved' | 'rejected';
  request_message: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string;
  created_at: string;
  updated_at: string;
  requester?: {
    id: string;
    name: string;
    email: string;
  };
  team?: {
    id: string;
    name: string;
    organization_id?: string;
  };
  reviewer?: {
    id: string;
    name: string;
  };
}

const isGlobalAdmin = (role?: AppRole | string | null) => role === 'global_admin';

export const teamAccessQueries = {
  async getMyRequests(userId: string) {
    const { data, error } = await supabase
      .from('team_access_requests')
      .select(
        `
        *,
        team:teams (
          id,
          name
        )
      `,
      )
      .eq('requester_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as TeamAccessRequest[];
  },

  async getPendingRequestsForMyTeams(userId: string) {
    // users.role を参照（usersで統一）
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .maybeSingle();

    if (userError) throw userError;

    // ✅ global_admin は全件見える
    if (isGlobalAdmin(userData?.role)) {
      const { data, error } = await supabase
        .from('team_access_requests')
        .select(
          `
          *,
          requester:users!team_access_requests_requester_id_fkey (
            id,
            name,
            email
          ),
          team:teams (
            id,
            name,
            organization_id
          )
        `,
        )
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as TeamAccessRequest[];
    }

    // ✅ staff は自分が管理しているteamだけ
    const { data: myTeams, error: teamsError } = await supabase
      .from('staff_team_links')
      .select('team_id')
      .eq('staff_user_id', userId);

    if (teamsError) throw teamsError;

    const teamIds = myTeams?.map((t) => t.team_id).filter(Boolean) || [];
    if (teamIds.length === 0) return [];

    const { data, error } = await supabase
      .from('team_access_requests')
      .select(
        `
        *,
        requester:users!team_access_requests_requester_id_fkey (
          id,
          name,
          email
        ),
        team:teams (
          id,
          name
        )
      `,
      )
      .eq('status', 'pending')
      .in('team_id', teamIds)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as TeamAccessRequest[];
  },

  async getRequestsForOrganization(organizationId: string) {
    const { data, error } = await supabase
      .from('team_access_requests')
      .select(
        `
        *,
        requester:users!team_access_requests_requester_id_fkey (
          id,
          name,
          email
        ),
        team:teams (
          id,
          name
        ),
        reviewer:users!team_access_requests_reviewed_by_fkey (
          id,
          name
        )
      `,
      )
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as TeamAccessRequest[];
  },

  async getAvailableTeamsToRequest(userId: string, organizationId: string) {
    // ✅ users.team_id を参照（usersで統一）
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('team_id')
      .eq('id', userId)
      .maybeSingle();

    if (userError) throw userError;

    // ✅ staff_team_links ですでにアクセスしているチーム
    const { data: myTeams, error: myTeamsError } = await supabase
      .from('staff_team_links')
      .select('team_id')
      .eq('staff_user_id', userId);

    if (myTeamsError) throw myTeamsError;

    const myTeamIds = (myTeams ?? []).map((t) => t.team_id).filter(Boolean);

    // ✅ primary team も除外
    if (userData?.team_id) myTeamIds.push(userData.team_id);

    // ✅ pending request も除外
    const { data: pendingRequests, error: pendingError } = await supabase
      .from('team_access_requests')
      .select('team_id')
      .eq('requester_id', userId)
      .eq('status', 'pending');

    if (pendingError) throw pendingError;

    const pendingTeamIds = (pendingRequests ?? []).map((r) => r.team_id).filter(Boolean);
    const excludedTeamIds = Array.from(new Set([...myTeamIds, ...pendingTeamIds])).filter(Boolean);

    // ✅ organization内の全teamを取得して excluded をローカルで除外（安全・確実）
    // 1000件超える規模になったらRPC/VIEWで最適化する方針でOK
    const { data, error } = await supabase
      .from('teams')
      .select('id, name, organization_id')
      .eq('organization_id', organizationId)
      .order('name');

    if (error) throw error;

    if (!excludedTeamIds.length) return data ?? [];

    return (data ?? []).filter((t) => !excludedTeamIds.includes(t.id));
  },

  async createRequest(requesterId: string, teamId: string, organizationId: string, message: string = '') {
    const { data, error } = await supabase
      .from('team_access_requests')
      .insert({
        requester_id: requesterId,
        team_id: teamId,
        organization_id: organizationId,
        status: 'pending',
        request_message: message,
      })
      .select()
      .single();

    if (error) throw error;
    return data as TeamAccessRequest;
  },

  async approveRequest(requestId: string, reviewerId: string, notes: string = '') {
    const { error } = await supabase.rpc('approve_team_access_request', {
      request_id: requestId,
      reviewer_user_id: reviewerId,
      notes,
    });

    if (error) throw error;
  },

  async rejectRequest(requestId: string, reviewerId: string, notes: string = '') {
    const { error } = await supabase.rpc('reject_team_access_request', {
      request_id: requestId,
      reviewer_user_id: reviewerId,
      notes,
    });

    if (error) throw error;
  },

  async cancelRequest(requestId: string) {
    const { error } = await supabase
      .from('team_access_requests')
      .delete()
      .eq('id', requestId)
      .eq('status', 'pending');

    if (error) throw error;
  },

  async getRequestById(requestId: string) {
    const { data, error } = await supabase
      .from('team_access_requests')
      .select(
        `
        *,
        requester:users!team_access_requests_requester_id_fkey (
          id,
          name,
          email
        ),
        team:teams (
          id,
          name
        ),
        reviewer:users!team_access_requests_reviewed_by_fkey (
          id,
          name
        )
      `,
      )
      .eq('id', requestId)
      .maybeSingle();

    if (error) throw error;
    return data as TeamAccessRequest | null;
  },
};