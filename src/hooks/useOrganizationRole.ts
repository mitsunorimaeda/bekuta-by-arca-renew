import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface OrganizationRole {
  organizationId: string;
  organizationName: string;
  role: 'organization_admin' | 'member';
}

export function useOrganizationRole(userId: string | undefined) {
  const [organizationRoles, setOrganizationRoles] = useState<OrganizationRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    loadOrganizationRoles();
  }, [userId]);

  const loadOrganizationRoles = async () => {
    if (!userId) return;

    try {
      setLoading(true);
      setError(null);

      const { data, error: queryError } = await supabase
        .from('organization_members')
        .select(`
          organization_id,
          role,
          organizations (
            id,
            name
          )
        `)
        .eq('user_id', userId);

      if (queryError) throw queryError;

      const roles: OrganizationRole[] = (data || []).map((item: any) => ({
        organizationId: item.organization_id,
        organizationName: item.organizations?.name || 'Unknown',
        role: item.role
      }));

      setOrganizationRoles(roles);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load organization roles';
      setError(message);
      console.error('Error loading organization roles:', err);
    } finally {
      setLoading(false);
    }
  };

  const isOrganizationAdmin = (organizationId?: string) => {
    if (!organizationId) {
      return organizationRoles.some(role => role.role === 'organization_admin');
    }
    return organizationRoles.some(
      role => role.organizationId === organizationId && role.role === 'organization_admin'
    );
  };

  const getOrganizationAdminRoles = () => {
    return organizationRoles.filter(role => role.role === 'organization_admin');
  };

  return {
    organizationRoles,
    loading,
    error,
    isOrganizationAdmin,
    getOrganizationAdminRoles,
    reload: loadOrganizationRoles
  };
}
