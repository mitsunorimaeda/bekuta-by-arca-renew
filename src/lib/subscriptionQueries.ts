import { supabase } from './supabase';
import type { Database } from './database.types';

type SubscriptionPlan = Database['public']['Tables']['subscription_plans']['Row'];
type SubscriptionPlanInsert = Database['public']['Tables']['subscription_plans']['Insert'];
type OrganizationSubscription = Database['public']['Tables']['organization_subscriptions']['Row'];
type OrganizationSubscriptionInsert = Database['public']['Tables']['organization_subscriptions']['Insert'];
type OrganizationSubscriptionUpdate = Database['public']['Tables']['organization_subscriptions']['Update'];
type UserSubscription = Database['public']['Tables']['user_subscriptions']['Row'];
type UsageTracking = Database['public']['Tables']['usage_tracking']['Row'];
type UsageTrackingInsert = Database['public']['Tables']['usage_tracking']['Insert'];
type BillingHistory = Database['public']['Tables']['billing_history']['Row'];
type BillingHistoryInsert = Database['public']['Tables']['billing_history']['Insert'];
type PermissionDefinition = Database['public']['Tables']['permission_definitions']['Row'];
type RolePermission = Database['public']['Tables']['role_permissions']['Row'];

export const subscriptionQueries = {
  async getSubscriptionPlans() {
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');

    if (error) throw error;
    return data as SubscriptionPlan[];
  },

  async getSubscriptionPlanById(id: string) {
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data as SubscriptionPlan | null;
  },

  async createSubscriptionPlan(plan: SubscriptionPlanInsert) {
    const { data, error } = await supabase
      .from('subscription_plans')
      .insert(plan)
      .select()
      .single();

    if (error) throw error;
    return data as SubscriptionPlan;
  },

  async getOrganizationSubscription(organizationId: string) {
    const { data, error } = await supabase
      .from('organization_subscriptions')
      .select(`
        *,
        plan:plan_id (*)
      `)
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async createOrganizationSubscription(subscription: OrganizationSubscriptionInsert) {
    const { data, error } = await supabase
      .from('organization_subscriptions')
      .insert(subscription)
      .select()
      .single();

    if (error) throw error;
    return data as OrganizationSubscription;
  },

  async updateOrganizationSubscription(organizationId: string, updates: OrganizationSubscriptionUpdate) {
    const { data, error } = await supabase
      .from('organization_subscriptions')
      .update(updates)
      .eq('organization_id', organizationId)
      .select()
      .single();

    if (error) throw error;
    return data as OrganizationSubscription;
  },

  async getUserSubscription(userId: string) {
    const { data, error } = await supabase
      .from('user_subscriptions')
      .select(`
        *,
        plan:plan_id (*)
      `)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async getCurrentUsage(organizationId: string) {
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const { data, error } = await supabase
      .from('usage_tracking')
      .select('*')
      .eq('organization_id', organizationId)
      .gte('period_start', periodStart.toISOString())
      .lte('period_end', periodEnd.toISOString())
      .maybeSingle();

    if (error) throw error;
    return data as UsageTracking | null;
  },

  async calculateCurrentUsage(organizationId: string) {
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: activeAthletes, error: athletesError } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: false })
      .eq('role', 'athlete')
      .eq('team_id', organizationId)
      .gte('created_at', thirtyDaysAgo.toISOString());

    if (athletesError) throw athletesError;

    const { data: allUsers, error: usersError } = await supabase
      .from('organization_members')
      .select('id', { count: 'exact', head: false })
      .eq('organization_id', organizationId);

    if (usersError) throw usersError;

    const { data: trainingRecords, error: trainingError } = await supabase
      .from('training_records')
      .select('id', { count: 'exact', head: true })
      .gte('date', thirtyDaysAgo.toISOString().split('T')[0]);

    if (trainingError) throw trainingError;

    return {
      active_athletes: activeAthletes?.length || 0,
      total_users: allUsers?.length || 0,
      storage_used_mb: 0,
      api_calls: 0,
      data_exports: 0
    };
  },

  async createUsageRecord(usage: UsageTrackingInsert) {
    const { data, error } = await supabase
      .from('usage_tracking')
      .insert(usage)
      .select()
      .single();

    if (error) throw error;
    return data as UsageTracking;
  },

  async getBillingHistory(organizationId?: string, userId?: string) {
    let query = supabase
      .from('billing_history')
      .select('*')
      .order('billing_date', { ascending: false });

    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    } else if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data as BillingHistory[];
  },

  async createBillingRecord(billing: BillingHistoryInsert) {
    const { data, error } = await supabase
      .from('billing_history')
      .insert(billing)
      .select()
      .single();

    if (error) throw error;
    return data as BillingHistory;
  },

  async updateBillingRecord(id: string, updates: Partial<BillingHistory>) {
    const { data, error } = await supabase
      .from('billing_history')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as BillingHistory;
  },

  async getPermissionDefinitions() {
    const { data, error } = await supabase
      .from('permission_definitions')
      .select('*')
      .eq('is_active', true)
      .order('category', { ascending: true })
      .order('name', { ascending: true });

    if (error) throw error;
    return data as PermissionDefinition[];
  },

  async getRolePermissions(role: string) {
    const { data, error } = await supabase
      .from('role_permissions')
      .select(`
        *,
        permission:permission_id (*)
      `)
      .eq('role', role);

    if (error) throw error;
    return data;
  },

  async getAllRolePermissions() {
    const { data, error } = await supabase
      .from('role_permissions')
      .select(`
        *,
        permission:permission_id (*)
      `)
      .order('role');

    if (error) throw error;
    return data;
  },

  async checkPlanLimits(organizationId: string) {
    const subscription = await this.getOrganizationSubscription(organizationId);
    if (!subscription || !subscription.plan) {
      return {
        withinLimits: false,
        message: 'サブスクリプションが見つかりません',
        limits: {}
      };
    }

    const plan = subscription.plan as SubscriptionPlan;
    const usage = await this.calculateCurrentUsage(organizationId);

    const withinAthleteLimit = plan.athlete_limit === null || usage.active_athletes <= plan.athlete_limit;
    const withinStorageLimit = usage.storage_used_mb <= (plan.storage_gb * 1024);

    return {
      withinLimits: withinAthleteLimit && withinStorageLimit,
      message: withinAthleteLimit && withinStorageLimit
        ? 'プラン制限内です'
        : '使用量がプラン制限を超えています',
      limits: {
        athletes: {
          current: usage.active_athletes,
          limit: plan.athlete_limit,
          exceeded: !withinAthleteLimit
        },
        storage: {
          current: usage.storage_used_mb,
          limit: plan.storage_gb * 1024,
          exceeded: !withinStorageLimit
        }
      },
      plan: plan,
      usage: usage
    };
  },

  async hasFeature(organizationId: string, featureKey: string): Promise<boolean> {
    const subscription = await this.getOrganizationSubscription(organizationId);
    if (!subscription || !subscription.plan) {
      return false;
    }

    const plan = subscription.plan as SubscriptionPlan;
    return plan.features && plan.features[featureKey] === true;
  },

  async upgradePlan(organizationId: string, newPlanId: string, billingCycle: 'monthly' | 'yearly') {
    const currentSubscription = await this.getOrganizationSubscription(organizationId);
    if (!currentSubscription) {
      throw new Error('現在のサブスクリプションが見つかりません');
    }

    const now = new Date();
    const periodEnd = new Date(now);
    if (billingCycle === 'monthly') {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    } else {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    }

    const updates: OrganizationSubscriptionUpdate = {
      plan_id: newPlanId,
      billing_cycle: billingCycle,
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      status: 'active',
      updated_at: now.toISOString()
    };

    return await this.updateOrganizationSubscription(organizationId, updates);
  },

  async cancelSubscription(organizationId: string, immediate: boolean = false) {
    const updates: OrganizationSubscriptionUpdate = immediate
      ? { status: 'cancelled', updated_at: new Date().toISOString() }
      : { cancel_at_period_end: true, updated_at: new Date().toISOString() };

    return await this.updateOrganizationSubscription(organizationId, updates);
  },

  async reactivateSubscription(organizationId: string) {
    const updates: OrganizationSubscriptionUpdate = {
      status: 'active',
      cancel_at_period_end: false,
      updated_at: new Date().toISOString()
    };

    return await this.updateOrganizationSubscription(organizationId, updates);
  }
};
