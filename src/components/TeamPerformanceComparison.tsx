import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getDaysAgoJSTString } from '../lib/date';

interface AthletePerformance {
  userId: string;
  name: string;
  avgLoad: number; // 30日平均（日別じゃなく「レコード平均」）
  avgACWR: number; // 30日平均（athlete_acwr_daily の valid だけ）
  totalSessions: number;
  performanceTests: number;
  trend: 'improving' | 'stable' | 'declining';
}

interface TeamPerformanceComparisonProps {
  teamId: string;
}

type MemberRow = {
  user_id: string;
  users?: { id: string; name: string | null } | null;
};

type TrainingRow = {
  user_id: string;
  date: string; // YYYY-MM-DD
  load: number | null;
};

type ACWRDailyRow = {
  user_id: string;
  date: string;
  acwr: number | null;
  is_valid?: boolean | null;
};

type PerfRow = {
  user_id: string;
  id: string;
  date: string;
};

export function TeamPerformanceComparison({ teamId }: TeamPerformanceComparisonProps) {
  const [athleteData, setAthleteData] = useState<AthletePerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'load' | 'acwr'>('load');

  useEffect(() => {
    fetchTeamPerformance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  const fetchTeamPerformance = async () => {
    try {
      setLoading(true);

      // ① メンバー取得（名前もここで取る）
      const { data: members, error: membersError } = await supabase
        .from('team_member_assignments')
        .select('user_id, users!inner(id, name)')
        .eq('team_id', teamId);

      if (membersError) throw membersError;

      const memberRows = (members || []) as MemberRow[];
      const userIds = memberRows.map((m) => m.user_id);

      if (userIds.length === 0) {
        setAthleteData([]);
        return;
      }

      const thirtyDaysAgo = getDaysAgoJSTString(30);
      const today = getDaysAgoJSTString(0);

      // ② まとめて取得（training / acwr / performance）
      const [trainRes, acwrRes, perfRes] = await Promise.all([
        supabase
          .from('training_records')
          .select('user_id, date, load')
          .in('user_id', userIds)
          .gte('date', thirtyDaysAgo)
          .lte('date', today)
          .order('date', { ascending: true }),

        supabase
          .from('athlete_acwr_daily')
          .select('user_id, date, acwr, is_valid')
          .in('user_id', userIds)
          .gte('date', thirtyDaysAgo)
          .lte('date', today),

        supabase
          .from('performance_records')
          .select('id, user_id, date')
          .in('user_id', userIds)
          .gte('date', thirtyDaysAgo)
          .lte('date', today),
      ]);

      if (trainRes.error) throw trainRes.error;
      if (acwrRes.error) throw acwrRes.error;
      if (perfRes.error) throw perfRes.error;

      const trainings = (trainRes.data || []) as TrainingRow[];
      const acwrs = (acwrRes.data || []) as ACWRDailyRow[];
      const perf = (perfRes.data || []) as PerfRow[];

      // ③ index: userId -> data
      const nameById = new Map<string, string>();
      for (const m of memberRows) {
        const n = (m.users as any)?.name ?? null;
        nameById.set(m.user_id, n || 'unknown');
      }

      const trainingByUser = new Map<string, TrainingRow[]>();
      for (const r of trainings) {
        const arr = trainingByUser.get(r.user_id) ?? [];
        arr.push(r);
        trainingByUser.set(r.user_id, arr);
      }

      const acwrByUser = new Map<string, ACWRDailyRow[]>();
      for (const r of acwrs) {
        const arr = acwrByUser.get(r.user_id) ?? [];
        arr.push(r);
        acwrByUser.set(r.user_id, arr);
      }

      const perfCountByUser = new Map<string, number>();
      for (const r of perf) {
        perfCountByUser.set(r.user_id, (perfCountByUser.get(r.user_id) ?? 0) + 1);
      }

      // ④ 集計（userごと）
      const performances: AthletePerformance[] = userIds.map((userId) => {
        const userName = nameById.get(userId) ?? 'unknown';

        const userTraining = trainingByUser.get(userId) ?? [];

        // avgLoad（training_records のレコード平均）
        const totalLoad = userTraining.reduce((sum, r) => sum + (r.load ?? 0), 0);
        const avgLoad = userTraining.length > 0 ? totalLoad / userTraining.length : 0;

        // avgACWR（athlete_acwr_daily の valid のみ平均）
        const userAcwrRows = acwrByUser.get(userId) ?? [];
        const validAcwr = userAcwrRows
          .map((r) => ({
            acwr:
              typeof r.acwr === 'number' && Number.isFinite(r.acwr) ? r.acwr : null,
            valid: r.is_valid === true,
          }))
          .filter((x) => x.acwr != null && x.valid)
          .map((x) => x.acwr as number);

        const avgACWR =
          validAcwr.length > 0
            ? validAcwr.reduce((sum, v) => sum + v, 0) / validAcwr.length
            : 0;

        // trend（loadの前半/後半平均で判定：元ロジック踏襲）
        let trend: 'improving' | 'stable' | 'declining' = 'stable';
        if (userTraining.length >= 14) {
          const mid = Math.floor(userTraining.length / 2);
          const firstHalf = userTraining.slice(0, mid);
          const secondHalf = userTraining.slice(mid);

          const firstAvg =
            firstHalf.reduce((sum, r) => sum + (r.load ?? 0), 0) /
            Math.max(firstHalf.length, 1);
          const secondAvg =
            secondHalf.reduce((sum, r) => sum + (r.load ?? 0), 0) /
            Math.max(secondHalf.length, 1);

          if (secondAvg > firstAvg * 1.1) trend = 'improving';
          else if (secondAvg < firstAvg * 0.9) trend = 'declining';
        }

        return {
          userId,
          name: userName,
          avgLoad,
          avgACWR,
          totalSessions: userTraining.length,
          performanceTests: perfCountByUser.get(userId) ?? 0,
          trend,
        };
      });

      // デフォは負荷で並べ替え（今のUIと同じ）
      setAthleteData(performances.sort((a, b) => b.avgLoad - a.avgLoad));
    } catch (error) {
      console.error('Error fetching team performance:', error);
      setAthleteData([]);
    } finally {
      setLoading(false);
    }
  };

  const chartData = useMemo(
    () =>
      athleteData.map((athlete) => ({
        name: athlete.name.split(' ')[0],
        load: Number(athlete.avgLoad.toFixed(1)),
        acwr: Number(athlete.avgACWR.toFixed(2)),
        sessions: athlete.totalSessions,
      })),
    [athleteData]
  );

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
          <XAxis dataKey="name" stroke="#6B7280" style={{ fontSize: '12px' }} />
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
          <div key={athlete.userId} className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
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