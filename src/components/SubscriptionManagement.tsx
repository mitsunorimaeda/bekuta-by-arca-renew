import React, { useState } from 'react';
import { useSubscription } from '../hooks/useSubscription';
import { CreditCard, TrendingUp, Calendar, AlertCircle, Check, X, DollarSign } from 'lucide-react';
import type { Database } from '../lib/database.types';

type SubscriptionPlan = Database['public']['Tables']['subscription_plans']['Row'];

interface SubscriptionManagementProps {
  organizationId: string;
  organizationName: string;
}

export function SubscriptionManagement({ organizationId, organizationName }: SubscriptionManagementProps) {
  const {
    subscription,
    plans,
    usage,
    billingHistory,
    limits,
    loading,
    error,
    upgradePlan,
    cancelSubscription,
    reactivateSubscription
  } = useSubscription(organizationId);

  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [processing, setProcessing] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p className="text-red-800 dark:text-red-200">{error}</p>
      </div>
    );
  }

  const currentPlan = subscription?.plan as SubscriptionPlan | undefined;
  const isTrialing = subscription?.status === 'trial';
  const isCancelled = subscription?.status === 'cancelled';
  const willCancelAtPeriodEnd = subscription?.cancel_at_period_end;

  const handleUpgrade = async () => {
    if (!selectedPlan) return;

    setProcessing(true);
    try {
      await upgradePlan(selectedPlan.id, billingCycle);
      setShowUpgradeModal(false);
      setSelectedPlan(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'アップグレードに失敗しました');
    } finally {
      setProcessing(false);
    }
  };

  const handleCancel = async (immediate: boolean) => {
    setProcessing(true);
    try {
      await cancelSubscription(immediate);
      setShowCancelModal(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'キャンセルに失敗しました');
    } finally {
      setProcessing(false);
    }
  };

  const handleReactivate = async () => {
    setProcessing(true);
    try {
      await reactivateSubscription();
    } catch (err) {
      alert(err instanceof Error ? err.message : '再開に失敗しました');
    } finally {
      setProcessing(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY'
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <CreditCard className="h-6 w-6" />
          サブスクリプション管理
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mt-1">{organizationName}のプランと請求</p>
      </div>

      {limits && !limits.withinLimits && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
            <div>
              <h3 className="font-semibold text-yellow-900 dark:text-yellow-200">使用量がプラン制限を超えています</h3>
              <p className="text-sm text-yellow-800 dark:text-yellow-300 mt-1">
                現在のプランの制限を超えています。アップグレードをご検討ください。
              </p>
              {limits.limits.athletes?.exceeded && (
                <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">
                  アスリート数: {limits.limits.athletes.current} / {limits.limits.athletes.limit || '無制限'}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {willCancelAtPeriodEnd && (
        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400 mt-0.5" />
              <div>
                <h3 className="font-semibold text-orange-900 dark:text-orange-200">サブスクリプションがキャンセル予定です</h3>
                <p className="text-sm text-orange-800 dark:text-orange-300 mt-1">
                  {formatDate(subscription.current_period_end)}にサブスクリプションが終了します
                </p>
              </div>
            </div>
            <button
              onClick={handleReactivate}
              disabled={processing}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              再開する
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">現在のプラン</h3>

          {currentPlan ? (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl font-bold text-gray-900 dark:text-white">{currentPlan.name}</span>
                  {isTrialing && (
                    <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 text-xs font-semibold rounded-full">
                      トライアル中
                    </span>
                  )}
                  {isCancelled && (
                    <span className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 text-xs font-semibold rounded-full">
                      キャンセル済み
                    </span>
                  )}
                </div>
                <p className="text-gray-600 dark:text-gray-400 text-sm">{currentPlan.description}</p>
              </div>

              <div className="pt-4 border-t dark:border-gray-700">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-3xl font-bold text-gray-900 dark:text-white">
                    {formatCurrency(subscription.billing_cycle === 'yearly' ? currentPlan.price_yearly : currentPlan.price_monthly)}
                  </span>
                  <span className="text-gray-600 dark:text-gray-400">
                    / {subscription.billing_cycle === 'yearly' ? '年' : '月'}
                  </span>
                </div>
                {subscription.billing_cycle === 'yearly' && (
                  <p className="text-sm text-green-600 dark:text-green-400">
                    年間プランで {formatCurrency((currentPlan.price_monthly * 12) - currentPlan.price_yearly)} お得
                  </p>
                )}
              </div>

              <div className="space-y-2 pt-4 border-t dark:border-gray-700">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">請求サイクル</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {subscription.billing_cycle === 'yearly' ? '年次' : '月次'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">次回請求日</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {formatDate(subscription.current_period_end)}
                  </span>
                </div>
                {isTrialing && subscription.trial_end && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">トライアル終了</span>
                    <span className="font-medium text-blue-600 dark:text-blue-400">
                      {formatDate(subscription.trial_end)}
                    </span>
                  </div>
                )}
              </div>

              <div className="pt-4 space-y-2">
                <button
                  onClick={() => setShowUpgradeModal(true)}
                  disabled={isCancelled}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  プランを変更
                </button>
                {!isCancelled && !willCancelAtPeriodEnd && (
                  <button
                    onClick={() => setShowCancelModal(true)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    サブスクリプションをキャンセル
                  </button>
                )}
              </div>
            </div>
          ) : (
            <p className="text-gray-600 dark:text-gray-400">サブスクリプション情報がありません</p>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            使用状況
          </h3>

          {limits && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">アクティブアスリート</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {limits.usage?.active_athletes || 0} / {currentPlan?.athlete_limit || '無制限'}
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      limits.limits?.athletes?.exceeded ? 'bg-red-600' : 'bg-blue-600'
                    }`}
                    style={{
                      width: currentPlan?.athlete_limit
                        ? `${Math.min((limits.usage?.active_athletes || 0) / currentPlan.athlete_limit * 100, 100)}%`
                        : '0%'
                    }}
                  ></div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">ストレージ使用量</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {((limits.usage?.storage_used_mb || 0) / 1024).toFixed(2)} GB / {currentPlan?.storage_gb || 0} GB
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      limits.limits?.storage?.exceeded ? 'bg-red-600' : 'bg-green-600'
                    }`}
                    style={{
                      width: currentPlan?.storage_gb
                        ? `${Math.min(((limits.usage?.storage_used_mb || 0) / 1024) / currentPlan.storage_gb * 100, 100)}%`
                        : '0%'
                    }}
                  ></div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t dark:border-gray-700">
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{limits.usage?.total_users || 0}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">総ユーザー数</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{limits.usage?.data_exports || 0}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">データエクスポート</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          請求履歴
        </h3>

        {billingHistory.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b dark:border-gray-700">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">日付</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">金額</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">ステータス</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">支払方法</th>
                </tr>
              </thead>
              <tbody>
                {billingHistory.slice(0, 10).map((bill) => (
                  <tr key={bill.id} className="border-b dark:border-gray-700 last:border-0">
                    <td className="py-3 px-4 text-sm text-gray-900 dark:text-white">
                      {formatDate(bill.billing_date)}
                    </td>
                    <td className="py-3 px-4 text-sm font-medium text-gray-900 dark:text-white">
                      {formatCurrency(bill.amount)}
                    </td>
                    <td className="py-3 px-4 text-sm">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          bill.status === 'paid'
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                            : bill.status === 'pending'
                            ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200'
                            : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
                        }`}
                      >
                        {bill.status === 'paid' ? '支払済' : bill.status === 'pending' ? '保留中' : '失敗'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                      {bill.payment_method || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-600 dark:text-gray-400 text-center py-4">請求履歴がありません</p>
        )}
      </div>

      {showUpgradeModal && (
        <UpgradeModal
          plans={plans}
          currentPlan={currentPlan}
          selectedPlan={selectedPlan}
          billingCycle={billingCycle}
          onSelectPlan={setSelectedPlan}
          onSelectCycle={setBillingCycle}
          onConfirm={handleUpgrade}
          onClose={() => {
            setShowUpgradeModal(false);
            setSelectedPlan(null);
          }}
          processing={processing}
        />
      )}

      {showCancelModal && (
        <CancelModal
          onCancel={handleCancel}
          onClose={() => setShowCancelModal(false)}
          processing={processing}
        />
      )}
    </div>
  );
}

function UpgradeModal({
  plans,
  currentPlan,
  selectedPlan,
  billingCycle,
  onSelectPlan,
  onSelectCycle,
  onConfirm,
  onClose,
  processing
}: {
  plans: SubscriptionPlan[];
  currentPlan?: SubscriptionPlan;
  selectedPlan: SubscriptionPlan | null;
  billingCycle: 'monthly' | 'yearly';
  onSelectPlan: (plan: SubscriptionPlan) => void;
  onSelectCycle: (cycle: 'monthly' | 'yearly') => void;
  onConfirm: () => void;
  onClose: () => void;
  processing: boolean;
}) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY'
    }).format(amount);
  };

  const getFeatureValue = (plan: SubscriptionPlan, key: string) => {
    return plan.features && plan.features[key];
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">プランを選択</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="flex items-center justify-center gap-4 mb-8">
            <button
              onClick={() => onSelectCycle('monthly')}
              className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                billingCycle === 'monthly'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              月次
            </button>
            <button
              onClick={() => onSelectCycle('yearly')}
              className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                billingCycle === 'yearly'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              年次（お得）
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {plans.map((plan) => {
              const isCurrentPlan = currentPlan?.id === plan.id;
              const isSelected = selectedPlan?.id === plan.id;
              const price = billingCycle === 'yearly' ? plan.price_yearly : plan.price_monthly;

              return (
                <div
                  key={plan.id}
                  onClick={() => onSelectPlan(plan)}
                  className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                      : isCurrentPlan
                      ? 'border-gray-400 dark:border-gray-600'
                      : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700'
                  }`}
                >
                  {isCurrentPlan && (
                    <div className="mb-2">
                      <span className="px-2 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-semibold rounded">
                        現在のプラン
                      </span>
                    </div>
                  )}
                  <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{plan.name}</h4>
                  <div className="mb-4">
                    <span className="text-3xl font-bold text-gray-900 dark:text-white">{formatCurrency(price)}</span>
                    <span className="text-gray-600 dark:text-gray-400 text-sm">
                      / {billingCycle === 'yearly' ? '年' : '月'}
                    </span>
                  </div>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-600" />
                      <span className="text-gray-700 dark:text-gray-300">
                        {plan.athlete_limit ? `${plan.athlete_limit}人` : '無制限'}のアスリート
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-600" />
                      <span className="text-gray-700 dark:text-gray-300">{plan.storage_gb}GB ストレージ</span>
                    </li>
                    {getFeatureValue(plan, 'advanced_analytics') && (
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-600" />
                        <span className="text-gray-700 dark:text-gray-300">高度な分析</span>
                      </li>
                    )}
                    {getFeatureValue(plan, 'priority_support') && (
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-600" />
                        <span className="text-gray-700 dark:text-gray-300">優先サポート</span>
                      </li>
                    )}
                  </ul>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t dark:border-gray-700">
            <button
              onClick={onClose}
              disabled={processing}
              className="px-6 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
            >
              キャンセル
            </button>
            <button
              onClick={onConfirm}
              disabled={!selectedPlan || processing}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processing ? '処理中...' : '変更を確定'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CancelModal({
  onCancel,
  onClose,
  processing
}: {
  onCancel: (immediate: boolean) => void;
  onClose: () => void;
  processing: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
        <div className="p-6">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">サブスクリプションをキャンセル</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            サブスクリプションをキャンセルしますか？
          </p>

          <div className="space-y-3">
            <button
              onClick={() => onCancel(false)}
              disabled={processing}
              className="w-full px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 text-left"
            >
              <div className="font-semibold">期間終了時にキャンセル</div>
              <div className="text-sm opacity-90">現在の請求期間の終わりまで利用可能です</div>
            </button>

            <button
              onClick={() => onCancel(true)}
              disabled={processing}
              className="w-full px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 text-left"
            >
              <div className="font-semibold">即座にキャンセル</div>
              <div className="text-sm opacity-90">すぐにアクセスができなくなります（返金なし）</div>
            </button>

            <button
              onClick={onClose}
              disabled={processing}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              閉じる
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
