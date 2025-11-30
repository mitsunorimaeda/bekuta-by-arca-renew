import { useState, useEffect } from 'react';
import { subscriptionQueries } from '../lib/subscriptionQueries';
import type { Database } from '../lib/database.types';

type SubscriptionPlan = Database['public']['Tables']['subscription_plans']['Row'];
type OrganizationSubscription = Database['public']['Tables']['organization_subscriptions']['Row'];
type UsageTracking = Database['public']['Tables']['usage_tracking']['Row'];
type BillingHistory = Database['public']['Tables']['billing_history']['Row'];

export function useSubscription(organizationId: string | undefined) {
  const [subscription, setSubscription] = useState<any>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [usage, setUsage] = useState<UsageTracking | null>(null);
  const [billingHistory, setBillingHistory] = useState<BillingHistory[]>([]);
  const [limits, setLimits] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    loadSubscriptionData();
  }, [organizationId]);

  const loadSubscriptionData = async () => {
    if (!organizationId) return;

    try {
      setLoading(true);
      setError(null);

      const [subData, plansData, usageData, billingData, limitsData] = await Promise.all([
        subscriptionQueries.getOrganizationSubscription(organizationId),
        subscriptionQueries.getSubscriptionPlans(),
        subscriptionQueries.getCurrentUsage(organizationId),
        subscriptionQueries.getBillingHistory(organizationId),
        subscriptionQueries.checkPlanLimits(organizationId)
      ]);

      setSubscription(subData);
      setPlans(plansData);
      setUsage(usageData);
      setBillingHistory(billingData);
      setLimits(limitsData);
    } catch (err) {
      // Subscription tables are not yet implemented, so suppress errors
      console.warn('Subscription feature not yet implemented:', err);
      setError(null); // Don't show error to user
      setSubscription(null);
      setPlans([]);
      setUsage(null);
      setBillingHistory([]);
      setLimits(null);
    } finally {
      setLoading(false);
    }
  };

  const upgradePlan = async (newPlanId: string, billingCycle: 'monthly' | 'yearly') => {
    if (!organizationId) {
      throw new Error('Organization ID is required');
    }

    try {
      const updated = await subscriptionQueries.upgradePlan(organizationId, newPlanId, billingCycle);
      await loadSubscriptionData();
      return updated;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'プランのアップグレードに失敗しました';
      setError(message);
      throw new Error(message);
    }
  };

  const cancelSubscription = async (immediate: boolean = false) => {
    if (!organizationId) {
      throw new Error('Organization ID is required');
    }

    try {
      const updated = await subscriptionQueries.cancelSubscription(organizationId, immediate);
      await loadSubscriptionData();
      return updated;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'サブスクリプションのキャンセルに失敗しました';
      setError(message);
      throw new Error(message);
    }
  };

  const reactivateSubscription = async () => {
    if (!organizationId) {
      throw new Error('Organization ID is required');
    }

    try {
      const updated = await subscriptionQueries.reactivateSubscription(organizationId);
      await loadSubscriptionData();
      return updated;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'サブスクリプションの再開に失敗しました';
      setError(message);
      throw new Error(message);
    }
  };

  const hasFeature = async (featureKey: string): Promise<boolean> => {
    if (!organizationId) return false;

    try {
      return await subscriptionQueries.hasFeature(organizationId, featureKey);
    } catch (err) {
      console.error('Error checking feature:', err);
      return false;
    }
  };

  const refreshUsage = async () => {
    if (!organizationId) return;

    try {
      const [usageData, limitsData] = await Promise.all([
        subscriptionQueries.getCurrentUsage(organizationId),
        subscriptionQueries.checkPlanLimits(organizationId)
      ]);

      setUsage(usageData);
      setLimits(limitsData);
    } catch (err) {
      console.error('Error refreshing usage:', err);
    }
  };

  return {
    subscription,
    plans,
    usage,
    billingHistory,
    limits,
    loading,
    error,
    upgradePlan,
    cancelSubscription,
    reactivateSubscription,
    hasFeature,
    refreshUsage,
    reload: loadSubscriptionData
  };
}

export function usePermissions(role: string | undefined) {
  const [permissions, setPermissions] = useState<any[]>([]);
  const [allPermissions, setAllPermissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPermissions();
  }, [role]);

  const loadPermissions = async () => {
    try {
      setLoading(true);
      setError(null);

      const [allPerms, rolePerms] = await Promise.all([
        subscriptionQueries.getPermissionDefinitions(),
        role ? subscriptionQueries.getRolePermissions(role) : Promise.resolve([])
      ]);

      setAllPermissions(allPerms);
      setPermissions(rolePerms);
    } catch (err) {
      setError(err instanceof Error ? err.message : '権限データの読み込みに失敗しました');
      console.error('Error loading permissions:', err);
    } finally {
      setLoading(false);
    }
  };

  const hasPermission = (permissionKey: string): boolean => {
    if (!permissions || permissions.length === 0) return false;

    return permissions.some(rp => {
      const perm = rp.permission;
      return perm && perm.permission_key === permissionKey;
    });
  };

  const hasAnyPermission = (permissionKeys: string[]): boolean => {
    return permissionKeys.some(key => hasPermission(key));
  };

  const hasAllPermissions = (permissionKeys: string[]): boolean => {
    return permissionKeys.every(key => hasPermission(key));
  };

  return {
    permissions,
    allPermissions,
    loading,
    error,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    reload: loadPermissions
  };
}
