import { useState, useEffect } from 'react';
import { Crown, ArrowUpCircle, CreditCard, Check, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { usePlanLimits } from '../hooks/usePlanLimits';

interface SubscriptionSettingsProps {
  organizationId: string;
}

interface PlanOption {
  name: string;
  priceMonthly: number;
  athleteLimit: number;
  stripePriceId: string | null;
  features: Record<string, any>;
}

export function SubscriptionSettings({ organizationId }: SubscriptionSettingsProps) {
  const limits = usePlanLimits(organizationId);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [upgradeLoading, setUpgradeLoading] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPlans() {
      const { data } = await supabase
        .from('subscription_plans')
        .select('name, price_monthly, athlete_limit, stripe_price_id, features, sort_order')
        .eq('is_active', true)
        .lt('sort_order', 99) // Sponsoredプランを除外
        .order('sort_order');

      if (data) {
        setPlans(data.map(p => ({
          name: p.name,
          priceMonthly: p.price_monthly,
          athleteLimit: p.athlete_limit,
          stripePriceId: p.stripe_price_id,
          features: p.features || {},
        })));
      }
    }
    fetchPlans();
  }, []);

  const handleUpgrade = async (priceId: string) => {
    setUpgradeLoading(priceId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('ログインが必要です');
        return;
      }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout-session`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            organizationId,
            priceId,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || 'エラーが発生しました');
        return;
      }

      // Stripe Checkoutにリダイレクト
      window.location.href = data.url;
    } catch (err) {
      alert('エラーが発生しました');
    } finally {
      setUpgradeLoading(null);
    }
  };

  const handleManageBilling = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('ログインが必要です');
        return;
      }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-customer-portal`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ organizationId }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || 'エラーが発生しました');
        return;
      }

      window.location.href = data.url;
    } catch (err) {
      alert('エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  if (limits.loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="animate-spin text-blue-600" size={24} />
      </div>
    );
  }

  const currentPlanName = limits.plan?.name || 'Free';
  const isSponsored = limits.isSponsored;

  return (
    <div className="space-y-6">
      {/* Current Plan */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Crown size={20} className="text-blue-600" />
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">現在のプラン</h3>
        </div>

        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-2xl font-bold text-gray-900 dark:text-white">{currentPlanName}</span>
          {isSponsored && (
            <span className="px-2 py-0.5 text-xs font-medium text-purple-600 bg-purple-100 rounded-full">
              スポンサード
            </span>
          )}
        </div>

        <div className="text-sm text-gray-500 dark:text-gray-400 space-y-1">
          <p>選手数: {limits.currentAthletes}人 / {limits.athleteLimit ?? '無制限'}人</p>
          {limits.athleteLimit && (
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div
                className={`h-2 rounded-full ${
                  limits.isOverLimit ? 'bg-red-500' : limits.isAtLimit ? 'bg-amber-500' : 'bg-blue-600'
                }`}
                style={{ width: `${Math.min(100, (limits.currentAthletes / limits.athleteLimit) * 100)}%` }}
              />
            </div>
          )}
        </div>

        {/* Billing management button */}
        {!isSponsored && currentPlanName !== 'Free' && (
          <button
            onClick={handleManageBilling}
            disabled={loading}
            className="mt-4 flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 transition-colors"
          >
            <CreditCard size={16} />
            {loading ? '読み込み中...' : '請求管理・プラン変更'}
          </button>
        )}
      </div>

      {/* Plan Comparison (only show if not Sponsored) */}
      {!isSponsored && (
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">プランを選択</h4>
          <div className="grid gap-4 sm:grid-cols-3">
            {plans.map((plan) => {
              const isCurrent = plan.name === currentPlanName;
              const isUpgrade = plan.priceMonthly > (limits.plan?.priceMonthly || 0);

              return (
                <div
                  key={plan.name}
                  className={`rounded-xl border p-5 ${
                    isCurrent
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                  }`}
                >
                  <h5 className="font-bold text-gray-900 dark:text-white">{plan.name}</h5>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">
                      ¥{plan.priceMonthly.toLocaleString()}
                    </span>
                    <span className="text-sm text-gray-500">/月</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">{plan.athleteLimit}人まで</p>

                  <ul className="mt-4 space-y-2">
                    {plan.features.export && (
                      <li className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                        <Check size={14} className="text-blue-600" /> CSVエクスポート
                      </li>
                    )}
                    {plan.features.reports && (
                      <li className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                        <Check size={14} className="text-blue-600" /> レポート自動生成
                      </li>
                    )}
                    {plan.features.priority_support && (
                      <li className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                        <Check size={14} className="text-blue-600" /> 優先サポート
                      </li>
                    )}
                  </ul>

                  <div className="mt-4">
                    {isCurrent ? (
                      <span className="block text-center py-2 text-sm font-medium text-blue-600">
                        現在のプラン
                      </span>
                    ) : isUpgrade && plan.stripePriceId ? (
                      <button
                        onClick={() => handleUpgrade(plan.stripePriceId!)}
                        disabled={!!upgradeLoading}
                        className="w-full py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                      >
                        {upgradeLoading === plan.stripePriceId ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <><ArrowUpCircle size={16} /> アップグレード</>
                        )}
                      </button>
                    ) : (
                      <span className="block text-center py-2 text-sm text-gray-400">—</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
