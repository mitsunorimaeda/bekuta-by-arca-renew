import { supabase } from './supabase';

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
  };
  reviewer?: {
    id: string;
    name: string;
  };
}

export const teamAccessQueries = {
  async getMyRequests(userId: string) {
    const { data, error } = await supabase
      .from('team_access_requests')
      .select(`
        *,
        team:teams (
          id,
          name
        )
      `)
      .eq('requester_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as TeamAccessRequest[];
  },

  async getPendingRequestsForMyTeams(userId: string) {
    // Check if user is a system admin
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .maybeSingle();

    if (userError) throw userError;

    // If system admin, return all pending requests
    if (userData?.role === 'admin') {
      const { data, error } = await supabase
        .from('team_access_requests')
        .select(`
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
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as TeamAccessRequest[];
    }

    // For regular staff, get the teams managed by this user
    const { data: myTeams, error: teamsError } = await supabase
      .from('staff_team_links')
      .select('team_id')
      .eq('staff_user_id', userId);

    if (teamsError) throw teamsError;

    const teamIds = myTeams?.map(t => t.team_id) || [];

    if (teamIds.length === 0) {
      return [];
    }

    // Then get the pending requests for those teams
    const { data, error } = await supabase
      .from('team_access_requests')
      .select(`
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
      `)
      .eq('status', 'pending')
      .in('team_id', teamIds)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as TeamAccessRequest[];
  },

  async getRequestsForOrganization(organizationId: string) {
    const { data, error } = await supabase
      .from('team_access_requests')
      .select(`
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
      `)
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as TeamAccessRequest[];
  },

  async getAvailableTeamsToRequest(userId: string, organizationId: string) {
    // Get the user's primary team (from users.team_id)
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('team_id')
      .eq('id', userId)
      .maybeSingle();

    if (userError) throw userError;

    // Get teams the user already has access to via staff_team_links
    const { data: myTeams, error: myTeamsError } = await supabase
      .from('staff_team_links')
      .select('team_id')
      .eq('staff_user_id', userId);

    if (myTeamsError) throw myTeamsError;

    const myTeamIds = myTeams?.map(t => t.team_id) || [];

    // Add the user's primary team if they have one
    if (userData?.team_id) {
      myTeamIds.push(userData.team_id);
    }

    // Get pending requests
    const { data: pendingRequests, error: pendingError } = await supabase
      .from('team_access_requests')
      .select('team_id')
      .eq('requester_id', userId)
      .eq('status', 'pending');

    if (pendingError) throw pendingError;

    const pendingTeamIds = pendingRequests?.map(r => r.team_id) || [];
    const excludedTeamIds = [...myTeamIds, ...pendingTeamIds];

    console.log('getAvailableTeamsToRequest debug:', {
      userId,
      organizationId,
      primaryTeamId: userData?.team_id,
      myTeamIds,
      pendingTeamIds,
      excludedTeamIds
    });

    // Get all teams in organization, excluding the ones user already has access to
    let query = supabase
      .from('teams')
      .select('id, name, organization_id')
      .eq('organization_id', organizationId);

    // Only apply the exclusion filter if there are teams to exclude
    if (excludedTeamIds.length > 0) {
      query = query.not('id', 'in', `(${excludedTeamIds.join(',')})`);
    }

    const { data, error } = await query.order('name');

    console.log('getAvailableTeamsToRequest result:', { data, error, count: data?.length });

    if (error) throw error;
    return data;
  },

  async createRequest(
    requesterId: string,
    teamId: string,
    organizationId: string,
    message: string = ''
  ) {
    const { data, error } = await supabase
      .from('team_access_requests')
      .insert({
        requester_id: requesterId,
        team_id: teamId,
        organization_id: organizationId,
        status: 'pending',
        request_message: message
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
      notes: notes
    });

    if (error) throw error;
  },

  async rejectRequest(requestId: string, reviewerId: string, notes: string = '') {
    const { error } = await supabase.rpc('reject_team_access_request', {
      request_id: requestId,
      reviewer_user_id: reviewerId,
      notes: notes
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
      .select(`
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
      `)
      .eq('id', requestId)
      .maybeSingle();

    if (error) throw error;
    return data as TeamAccessRequest | null;
  }
};
