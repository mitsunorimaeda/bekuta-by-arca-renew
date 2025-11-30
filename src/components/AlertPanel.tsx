import React, { useState } from 'react';
import { Alert, getAlertStyle, getAlertTypeLabel } from '../lib/alerts';
import { X, Check, Eye, EyeOff, Filter, Clock, User, TrendingUp } from 'lucide-react';

interface AlertPanelProps {
  alerts: Alert[];
  onMarkAsRead: (alertId: string) => void;
  onDismiss: (alertId: string) => void;
  onMarkAllAsRead: () => void;
  onClose: () => void;
  userRole: 'athlete' | 'staff' | 'admin';
}

export function AlertPanel({ 
  alerts, 
  onMarkAsRead, 
  onDismiss, 
  onMarkAllAsRead, 
  onClose,
  userRole 
}: AlertPanelProps) {
  const [filter, setFilter] = useState<'all' | 'unread' | 'high' | 'medium' | 'low'>('all');
  const [showDismissed, setShowDismissed] = useState(false);

  const filteredAlerts = alerts.filter(alert => {
    if (!showDismissed && alert.is_dismissed) return false;
    
    switch (filter) {
      case 'unread':
        return !alert.is_read;
      case 'high':
      case 'medium':
      case 'low':
        return alert.priority === filter;
      default:
        return true;
    }
  });

  const unreadCount = alerts.filter(alert => !alert.is_read && !alert.is_dismissed).length;
  const highPriorityCount = alerts.filter(alert => alert.priority === 'high' && !alert.is_dismissed).length;

  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const alertTime = new Date(dateString);
    const diffInMinutes = Math.floor((now.getTime() - alertTime.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'たった今';
    if (diffInMinutes < 60) return `${diffInMinutes}分前`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}時間前`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}日前`;
  };

  const getUserName = async (userId: string) => {
    // 実際の実装では、ユーザー情報をキャッシュまたはAPIから取得
    return 'ユーザー'; // プレースホルダー
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="bg-blue-500 rounded-full p-3">
                <TrendingUp className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">アラート通知</h2>
                <p className="text-blue-100">
                  {unreadCount > 0 ? `${unreadCount}件の未読通知` : '全て確認済み'}
                  {highPriorityCount > 0 && (
                    <span className="ml-2 bg-red-500 text-white px-2 py-1 rounded-full text-xs">
                      高優先度 {highPriorityCount}件
                    </span>
                  )}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="bg-blue-500 hover:bg-blue-400 rounded-full p-2 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-gray-50 border-b border-gray-200 p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-3 sm:space-y-0">
            <div className="flex flex-wrap items-center space-x-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as any)}
                className="text-sm border border-gray-300 rounded px-2 py-1"
              >
                <option value="all">全て</option>
                <option value="unread">未読のみ</option>
                <option value="high">高優先度</option>
                <option value="medium">中優先度</option>
                <option value="low">低優先度</option>
              </select>
              
              <label className="flex items-center space-x-1 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={showDismissed}
                  onChange={(e) => setShowDismissed(e.target.checked)}
                  className="rounded"
                />
                <span>非表示を含む</span>
              </label>
            </div>

            <div className="flex space-x-2">
              {unreadCount > 0 && (
                <button
                  onClick={onMarkAllAsRead}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm transition-colors flex items-center space-x-1"
                >
                  <Check className="w-4 h-4" />
                  <span>全て既読</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Alert List */}
        <div className="overflow-y-auto max-h-[60vh] p-6">
          {filteredAlerts.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4">
                <TrendingUp className="w-16 h-16 mx-auto" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {filter === 'unread' ? '未読の通知はありません' : '通知はありません'}
              </h3>
              <p className="text-gray-600">
                {filter === 'unread' 
                  ? '全ての通知を確認済みです。' 
                  : 'システムが継続的に監視しています。'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredAlerts.map((alert) => {
                const style = getAlertStyle(alert);
                return (
                  <div
                    key={alert.id}
                    className={`${style.bgColor} ${style.borderColor} border rounded-lg p-4 transition-all duration-200 ${
                      alert.is_read ? 'opacity-75' : ''
                    } ${alert.is_dismissed ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="text-lg">{style.icon}</span>
                          <h3 className={`font-semibold ${style.textColor}`}>
                            {alert.title}
                          </h3>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${style.bgColor} ${style.textColor} border ${style.borderColor}`}>
                            {getAlertTypeLabel(alert.type)}
                          </span>
                          {!alert.is_read && (
                            <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                          )}
                        </div>
                        
                        <p className={`${style.textColor} mb-3`}>
                          {alert.message}
                        </p>
                        
                        {alert.acwr_value && (
                          <div className="bg-white bg-opacity-50 rounded p-2 mb-3">
                            <div className="flex items-center space-x-4 text-sm">
                              <div>
                                <span className="text-gray-600">ACWR値:</span>
                                <span className={`font-bold ml-1 ${style.textColor}`}>
                                  {alert.acwr_value}
                                </span>
                              </div>
                              {alert.threshold_exceeded && (
                                <div>
                                  <span className="text-gray-600">閾値:</span>
                                  <span className="font-medium ml-1">
                                    {alert.threshold_exceeded}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          <div className="flex items-center space-x-1">
                            <Clock className="w-3 h-3" />
                            <span>{formatTimeAgo(alert.created_at)}</span>
                          </div>
                          {userRole !== 'athlete' && (
                            <div className="flex items-center space-x-1">
                              <User className="w-3 h-3" />
                              <span>対象ユーザー</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2 ml-4">
                        {!alert.is_read && (
                          <button
                            onClick={() => onMarkAsRead(alert.id)}
                            className={`p-1 rounded hover:bg-white hover:bg-opacity-50 transition-colors ${style.iconColor}`}
                            title="既読にする"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        )}
                        
                        {!alert.is_dismissed && (
                          <button
                            onClick={() => onDismiss(alert.id)}
                            className={`p-1 rounded hover:bg-white hover:bg-opacity-50 transition-colors ${style.iconColor}`}
                            title="非表示にする"
                          >
                            <EyeOff className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 border-t border-gray-200 p-4">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div>
              表示中: {filteredAlerts.length}件 / 全体: {alerts.length}件
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-red-100 border border-red-200 rounded"></div>
                <span>高優先度</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-yellow-100 border border-yellow-200 rounded"></div>
                <span>中優先度</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-blue-100 border border-blue-200 rounded"></div>
                <span>低優先度</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}