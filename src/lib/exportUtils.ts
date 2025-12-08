import { TrainingRecord, User } from './supabase';
import { ACWRData } from './acwr';
import { TrendAnalysis } from './trendAnalysis';
import { formatDateJST, getTodayJST } from './date'; // ★ 追加

export interface ExportData {
  user: User;
  trainingRecords: TrainingRecord[];
  acwrData: ACWRData[];
  trendAnalysis?: TrendAnalysis;
  exportDate: string;
  dateRange: {
    start: string;
    end: string;
  };
}

export interface TeamExportData {
  teamName: string;
  athletes: Array<{
    user: User;
    trainingRecords: TrainingRecord[];
    acwrData: ACWRData[];
    latestACWR?: number;
    riskLevel?: string;
  }>;
  teamSummary: {
    totalAthletes: number;
    activeAthletes: number;
    averageACWR: number;
    highRiskAthletes: number;
  };
  exportDate: string;
  dateRange: {
    start: string;
    end: string;
  };
}

// CSV エクスポート関数
export function exportToCSV(data: ExportData): void {
  const { user, trainingRecords, acwrData, exportDate, dateRange } = data;
  
  // ヘッダー行
  const headers = [
    '日付',
    'RPE',
    '練習時間(分)',
    '負荷',
    'ACWR',
    '急性負荷',
    '慢性負荷',
    'リスクレベル'
  ];
  
  // データ行を作成
  const rows = trainingRecords.map(record => {
    const acwrEntry = acwrData.find(a => a.date === record.date);
    return [
      record.date,
      record.rpe.toString(),
      record.duration_min.toString(),
      (record.load ?? '').toString(),
      acwrEntry?.acwr?.toString() || '',
      acwrEntry?.acuteLoad?.toString() || '',
      acwrEntry?.chronicLoad?.toString() || '',
      acwrEntry?.riskLevel || ''
    ];
  });
  
  // CSV文字列を作成
  const csvContent = [
    `# ${user.name}さんの練習記録`,
    `# エクスポート日時: ${exportDate}`,
    `# 期間: ${dateRange.start} ～ ${dateRange.end}`,
    '',
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');
  
  // BOMを追加してUTF-8エンコーディングを明示
  const bom = '\uFEFF';
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
  
  // ダウンロード
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${user.name}_練習記録_${dateRange.start}_${dateRange.end}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// チームCSVエクスポート関数
export function exportTeamToCSV(data: TeamExportData): void {
  const { teamName, athletes, teamSummary, exportDate, dateRange } = data;
  
  // ヘッダー行
  const headers = [
    '選手名',
    '日付',
    'RPE',
    '練習時間(分)',
    '負荷',
    'ACWR',
    '急性負荷',
    '慢性負荷',
    'リスクレベル'
  ];
  
  // データ行を作成
  const rows: string[][] = [];
  
  athletes.forEach(athlete => {
    athlete.trainingRecords.forEach(record => {
      const acwrEntry = athlete.acwrData.find(a => a.date === record.date);
      rows.push([
        athlete.user.name,
        record.date,
        record.rpe.toString(),
        record.duration_min.toString(),
        (record.load ?? '').toString(),
        acwrEntry?.acwr?.toString() || '',
        acwrEntry?.acuteLoad?.toString() || '',
        acwrEntry?.chronicLoad?.toString() || '',
        acwrEntry?.riskLevel || ''
      ]);
    });
  });
  
  // CSV文字列を作成
  const csvContent = [
    `# ${teamName} チーム練習記録`,
    `# エクスポート日時: ${exportDate}`,
    `# 期間: ${dateRange.start} ～ ${dateRange.end}`,
    `# 総選手数: ${teamSummary.totalAthletes}名`,
    `# アクティブ選手数: ${teamSummary.activeAthletes}名`,
    `# チーム平均ACWR: ${teamSummary.averageACWR}`,
    `# 高リスク選手数: ${teamSummary.highRiskAthletes}名`,
    '',
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');
  
  // BOMを追加してUTF-8エンコーディングを明示
  const bom = '\uFEFF';
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
  
  // ダウンロード
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${teamName}_チーム練習記録_${dateRange.start}_${dateRange.end}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// JSON エクスポート関数（詳細データ用）
export function exportToJSON(data: ExportData): void {
  const { user, exportDate, dateRange } = data;
  
  const jsonContent = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json' });
  
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${user.name}_詳細データ_${dateRange.start}_${dateRange.end}.json`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// 日付範囲のヘルパー関数（JST対応版）
export function getDateRange(
  period: 'week' | 'month' | 'quarter' | 'custom',
  customStart?: string,
  customEnd?: string
) {
  const today = getTodayJST();         // ★ ベースはJSTの「今日」
  let start: Date;
  let end: Date = new Date(today);

  switch (period) {
    case 'week': {
      start = new Date(today);
      start.setDate(start.getDate() - 7);
      break;
    }
    case 'month': {
      start = new Date(today);
      start.setMonth(start.getMonth() - 1);
      break;
    }
    case 'quarter': {
      start = new Date(today);
      start.setMonth(start.getMonth() - 3);
      break;
    }
    case 'custom': {
      if (customStart && customEnd) {
        // custom はユーザーが選んだ YYYY-MM-DD をそのまま使う
        return {
          start: customStart,
          end: customEnd
        };
      } else {
        throw new Error('カスタム期間には開始日と終了日が必要です');
      }
    }
    default: {
      start = new Date(today);
      start.setMonth(start.getMonth() - 1);
    }
  }

  return {
    start: formatDateJST(start),  // ★ JSTベースで YYYY-MM-DD を作成
    end: formatDateJST(end)
  };
}

// リスクレベルの日本語変換
export function getRiskLevelJapanese(riskLevel: string): string {
  switch (riskLevel) {
    case 'high': return '高リスク';
    case 'caution': return '注意';
    case 'good': return '良好';
    case 'low': return '低負荷';
    default: return '不明';
  }
}