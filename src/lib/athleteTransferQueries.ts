import { supabase } from './supabase';

export interface AthleteTransferRequest {
  id: string;
  athlete_id: string;
  from_team_id: string;
  to_team_id: string;
  organization_id: string;
  requested_by: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  request_reason: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  athlete?: {
    id: string;
    name: string;
    email: string;
  };
  from_team?: {
    id: string;
    name: string;
  };
  to_team?: {
    id: string;
    name: string;
  };
  requester?: {
    id: string;
    name: string;
  };
  reviewer?: {
    id: string;
    name: string;
  };
}

export interface TransferHistory {
  id: string;
  athlete_id: string;
  from_team_id: string | null;
  to_team_id: string;
  organization_id: string;
  transfer_request_id: string | null;
  transferred_by: string;
  transfer_reason: string;
  transfer_date: string;
  metadata: Record<string, unknown>;
  athlete?: {
    id: string;
    name: string;
  };
  from_team?: {
    id: string;
    name: string;
  };
  to_team?: {
    id: string;
    name: string;
  };
  transferred_by_user?: {
    id: string;
    name: string;
  };
}

export const athleteTransferQueries = {
  async getMyTransferRequests(userId: string) {
    const { data, error } = await supabase
      .from('athlete_transfer_requests')
      .select(`
        *,
        athlete:users!athlete_transfer_requests_athlete_id_fkey (
          id,
          name,
          email
        ),
        from_team:teams!athlete_transfer_requests_from_team_id_fkey (
          id,
          name
        ),
        to_team:teams!athlete_transfer_requests_to_team_id_fkey (
          id,
          name
        )
      `)
      .or(`athlete_id.eq.${userId},requested_by.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as AthleteTransferRequest[];
  },

  async getPendingRequestsForMyTeams(userId: string) {
    // First get the teams managed by this user
    const { data: myTeams, error: teamsError } = await supabase
      .from('staff_team_links')
      .select('team_id')
      .eq('staff_user_id', userId);

    if (teamsError) throw teamsError;

    const teamIds = myTeams?.map(t => t.team_id) || [];

    if (teamIds.length === 0) {
      return [];
    }

    // Then get the pending transfer requests for those teams
    const { data, error } = await supabase
      .from('athlete_transfer_requests')
      .select(`
        *,
        athlete:users!athlete_transfer_requests_athlete_id_fkey (
          id,
          name,
          email
        ),
        from_team:teams!athlete_transfer_requests_from_team_id_fkey (
          id,
          name
        ),
        to_team:teams!athlete_transfer_requests_to_team_id_fkey (
          id,
          name
        ),
        requester:users!athlete_transfer_requests_requested_by_fkey (
          id,
          name
        )
      `)
      .eq('status', 'pending')
      .in('from_team_id', teamIds)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as AthleteTransferRequest[];
  },

  async getRequestsForOrganization(organizationId: string) {
    const { data, error } = await supabase
      .from('athlete_transfer_requests')
      .select(`
        *,
        athlete:users!athlete_transfer_requests_athlete_id_fkey (
          id,
          name,
          email
        ),
        from_team:teams!athlete_transfer_requests_from_team_id_fkey (
          id,
          name
        ),
        to_team:teams!athlete_transfer_requests_to_team_id_fkey (
          id,
          name
        ),
        requester:users!athlete_transfer_requests_requested_by_fkey (
          id,
          name
        ),
        reviewer:users!athlete_transfer_requests_reviewed_by_fkey (
          id,
          name
        )
      `)
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as AthleteTransferRequest[];
  },

  async getAthletesInMyTeams(userId: string) {
    const { data: myTeams, error: teamsError } = await supabase
      .from('staff_team_links')
      .select('team_id')
      .eq('staff_user_id', userId);

    if (teamsError) throw teamsError;

    const teamIds = myTeams?.map(t => t.team_id) || [];

    if (teamIds.length === 0) {
      return [];
    }

    const { data, error } = await supabase
      .from('users')
      .select(`
        id,
        name,
        email,
        team_id,
        team:teams (
          id,
          name
        )
      `)
      .eq('role', 'athlete')
      .in('team_id', teamIds)
      .order('name');

    if (error) throw error;
    return data;
  },

  async getAvailableDestinationTeams(organizationId: string, currentTeamId: string) {
    const { data, error } = await supabase
      .from('teams')
      .select('id, name, organization_id')
      .eq('organization_id', organizationId)
      .neq('id', currentTeamId)
      .order('name');

    if (error) throw error;
    return data;
  },

  async createTransferRequest(
    athleteId: string,
    fromTeamId: string,
    toTeamId: string,
    organizationId: string,
    requestedBy: string,
    reason: string = ''
  ) {
    const { data, error } = await supabase
      .from('athlete_transfer_requests')
      .insert({
        athlete_id: athleteId,
        from_team_id: fromTeamId,
        to_team_id: toTeamId,
        organization_id: organizationId,
        requested_by: requestedBy,
        status: 'pending',
        request_reason: reason
      })
      .select()
      .single();

    if (error) throw error;
    return data as AthleteTransferRequest;
  },

  async approveTransfer(requestId: string, reviewerId: string, notes: string = '') {
    const { error } = await supabase.rpc('approve_athlete_transfer', {
      request_id: requestId,
      reviewer_user_id: reviewerId,
      notes: notes
    });

    if (error) throw error;
  },

  async rejectTransfer(requestId: string, reviewerId: string, notes: string = '') {
    const { error } = await supabase.rpc('reject_athlete_transfer', {
      request_id: requestId,
      reviewer_user_id: reviewerId,
      notes: notes
    });

    if (error) throw error;
  },

  async cancelTransferRequest(requestId: string) {
    const { error } = await supabase
      .from('athlete_transfer_requests')
      .delete()
      .eq('id', requestId)
      .eq('status', 'pending');

    if (error) throw error;
  },

  async getTransferHistory(athleteId: string) {
    const { data, error } = await supabase
      .from('team_transfer_history')
      .select(`
        *,
        athlete:users!team_transfer_history_athlete_id_fkey (
          id,
          name
        ),
        from_team:teams!team_transfer_history_from_team_id_fkey (
          id,
          name
        ),
        to_team:teams!team_transfer_history_to_team_id_fkey (
          id,
          name
        ),
        transferred_by_user:users!team_transfer_history_transferred_by_fkey (
          id,
          name
        )
      `)
      .eq('athlete_id', athleteId)
      .order('transfer_date', { ascending: false });

    if (error) throw error;
    return data as TransferHistory[];
  },

  async getTeamTransferHistory(teamId: string) {
    const { data, error } = await supabase
      .from('team_transfer_history')
      .select(`
        *,
        athlete:users!team_transfer_history_athlete_id_fkey (
          id,
          name
        ),
        from_team:teams!team_transfer_history_from_team_id_fkey (
          id,
          name
        ),
        to_team:teams!team_transfer_history_to_team_id_fkey (
          id,
          name
        ),
        transferred_by_user:users!team_transfer_history_transferred_by_fkey (
          id,
          name
        )
      `)
      .or(`from_team_id.eq.${teamId},to_team_id.eq.${teamId}`)
      .order('transfer_date', { ascending: false });

    if (error) throw error;
    return data as TransferHistory[];
  },

  async getRequestById(requestId: string) {
    const { data, error } = await supabase
      .from('athlete_transfer_requests')
      .select(`
        *,
        athlete:users!athlete_transfer_requests_athlete_id_fkey (
          id,
          name,
          email
        ),
        from_team:teams!athlete_transfer_requests_from_team_id_fkey (
          id,
          name
        ),
        to_team:teams!athlete_transfer_requests_to_team_id_fkey (
          id,
          name
        ),
        requester:users!athlete_transfer_requests_requested_by_fkey (
          id,
          name
        ),
        reviewer:users!athlete_transfer_requests_reviewed_by_fkey (
          id,
          name
        )
      `)
      .eq('id', requestId)
      .maybeSingle();

    if (error) throw error;
    return data as AthleteTransferRequest | null;
  }
};
