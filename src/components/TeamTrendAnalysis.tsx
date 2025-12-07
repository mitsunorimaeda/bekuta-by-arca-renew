import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface TeamTrendAnalysisProps {
  teamId: string;
}

interface TrendData {
  date: string;
  avgLoad: number;
  avgACWR: number;
  activeAthletes: number;
  highRiskCount: number;
}

interface Insight {
  type: 'success' | 'warning' | 'info';
  message: string;
}

export function TeamTrendAnalysis({ teamId }: TeamTrendAnalysisProps) {
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTeamTrends();
  }, [teamId]);

  const fetchTeamTrends = async () => {
    try {
      setLoading(true);

      const { data: members, error: membersError } = await supabase
        .from('team_member_assignments')
        .select('user_id')
        .eq('team_id', teamId);

      if (membersError) throw membersError;

      const userIds = members?.map((m) => m.user_id) || [];
      if (userIds.length === 0) {
        setLoading(false);
        return;
      }

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const trends: TrendData[] = [];

      for (let i = 0; i < 30; i++) {
        const date = new Date(thirtyDaysAgo);
        date.setDate(date.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];

        const { data: dayTraining } = await supabase
          .from('training_records')
          .select('user_id, load')
          .in('user_id', userIds)
          .eq('date', dateStr);

        const activeAthletes = new Set(dayTraining?.map((r) => r.user_id) || []).size;
        const totalLoad = dayTraining?.reduce((sum, r) => sum + r.load, 0) || 0;
        const avgLoad = activeAthletes > 0 ? totalLoad / activeAthletes : 0;

        const acwrValues: number[] = [];
        for (const userId of userIds) {
          const { data: userData } = await supabase
            .from('training_records')
            .select('load')
            .eq('user_id', userId)
            .gte('date', new Date(date.getTime() - 27 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
            .lte('date', dateStr);

          if (userData && userData.length >= 7) {
            const acute = userData.slice(-7).reduce((sum, r) => sum + r.load, 0);
            const chronic = userData.slice(0, -7).reduce((sum, r) => sum + r.load, 0) / 3;
            if (chronic > 0) {
              acwrValues.push(acute / chronic);
            }
          }
        }

        const avgACWR = acwrValues.length > 0
          ? acwrValues.reduce((sum, v) => sum + v, 0) / acwrValues.length
          : 0;

        const highRiskCount = acwrValues.filter((v) => v > 1.5 || v < 0.8).length;

        trends.push({
          date: dateStr,
          avgLoad,
          avgACWR,
          activeAthletes,
          highRiskCount,
        });
      }

      setTrendData(trends);
      generateInsights(trends, userIds.length);
    } catch (error) {
      console.error('Error fetching team trends:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateInsights = (trends: TrendData[], totalAthletes: number) => {
    const newInsights: Insight[] = [];

    const recentWeek = trends.slice(-7);
    const avgRecentLoad = recentWeek.reduce((sum, d) => sum + d.avgLoad, 0) / recentWeek.length;
    const avgRecentACWR = recentWeek.reduce((sum, d) => sum + d.avgACWR, 0) / recentWeek.length;
    const avgRecentActive = recentWeek.reduce((sum, d) => sum + d.activeAthletes, 0) / recentWeek.length;

    const previousWeek = trends.slice(-14, -7);
    const avgPreviousLoad = previousWeek.reduce((sum, d) => sum + d.avgLoad, 0) / previousWeek.length;

    if (avgRecentLoad > avgPreviousLoad * 1.3) {
      newInsights.push({
        type: 'warning',
        message: `チームのトレーニング負荷が今週${(((avgRecentLoad - avgPreviousLoad) / avgPreviousLoad) * 100).toFixed(1)}%増加しました。オーバートレーニングに注意してください。`,
      });
    }

    if (avgRecentACWR > 1.5) {
      newInsights.push({
        type: 'warning',
        message: `チーム平均ACWRが${avgRecentACWR.toFixed(2)}で、傷害リスクが高まっています。強度を減らすことを検討してください。`,
      });
    } else if (avgRecentACWR >= 0.8 && avgRecentACWR <= 1.3) {
      newInsights.push({
        type: 'success',
        message: `チームACWRが最適範囲内です(${avgRecentACWR.toFixed(2)})。トレーニング負荷が適切に管理されています。`,
      });
    }

    const participationRate = (avgRecentActive / totalAthletes) * 100;
    if (participationRate < 70) {
      newInsights.push({
        type: 'info',
        message: `アクティブにトレーニングしている選手は${participationRate.toFixed(1)}%のみです。欠席や傷害を確認してください。`,
      });
    } else if (participationRate > 90) {
      newInsights.push({
        type: 'success',
        message: `素晴らしい参加率です：${participationRate.toFixed(1)}%の選手がアクティブにトレーニングしています。`,
      });
    }

    const recentHighRisk = recentWeek.reduce((sum, d) => sum + d.highRiskCount, 0) / recentWeek.length;
    if (recentHighRisk > totalAthletes * 0.3) {
      newInsights.push({
        type: 'warning',
        message: `平均${recentHighRisk.toFixed(0)}名の選手が傷害リスクが高い状態です。個別のワークロードを見直してください。`,
      });
    }

    setInsights(newInsights);
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />;
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400" />;
      default:
        return <Info className="w-5 h-5 text-blue-600 dark:text-blue-400" />;
    }
  };

  const getInsightBgColor = (type: string) => {
    switch (type) {
      case 'success':
        return 'bg-green-50 dark:bg-green-900/20';
      case 'warning':
        return 'bg-orange-50 dark:bg-orange-900/20';
      default:
        return 'bg-blue-50 dark:bg-blue-900/20';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  const chartData = trendData.map((d) => ({
    date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    load: d.avgLoad.toFixed(1),
    acwr: d.avgACWR.toFixed(2),
    active: d.activeAthletes,
  }));

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
      <div className="flex items-center gap-2 mb-6">
        <TrendingUp className="w-6 h-6 text-purple-600 dark:text-purple-400" />
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
          チームトレンド分析（30日間）
        </h3>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
          <XAxis
            dataKey="date"
            stroke="#6B7280"
            style={{ fontSize: '12px' }}
          />
          <YAxis
            yAxisId="left"
            stroke="#6B7280"
            style={{ fontSize: '12px' }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            stroke="#6B7280"
            style={{ fontSize: '12px' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1F2937',
              border: 'none',
              borderRadius: '8px',
              color: '#F3F4F6',
            }}
          />
          <Legend />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="load"
            stroke="#3B82F6"
            strokeWidth={2}
            name="平均負荷"
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="acwr"
            stroke="#10B981"
            strokeWidth={2}
            name="平均ACWR"
          />
        </LineChart>
      </ResponsiveContainer>

      {insights.length > 0 && (
        <div className="mt-6 space-y-3">
          <h4 className="font-semibold text-gray-900 dark:text-white">インサイト</h4>
          {insights.map((insight, index) => (
            <div
              key={index}
              className={`flex items-start gap-3 p-4 rounded-lg ${getInsightBgColor(insight.type)}`}
            >
              {getInsightIcon(insight.type)}
              <p className="text-sm text-gray-800 dark:text-gray-200">{insight.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
