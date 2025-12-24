import React, { useMemo, useState } from 'react';
import { Alert, getAlertStyle, getAlertTypeLabel } from '../lib/alerts';
import {
  X, Check, Eye, EyeOff, Filter, Clock, User, TrendingUp,
  ChevronDown, ChevronRight
} from 'lucide-react';

interface AlertPanelProps {
  alerts: Alert[];
  onMarkAsRead: (alertId: string) => void;
  onDismiss: (alertId: string) => void;
  onMarkAllAsRead: () => void;
  onClose: () => void;
  userRole: 'athlete' | 'staff' | 'admin';

  // ✅ 追加：選択した選手だけ表示（これが入っていれば「その選手限定モード」）
  selectedUserId?: string;

  // ✅ 任意：ユーザー名を外から渡せるように（無ければ "対象ユーザー"）
  userNameMap?: Record<string, string>;
}

type Priority = 'high' | 'medium' | 'low';

const priorityRank: Record<Priority, number> = { high: 3, medium: 2, low: 1 };

function isPriority(v: any): v is Priority {
  return v === 'high' || v === 'medium' || v === 'low';
}
function comparePriority(a: Priority, b: Priority) {
  return priorityRank[b] - priorityRank[a];
}

type GroupedAlerts = {
  userId: string;
  topPriority: Priority;
  topAlerts: Alert[];
  included: { medium: Alert[]; low: Alert[] };
  totalCount: number;
  unreadCount: number;
};

export function AlertPanel({
  alerts,
  onMarkAsRead,
  onDismiss,
  onMarkAllAsRead,
  onClose,
  userRole,
  selectedUserId,
  userNameMap = {},
}: AlertPanelProps) {
  const [filter, setFilter] = useState<'all' | 'unread' | 'high' | 'medium' | 'low'>('all');
  const [showDismissed, setShowDismissed] = useState(false);
  const [expandedUserIds, setExpandedUserIds] = useState<Record<string, boolean>>({});

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

  const toggleExpanded = (userId: string) => {
    setExpandedUserIds(prev => ({ ...prev, [userId]: !prev[userId] }));
  };

  // ✅ 対象ユーザーID抽出（あなたの Alert 型に合わせて一つに固定推奨）
  const getTargetUserId = (a: Alert) =>
    (a as any).user_id ?? (a as any).target_user_id ?? (a as any).athlete_id;

  // 1) dismiss反映
  const visibleAlerts = useMemo(() => {
    return alerts.filter(a => {
      if (!showDismissed && a.is_dismissed) return false;
      return true;
    });
  }, [alerts, showDismissed]);

  // ✅ 2) selectedUserId がある場合は、そこで絞る（＝選手限定モード）
  const scopedAlerts = useMemo(() => {
    if (!selectedUserId) return visibleAlerts;
    return visibleAlerts.filter(a => getTargetUserId(a) === selectedUserId);
  }, [visibleAlerts, selectedUserId]);

  // ヘッダー用（表示対象ベース）
  const unreadCount = useMemo(
    () => scopedAlerts.filter(a => !a.is_read && !a.is_dismissed).length,
    [scopedAlerts]
  );
  const highPriorityCount = useMemo(
    () => scopedAlerts.filter(a => a.priority === 'high' && !a.is_dismissed).length,
    [scopedAlerts]
  );

  // ✅ 3) 選手単位に集約（下位を内包）
  const grouped = useMemo<GroupedAlerts[]>(() => {
    const byUser = new Map<string, Alert[]>();

    for (const a of scopedAlerts) {
      const uid = getTargetUserId(a);
      if (!uid) continue;
      if (!byUser.has(uid)) byUser.set(uid, []);
      byUser.get(uid)!.push(a);
    }

    const result: GroupedAlerts[] = [];

    for (const [userId, userAlerts] of byUser.entries()) {
      const priorities: Priority[] = userAlerts.map(a => (isPriority(a.priority) ? a.priority : 'low'));
      const topPriority = priorities.sort(comparePriority)[0] ?? 'low';

      const topAlerts = userAlerts
        .filter(a => (isPriority(a.priority) ? a.priority : 'low') === topPriority)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      const medium = userAlerts
        .filter(a => (isPriority(a.priority) ? a.priority : 'low') === 'medium')
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      const low = userAlerts
        .filter(a => (isPriority(a.priority) ? a.priority : 'low') === 'low')
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      result.push({
        userId,
        topPriority,
        topAlerts,
        included: {
          // ✅ 内包ルール：topがhighなら medium+low を内包、topがmediumなら lowを内包
          medium: topPriority === 'high' ? medium : [],
          low: topPriority !== 'low' ? low : [],
        },
        totalCount: userAlerts.length,
        unreadCount: userAlerts.filter(a => !a.is_read).length,
      });
    }

    return result.sort((a, b) => {
      const p = comparePriority(a.topPriority, b.topPriority);
      if (p !== 0) return p;
      if (b.unreadCount !== a.unreadCount) return b.unreadCount - a.unreadCount;
      const aNewest = new Date(a.topAlerts[0]?.created_at ?? 0).getTime();
      const bNewest = new Date(b.topAlerts[0]?.created_at ?? 0).getTime();
      return bNewest - aNewest;
    });
  }, [scopedAlerts]);

  // ✅ 4) フィルタ（選手単位）
  const filteredGrouped = useMemo(() => {
    return grouped.filter(g => {
      if (filter === 'unread') return g.unreadCount > 0;
      if (filter === 'high' || filter === 'medium' || filter === 'low') return g.topPriority === filter;
      return true;
    });
  }, [grouped, filter]);

  const isSingleUserMode = !!selectedUserId;

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
                <h2 className="text-2xl font-bold">
                  {isSingleUserMode ? '選手アラート詳細' : 'アラート通知'}
                </h2>
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
            <button onClick={onClose} className="bg-blue-500 hover:bg-blue-400 rounded-full p-2 transition-colors">
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
                <option value="all">{isSingleUserMode ? '全て（この選手）' : '全て（選手単位）'}</option>
                <option value="unread">{isSingleUserMode ? '未読のみ（この選手）' : '未読あり（選手）'}</option>
                <option value="high">高リスク</option>
                <option value="medium">中リスク</option>
                <option value="low">低リスク</option>
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

        {/* Body */}
        <div className="overflow-y-auto max-h-[60vh] p-6">
          {filteredGrouped.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4">
                <TrendingUp className="w-16 h-16 mx-auto" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {filter === 'unread' ? '未読の通知はありません' : '通知はありません'}
              </h3>
              <p className="text-gray-600">
                {filter === 'unread' ? '全ての通知を確認済みです。' : 'システムが継続的に監視しています。'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredGrouped.map((g) => {
                const representative = g.topAlerts[0];
                const style = representative
                  ? getAlertStyle(representative)
                  : getAlertStyle({ priority: g.topPriority } as any);

                const userName = userNameMap[g.userId] ?? '対象ユーザー';
                const expanded = !!expandedUserIds[g.userId];

                return (
                  <div key={g.userId} className={`${style.bgColor} ${style.borderColor} border rounded-lg p-4`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="text-lg">{style.icon}</span>
                          <h3 className={`font-semibold ${style.textColor}`}>
                            {userRole !== 'athlete' ? userName : representative?.title}
                          </h3>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${style.bgColor} ${style.textColor} border ${style.borderColor}`}>
                            {g.topPriority === 'high' ? '高リスク' : g.topPriority === 'medium' ? '中リスク' : '低リスク'}
                          </span>

                          {g.unreadCount > 0 && (
                            <span className="ml-1 inline-flex items-center text-xs">
                              <span className="w-2 h-2 bg-blue-600 rounded-full mr-2" />
                              <span className="text-gray-600">未読 {g.unreadCount}</span>
                            </span>
                          )}

                          {(g.included.medium.length + g.included.low.length) > 0 && (
                            <span className="text-xs text-gray-500 ml-2">
                              関連要因 {g.included.medium.length + g.included.low.length}件
                            </span>
                          )}
                        </div>

                        {/* Top (最上位) */}
                        <div className="space-y-2">
                          {g.topAlerts.slice(0, 2).map((a) => (
                            <div key={a.id}>
                              <div className="flex items-center space-x-2">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${style.bgColor} ${style.textColor} border ${style.borderColor}`}>
                                  {getAlertTypeLabel(a.type)}
                                </span>
                                <span className={`font-semibold ${style.textColor}`}>{a.title}</span>
                              </div>
                              <p className={`${style.textColor} mt-1`}>{a.message}</p>

                              {a.acwr_value && (
                                <div className="bg-white bg-opacity-50 rounded p-2 mt-2">
                                  <div className="flex items-center space-x-4 text-sm">
                                    <div>
                                      <span className="text-gray-600">ACWR値:</span>
                                      <span className={`font-bold ml-1 ${style.textColor}`}>{a.acwr_value}</span>
                                    </div>
                                    {a.threshold_exceeded && (
                                      <div>
                                        <span className="text-gray-600">閾値:</span>
                                        <span className="font-medium ml-1">{a.threshold_exceeded}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              <div className="flex items-center space-x-4 text-xs text-gray-500 mt-2">
                                <div className="flex items-center space-x-1">
                                  <Clock className="w-3 h-3" />
                                  <span>{formatTimeAgo(a.created_at)}</span>
                                </div>
                                {userRole !== 'athlete' && (
                                  <div className="flex items-center space-x-1">
                                    <User className="w-3 h-3" />
                                    <span>{userName}</span>
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center space-x-2 mt-2">
                                {!a.is_read && (
                                  <button
                                    onClick={() => onMarkAsRead(a.id)}
                                    className={`p-1 rounded hover:bg-white hover:bg-opacity-50 transition-colors ${style.iconColor}`}
                                    title="既読にする"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                )}
                                {!a.is_dismissed && (
                                  <button
                                    onClick={() => onDismiss(a.id)}
                                    className={`p-1 rounded hover:bg-white hover:bg-opacity-50 transition-colors ${style.iconColor}`}
                                    title="非表示にする"
                                  >
                                    <EyeOff className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}

                          {g.topAlerts.length > 2 && (
                            <div className="text-xs text-gray-600">ほか {g.topAlerts.length - 2} 件の同優先度アラートがあります</div>
                          )}
                        </div>
                      </div>

                      {(g.included.medium.length + g.included.low.length) > 0 && (
                        <button
                          onClick={() => toggleExpanded(g.userId)}
                          className="ml-4 text-gray-700 hover:text-gray-900 flex items-center space-x-1"
                          title="関連要因を表示"
                        >
                          {expanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                        </button>
                      )}
                    </div>

                    {/* Included */}
                    {(g.included.medium.length + g.included.low.length) > 0 && expanded && (
                      <div className="mt-4 bg-white bg-opacity-60 rounded-lg p-4">
                        <div className="text-sm font-semibold text-gray-800 mb-3">関連要因（参考）</div>

                        {g.included.medium.length > 0 && (
                          <div className="mb-4">
                            <div className="text-xs font-semibold text-gray-700 mb-2">中リスク（{g.included.medium.length}）</div>
                            <div className="space-y-3">
                              {g.included.medium.map((a) => {
                                const s = getAlertStyle(a);
                                return (
                                  <div key={a.id} className={`${s.bgColor} ${s.borderColor} border rounded p-3`}>
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center space-x-2">
                                        <span className="text-base">{s.icon}</span>
                                        <span className={`text-sm font-semibold ${s.textColor}`}>{a.title}</span>
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${s.bgColor} ${s.textColor} border ${s.borderColor}`}>
                                          {getAlertTypeLabel(a.type)}
                                        </span>
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        {!a.is_read && (
                                          <button onClick={() => onMarkAsRead(a.id)} className={`p-1 rounded hover:bg-white hover:bg-opacity-50 transition-colors ${s.iconColor}`} title="既読にする">
                                            <Eye className="w-4 h-4" />
                                          </button>
                                        )}
                                        {!a.is_dismissed && (
                                          <button onClick={() => onDismiss(a.id)} className={`p-1 rounded hover:bg-white hover:bg-opacity-50 transition-colors ${s.iconColor}`} title="非表示にする">
                                            <EyeOff className="w-4 h-4" />
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                    <p className={`${s.textColor} mt-2 text-sm`}>{a.message}</p>
                                    <div className="flex items-center space-x-1 text-xs text-gray-500 mt-2">
                                      <Clock className="w-3 h-3" />
                                      <span>{formatTimeAgo(a.created_at)}</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {g.included.low.length > 0 && (
                          <div>
                            <div className="text-xs font-semibold text-gray-700 mb-2">低リスク（{g.included.low.length}）</div>
                            <div className="space-y-3">
                              {g.included.low.map((a) => {
                                const s = getAlertStyle(a);
                                return (
                                  <div key={a.id} className={`${s.bgColor} ${s.borderColor} border rounded p-3`}>
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center space-x-2">
                                        <span className="text-base">{s.icon}</span>
                                        <span className={`text-sm font-semibold ${s.textColor}`}>{a.title}</span>
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${s.bgColor} ${s.textColor} border ${s.borderColor}`}>
                                          {getAlertTypeLabel(a.type)}
                                        </span>
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        {!a.is_read && (
                                          <button onClick={() => onMarkAsRead(a.id)} className={`p-1 rounded hover:bg-white hover:bg-opacity-50 transition-colors ${s.iconColor}`} title="既読にする">
                                            <Eye className="w-4 h-4" />
                                          </button>
                                        )}
                                        {!a.is_dismissed && (
                                          <button onClick={() => onDismiss(a.id)} className={`p-1 rounded hover:bg-white hover:bg-opacity-50 transition-colors ${s.iconColor}`} title="非表示にする">
                                            <EyeOff className="w-4 h-4" />
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                    <p className={`${s.textColor} mt-2 text-sm`}>{a.message}</p>
                                    <div className="flex items-center space-x-1 text-xs text-gray-500 mt-2">
                                      <Clock className="w-3 h-3" />
                                      <span>{formatTimeAgo(a.created_at)}</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
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
              表示中: {filteredGrouped.length}{isSingleUserMode ? '（この選手）' : '人'} / 対象: {grouped.length}{isSingleUserMode ? '' : '人'}（アラート総数: {scopedAlerts.length}件）
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