import { supabase } from './supabase';
import { calculateACWR, ACWRData } from './acwr';
import { Alert } from './alerts';

export interface ReportPeriod {
  start: string;
  end: string;
  type: 'weekly' | 'monthly' | 'quarterly' | 'semi_annual' | 'annual' | 'custom';
}

export interface AthleteReportData {
  athleteId: string;
  athleteName: string;
  athleteEmail: string;

  // トレーニング負荷データ
  trainingRecords: {
    totalSessions: number;
    totalLoad: number;
    averageLoad: number;
    maxLoad: number;
    averageRPE: number;
    totalDuration: number;
  };

  // ACWR データ
  acwrData: {
    current: number;
    average: number;
    max: number;
    min: number;
    riskLevel: 'low' | 'medium' | 'high';
    daysInDangerZone: number;
    trend: 'improving' | 'stable' | 'declining';
  };

  // 体重データ
  weightData: {
    current: number | null;
    average: number | null;
    change: number | null;
    changePercent: number | null;
    trend: 'increasing' | 'stable' | 'decreasing' | 'no_data';
  };

  // 睡眠データ
  sleepData: {
    averageHours: number | null;
    averageQuality: number | null;
    totalRecords: number;
    qualityTrend: 'improving' | 'stable' | 'declining' | 'no_data';
  };

  // モチベーションデータ
  motivationData: {
    averageMotivation: number | null;
    averageEnergy: number | null;
    averageStress: number | null;
    totalRecords: number;
    motivationTrend: 'improving' | 'stable' | 'declining' | 'no_data';
  };

  // パフォーマンスデータ
  performanceData: {
    totalTests: number;
    personalBests: number;
    improvements: number;
    declines: number;
  };

  // アラート
  alerts: {
    total: number;
    high: number;
    medium: number;
    low: number;
    resolved: number;
  };
}

export interface TeamReportSummary {
  teamId: string;
  teamName: string;
  period: ReportPeriod;
  generatedAt: string;

  // チーム統計
  totalAthletes: number;
  activeAthletes: number;

  // トレーニング統計
  teamAverageLoad: number;
  teamAverageACWR: number;

  // リスク統計
  highRiskCount: number;
  mediumRiskCount: number;
  lowRiskCount: number;

  // アラート統計
  totalAlerts: number;
  newAlerts: number;
  criticalAlerts: number;

  // 個別選手データ
  athletes: AthleteReportData[];

  // インサイトと推奨事項
  insights: string[];
  recommendations: string[];
}

export async function generateAthleteReport(
  athleteId: string,
  period: ReportPeriod
): Promise<AthleteReportData> {
  // 選手情報取得
  const { data: athlete } = await supabase
    .from('users')
    .select('*')
    .eq('id', athleteId)
    .single();

  if (!athlete) {
    throw new Error('Athlete not found');
  }

  // トレーニングデータ取得
  const { data: trainingRecords } = await supabase
    .from('training_records')
    .select('*')
    .eq('user_id', athleteId)
    .gte('date', period.start)
    .lte('date', period.end)
    .order('date', { ascending: true });

  const totalSessions = trainingRecords?.length || 0;
  const totalLoad = trainingRecords?.reduce((sum, r) => sum + r.load, 0) || 0;
  const totalDuration = trainingRecords?.reduce((sum, r) => sum + r.duration_min, 0) || 0;
  const averageLoad = totalSessions > 0 ? totalLoad / totalSessions : 0;
  const maxLoad = trainingRecords?.reduce((max, r) => Math.max(max, r.load), 0) || 0;
  const averageRPE = totalSessions > 0
    ? trainingRecords!.reduce((sum, r) => sum + r.rpe, 0) / totalSessions
    : 0;

  // ACWR計算
  const acwrResults = trainingRecords && trainingRecords.length > 0
    ? calculateACWR(trainingRecords)
    : [];

  const acwrValues = acwrResults.map(r => r.acwr).filter(v => v !== null) as number[];
  const currentACWR = acwrValues.length > 0 ? acwrValues[acwrValues.length - 1] : 0;
  const averageACWR = acwrValues.length > 0
    ? acwrValues.reduce((sum, v) => sum + v, 0) / acwrValues.length
    : 0;
  const maxACWR = acwrValues.length > 0 ? Math.max(...acwrValues) : 0;
  const minACWR = acwrValues.length > 0 ? Math.min(...acwrValues) : 0;

  const daysInDangerZone = acwrValues.filter(v => v < 0.8 || v > 1.3).length;
  const riskLevel: 'low' | 'medium' | 'high' =
    currentACWR > 1.5 || currentACWR < 0.7 ? 'high' :
    currentACWR > 1.3 || currentACWR < 0.8 ? 'medium' : 'low';

  const acwrTrend = acwrValues.length >= 3
    ? (acwrValues[acwrValues.length - 1] > acwrValues[Math.floor(acwrValues.length / 2)]
        ? 'improving' : 'declining')
    : 'stable';

  // 体重データ取得
  const { data: weightRecords } = await supabase
    .from('weight_records')
    .select('*')
    .eq('user_id', athleteId)
    .gte('date', period.start)
    .lte('date', period.end)
    .order('date', { ascending: true });

  const weights = weightRecords?.map(r => r.weight_kg) || [];
  const currentWeight = weights.length > 0 ? weights[weights.length - 1] : null;
  const firstWeight = weights.length > 0 ? weights[0] : null;
  const averageWeight = weights.length > 0
    ? weights.reduce((sum, w) => sum + w, 0) / weights.length
    : null;
  const weightChange = currentWeight && firstWeight ? currentWeight - firstWeight : null;
  const weightChangePercent = currentWeight && firstWeight && firstWeight > 0
    ? ((currentWeight - firstWeight) / firstWeight) * 100
    : null;
  const weightTrend: 'increasing' | 'stable' | 'decreasing' | 'no_data' =
    !weightChange ? 'no_data' :
    Math.abs(weightChange) < 0.5 ? 'stable' :
    weightChange > 0 ? 'increasing' : 'decreasing';

  // 睡眠データ取得
  const { data: sleepRecords } = await supabase
    .from('sleep_records')
    .select('*')
    .eq('user_id', athleteId)
    .gte('date', period.start)
    .lte('date', period.end);

  const sleepHours = sleepRecords?.map(r => r.sleep_hours) || [];
  const sleepQualities = sleepRecords?.filter(r => r.sleep_quality !== null).map(r => r.sleep_quality!) || [];
  const averageSleepHours = sleepHours.length > 0
    ? sleepHours.reduce((sum, h) => sum + h, 0) / sleepHours.length
    : null;
  const averageSleepQuality = sleepQualities.length > 0
    ? sleepQualities.reduce((sum, q) => sum + q, 0) / sleepQualities.length
    : null;

  const sleepQualityTrend: 'improving' | 'stable' | 'declining' | 'no_data' =
    sleepQualities.length < 3 ? 'no_data' :
    sleepQualities[sleepQualities.length - 1] > sleepQualities[Math.floor(sleepQualities.length / 2)] ? 'improving' :
    sleepQualities[sleepQualities.length - 1] < sleepQualities[Math.floor(sleepQualities.length / 2)] ? 'declining' : 'stable';

  // モチベーションデータ取得
  const { data: motivationRecords } = await supabase
    .from('motivation_records')
    .select('*')
    .eq('user_id', athleteId)
    .gte('date', period.start)
    .lte('date', period.end);

  const motivations = motivationRecords?.map(r => r.motivation_level) || [];
  const energies = motivationRecords?.map(r => r.energy_level) || [];
  const stresses = motivationRecords?.map(r => r.stress_level) || [];

  const averageMotivation = motivations.length > 0
    ? motivations.reduce((sum, m) => sum + m, 0) / motivations.length
    : null;
  const averageEnergy = energies.length > 0
    ? energies.reduce((sum, e) => sum + e, 0) / energies.length
    : null;
  const averageStress = stresses.length > 0
    ? stresses.reduce((sum, s) => sum + s, 0) / stresses.length
    : null;

  const motivationTrend: 'improving' | 'stable' | 'declining' | 'no_data' =
    motivations.length < 3 ? 'no_data' :
    motivations[motivations.length - 1] > motivations[Math.floor(motivations.length / 2)] ? 'improving' :
    motivations[motivations.length - 1] < motivations[Math.floor(motivations.length / 2)] ? 'declining' : 'stable';

  // パフォーマンスデータ取得
  const { data: performanceRecords } = await supabase
    .from('performance_records')
    .select('*, performance_test_types(*)')
    .eq('user_id', athleteId)
    .gte('date', period.start)
    .lte('date', period.end);

  const totalTests = performanceRecords?.length || 0;

  let personalBests = 0;
  let improvements = 0;
  let declines = 0;

  // パフォーマンスの改善・低下を計算（簡易版）
  if (performanceRecords && performanceRecords.length > 0) {
    const testTypeGroups = new Map<string, any[]>();
    performanceRecords.forEach(record => {
      const typeId = record.test_type_id;
      if (!testTypeGroups.has(typeId)) {
        testTypeGroups.set(typeId, []);
      }
      testTypeGroups.get(typeId)!.push(record);
    });

    testTypeGroups.forEach(records => {
      if (records.length >= 2) {
        const sorted = [...records].sort((a, b) =>
          new Date(a.date).getTime() - new Date(b.date).getTime()
        );
        const first = sorted[0];
        const last = sorted[sorted.length - 1];

        const firstValue = first.values.result;
        const lastValue = last.values.result;

        if (firstValue && lastValue) {
          if (lastValue > firstValue) improvements++;
          else if (lastValue < firstValue) declines++;
        }
      }
    });
  }

  // アラート取得
  const { data: alerts } = await supabase
    .from('alerts')
    .select('*')
    .eq('user_id', athleteId)
    .gte('created_at', period.start)
    .lte('created_at', period.end);

  const totalAlerts = alerts?.length || 0;
  const highAlerts = alerts?.filter(a => a.priority === 'high').length || 0;
  const mediumAlerts = alerts?.filter(a => a.priority === 'medium').length || 0;
  const lowAlerts = alerts?.filter(a => a.priority === 'low').length || 0;
  const resolvedAlerts = alerts?.filter(a => a.is_resolved).length || 0;

  return {
    athleteId: athlete.id,
    athleteName: athlete.name,
    athleteEmail: athlete.email,
    trainingRecords: {
      totalSessions,
      totalLoad,
      averageLoad,
      maxLoad,
      averageRPE,
      totalDuration
    },
    acwrData: {
      current: currentACWR,
      average: averageACWR,
      max: maxACWR,
      min: minACWR,
      riskLevel,
      daysInDangerZone,
      trend: acwrTrend
    },
    weightData: {
      current: currentWeight,
      average: averageWeight,
      change: weightChange,
      changePercent: weightChangePercent,
      trend: weightTrend
    },
    sleepData: {
      averageHours: averageSleepHours,
      averageQuality: averageSleepQuality,
      totalRecords: sleepRecords?.length || 0,
      qualityTrend: sleepQualityTrend
    },
    motivationData: {
      averageMotivation,
      averageEnergy,
      averageStress,
      totalRecords: motivationRecords?.length || 0,
      motivationTrend
    },
    performanceData: {
      totalTests,
      personalBests,
      improvements,
      declines
    },
    alerts: {
      total: totalAlerts,
      high: highAlerts,
      medium: mediumAlerts,
      low: lowAlerts,
      resolved: resolvedAlerts
    }
  };
}

export async function generateTeamReport(
  teamId: string,
  period: ReportPeriod
): Promise<TeamReportSummary> {
  // チーム情報取得
  const { data: team } = await supabase
    .from('teams')
    .select('*')
    .eq('id', teamId)
    .single();

  if (!team) {
    throw new Error('Team not found');
  }

  // チームの選手取得
  const { data: athletes } = await supabase
    .from('users')
    .select('*')
    .eq('team_id', teamId)
    .eq('role', 'athlete');

  const totalAthletes = athletes?.length || 0;

  // 各選手のレポート生成
  const athleteReports: AthleteReportData[] = [];

  if (athletes) {
    for (const athlete of athletes) {
      try {
        const report = await generateAthleteReport(athlete.id, period);
        athleteReports.push(report);
      } catch (error) {
        console.error(`Error generating report for athlete ${athlete.id}:`, error);
      }
    }
  }

  const activeAthletes = athleteReports.filter(r => r.trainingRecords.totalSessions > 0).length;

  // チーム統計計算
  const teamAverageLoad = activeAthletes > 0
    ? athleteReports.reduce((sum, r) => sum + r.trainingRecords.averageLoad, 0) / activeAthletes
    : 0;

  const athletesWithACWR = athleteReports.filter(r => r.acwrData.current > 0);
  const teamAverageACWR = athletesWithACWR.length > 0
    ? athletesWithACWR.reduce((sum, r) => sum + r.acwrData.current, 0) / athletesWithACWR.length
    : 0;

  const highRiskCount = athleteReports.filter(r => r.acwrData.riskLevel === 'high').length;
  const mediumRiskCount = athleteReports.filter(r => r.acwrData.riskLevel === 'medium').length;
  const lowRiskCount = athleteReports.filter(r => r.acwrData.riskLevel === 'low').length;

  const totalAlerts = athleteReports.reduce((sum, r) => sum + r.alerts.total, 0);
  const criticalAlerts = athleteReports.reduce((sum, r) => sum + r.alerts.high, 0);

  // インサイト生成
  const insights: string[] = [];
  const recommendations: string[] = [];

  if (teamAverageACWR > 1.3) {
    insights.push(`チーム平均ACWR（${teamAverageACWR.toFixed(2)}）が推奨範囲を超えています。全体的にトレーニング負荷が高い状態です。`);
    recommendations.push('チーム全体のトレーニング強度を見直し、適切な休息日を設けることを推奨します。');
  } else if (teamAverageACWR < 0.8) {
    insights.push(`チーム平均ACWR（${teamAverageACWR.toFixed(2)}）が推奨範囲を下回っています。トレーニング負荷が不足している可能性があります。`);
    recommendations.push('選手のコンディションを確認しながら、段階的にトレーニング負荷を増やすことを検討してください。');
  } else {
    insights.push(`チーム平均ACWR（${teamAverageACWR.toFixed(2)}）は適切な範囲内です。`);
  }

  if (highRiskCount > 0) {
    insights.push(`${highRiskCount}名の選手が高リスク状態です。個別対応が必要です。`);
    recommendations.push(`高リスク選手: ${athleteReports.filter(r => r.acwrData.riskLevel === 'high').map(r => r.athleteName).join(', ')} の負荷調整を優先してください。`);
  }

  if (criticalAlerts > 0) {
    insights.push(`${criticalAlerts}件の重要アラートが発生しています。`);
    recommendations.push('高優先度のアラートに対して迅速に対応してください。');
  }

  const lowSleepAthletes = athleteReports.filter(r =>
    r.sleepData.averageHours !== null && r.sleepData.averageHours < 7
  );
  if (lowSleepAthletes.length > 0) {
    insights.push(`${lowSleepAthletes.length}名の選手の平均睡眠時間が7時間未満です。`);
    recommendations.push(`睡眠不足の選手（${lowSleepAthletes.map(r => r.athleteName).join(', ')}）に対して、睡眠習慣の改善を指導してください。`);
  }

  const lowMotivationAthletes = athleteReports.filter(r =>
    r.motivationData.averageMotivation !== null && r.motivationData.averageMotivation < 3
  );
  if (lowMotivationAthletes.length > 0) {
    insights.push(`${lowMotivationAthletes.length}名の選手のモチベーションが低下しています。`);
    recommendations.push(`モチベーション低下が見られる選手（${lowMotivationAthletes.map(r => r.athleteName).join(', ')}）と個別面談を行うことを推奨します。`);
  }

  return {
    teamId: team.id,
    teamName: team.name,
    period,
    generatedAt: new Date().toISOString(),
    totalAthletes,
    activeAthletes,
    teamAverageLoad,
    teamAverageACWR,
    highRiskCount,
    mediumRiskCount,
    lowRiskCount,
    totalAlerts,
    newAlerts: totalAlerts,
    criticalAlerts,
    athletes: athleteReports,
    insights,
    recommendations
  };
}

export function getPeriodDates(periodType: ReportPeriod['type'], customStart?: string, customEnd?: string): ReportPeriod {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let start = new Date(end);

  switch (periodType) {
    case 'weekly':
      start.setDate(end.getDate() - 7);
      break;
    case 'monthly':
      start.setMonth(end.getMonth() - 1);
      break;
    case 'quarterly':
      start.setMonth(end.getMonth() - 3);
      break;
    case 'semi_annual':
      start.setMonth(end.getMonth() - 6);
      break;
    case 'annual':
      start.setFullYear(end.getFullYear() - 1);
      break;
    case 'custom':
      if (customStart && customEnd) {
        return {
          start: customStart,
          end: customEnd,
          type: 'custom'
        };
      }
      break;
  }

  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
    type: periodType
  };
}

export function getPeriodLabel(period: ReportPeriod): string {
  switch (period.type) {
    case 'weekly': return '過去1週間';
    case 'monthly': return '過去1ヶ月';
    case 'quarterly': return '過去3ヶ月';
    case 'semi_annual': return '過去6ヶ月';
    case 'annual': return '過去1年';
    case 'custom': return `${period.start} 〜 ${period.end}`;
    default: return '期間不明';
  }
}
