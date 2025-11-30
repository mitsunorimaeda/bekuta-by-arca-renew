import { TrainingRecord } from './supabase';

export interface ACWRData {
  date: string;
  acwr: number;
  acuteLoad: number;
  chronicLoad: number;
  riskLevel: 'low' | 'good' | 'caution' | 'high';
}

export function calculateACWR(records: TrainingRecord[]): ACWRData[] {
  if (records.length === 0) return [];

  // Sort records by date
  const sortedRecords = [...records].sort((a, b) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const acwrData: ACWRData[] = [];

  // 実際に練習記録がある日のみを対象にACWRを計算
  sortedRecords.forEach(currentRecord => {
    const currentDate = new Date(currentRecord.date);
    const dateStr = currentRecord.date;

    // Get records up to current date (including current date)
    const recordsUpToDate = sortedRecords.filter(r =>
      new Date(r.date) <= currentDate
    );

    if (recordsUpToDate.length === 0) return;

    // Calculate acute load (last 7 days including current day) - DAILY AVERAGE
    const acuteStartDate = new Date(currentDate);
    acuteStartDate.setDate(currentDate.getDate() - 6);

    const acuteRecords = recordsUpToDate.filter(r =>
      new Date(r.date) >= acuteStartDate && new Date(r.date) <= currentDate
    );

    const totalAcuteLoad = acuteRecords.reduce((sum, r) => sum + r.load, 0);
    const acuteLoad = totalAcuteLoad / 7; // Daily average over 7 days

    // Calculate chronic load (last 28 days including current day) - DAILY AVERAGE
    const chronicStartDate = new Date(currentDate);
    chronicStartDate.setDate(currentDate.getDate() - 27);

    const chronicRecords = recordsUpToDate.filter(r =>
      new Date(r.date) >= chronicStartDate && new Date(r.date) <= currentDate
    );

    if (chronicRecords.length === 0) return;

    const totalChronicLoad = chronicRecords.reduce((sum, r) => sum + r.load, 0);
    const chronicLoad = totalChronicLoad / 28; // Daily average over 28 days

    if (chronicLoad === 0) return;

    // ACWR = Daily average acute load / Daily average chronic load
    const acwr = acuteLoad / chronicLoad;

    // Determine risk level
    let riskLevel: ACWRData['riskLevel'];
    if (acwr > 1.5) riskLevel = 'high';
    else if (acwr >= 1.3) riskLevel = 'caution';
    else if (acwr >= 0.8) riskLevel = 'good';
    else riskLevel = 'low';

    acwrData.push({
      date: dateStr,
      acwr: Number(acwr.toFixed(2)),
      acuteLoad: Number(acuteLoad.toFixed(1)),
      chronicLoad: Number(chronicLoad.toFixed(1)),
      riskLevel
    });
  });

  return acwrData;
}

export function getRiskColor(riskLevel: ACWRData['riskLevel']): string {
  switch (riskLevel) {
    case 'high': return '#EF4444'; // Red
    case 'caution': return '#F59E0B'; // Yellow
    case 'good': return '#10B981'; // Green
    case 'low': return '#3B82F6'; // Blue
    default: return '#6B7280'; // Gray
  }
}

export function getRiskLabel(riskLevel: ACWRData['riskLevel']): string {
  switch (riskLevel) {
    case 'high': return '高リスク';
    case 'caution': return '注意';
    case 'good': return '良好';
    case 'low': return '低負荷';
    default: return '不明';
  }
}