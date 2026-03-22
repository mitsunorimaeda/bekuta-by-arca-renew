import { Lock, ArrowUpCircle } from 'lucide-react';

interface UpgradeGateProps {
  /** 機能が利用可能かどうか */
  allowed: boolean;
  /** 機能名（表示用） */
  featureName: string;
  /** 必要なプラン名 */
  requiredPlan?: string;
  /** アップグレードボタンのコールバック */
  onUpgrade?: () => void;
  /** 子要素（allowedの場合に表示） */
  children: React.ReactNode;
}

/**
 * プラン制限による機能ゲートコンポーネント
 * allowed=false の場合、子要素の代わりにアップグレード促進UIを表示
 */
export function UpgradeGate({
  allowed,
  featureName,
  requiredPlan = 'Pro',
  onUpgrade,
  children,
}: UpgradeGateProps) {
  if (allowed) {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-col items-center justify-center py-12 px-6">
      <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
        <Lock size={28} className="text-gray-400 dark:text-gray-500" />
      </div>
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
        {featureName}
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6 max-w-sm">
        この機能は{requiredPlan}プラン以上でご利用いただけます。
        アップグレードして、チームの管理をさらに強化しましょう。
      </p>
      {onUpgrade && (
        <button
          onClick={onUpgrade}
          className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <ArrowUpCircle size={18} />
          {requiredPlan}にアップグレード
        </button>
      )}
    </div>
  );
}

/**
 * タブを非表示にせず、ロックアイコン付きで表示するためのラッパー
 */
export function LockedTabLabel({ label, locked }: { label: string; locked: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      {locked && <Lock size={12} className="text-gray-400" />}
      <span className={locked ? 'text-gray-400' : ''}>{label}</span>
    </span>
  );
}
