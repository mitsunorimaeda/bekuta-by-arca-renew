import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

interface PlanInfo {
  name: string;
  athleteLimit: number | null;
  features: Record<string, any>;
  priceMonthly: number;
}

interface PlanLimits {
  plan: PlanInfo | null;
  currentAthletes: number;
  athleteLimit: number | null;
  isAtLimit: boolean;
  isOverLimit: boolean;
  remainingSlots: number | null;
  canExport: boolean;
  canGenerateReports: boolean;
  hasPrioritySupport: boolean;
  pushLimit: number | null;
  teamsLimit: number | null;
  dataRetentionMonths: number | null;
  isSponsored: boolean;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function usePlanLimits(organizationId: string | null | undefined): PlanLimits {
  const [plan, setPlan] = useState<PlanInfo | null>(null);
  const [currentAthletes, setCurrentAthletes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLimits = useCallback(async () => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // サブスクリプション + プラン情報を取得
      const { data: subscription, error: subError } = await supabase
        .from('organization_subscriptions')
        .select(`
          *,
          plan:plan_id (
            id, name, price_monthly, athlete_limit, features, sort_order
          )
        `)
        .eq('organization_id', organizationId)
        .maybeSingle();

      if (subError) throw subError;

      if (!subscription?.plan) {
        // サブスクリプションなし → Free扱い
        setPlan({ name: 'Free', athleteLimit: 30, features: { push_limit: 10, export: false, reports: false, teams_limit: 1 }, priceMonthly: 0 });
      } else {
        const p = subscription.plan as any;
        setPlan({
          name: p.name,
          athleteLimit: p.athlete_limit,
          features: p.features || {},
          priceMonthly: p.price_monthly || 0,
        });
      }

      // 現在の選手数をカウント
      const { count, error: countError } = await supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'athlete')
        .eq('is_active', true)
        .in('id',
          // organization_membersに属する選手
          (await supabase
            .from('organization_members')
            .select('user_id')
            .eq('organization_id', organizationId)
          ).data?.map(m => m.user_id) || []
        );

      if (countError) throw countError;
      setCurrentAthletes(count || 0);
      setError(null);
    } catch (err: any) {
      console.error('[usePlanLimits] error:', err);
      setError(err.message || 'プラン情報の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchLimits();
  }, [fetchLimits]);

  const athleteLimit = plan?.athleteLimit ?? null;
  const features = plan?.features || {};

  const isAtLimit = athleteLimit !== null && currentAthletes >= athleteLimit;
  const isOverLimit = athleteLimit !== null && currentAthletes > athleteLimit;
  const remainingSlots = athleteLimit !== null ? Math.max(0, athleteLimit - currentAthletes) : null;

  return {
    plan,
    currentAthletes,
    athleteLimit,
    isAtLimit,
    isOverLimit,
    remainingSlots,
    canExport: features.export === true,
    canGenerateReports: features.reports === true,
    hasPrioritySupport: features.priority_support === true,
    pushLimit: features.push_limit ?? null,
    teamsLimit: features.teams_limit ?? null,
    dataRetentionMonths: features.data_retention_months ?? null,
    isSponsored: features.sponsored === true,
    loading,
    error,
    refresh: fetchLimits,
  };
}
