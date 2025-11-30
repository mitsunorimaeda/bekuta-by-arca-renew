import { supabase } from './supabase';
import type { Database } from './database.types';

type Organization = Database['public']['Tables']['organizations']['Row'];
type OrganizationInsert = Database['public']['Tables']['organizations']['Insert'];
type OrganizationUpdate = Database['public']['Tables']['organizations']['Update'];
type Team = Database['public']['Tables']['teams']['Row'];
type TeamInsert = Database['public']['Tables']['teams']['Insert'];
type TeamUpdate = Database['public']['Tables']['teams']['Update'];
type OrganizationMember = Database['public']['Tables']['organization_members']['Row'];
type OrganizationMemberInsert = Database['public']['Tables']['organization_members']['Insert'];

export const organizationQueries = {
  async getUserOrganizations(userId: string) {
    const { data, error } = await supabase.rpc('get_user_organizations', {
      user_uuid: userId
    });

    if (error) throw error;
    return data;
  },

  async getOrganizationHierarchy(organizationId: string) {
    const { data, error } = await supabase.rpc('get_organization_hierarchy', {
      org_id: organizationId
    });

    if (error) throw error;
    return data;
  },

  async getOrganizations() {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .order('name');

    if (error) {
      console.error('Organizations query error:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      throw new Error(`Failed to load organizations: ${error.message} (${error.code})`);
    }
    return data as Organization[];
  },

  async getOrganizationById(id: string) {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data as Organization | null;
  },

  async createOrganization(organization: OrganizationInsert) {
    const { data, error } = await supabase
      .from('organizations')
      .insert(organization)
      .select()
      .single();

    if (error) throw error;
    return data as Organization;
  },

  async updateOrganization(id: string, updates: OrganizationUpdate) {
    const { data, error } = await supabase
      .from('organizations')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Organization;
  },

  async deleteOrganization(id: string) {
    const { error } = await supabase
      .from('organizations')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async getOrganizationTeams(organizationId: string) {
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .eq('organization_id', organizationId)
      .order('name');

    if (error) {
      console.error('Organization teams query error:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      throw new Error(`Failed to load organization teams: ${error.message}`);
    }
    return data;
  },

  async getTeamById(id: string) {
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data as Team | null;
  },

  async createTeam(team: TeamInsert) {
    const cleanedTeam = {
      name: team.name,
      organization_id: team.organization_id,
      department_id: team.department_id
    };

    console.log('Creating team with data:', cleanedTeam);
    const { data, error } = await supabase
      .from('teams')
      .insert(cleanedTeam)
      .select()
      .single();

    if (error) {
      console.error('Team creation error:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      throw error;
    }
    console.log('Team created successfully:', data);
    return data as Team;
  },

  async updateTeam(id: string, updates: TeamUpdate) {
    const { data, error } = await supabase
      .from('teams')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Team;
  },

  async deleteTeam(id: string) {
    const { error } = await supabase
      .from('teams')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async getOrganizationMembers(organizationId: string) {
    const { data, error } = await supabase
      .from('organization_members')
      .select(`
        *,
        users:user_id (
          id,
          user_id,
          name,
          email,
          role
        )
      `)
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async addOrganizationMember(member: OrganizationMemberInsert) {
    const { data, error } = await supabase
      .from('organization_members')
      .insert(member)
      .select()
      .single();

    if (error) throw error;
    return data as OrganizationMember;
  },

  async updateOrganizationMemberRole(id: string, role: OrganizationMember['role']) {
    const { data, error } = await supabase
      .from('organization_members')
      .update({ role })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as OrganizationMember;
  },

  async removeOrganizationMember(id: string) {
    const { error } = await supabase
      .from('organization_members')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },


  async getOrganizationStats() {
    const { data, error } = await supabase
      .from('organization_stats')
      .select('*')
      .order('name');

    if (error) throw error;
    return data;
  },

  async checkOrphanedRecords() {
    const { data, error } = await supabase.rpc('check_orphaned_records');

    if (error) throw error;
    return data;
  },

  async assignTeamToOrganization(teamId: string, organizationId: string | null) {
    const { data, error } = await supabase
      .from('teams')
      .update({
        organization_id: organizationId
      })
      .eq('id', teamId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};
