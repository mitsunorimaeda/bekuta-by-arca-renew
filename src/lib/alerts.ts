export interface Alert {
  id: string;
  user_id: string;
  type: 'high_risk' | 'caution' | 'low_load' | 'no_data' | 'reminder';
  priority: 'high' | 'medium' | 'low';
  title: string;
  message: string;
  acwr_value?: number;
  threshold_exceeded?: string;
  is_read: boolean;
  is_dismissed: boolean;
  created_at: string;
  expires_at?: string;
}

export interface AlertRule {
  id: string;
  type: Alert['type'];
  condition: string;
  threshold: number;
  enabled: boolean;
  description: string;
}

// デフォルトのアラートルール（頻度を調整）
export const DEFAULT_ALERT_RULES: Omit<AlertRule, 'id'>[] = [
  {
    type: 'high_risk',
    condition: 'acwr_above',
    threshold: 1.5,
    enabled: true,
    description: 'ACWR が 1.5 を超えた場合（高リスク）'
  },
  {
    type: 'caution',
    condition: 'acwr_above',
    threshold: 1.3,
    enabled: true,
    description: 'ACWR が 1.3 を超えた場合（注意レベル）'
  },
  {
    type: 'low_load',
    condition: 'acwr_below',
    threshold: 0.8,
    enabled: true,
    description: 'ACWR が 0.8 を下回った場合（低負荷）'
  },
  {
    type: 'no_data',
    condition: 'no_training_days',
    threshold: 5, // 3日から5日に変更
    enabled: true,
    description: '5日間練習記録がない場合'
  },
  {
    type: 'reminder',
    condition: 'no_training_today',
    threshold: 1,
    enabled: false, // デフォルトで無効化
    description: '当日の練習記録がない場合（21時以降）'
  }
];

// アラート生成ロジック（頻度調整）
export function generateAlerts(
  userId: string,
  userName: string,
  acwrData: any[],
  trainingRecords: any[],
  rules: AlertRule[]
): Alert[] {
  const alerts: Alert[] = [];
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  
  // 最新のACWRデータ
  const latestACWR = acwrData.length > 0 ? acwrData[acwrData.length - 1] : null;
  
  // 最後の練習記録
  const lastTraining = trainingRecords.length > 0 
    ? trainingRecords[trainingRecords.length - 1] 
    : null;
  
  // 今日の練習記録があるか
  const todayTraining = trainingRecords.find(r => r.date === today);
  
  rules.forEach(rule => {
    if (!rule.enabled) return;
    
    let shouldAlert = false;
    let alertData: Partial<Alert> = {
      user_id: userId,
      type: rule.type,
      is_read: false,
      is_dismissed: false,
      created_at: now.toISOString()
    };
    
    switch (rule.condition) {
      case 'acwr_above':
        if (latestACWR && latestACWR.acwr > rule.threshold) {
          shouldAlert = true;
          alertData = {
            ...alertData,
            priority: rule.type === 'high_risk' ? 'high' : 'medium',
            title: rule.type === 'high_risk' ? '🚨 高リスク警告' : '⚠️ 注意レベル',
            message: `${userName}さんのACWRが${latestACWR.acwr}となり、${rule.threshold}を超えました。怪我のリスクが高まっています。`,
            acwr_value: latestACWR.acwr,
            threshold_exceeded: `${rule.threshold}以上`,
            expires_at: new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString() // 48時間後に延長
          };
        }
        break;
        
      case 'acwr_below':
        if (latestACWR && latestACWR.acwr < rule.threshold) {
          shouldAlert = true;
          alertData = {
            ...alertData,
            priority: 'low',
            title: '📉 低負荷通知',
            message: `${userName}さんのACWRが${latestACWR.acwr}となり、${rule.threshold}を下回りました。練習負荷が不足している可能性があります。`,
            acwr_value: latestACWR.acwr,
            threshold_exceeded: `${rule.threshold}未満`,
            expires_at: new Date(now.getTime() + 72 * 60 * 60 * 1000).toISOString() // 72時間後
          };
        }
        break;
        
      case 'no_training_days':
        if (lastTraining) {
          const daysSinceLastTraining = Math.floor(
            (now.getTime() - new Date(lastTraining.date).getTime()) / (1000 * 60 * 60 * 24)
          );
          if (daysSinceLastTraining >= rule.threshold) {
            shouldAlert = true;
            alertData = {
              ...alertData,
              priority: 'medium',
              title: '📅 練習記録なし',
              message: `${userName}さんの練習記録が${daysSinceLastTraining}日間ありません。継続的なデータ記録をお願いします。`,
              expires_at: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7日後
            };
          }
        }
        break;
        
      case 'no_training_today':
        // 22時以降のみチェック（時間を遅らせる）
        if (now.getHours() >= 22 && !todayTraining) {
          shouldAlert = true;
          alertData = {
            ...alertData,
            priority: 'low',
            title: '⏰ 今日の記録忘れ',
            message: `${userName}さん、今日の練習記録をまだ入力していません。忘れずに記録をお願いします。`,
            expires_at: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString() // 2時間後（深夜0時まで）
          };
        }
        break;
    }
    
    if (shouldAlert) {
      alerts.push({
        id: `${userId}-${rule.type}-${Date.now()}`,
        ...alertData
      } as Alert);
    }
  });
  
  return alerts;
}

// アラートの重要度に基づく色とアイコン
export function getAlertStyle(alert: Alert) {
  switch (alert.priority) {
    case 'high':
      return {
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
        textColor: 'text-red-800',
        iconColor: 'text-red-600',
        icon: '🚨'
      };
    case 'medium':
      return {
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-200',
        textColor: 'text-yellow-800',
        iconColor: 'text-yellow-600',
        icon: '⚠️'
      };
    case 'low':
      return {
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200',
        textColor: 'text-blue-800',
        iconColor: 'text-blue-600',
        icon: '💡'
      };
    default:
      return {
        bgColor: 'bg-gray-50',
        borderColor: 'border-gray-200',
        textColor: 'text-gray-800',
        iconColor: 'text-gray-600',
        icon: 'ℹ️'
      };
  }
}

// アラートタイプの日本語ラベル
export function getAlertTypeLabel(type: Alert['type']): string {
  switch (type) {
    case 'high_risk': return '高リスク';
    case 'caution': return '注意';
    case 'low_load': return '低負荷';
    case 'no_data': return 'データなし';
    case 'reminder': return 'リマインダー';
    default: return '不明';
  }
}

// アラートの有効期限チェック
export function isAlertExpired(alert: Alert): boolean {
  if (!alert.expires_at) return false;
  return new Date() > new Date(alert.expires_at);
}

// アラートのフィルタリング
export function filterActiveAlerts(alerts: Alert[]): Alert[] {
  return alerts.filter(alert => 
    !alert.is_dismissed && 
    !isAlertExpired(alert)
  );
}

// アラートの優先度ソート
export function sortAlertsByPriority(alerts: Alert[]): Alert[] {
  const priorityOrder = { high: 3, medium: 2, low: 1 };
  return alerts.sort((a, b) => {
    const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
    if (priorityDiff !== 0) return priorityDiff;
    
    // 同じ優先度の場合は作成日時で降順ソート
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}