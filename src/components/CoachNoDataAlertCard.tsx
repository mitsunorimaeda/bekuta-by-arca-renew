import { Alert } from '../lib/alerts';

interface CoachNoDataAlertCardProps {
  alerts: Alert[];
  markAsRead: (alertId: string) => void | Promise<void>;
}

export function CoachNoDataAlertCard({
  alerts,
  markAsRead,
}: CoachNoDataAlertCardProps) {
  // 「練習記録なし」だけ抽出
  const noDataAlerts = alerts.filter((a) => a.type === 'no_data');

  if (noDataAlerts.length === 0) return null;

  const handleMarkAllReadToday = () => {
    noDataAlerts.forEach((a) => {
      markAsRead(a.id);
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">📅</span>
          <div>
            <h3 className="font-semibold text-slate-900">
              練習記録が途切れている選手
            </h3>
            <p className="text-xs text-slate-500">
              最終記録日から一定期間、記録がない選手の一覧です
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleMarkAllReadToday}
          className="text-xs px-3 py-1 rounded-full border border-slate-300 text-slate-700 hover:bg-slate-50"
        >
          今日分は既読にする
        </button>
      </div>

      <div className="space-y-1 text-sm text-slate-800">
        {noDataAlerts.map((alert) => (
          <div
            key={alert.id}
            className="flex items-center justify-between py-0.5"
          >
            <div>
              <span className="font-medium">
                {alert.user_name ?? '選手'}
              </span>
              {alert.last_training_date && (
                <span className="ml-2 text-xs text-slate-500">
                  最終日 {alert.last_training_date}{' '}
                  {typeof alert.days_since_last_training === 'number' &&
                    `（${alert.days_since_last_training}日間）`}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}