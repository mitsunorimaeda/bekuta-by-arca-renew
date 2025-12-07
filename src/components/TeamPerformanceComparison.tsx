import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Users, Trophy, TrendingUp } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface AthletePerformance {
  userId: string;
  name: string;
  avgLoad: number;
  avgACWR: number;
  totalSessions: number;
  performanceTests: number;
  trend: 'improving' | 'stable' | 'declining';
}

interface TeamPerformanceComparisonProps {
  teamId: string;
}

export function TeamPerformanceComparison({ teamId }: TeamPerformanceComparisonProps) {
  const [athleteData, setAthleteData] = useState<AthletePerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'load' | 'acwr'>('load');

  useEffect(() => {
    fetchTeamPerformance();
  }, [teamId]);

  const fetchTeamPerformance = async () => {
    try {
      setLoading(true);

      const { data: members, error: membersError } = await supabase
        .from('team_member_assignments')
        .select(`
          user_id,
          users!inner(id, name)
        `)
        .eq('team_id', teamId);

      if (membersError) throw membersError;

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const performances: AthletePerformance[] = [];

      for (const member of members || []) {
        const userId = member.user_id;
        const userName = (member.users as any).name;

        const { data: trainingData } = await supabase
          .from('training_records')
          .select('date, load')
          .eq('user_id', userId)
          .gte('date', thirtyDaysAgo)
          .order('date', { ascending: true });

        const { data: performanceTests } = await supabase
          .from('performance_records')
          .select('id')
          .eq('user_id', userId)
          .gte('date', thirtyDaysAgo);

        const totalLoad = trainingData?.reduce((sum, r) => sum + r.load, 0) || 0;
        const avgLoad = trainingData && trainingData.length > 0 ? totalLoad / trainingData.length : 0;

        let avgACWR = 0;
        if (trainingData && trainingData.length >= 28) {
          const recentWeek = trainingData.slice(-7);
          const previousWeeks = trainingData.slice(-28, -7);

          const acuteLoad = recentWeek.reduce((sum, r) => sum + r.load, 0);
          const chronicLoad = previousWeeks.reduce((sum, r) => sum + r.load, 0) / 3;

          avgACWR = chronicLoad > 0 ? acuteLoad / chronicLoad : 0;
        }

        let trend: 'improving' | 'stable' | 'declining' = 'stable';
        if (trainingData && trainingData.length >= 14) {
          const firstHalf = trainingData.slice(0, Math.floor(trainingData.length / 2));
          const secondHalf = trainingData.slice(Math.floor(trainingData.length / 2));

          const firstAvg = firstHalf.reduce((sum, r) => sum + r.load, 0) / firstHalf.length;
          const secondAvg = secondHalf.reduce((sum, r) => sum + r.load, 0) / secondHalf.length;

          if (secondAvg > firstAvg * 1.1) trend = 'improving';
          else if (secondAvg < firstAvg * 0.9) trend = 'declining';
        }

        performances.push({
          userId,
          name: userName,
          avgLoad,
          avgACWR,
          totalSessions: trainingData?.length || 0,
          performanceTests: performanceTests?.length || 0,
          trend,
        });
      }

      setAthleteData(performances.sort((a, b) => b.avgLoad - a.avgLoad));
    } catch (error) {
      console.error('Error fetching team performance:', error);
    } finally {
      setLoading(false);
    }
  };

  const chartData = athleteData.map((athlete) => ({
    name: athlete.name.split(' ')[0],
    load: athlete.avgLoad.toFixed(1),
    acwr: athlete.avgACWR.toFixed(2),
    sessions: athlete.totalSessions,
  }));

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving':
        return '↗️';
      case 'declining':
        return '↘️';
      default:
        return '→';
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'improving':
        return 'text-green-600 dark:text-green-400';
      case 'declining':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
            チームパフォーマンス比較
          </h3>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('load')}
            className={`px-3 py-1 text-sm rounded ${
              viewMode === 'load'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            トレーニング負荷
          </button>
          <button
            onClick={() => setViewMode('acwr')}
            className={`px-3 py-1 text-sm rounded ${
              viewMode === 'acwr'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            ACWR
          </button>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
          <XAxis
            dataKey="name"
            stroke="#6B7280"
            style={{ fontSize: '12px' }}
          />
          <YAxis stroke="#6B7280" style={{ fontSize: '12px' }} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1F2937',
              border: 'none',
              borderRadius: '8px',
              color: '#F3F4F6',
            }}
          />
          <Legend />
          <Bar
            dataKey={viewMode === 'load' ? 'load' : 'acwr'}
            fill="#3B82F6"
            name={viewMode === 'load' ? '平均トレーニング負荷' : '平均ACWR'}
          />
        </BarChart>
      </ResponsiveContainer>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {athleteData.map((athlete) => (
          <div
            key={athlete.userId}
            className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
          >
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold text-gray-900 dark:text-white">{athlete.name}</h4>
              <span className={`text-xl ${getTrendColor(athlete.trend)}`}>
                {getTrendIcon(athlete.trend)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-gray-600 dark:text-gray-400">平均負荷</p>
                <p className="font-semibold text-gray-900 dark:text-white">
                  {athlete.avgLoad.toFixed(1)}
                </p>
              </div>
              <div>
                <p className="text-gray-600 dark:text-gray-400">ACWR</p>
                <p className="font-semibold text-gray-900 dark:text-white">
                  {athlete.avgACWR.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-gray-600 dark:text-gray-400">セッション数</p>
                <p className="font-semibold text-gray-900 dark:text-white">
                  {athlete.totalSessions}
                </p>
              </div>
              <div>
                <p className="text-gray-600 dark:text-gray-400">テスト数</p>
                <p className="font-semibold text-gray-900 dark:text-white">
                  {athlete.performanceTests}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
