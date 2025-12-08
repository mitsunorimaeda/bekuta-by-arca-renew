// trendAnalysis.ts の一番上あたりに追加
import { formatDateToJST } from './date';

export interface TrendData {
  date: string;
  acwr: number;
  acuteLoad: number;
  chronicLoad: number;
  riskLevel: string;
  weekNumber?: number;
  monthName?: string;
}

export interface WeeklyTrend {
  weekNumber: number;
  startDate: string;
  endDate: string;
  averageACWR: number;
  maxACWR: number;
  minACWR: number;
  totalLoad: number;
  trainingDays: number;
  riskDays: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  trendPercentage: number;
}

export interface MonthlyTrend {
  month: number;
  year: number;
  monthName: string;
  averageACWR: number;
  maxACWR: number;
  minACWR: number;
  totalLoad: number;
  trainingDays: number;
  riskDays: number;
  weeklyBreakdown: WeeklyTrend[];
  trend: 'increasing' | 'decreasing' | 'stable';
  trendPercentage: number;
}

export interface TrendAnalysis {
  weeklyTrends: WeeklyTrend[];
  monthlyTrends: MonthlyTrend[];
  overallTrend: {
    direction: 'increasing' | 'decreasing' | 'stable';
    percentage: number;
    description: string;
  };
  insights: TrendInsight[];
  recommendations: string[];
}

export interface TrendInsight {
  type: 'warning' | 'positive' | 'neutral';
  title: string;
  description: string;
  value?: number;
  comparison?: string;
}

// 週番号を取得（月曜日始まり）
export function getWeekNumber(date: Date): number {
  // 日付をコピーして操作
  const d = new Date(date.getTime());
  
  // 月曜日を0とする曜日を取得（日曜日=6, 月曜日=0, 火曜日=1, ...）
  const dayOfWeek = (d.getDay() + 6) % 7;
  
  // その週の月曜日の日付を取得
  d.setDate(d.getDate() - dayOfWeek);
  
  // 年の1月1日
  const yearStart = new Date(d.getFullYear(), 0, 1);
  
  // 1月1日の曜日（月曜日=0）
  const yearStartDay = (yearStart.getDay() + 6) % 7;
  
  // 年の最初の月曜日
  const firstMonday = new Date(yearStart.getTime());
  firstMonday.setDate(1 - yearStartDay);
  
  // 週番号を計算
  const diffTime = d.getTime() - firstMonday.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const weekNumber = Math.floor(diffDays / 7) + 1;
  
  return Math.max(1, weekNumber);
}

// 週の開始日と終了日を取得（月曜日始まり）
export function getWeekDateRange(
  year: number,
  weekNumber: number
): { startDate: string; endDate: string } {
  // 年の1月1日
  const yearStart = new Date(year, 0, 1);

  // 1月1日の曜日（月曜日=0）
  const yearStartDay = (yearStart.getDay() + 6) % 7;

  // 年の最初の月曜日
  const firstMonday = new Date(year, 0, 1 - yearStartDay);

  // 指定された週の月曜日
  const weekStart = new Date(firstMonday.getTime());
  weekStart.setDate(firstMonday.getDate() + (weekNumber - 1) * 7);

  // その週の日曜日
  const weekEnd = new Date(weekStart.getTime());
  weekEnd.setDate(weekStart.getDate() + 6);

  return {
    // ❌ weekStart.toISOString().split('T')[0]
    // ✅ JSTローカルの日付文字列に統一
    startDate: formatDateToJST(weekStart),
    endDate: formatDateToJST(weekEnd),
  };
}

// 月名を取得
export function getMonthName(month: number): string {
  const months = [
    '1月', '2月', '3月', '4月', '5月', '6月',
    '7月', '8月', '9月', '10月', '11月', '12月'
  ];
  return months[month - 1];
}

// 週間トレンド分析（修正版：実際の練習記録日数のみカウント）
export function calculateWeeklyTrends(acwrData: TrendData[]): WeeklyTrend[] {
  if (acwrData.length === 0) return [];

  const weeklyData = new Map<string, TrendData[]>();
  
  // データを週ごとにグループ化（月曜日始まり）
  // 重要：acwrDataは既に実際の練習記録がある日のみのデータ
  acwrData.forEach(data => {
    const date = new Date(data.date);
    const year = date.getFullYear();
    const weekNumber = getWeekNumber(date);
    const key = `${year}-W${weekNumber.toString().padStart(2, '0')}`;
    
    if (!weeklyData.has(key)) {
      weeklyData.set(key, []);
    }
    weeklyData.get(key)!.push({
      ...data,
      weekNumber
    });
  });

  const weeklyTrends: WeeklyTrend[] = [];

  weeklyData.forEach((weekData, key) => {
    const [year, week] = key.split('-W');
    const weekNumber = parseInt(week);
    
    // 週の開始日と終了日を計算（月曜日始まり）
    const { startDate, endDate } = getWeekDateRange(parseInt(year), weekNumber);

    const acwrValues = weekData.map(d => d.acwr).filter(v => v > 0);
    const loads = weekData.map(d => d.acuteLoad + d.chronicLoad);
    const riskDays = weekData.filter(d => d.riskLevel === 'high' || d.riskLevel === 'caution').length;

    if (acwrValues.length > 0) {
      const averageACWR = acwrValues.reduce((sum, val) => sum + val, 0) / acwrValues.length;
      const maxACWR = Math.max(...acwrValues);
      const minACWR = Math.min(...acwrValues);
      const totalLoad = loads.reduce((sum, val) => sum + val, 0);

      // トレンド計算（週の前半と後半を比較）
      const firstHalf = acwrValues.slice(0, Math.ceil(acwrValues.length / 2));
      const secondHalf = acwrValues.slice(Math.ceil(acwrValues.length / 2));
      
      let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
      let trendPercentage = 0;

      if (firstHalf.length > 0 && secondHalf.length > 0) {
        const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;
        const change = ((secondAvg - firstAvg) / firstAvg) * 100;
        
        trendPercentage = Math.abs(change);
        if (Math.abs(change) > 5) {
          trend = change > 0 ? 'increasing' : 'decreasing';
        }
      }

      weeklyTrends.push({
        weekNumber,
        startDate,
        endDate,
        averageACWR: Number(averageACWR.toFixed(2)),
        maxACWR: Number(maxACWR.toFixed(2)),
        minACWR: Number(minACWR.toFixed(2)),
        totalLoad: Number(totalLoad.toFixed(1)),
        trainingDays: weekData.length, // 実際にRPE記録がある日数のみ
        riskDays,
        trend,
        trendPercentage: Number(trendPercentage.toFixed(1))
      });
    }
  });

  return weeklyTrends.sort((a, b) => {
    // 年と週番号でソート
    const aDate = new Date(a.startDate);
    const bDate = new Date(b.startDate);
    return aDate.getTime() - bDate.getTime();
  });
}

// 月間トレンド分析（修正版：実際の練習記録日数のみカウント）
export function calculateMonthlyTrends(acwrData: TrendData[]): MonthlyTrend[] {
  if (acwrData.length === 0) return [];

  const monthlyData = new Map<string, TrendData[]>();
  
  // データを月ごとにグループ化
  // 重要：acwrDataは既に実際の練習記録がある日のみのデータ
  acwrData.forEach(data => {
    const date = new Date(data.date);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const key = `${year}-${month.toString().padStart(2, '0')}`;
    
    if (!monthlyData.has(key)) {
      monthlyData.set(key, []);
    }
    monthlyData.get(key)!.push({
      ...data,
      monthName: getMonthName(month)
    });
  });

  const monthlyTrends: MonthlyTrend[] = [];

  monthlyData.forEach((monthData, key) => {
    const [year, month] = key.split('-');
    const monthNumber = parseInt(month);
    const monthName = getMonthName(monthNumber);
    
    const acwrValues = monthData.map(d => d.acwr).filter(v => v > 0);
    const loads = monthData.map(d => d.acuteLoad + d.chronicLoad);
    const riskDays = monthData.filter(d => d.riskLevel === 'high' || d.riskLevel === 'caution').length;

    if (acwrValues.length > 0) {
      const averageACWR = acwrValues.reduce((sum, val) => sum + val, 0) / acwrValues.length;
      const maxACWR = Math.max(...acwrValues);
      const minACWR = Math.min(...acwrValues);
      const totalLoad = loads.reduce((sum, val) => sum + val, 0);

      // 週間ブレイクダウンを計算
      const weeklyBreakdown = calculateWeeklyTrends(monthData);

      // 月間トレンド計算（月の前半と後半を比較）
      const firstHalf = acwrValues.slice(0, Math.ceil(acwrValues.length / 2));
      const secondHalf = acwrValues.slice(Math.ceil(acwrValues.length / 2));
      
      let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
      let trendPercentage = 0;

      if (firstHalf.length > 0 && secondHalf.length > 0) {
        const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;
        const change = ((secondAvg - firstAvg) / firstAvg) * 100;
        
        trendPercentage = Math.abs(change);
        if (Math.abs(change) > 10) {
          trend = change > 0 ? 'increasing' : 'decreasing';
        }
      }

      monthlyTrends.push({
        month: monthNumber,
        year: parseInt(year),
        monthName,
        averageACWR: Number(averageACWR.toFixed(2)),
        maxACWR: Number(maxACWR.toFixed(2)),
        minACWR: Number(minACWR.toFixed(2)),
        totalLoad: Number(totalLoad.toFixed(1)),
        trainingDays: monthData.length, // 実際にRPE記録がある日数のみ
        riskDays,
        weeklyBreakdown,
        trend,
        trendPercentage: Number(trendPercentage.toFixed(1))
      });
    }
  });

  return monthlyTrends.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.month - b.month;
  });
}

// 全体的なトレンド分析（決定論的な計算）
export function analyzeOverallTrend(weeklyTrends: WeeklyTrend[], monthlyTrends: MonthlyTrend[]): TrendAnalysis['overallTrend'] {
  if (weeklyTrends.length < 2) {
    return {
      direction: 'stable',
      percentage: 0,
      description: 'データが不足しているため、トレンドを分析できません。'
    };
  }

  // 最近4週間のトレンドを分析（決定論的）
  const recentWeeks = weeklyTrends.slice(-4);
  const acwrValues = recentWeeks.map(w => w.averageACWR);
  
  // 単純な線形トレンド計算
  const firstValue = acwrValues[0];
  const lastValue = acwrValues[acwrValues.length - 1];
  const change = ((lastValue - firstValue) / firstValue) * 100;
  
  let direction: 'increasing' | 'decreasing' | 'stable' = 'stable';
  if (Math.abs(change) > 5) {
    direction = change > 0 ? 'increasing' : 'decreasing';
  }
  
  const percentage = Math.abs(change);
  
  let description = '';
  if (direction === 'increasing') {
    description = `過去4週間でACWRが${percentage.toFixed(1)}%上昇傾向にあります。負荷管理に注意が必要です。`;
  } else if (direction === 'decreasing') {
    description = `過去4週間でACWRが${percentage.toFixed(1)}%下降傾向にあります。練習強度の見直しを検討してください。`;
  } else {
    description = 'ACWRは安定した範囲で推移しています。良好な負荷管理が維持されています。';
  }
  
  return {
    direction,
    percentage: Number(percentage.toFixed(1)),
    description
  };
}

// インサイト生成
export function generateInsights(weeklyTrends: WeeklyTrend[], monthlyTrends: MonthlyTrend[]): TrendInsight[] {
  const insights: TrendInsight[] = [];
  
  if (weeklyTrends.length === 0) {
    insights.push({
      type: 'neutral',
      title: 'データ不足',
      description: '十分なデータが蓄積されていません。継続的な記録をお願いします。'
    });
    return insights;
  }

  // 最近の週のリスク分析
  const recentWeek = weeklyTrends[weeklyTrends.length - 1];
  if (recentWeek.riskDays > 3) {
    insights.push({
      type: 'warning',
      title: '高リスク日数が多い',
      description: `最近の週は${recentWeek.riskDays}日間リスクレベルが高い状態でした。`,
      value: recentWeek.riskDays,
      comparison: '推奨: 週2日以下'
    });
  }

  // ACWR変動の分析
  if (recentWeek.maxACWR - recentWeek.minACWR > 1.0) {
    insights.push({
      type: 'warning',
      title: 'ACWR変動が大きい',
      description: `最近の週のACWR変動幅が${(recentWeek.maxACWR - recentWeek.minACWR).toFixed(2)}と大きくなっています。`,
      value: Number((recentWeek.maxACWR - recentWeek.minACWR).toFixed(2)),
      comparison: '推奨: 0.5以下'
    });
  }

  // 練習頻度の分析
  if (recentWeek.trainingDays < 3) {
    insights.push({
      type: 'warning',
      title: '練習頻度が低い',
      description: `最近の週の練習日数が${recentWeek.trainingDays}日と少なくなっています。`,
      value: recentWeek.trainingDays,
      comparison: '推奨: 週4-6日'
    });
  } else if (recentWeek.trainingDays >= 5 && recentWeek.averageACWR < 1.3) {
    insights.push({
      type: 'positive',
      title: '良好な練習バランス',
      description: `週${recentWeek.trainingDays}日の練習でACWR ${recentWeek.averageACWR}を維持しています。`,
      value: recentWeek.averageACWR
    });
  }

  // 月間比較（2ヶ月以上のデータがある場合）
  if (monthlyTrends.length >= 2) {
    const currentMonth = monthlyTrends[monthlyTrends.length - 1];
    const previousMonth = monthlyTrends[monthlyTrends.length - 2];
    
    const monthlyChange = ((currentMonth.averageACWR - previousMonth.averageACWR) / previousMonth.averageACWR) * 100;
    
    if (Math.abs(monthlyChange) > 15) {
      insights.push({
        type: monthlyChange > 0 ? 'warning' : 'neutral',
        title: '月間ACWR変化',
        description: `先月と比較してACWRが${Math.abs(monthlyChange).toFixed(1)}%${monthlyChange > 0 ? '上昇' : '下降'}しました。`,
        value: Number(Math.abs(monthlyChange).toFixed(1)),
        comparison: `前月: ${previousMonth.averageACWR}`
      });
    }
  }

  return insights;
}

// 推奨事項生成
export function generateRecommendations(weeklyTrends: WeeklyTrend[], monthlyTrends: MonthlyTrend[], insights: TrendInsight[]): string[] {
  const recommendations: string[] = [];
  
  if (weeklyTrends.length === 0) {
    recommendations.push('継続的な練習記録の入力を開始してください。');
    recommendations.push('週4-6日の練習頻度を目標にしてください。');
    recommendations.push('RPEと練習時間を正確に記録してください。');
    return recommendations;
  }

  const recentWeek = weeklyTrends[weeklyTrends.length - 1];
  
  // ACWR値に基づく推奨
  if (recentWeek.averageACWR > 1.5) {
    recommendations.push('ACWRが高いため、練習強度を段階的に下げることを検討してください。');
    recommendations.push('回復日を増やし、軽い有酸素運動を取り入れてください。');
  } else if (recentWeek.averageACWR < 0.8) {
    recommendations.push('ACWRが低いため、練習強度を段階的に上げることを検討してください。');
    recommendations.push('週の練習日数を1-2日増やすことを検討してください。');
  } else if (recentWeek.averageACWR >= 0.8 && recentWeek.averageACWR <= 1.3) {
    recommendations.push('現在の練習負荷は適切な範囲です。この状態を維持してください。');
  }

  // リスク日数に基づく推奨
  if (recentWeek.riskDays > 3) {
    recommendations.push('高リスク日が多いため、練習計画の見直しを行ってください。');
    recommendations.push('コーチやトレーナーと相談し、個別の負荷調整を検討してください。');
  }

  // 練習頻度に基づく推奨
  if (recentWeek.trainingDays < 3) {
    recommendations.push('練習頻度を増やし、週4-6日の練習を目標にしてください。');
  } else if (recentWeek.trainingDays > 6) {
    recommendations.push('練習頻度が高いため、適切な休息日を設けてください。');
  }

  // トレンドに基づく推奨
  if (recentWeek.trend === 'increasing' && recentWeek.trendPercentage > 10) {
    recommendations.push('ACWRの上昇傾向が見られます。負荷の急激な増加を避けてください。');
  }

  // 変動に基づく推奨
  if (recentWeek.maxACWR - recentWeek.minACWR > 1.0) {
    recommendations.push('ACWR変動が大きいため、より一貫した練習強度を心がけてください。');
  }

  // 一般的な推奨事項
  recommendations.push('毎日の練習記録を継続し、データの精度を保ってください。');
  recommendations.push('体調や疲労感も考慮して、柔軟に練習計画を調整してください。');

  return recommendations;
}

// 完全なトレンド分析
export function performTrendAnalysis(acwrData: TrendData[]): TrendAnalysis {
  const weeklyTrends = calculateWeeklyTrends(acwrData);
  const monthlyTrends = calculateMonthlyTrends(acwrData);
  const overallTrend = analyzeOverallTrend(weeklyTrends, monthlyTrends);
  const insights = generateInsights(weeklyTrends, monthlyTrends);
  const recommendations = generateRecommendations(weeklyTrends, monthlyTrends, insights);

  return {
    weeklyTrends,
    monthlyTrends,
    overallTrend,
    insights,
    recommendations
  };
}