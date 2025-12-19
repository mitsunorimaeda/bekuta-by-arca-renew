// src/lib/alerts.ts
import { formatDateJST } from '../lib/date';

export interface Alert {
  id: string;
  user_id: string;

  // UI で名前を出す用
  user_name?: string;

  // ✅ sRPE系を追加
  type:
    | 'high_risk'
    | 'caution'
    | 'low_load'
    | 'no_data'
    | 'reminder'
    | 'srpe_high'
    | 'srpe_spike';

  priority: 'high' | 'medium' | 'low';
  title: string;
  message: string;

  acwr_value?: number;
  threshold_exceeded?: string;

  // 「練習記録なし」用の補足情報
  last_training_date?: string;
  days_since_last_training?: number;

  // （任意）sRPE表示したくなったら使える
  srpe_value?: number;
  srpe_avg_7d?: number;
  srpe_spike_ratio?: number;

  is_read: boolean;
  is_dismissed: boolean;
  created_at: string;
  expires_at?: string;
}

// ✅ 条件も型を付けて安全に
export type AlertCondition =
  | 'acwr_above'
  | 'acwr_below'
  | 'no_training_days'
  | 'no_training_today'
  | 'srpe_above'
  | 'srpe_spike_ratio';

export interface AlertRule {
  id: string;
  type: Alert['type'];
  condition: AlertCondition;
  threshold: number;
  enabled: boolean;
  description: string;
}

// 🔢 ACWR 解析に必要な最小日数（選手・コーチ側の表示と揃える）
const MIN_DAYS_FOR_ACWR = 21;

// デフォルトのアラートルール
export const DEFAULT_ALERT_RULES: Omit<AlertRule, 'id'>[] = [
  {
    type: 'high_risk',
    condition: 'acwr_above',
    threshold: 1.5,
    enabled: true,
    description: 'ACWR が 1.5 を超えた場合（高リスク）',
  },
  {
    type: 'caution',
    condition: 'acwr_above',
    threshold: 1.3,
    enabled: true,
    description: 'ACWR が 1.3 を超えた場合（注意レベル）',
  },
  {
    type: 'low_load',
    condition: 'acwr_below',
    threshold: 0.8,
    enabled: true,
    description: 'ACWR が 0.8 を下回った場合（低負荷）',
  },
  {
    type: 'no_data',
    condition: 'no_training_days',
    threshold: 5,
    enabled: true,
    description: '5日間練習記録がない場合',
  },
  {
    type: 'reminder',
    condition: 'no_training_today',
    threshold: 1,
    enabled: false,
    description: '当日の練習記録がない場合（22時以降）',
  },

  // ✅ sRPEルール（追加）
  {
    type: 'srpe_high',
    condition: 'srpe_above',
    threshold: 600,
    enabled: true,
    description: 'sRPE（RPE×分）が600を超えた場合（単発高負荷）',
  },
  {
    type: 'srpe_spike',
    condition: 'srpe_spike_ratio',
    threshold: 1.6,
    enabled: true,
    description: '当日のsRPEが直近平均比で急増（例：1.6倍以上）',
  },
];

// アラート生成ロジック
export function generateAlerts(
  userId: string,
  userName: string,
  acwrData: any[],
  trainingRecords: any[],
  rules: AlertRule[]
): Alert[] {
  const alerts: Alert[] = [];
  const now = new Date();
  const today = formatDateJST(now); // JST 日付文字列

  // 最新のACWRデータ
  const latestACWR = acwrData.length > 0 ? acwrData[acwrData.length - 1] : null;

  // 最後の練習記録
  const lastTraining =
    trainingRecords.length > 0 ? trainingRecords[trainingRecords.length - 1] : null;

  // 今日の練習記録があるか（dateがJST文字列で揃っている前提）
  const todayTraining = trainingRecords.find((r) => r.date === today);

  // ✅ 練習日数（ユニーク日数）をカウントして、ACWR 解析可能かどうか判定
  const uniqueDates = Array.from(new Set(trainingRecords.map((r) => r.date)));
  const trainingDaysCount = uniqueDates.length;
  const hasEnoughDaysForACWR = trainingDaysCount >= MIN_DAYS_FOR_ACWR;

  // -------------------------
  // ✅ sRPE 計算（RPE×分）
  // -------------------------
  const getSRPE = (r: any) => {
    // ★ ここだけカラム名が違うなら修正してOK
    const rpe = Number(r?.rpe ?? 0);
    const duration = Number(r?.duration_min ?? 0);

    if (!rpe || !duration) return 0;
    return Math.round(rpe * duration);
  };

  // 日付ごとに合算（同日に複数レコードがある場合）
  const srpeByDate = new Map<string, number>();
  for (const r of trainingRecords) {
    const d = r.date;
    if (!d) continue;
    srpeByDate.set(d, (srpeByDate.get(d) ?? 0) + getSRPE(r));
  }

  const todaySRPE = srpeByDate.get(today) ?? 0;

  // 直近7日（今日除く）の平均（0は除外）
  const last7Dates = Array.from(srpeByDate.keys())
    .sort()
    .filter((d) => d < today)
    .slice(-7);

  const last7Values = last7Dates
    .map((d) => srpeByDate.get(d) ?? 0)
    .filter((v) => v > 0);

  const last7Avg = last7Values.length
    ? Math.round(last7Values.reduce((a, b) => a + b, 0) / last7Values.length)
    : 0;

  const spikeRatio = last7Avg > 0 ? Number((todaySRPE / last7Avg).toFixed(2)) : 0;

  // -------------------------
  // ルール判定
  // -------------------------
  rules.forEach((rule) => {
    if (!rule.enabled) return;

    let shouldAlert = false;

    let alertData: Partial<Alert> = {
      user_id: userId,
      user_name: userName,
      type: rule.type,
      is_read: false,
      is_dismissed: false,
      created_at: now.toISOString(), // UTCのままでOK
    };

    switch (rule.condition) {
      case 'acwr_above':
        // 🔒 21日未満は ACWR 系アラートは一切出さない
        if (!hasEnoughDaysForACWR) break;

        if (latestACWR && latestACWR.acwr > rule.threshold) {
          shouldAlert = true;
          alertData = {
            ...alertData,
            priority: rule.type === 'high_risk' ? 'high' : 'medium',
            title: rule.type === 'high_risk' ? '🚨 高リスク警告' : '⚠️ 注意レベル',
            message: `${userName}さんのACWRが${latestACWR.acwr}となり、${rule.threshold}を超えました。怪我のリスクが高まっています。`,
            acwr_value: latestACWR.acwr,
            threshold_exceeded: `${rule.threshold}以上`,
            expires_at: new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString(),
          };
        }
        break;

      case 'acwr_below':
        // 🔒 21日未満は ACWR 系アラートは一切出さない
        if (!hasEnoughDaysForACWR) break;

        if (latestACWR && latestACWR.acwr < rule.threshold) {
          shouldAlert = true;
          alertData = {
            ...alertData,
            priority: 'low',
            title: '📉 低負荷通知',
            message: `${userName}さんのACWRが${latestACWR.acwr}となり、${rule.threshold}を下回りました。練習負荷が不足している可能性があります。`,
            acwr_value: latestACWR.acwr,
            threshold_exceeded: `${rule.threshold}未満`,
            expires_at: new Date(now.getTime() + 72 * 60 * 60 * 1000).toISOString(),
          };
        }
        break;

      case 'no_training_days':
        if (lastTraining) {
          const daysSinceLastTraining = Math.floor(
            (now.getTime() - new Date(lastTraining.date).getTime()) /
              (1000 * 60 * 60 * 24)
          );

          if (daysSinceLastTraining >= rule.threshold) {
            shouldAlert = true;
            alertData = {
              ...alertData,
              priority: 'medium',
              title: '📅 練習記録なし',
              message: `${userName}さんの練習記録が${daysSinceLastTraining}日間ありません。継続的なデータ記録をお願いします。`,
              last_training_date: lastTraining.date,
              days_since_last_training: daysSinceLastTraining,
              expires_at: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            };
          }
        }
        break;

      case 'no_training_today':
        // 22時以降のみチェック
        if (now.getHours() >= 22 && !todayTraining) {
          shouldAlert = true;
          alertData = {
            ...alertData,
            priority: 'low',
            title: '⏰ 今日の記録忘れ',
            message: `${userName}さん、今日の練習記録をまだ入力していません。忘れずに記録をお願いします。`,
            expires_at: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(),
          };
        }
        break;

      // ✅ sRPE: 単発で高い
      case 'srpe_above':
        if (todaySRPE > 0 && todaySRPE >= rule.threshold) {
          shouldAlert = true;
          alertData = {
            ...alertData,
            priority: 'medium',
            title: '🔥 高負荷（sRPE）',
            message: `${userName}さんの今日の負荷（sRPE）が${todaySRPE}です。疲労が溜まりやすいので睡眠・補食・回復を意識してください。`,
            srpe_value: todaySRPE,
            expires_at: new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString(),
          };
        }
        break;

      // ✅ sRPE: 直近平均比で急増
      case 'srpe_spike_ratio':
        if (todaySRPE > 0 && last7Avg > 0 && spikeRatio >= rule.threshold) {
          shouldAlert = true;
          alertData = {
            ...alertData,
            priority: 'high',
            title: '⚡ 急増（sRPE）',
            message: `${userName}さんの今日の負荷（sRPE）が急増しています（${todaySRPE} / 直近平均${last7Avg} = ${spikeRatio}倍）。怪我リスクが上がりやすいので注意してください。`,
            srpe_value: todaySRPE,
            srpe_avg_7d: last7Avg,
            srpe_spike_ratio: spikeRatio,
            expires_at: new Date(now.getTime() + 72 * 60 * 60 * 1000).toISOString(),
          };
        }
        break;
    }

    if (shouldAlert) {
      alerts.push({
        id: `${userId}-${rule.type}-${Date.now()}`,
        ...alertData,
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
        icon: '🚨',
      };
    case 'medium':
      return {
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-200',
        textColor: 'text-yellow-800',
        iconColor: 'text-yellow-600',
        icon: '⚠️',
      };
    case 'low':
      return {
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200',
        textColor: 'text-blue-800',
        iconColor: 'text-blue-600',
        icon: '💡',
      };
    default:
      return {
        bgColor: 'bg-gray-50',
        borderColor: 'border-gray-200',
        textColor: 'text-gray-800',
        iconColor: 'text-gray-600',
        icon: 'ℹ️',
      };
  }
}

// アラートタイプの日本語ラベル
export function getAlertTypeLabel(type: Alert['type']): string {
  switch (type) {
    case 'high_risk':
      return '高リスク';
    case 'caution':
      return '注意';
    case 'low_load':
      return '低負荷';
    case 'no_data':
      return 'データなし';
    case 'reminder':
      return 'リマインダー';

    // ✅ sRPE追加
    case 'srpe_high':
      return '高負荷（sRPE）';
    case 'srpe_spike':
      return '急増（sRPE）';

    default:
      return '不明';
  }
}

// アラートの有効期限チェック
export function isAlertExpired(alert: Alert): boolean {
  if (!alert.expires_at) return false;
  return new Date() > new Date(alert.expires_at);
}

// アラートのフィルタリング
export function filterActiveAlerts(alerts: Alert[]): Alert[] {
  return alerts.filter((alert) => !alert.is_dismissed && !isAlertExpired(alert));
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