import { useState, useEffect, useCallback } from 'react';
import { organizationQueries } from '../lib/organizationQueries';
import type { Database } from '../lib/database.types';

type Organization = Database['public']['Tables']['organizations']['Row'];
type Team = Database['public']['Tables']['teams']['Row'];

export function useOrganizations(userId: string | undefined) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    loadOrganizations();
  }, [userId]);

  const loadOrganizations = async () => {
    try {
      setLoading(true);
      setError(null);

      // Log auth state for debugging
      const { data: { session } } = await (await import('../lib/supabase')).supabase.auth.getSession();
      console.log('Auth state when loading organizations:', {
        hasSession: !!session,
        userId: session?.user?.id,
        email: session?.user?.email
      });

      const data = await organizationQueries.getOrganizations();
      console.log('Organizations loaded successfully:', data.length);
      setOrganizations(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load organizations';
      setError(errorMessage);
      console.error('Error loading organizations:', {
        error: err,
        message: errorMessage,
        stack: err instanceof Error ? err.stack : undefined
      });
    } finally {
      setLoading(false);
    }
  };

  const createOrganization = async (name: string, description?: string) => {
    try {
      const newOrg = await organizationQueries.createOrganization({
        name,
        description: description || ''
      });
      setOrganizations(prev => [...prev, newOrg].sort((a, b) => a.name.localeCompare(b.name)));
      return newOrg;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create organization';
      setError(message);
      throw new Error(message);
    }
  };

  const updateOrganization = async (id: string, updates: { name?: string; description?: string; settings?: Record<string, any> }) => {
    try {
      const updated = await organizationQueries.updateOrganization(id, updates);
      setOrganizations(prev =>
        prev.map(org => org.id === id ? updated : org).sort((a, b) => a.name.localeCompare(b.name))
      );
      return updated;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update organization';
      setError(message);
      throw new Error(message);
    }
  };

  const deleteOrganization = async (id: string) => {
    try {
      await organizationQueries.deleteOrganization(id);
      setOrganizations(prev => prev.filter(org => org.id !== id));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete organization';
      setError(message);
      throw new Error(message);
    }
  };

  return {
    organizations,
    loading,
    error,
    createOrganization,
    updateOrganization,
    deleteOrganization,
    reload: loadOrganizations
  };
}

export function useOrganizationTeams(organizationId: string | undefined) {
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTeams = useCallback(async () => {
    if (!organizationId) return;

    try {
      setLoading(true);
      setError(null);
      const data = await organizationQueries.getOrganizationTeams(organizationId);
      console.log('Teams loaded:', data);
      setTeams(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load teams');
      console.error('Error loading teams:', err);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    if (!organizationId) {
      setTeams([]);
      setLoading(false);
      return;
    }

    loadTeams();
  }, [organizationId, loadTeams]);

  const createTeam = async (name: string) => {
    if (!organizationId) throw new Error('Organization ID is required');

    try {
      const newTeam = await organizationQueries.createTeam({
        organization_id: organizationId,
        name
      });
      console.log('New team created, reloading teams...');
      await loadTeams();
      console.log('Teams reloaded after creation');
      return newTeam;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create team';
      setError(message);
      throw new Error(message);
    }
  };

  const updateTeam = async (id: string, updates: { name?: string; description?: string; settings?: Record<string, any> }) => {
    try {
      const updated = await organizationQueries.updateTeam(id, updates);
      await loadTeams();
      return updated;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update team';
      setError(message);
      throw new Error(message);
    }
  };

  const deleteTeam = async (id: string) => {
    try {
      await organizationQueries.deleteTeam(id);
      setTeams(prev => prev.filter(team => team.id !== id));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete team';
      setError(message);
      throw new Error(message);
    }
  };

  return {
    teams,
    loading,
    error,
    createTeam,
    updateTeam,
    deleteTeam,
    reload: loadTeams
  };
}

export function useOrganizationHierarchy(organizationId: string | undefined) {
  const [hierarchy, setHierarchy] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!organizationId) {
      setHierarchy(null);
      setLoading(false);
      return;
    }

    loadHierarchy();
  }, [organizationId]);

  const loadHierarchy = async () => {
    if (!organizationId) return;

    try {
      setLoading(true);
      setError(null);
      const data = await organizationQueries.getOrganizationHierarchy(organizationId);
      setHierarchy(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load organization hierarchy');
      console.error('Error loading organization hierarchy:', err);
    } finally {
      setLoading(false);
    }
  };

  return {
    hierarchy,
    loading,
    error,
    reload: loadHierarchy
  };
}
