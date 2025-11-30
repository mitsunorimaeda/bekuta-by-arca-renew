import { useState, useEffect, useCallback } from 'react';
import { athleteTransferQueries, AthleteTransferRequest, TransferHistory } from '../lib/athleteTransferQueries';

export function useAthleteTransfers(userId: string, organizationId?: string) {
  const [myRequests, setMyRequests] = useState<AthleteTransferRequest[]>([]);
  const [pendingRequests, setPendingRequests] = useState<AthleteTransferRequest[]>([]);
  const [organizationRequests, setOrganizationRequests] = useState<AthleteTransferRequest[]>([]);
  const [myAthletes, setMyAthletes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMyRequests = useCallback(async () => {
    try {
      const data = await athleteTransferQueries.getMyTransferRequests(userId);
      setMyRequests(data);
    } catch (err) {
      console.error('Error loading my transfer requests:', err);
      throw err;
    }
  }, [userId]);

  const loadPendingRequests = useCallback(async () => {
    try {
      const data = await athleteTransferQueries.getPendingRequestsForMyTeams(userId);
      setPendingRequests(data);
    } catch (err) {
      console.error('Error loading pending transfer requests:', err);
      throw err;
    }
  }, [userId]);

  const loadOrganizationRequests = useCallback(async () => {
    if (!organizationId) return;
    try {
      const data = await athleteTransferQueries.getRequestsForOrganization(organizationId);
      setOrganizationRequests(data);
    } catch (err) {
      console.error('Error loading organization transfer requests:', err);
      throw err;
    }
  }, [organizationId]);

  const loadMyAthletes = useCallback(async () => {
    try {
      const data = await athleteTransferQueries.getAthletesInMyTeams(userId);
      setMyAthletes(data);
    } catch (err) {
      console.error('Error loading my athletes:', err);
      throw err;
    }
  }, [userId]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([
        loadMyRequests(),
        loadPendingRequests(),
        loadMyAthletes(),
        organizationId ? loadOrganizationRequests() : Promise.resolve()
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transfer requests');
    } finally {
      setLoading(false);
    }
  }, [loadMyRequests, loadPendingRequests, loadMyAthletes, loadOrganizationRequests, organizationId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const createTransferRequest = useCallback(async (
    athleteId: string,
    fromTeamId: string,
    toTeamId: string,
    reason: string = ''
  ) => {
    if (!organizationId) {
      throw new Error('Organization ID is required');
    }
    try {
      await athleteTransferQueries.createTransferRequest(
        athleteId,
        fromTeamId,
        toTeamId,
        organizationId,
        userId,
        reason
      );
      await loadAll();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to create transfer request');
    }
  }, [userId, organizationId, loadAll]);

  const approveTransfer = useCallback(async (requestId: string, notes: string = '') => {
    try {
      await athleteTransferQueries.approveTransfer(requestId, userId, notes);
      await loadAll();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to approve transfer');
    }
  }, [userId, loadAll]);

  const rejectTransfer = useCallback(async (requestId: string, notes: string = '') => {
    try {
      await athleteTransferQueries.rejectTransfer(requestId, userId, notes);
      await loadAll();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to reject transfer');
    }
  }, [userId, loadAll]);

  const cancelTransferRequest = useCallback(async (requestId: string) => {
    try {
      await athleteTransferQueries.cancelTransferRequest(requestId);
      await loadAll();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to cancel transfer request');
    }
  }, [loadAll]);

  const getTransferHistory = useCallback(async (athleteId: string): Promise<TransferHistory[]> => {
    try {
      return await athleteTransferQueries.getTransferHistory(athleteId);
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to get transfer history');
    }
  }, []);

  const getAvailableDestinationTeams = useCallback(async (currentTeamId: string) => {
    if (!organizationId) {
      throw new Error('Organization ID is required');
    }
    try {
      return await athleteTransferQueries.getAvailableDestinationTeams(organizationId, currentTeamId);
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to get available teams');
    }
  }, [organizationId]);

  return {
    myRequests,
    pendingRequests,
    organizationRequests,
    myAthletes,
    loading,
    error,
    createTransferRequest,
    approveTransfer,
    rejectTransfer,
    cancelTransferRequest,
    getTransferHistory,
    getAvailableDestinationTeams,
    refresh: loadAll
  };
}
