import React, { useState, useEffect } from 'react';
import { Alert, getAlertStyle } from '../lib/alerts';
import { TrendingUp, AlertTriangle, Info, Clock, X } from 'lucide-react';

interface AlertSummaryProps {
  alerts: Alert[];
  onViewAll: () => void;
  className?: string;
}

export function AlertSummary({ alerts, onViewAll, className = '' }: AlertSummaryProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem('alertSummaryDismissed');
    const dismissedTime = dismissed ? parseInt(dismissed, 10) : 0;
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;

    if (dismissedTime && now - dismissedTime < oneHour) {
      setIsDismissed(true);
    } else if (dismissedTime && now - dismissedTime >= oneHour) {
      localStorage.removeItem('alertSummaryDismissed');
    }
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem('alertSummaryDismissed', Date.now().toString());
  };

  const activeAlerts = alerts.filter(alert => !alert.is_dismissed);
  const highPriorityAlerts = activeAlerts.filter(alert => alert.priority === 'high');
  const unreadAlerts = activeAlerts.filter(alert => !alert.is_read);

  if (isDismissed) {
    return null;
  }

  if (activeAlerts.length === 0) {
    return null;
  }

  return (
    <div className={`bg-white border border-gray-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900 flex items-center">
          <AlertTriangle className="w-5 h-5 text-orange-500 mr-2" />
          アラート概要
        </h3>
        <div className="flex items-center space-x-2">
          <button
            onClick={onViewAll}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            全て表示
          </button>
          <button
            onClick={handleDismiss}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            title="1時間非表示"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-red-600">
            {highPriorityAlerts.length}
          </div>
          <div className="text-xs text-gray-600">高優先度</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">
            {unreadAlerts.length}
          </div>
          <div className="text-xs text-gray-600">未読</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-600">
            {activeAlerts.length}
          </div>
          <div className="text-xs text-gray-600">合計</div>
        </div>
      </div>

      {/* Recent High Priority Alerts */}
      {highPriorityAlerts.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700 flex items-center">
            <AlertTriangle className="w-4 h-4 text-red-500 mr-1" />
            緊急対応が必要
          </h4>
          {highPriorityAlerts.slice(0, 3).map((alert) => {
            const style = getAlertStyle(alert);
            return (
              <div
                key={alert.id}
                className={`${style.bgColor} ${style.borderColor} border rounded p-3`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-sm">{style.icon}</span>
                      <h5 className={`font-medium text-sm ${style.textColor}`}>
                        {alert.title}
                      </h5>
                      {!alert.is_read && (
                        <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                      )}
                    </div>
                    <p className={`text-xs ${style.textColor} line-clamp-2`}>
                      {alert.message}
                    </p>
                    {alert.acwr_value && (
                      <div className="mt-1">
                        <span className="text-xs text-gray-600">ACWR: </span>
                        <span className={`text-xs font-bold ${style.textColor}`}>
                          {alert.acwr_value}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="ml-2">
                    <Clock className="w-3 h-3 text-gray-400" />
                  </div>
                </div>
              </div>
            );
          })}
          {highPriorityAlerts.length > 3 && (
            <div className="text-center">
              <button
                onClick={onViewAll}
                className="text-xs text-red-600 hover:text-red-700 font-medium"
              >
                他 {highPriorityAlerts.length - 3}件の高優先度アラート
              </button>
            </div>
          )}
        </div>
      )}

      {/* General Info */}
      <div className="mt-4 pt-3 border-t border-gray-200">
        <div className="flex items-center text-xs text-gray-500">
          <Info className="w-3 h-3 mr-1" />
          <span>アラートは5分ごとに自動更新されます</span>
        </div>
      </div>
    </div>
  );
}