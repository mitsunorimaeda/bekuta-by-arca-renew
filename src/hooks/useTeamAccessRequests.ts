import { useState, useEffect, useCallback } from 'react';
import { teamAccessQueries, TeamAccessRequest } from '../lib/teamAccessQueries';

export function useTeamAccessRequests(userId: string, organizationId?: string) {
  const [myRequests, setMyRequests] = useState<TeamAccessRequest[]>([]);
  const [pendingRequests, setPendingRequests] = useState<TeamAccessRequest[]>([]);
  const [organizationRequests, setOrganizationRequests] = useState<TeamAccessRequest[]>([]);
  const [availableTeams, setAvailableTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMyRequests = useCallback(async () => {
    try {
      const data = await teamAccessQueries.getMyRequests(userId);
      setMyRequests(data);
    } catch (err) {
      console.error('Error loading my requests:', err);
      throw err;
    }
  }, [userId]);

  const loadPendingRequests = useCallback(async () => {
    try {
      const data = await teamAccessQueries.getPendingRequestsForMyTeams(userId);
      setPendingRequests(data);
    } catch (err) {
      console.error('Error loading pending requests:', err);
      throw err;
    }
  }, [userId]);

  const loadOrganizationRequests = useCallback(async () => {
    if (!organizationId) return;
    try {
      const data = await teamAccessQueries.getRequestsForOrganization(organizationId);
      setOrganizationRequests(data);
    } catch (err) {
      console.error('Error loading organization requests:', err);
      throw err;
    }
  }, [organizationId]);

  const loadAvailableTeams = useCallback(async () => {
    if (!organizationId) return;
    try {
      const data = await teamAccessQueries.getAvailableTeamsToRequest(userId, organizationId);
      setAvailableTeams(data);
    } catch (err) {
      console.error('Error loading available teams:', err);
      throw err;
    }
  }, [userId, organizationId]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const results = await Promise.allSettled([
        loadMyRequests(),
        loadPendingRequests(),
        organizationId ? loadOrganizationRequests() : Promise.resolve(),
        organizationId ? loadAvailableTeams() : Promise.resolve()
      ]);

      // Log any errors but don't fail the entire load
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          const labels = ['myRequests', 'pendingRequests', 'organizationRequests', 'availableTeams'];
          console.error(`Failed to load ${labels[index]}:`, result.reason);
        }
      });

      // Only set error if all critical loads failed
      const criticalFailures = results.filter((r, i) => i < 2 && r.status === 'rejected');
      if (criticalFailures.length === 2) {
        setError('Failed to load team access requests');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load team access requests');
    } finally {
      setLoading(false);
    }
  }, [loadMyRequests, loadPendingRequests, loadOrganizationRequests, loadAvailableTeams, organizationId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const createRequest = useCallback(async (teamId: string, message: string = '') => {
    if (!organizationId) {
      throw new Error('Organization ID is required');
    }
    try {
      await teamAccessQueries.createRequest(userId, teamId, organizationId, message);
      await loadAll();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to create request');
    }
  }, [userId, organizationId, loadAll]);

  const approveRequest = useCallback(async (requestId: string, notes: string = '') => {
    try {
      await teamAccessQueries.approveRequest(requestId, userId, notes);
      await loadAll();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to approve request');
    }
  }, [userId, loadAll]);

  const rejectRequest = useCallback(async (requestId: string, notes: string = '') => {
    try {
      await teamAccessQueries.rejectRequest(requestId, userId, notes);
      await loadAll();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to reject request');
    }
  }, [userId, loadAll]);

  const cancelRequest = useCallback(async (requestId: string) => {
    try {
      await teamAccessQueries.cancelRequest(requestId);
      await loadAll();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to cancel request');
    }
  }, [loadAll]);

  return {
    myRequests,
    pendingRequests,
    organizationRequests,
    availableTeams,
    loading,
    error,
    createRequest,
    approveRequest,
    rejectRequest,
    cancelRequest,
    refresh: loadAll
  };
}
