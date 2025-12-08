import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { calculateACWR } from '../lib/acwr';
import { performTrendAnalysis, TrendAnalysis, TrendData } from '../lib/trendAnalysis';
import { getTodayJST, formatDateToJST } from '../lib/date';

export function useTrendAnalysis(targetId: string | null, analysisType: 'user' | 'team' = 'user') {
  const [trendAnalysis, setTrendAnalysis] = useState<TrendAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAndAnalyzeTrends = useCallback(async () => {
    if (!targetId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let trendData: TrendData[] = [];
    
      // ▼ ここを書き換え
      const threeMonthsAgoDate = getTodayJST();
      threeMonthsAgoDate.setUTCMonth(threeMonthsAgoDate.getUTCMonth() - 3);
      const threeMonthsAgoStr = formatDateToJST(threeMonthsAgoDate);
      // ▲ JST基準で「3ヶ月前のYYYY-MM-DD」
    
      if (analysisType === 'user') {
        // 個人ユーザーの分析
        const { data: trainingRecords, error: recordsError } = await supabase
          .from('training_records')
          .select('*')
          .eq('user_id', targetId)
          .gte('date', threeMonthsAgoStr)   // ← ここも変更
          .order('date', { ascending: true });
    
        if (recordsError) throw recordsError;
    
        if (trainingRecords && trainingRecords.length > 0) {
          const acwrData = calculateACWR(trainingRecords);
          
          trendData = acwrData.map(data => ({
            date: data.date,
            acwr: data.acwr,
            acuteLoad: data.acuteLoad,
            chronicLoad: data.chronicLoad,
            riskLevel: data.riskLevel
          }));
        }
      } else {
        // チーム分析
        const { data: athletes, error: athletesError } = await supabase
          .from('users')
          .select('id')
          .eq('role', 'athlete')
          .eq('team_id', targetId);
    
        if (athletesError) throw athletesError;
    
        if (!athletes || athletes.length === 0) {
          setError('このチームには選手が登録されていません。');
          setTrendAnalysis(null);
          setLoading(false);
          return;
        }
    
        // （この先はそのままでOK）

        const athleteIds = athletes.map(athlete => athlete.id);

        // 全選手の練習記録を取得
        // JST の今日を基準に 3 ヶ月前を算出
        const threeMonthsAgoDate = getTodayJST();
        threeMonthsAgoDate.setUTCMonth(threeMonthsAgoDate.getUTCMonth() - 3);
        const threeMonthsAgoStr = formatDateToJST(threeMonthsAgoDate);

        const { data: trainingRecords, error: recordsError } = await supabase
          .from('training_records')
          .select('*')
          .in('user_id', athleteIds)
          .gte('date', threeMonthsAgoStr)  // ← JST版日付
          .order('date', { ascending: true });

        if (recordsError) throw recordsError;

        if (trainingRecords && trainingRecords.length > 0) {
          // 各選手のACWRを計算
          const athleteACWRData: { [athleteId: string]: any[] } = {};
          
          for (const athleteId of athleteIds) {
            const athleteRecords = trainingRecords.filter(r => r.user_id === athleteId);
            if (athleteRecords.length > 0) {
              athleteACWRData[athleteId] = calculateACWR(athleteRecords);
            }
          }

          // 日付ごとにチーム平均を計算
          const dateMap = new Map<string, { 
            acwrs: number[], 
            acuteLoads: number[], 
            chronicLoads: number[], 
            riskLevels: string[] 
          }>();
          
          Object.values(athleteACWRData).forEach(athleteData => {
            athleteData.forEach(dayData => {
              if (!dateMap.has(dayData.date)) {
                dateMap.set(dayData.date, { 
                  acwrs: [], 
                  acuteLoads: [], 
                  chronicLoads: [], 
                  riskLevels: [] 
                });
              }
              const dateData = dateMap.get(dayData.date)!;
              if (dayData.acwr > 0) {
                dateData.acwrs.push(dayData.acwr);
                dateData.acuteLoads.push(dayData.acuteLoad);
                dateData.chronicLoads.push(dayData.chronicLoad);
                dateData.riskLevels.push(dayData.riskLevel);
              }
            });
          });

          // 平均値を計算してtrendDataを作成
          trendData = Array.from(dateMap.entries())
            .filter(([_, data]) => data.acwrs.length > 0)
            .map(([date, data]) => {
              const avgACWR = data.acwrs.reduce((sum, val) => sum + val, 0) / data.acwrs.length;
              const avgAcuteLoad = data.acuteLoads.reduce((sum, val) => sum + val, 0) / data.acuteLoads.length;
              const avgChronicLoad = data.chronicLoads.reduce((sum, val) => sum + val, 0) / data.chronicLoads.length;
              
              // リスクレベルは最も高いものを採用
              const riskPriority = { 'high': 4, 'caution': 3, 'good': 2, 'low': 1 };
              const highestRisk = data.riskLevels.reduce((highest, current) => 
                riskPriority[current as keyof typeof riskPriority] > riskPriority[highest as keyof typeof riskPriority] ? current : highest
              );

              return {
                date,
                acwr: Number(avgACWR.toFixed(2)),
                acuteLoad: Number(avgAcuteLoad.toFixed(1)),
                chronicLoad: Number(avgChronicLoad.toFixed(1)),
                riskLevel: highestRisk
              };
            })
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        }
      }

      // データが不足している場合
      if (trendData.length < 14) {
        const message = analysisType === 'team' 
          ? 'チームの練習データが不足しています。選手に継続的な練習記録の入力を促してください。'
          : '十分なデータがありません。継続的な練習記録の入力をお願いします。';
        setError(message);
        setTrendAnalysis(null);
      } else {
        // トレンド分析を実行
        const analysis = performTrendAnalysis(trendData);
        setTrendAnalysis(analysis);
        setError(null);
      }

    } catch (err: any) {
      console.error('Error analyzing trends:', err);
      setError('トレンド分析中にエラーが発生しました。');
      setTrendAnalysis(null);
    } finally {
      setLoading(false);
    }
  }, [targetId, analysisType]);

  useEffect(() => {
    fetchAndAnalyzeTrends();
  }, [fetchAndAnalyzeTrends]);

  const refreshAnalysis = useCallback(() => {
    fetchAndAnalyzeTrends();
  }, [fetchAndAnalyzeTrends]);

  return {
    trendAnalysis,
    loading,
    error,
    refreshAnalysis
  };
}