import React, { useEffect, useState } from 'react';
import { AlertTriangle, Activity, TrendingUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getTodayJSTString, getDaysAgoJSTString } from '../lib/date';

interface TeamMember {
  userId: string;
  name: string;
  riskScore: number;
  acwrRisk: number;
  workloadSpikeRisk: number;
  recentInjuries: number;
  currentACWR: number | null;
}

interface TeamInjuryRiskHeatmapProps {
  teamId: string;
}

type TeamMemberAssignmentRow = {
  user_id: string;
  // FK名を明示した埋め込みの戻り
  users: { id: string; name: string | null } | null;
};

export function TeamInjuryRiskHeatmap({ teamId }: TeamInjuryRiskHeatmapProps) {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'name' | 'risk'>('risk');

  useEffect(() => {
    fetchTeamRiskData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  const fetchTeamRiskData = async () => {
    try {
      setLoading(true);

      const { data: members, error: membersError } = await supabase
        .from('team_member_assignments')
        .select(
          `
            user_id,
            users:users!team_member_assignments_user_id_fkey (
              id,
              name
            )
          `
        )
        .eq('team_id', teamId);

      if (membersError) throw membersError;

      const today = getTodayJSTString();
      const memberRisks: TeamMember[] = [];

      for (const member of (members || []) as TeamMemberAssignmentRow[]) {
        const userId = member.user_id;

        // nameが無い/取れないケースの保険
        const userName =
          member.users?.name ||
          'unknown';

        const { data: riskData } = await supabase.rpc('calculate_injury_risk', {
          p_user_id: userId,
          p_date: today,
        });

        const { data: trainingData } = await supabase
          .from('training_records')
          .select('date, load')
          .eq('user_id', userId)
          .gte('date', getDaysAgoJSTString(27))
          .order('date', { ascending: false });

        const { data: injuries } = await supabase
          .from('injury_records')
          .select('id')
          .eq('user_id', userId)
          .gte('occurred_date', getDaysAgoJSTString(90));

        let currentACWR: number | null = null;
        if (trainingData && trainingData.length > 0) {
          const acute = trainingData
            .slice(0, 7)
            .reduce((sum, r) => sum + (r.load ?? 0), 0);

          const chronic =
            trainingData
              .slice(7, 28)
              .reduce((sum, r) => sum + (r.load ?? 0), 0) / 3;

          currentACWR = chronic > 0 ? acute / chronic : null;
        }

        memberRisks.push({
          userId,
          name: userName,
          riskScore: riskData || 0,
          acwrRisk: 0,
          workloadSpikeRisk: 0,
          recentInjuries: injuries?.length || 0,
          currentACWR,
        });
      }

      setTeamMembers(memberRisks);
    } catch (error) {
      console.error('Error fetching team risk data:', error);
      setTeamMembers([]);
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (score: number): string => {
    if (score >= 70) return 'bg-red-500';
    if (score >= 50) return 'bg-orange-500';
    if (score >= 30) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getRiskLabel = (score: number): string => {
    if (score >= 70) return '非常に高い';
    if (score >= 50) return '高い';
    if (score >= 30) return '中程度';
    return '低い';
  };

  const sortedMembers = [...teamMembers].sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    return b.riskScore - a.riskScore;
  });

  const highRiskCount = teamMembers.filter((m) => m.riskScore >= 50).length;
  const avgRisk =
    teamMembers.length > 0
      ? teamMembers.reduce((sum, m) => sum + m.riskScore, 0) / teamMembers.length
      : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
            チーム傷害リスクヒートマップ
          </h3>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setSortBy('risk')}
            className={`px-3 py-1 text-sm rounded ${
              sortBy === 'risk'
                ? 'bg-red-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            リスク順
          </button>
          <button
            onClick={() => setSortBy('name')}
            className={`px-3 py-1 text-sm rounded ${
              sortBy === 'name'
                ? 'bg-red-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            名前順
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
            <p className="text-sm text-red-800 dark:text-red-200 font-medium">高リスク選手</p>
          </div>
          <p className="text-3xl font-bold text-red-600 dark:text-red-400">{highRiskCount}</p>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <p className="text-sm text-blue-800 dark:text-blue-200 font-medium">チーム平均リスク</p>
          </div>
          <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
            {avgRisk.toFixed(1)}
          </p>
        </div>

        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
            <p className="text-sm text-green-800 dark:text-green-200 font-medium">総選手数</p>
          </div>
          <p className="text-3xl font-bold text-green-600 dark:text-green-400">
            {teamMembers.length}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {sortedMembers.map((member) => (
          <div
            key={member.userId}
            className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:shadow-md transition-shadow"
          >
            <div className="flex-1">
              <h4 className="font-semibold text-gray-900 dark:text-white">{member.name}</h4>
              <div className="flex items-center gap-4 mt-2 text-sm text-gray-600 dark:text-gray-400">
                {member.currentACWR !== null && <span>ACWR: {member.currentACWR.toFixed(2)}</span>}
                {member.recentInjuries > 0 && (
                  <span className="text-red-600 dark:text-red-400">
                    最近{member.recentInjuries}件の傷害
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm text-gray-600 dark:text-gray-400">リスクスコア</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {member.riskScore.toFixed(0)}
                </p>
              </div>
              <div
                className={`w-24 h-12 ${getRiskColor(member.riskScore)} rounded flex items-center justify-center text-white font-semibold text-sm`}
              >
                {getRiskLabel(member.riskScore)}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
        <h4 className="font-semibold text-gray-900 dark:text-white mb-2">リスクカテゴリー</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 rounded"></div>
            <span className="text-gray-700 dark:text-gray-300">低い (0-29)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-500 rounded"></div>
            <span className="text-gray-700 dark:text-gray-300">中程度 (30-49)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-orange-500 rounded"></div>
            <span className="text-gray-700 dark:text-gray-300">高い (50-69)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-500 rounded"></div>
            <span className="text-gray-700 dark:text-gray-300">非常に高い (70+)</span>
          </div>
        </div>
      </div>
    </div>
  );
}