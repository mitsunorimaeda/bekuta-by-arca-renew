import { AlertTriangle, ArrowUpCircle } from 'lucide-react';

interface PlanLimitBannerProps {
  currentAthletes: number;
  athleteLimit: number | null;
  planName: string;
  isAtLimit: boolean;
  isOverLimit: boolean;
  remainingSlots: number | null;
}

export function PlanLimitBanner({
  currentAthletes,
  athleteLimit,
  planName,
  isAtLimit,
  isOverLimit,
  remainingSlots,
}: PlanLimitBannerProps) {
  if (!isAtLimit && !isOverLimit) return null;

  return (
    <div
      className={`rounded-lg p-4 flex items-start gap-3 ${
        isOverLimit
          ? 'bg-red-50 border border-red-200'
          : 'bg-amber-50 border border-amber-200'
      }`}
    >
      <AlertTriangle
        size={20}
        className={`flex-shrink-0 mt-0.5 ${isOverLimit ? 'text-red-500' : 'text-amber-500'}`}
      />
      <div className="flex-1">
        <p className={`text-sm font-medium ${isOverLimit ? 'text-red-800' : 'text-amber-800'}`}>
          {isOverLimit
            ? `選手数が${planName}プランの上限（${athleteLimit}人）を超えています`
            : `選手数が${planName}プランの上限（${athleteLimit}人）に達しました`}
        </p>
        <p className={`text-xs mt-1 ${isOverLimit ? 'text-red-600' : 'text-amber-600'}`}>
          現在{currentAthletes}人 / 上限{athleteLimit}人
          {remainingSlots !== null && remainingSlots > 0 && `（残り${remainingSlots}枠）`}
        </p>
        <button
          onClick={() => {
            // TODO: Stripe連携後にアップグレードページへ遷移
            alert('プランのアップグレードは近日公開予定です');
          }}
          className={`mt-2 inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
            isOverLimit
              ? 'bg-red-600 text-white hover:bg-red-700'
              : 'bg-amber-600 text-white hover:bg-amber-700'
          }`}
        >
          <ArrowUpCircle size={14} />
          プランをアップグレード
        </button>
      </div>
    </div>
  );
}
