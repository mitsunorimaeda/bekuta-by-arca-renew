import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface TeamAchievement {
  id: string;
  team_id: string;
  achievement_type: string;
  title: string;
  description: string;
  achieved_at: string;
  metadata: any;
  celebrated: boolean;
}

export function useTeamAchievements(teamId: string | null) {
  const [achievements, setAchievements] = useState<TeamAchievement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (teamId) {
      loadTeamAchievements();
    }
  }, [teamId]);

  const loadTeamAchievements = async () => {
    if (!teamId) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('team_achievements')
      .select('*')
      .eq('team_id', teamId)
      .order('achieved_at', { ascending: false });

    if (!error && data) {
      setAchievements(data);
    }
    setLoading(false);
  };

  const checkTeamStreak = async (days: number = 7) => {
    if (!teamId) return;

    const { data: teamMembers } = await supabase
      .from('users')
      .select('id')
      .eq('team_id', teamId)
      .eq('role', 'athlete');

    if (!teamMembers || teamMembers.length === 0) return;

    let allMembersHaveStreak = true;

    for (const member of teamMembers) {
      const { data: streaks } = await supabase
        .from('user_streaks')
        .select('current_streak')
        .eq('user_id', member.id)
        .eq('streak_type', 'all')
        .gte('current_streak', days)
        .maybeSingle();

      if (!streaks) {
        allMembersHaveStreak = false;
        break;
      }
    }

    if (allMembersHaveStreak) {
      const { data: existing } = await supabase
        .from('team_achievements')
        .select('id')
        .eq('team_id', teamId)
        .eq('achievement_type', 'team_streak')
        .gte('achieved_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .maybeSingle();

      if (!existing) {
        await recordTeamAchievement(
          'team_streak',
          `チーム全員が${days}日連続記録達成`,
          `チームメンバー全員が${days}日間連続で記録を入力しました！`,
          { days }
        );
      }
    }
  };

  const checkTeamPersonalBests = async () => {
    if (!teamId) return;

    const { data: teamMembers } = await supabase
      .from('users')
      .select('id')
      .eq('team_id', teamId)
      .eq('role', 'athlete');

    if (!teamMembers || teamMembers.length === 0) return;

    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    let allHavePB = true;

    for (const member of teamMembers) {
      const { data: recentPBs } = await supabase
        .from('achievement_milestones')
        .select('id')
        .eq('user_id', member.id)
        .eq('milestone_type', 'personal_best')
        .gte('created_at', weekAgo)
        .lte('created_at', today);

      if (!recentPBs || recentPBs.length === 0) {
        allHavePB = false;
        break;
      }
    }

    if (allHavePB) {
      const { data: existing } = await supabase
        .from('team_achievements')
        .select('id')
        .eq('team_id', teamId)
        .eq('achievement_type', 'team_personal_best')
        .gte('achieved_at', weekAgo)
        .maybeSingle();

      if (!existing) {
        await recordTeamAchievement(
          'team_personal_best',
          'チーム全員がパーソナルベスト更新',
          'チームメンバー全員が今週パーソナルベストを更新しました！',
          { week: weekAgo }
        );
      }
    }
  };

  const checkTeamGoals = async () => {
    if (!teamId) return;

    const { data: teamMembers } = await supabase
      .from('users')
      .select('id')
      .eq('team_id', teamId)
      .eq('role', 'athlete');

    if (!teamMembers || teamMembers.length === 0) return;

    const thisMonth = new Date().toISOString().slice(0, 7);

    let allCompletedGoals = true;

    for (const member of teamMembers) {
      const { data: activeGoals } = await supabase
        .from('user_goals')
        .select('id')
        .eq('user_id', member.id)
        .eq('status', 'active')
        .like('deadline', `${thisMonth}%`);

      const { data: completedGoals } = await supabase
        .from('user_goals')
        .select('id')
        .eq('user_id', member.id)
        .eq('status', 'completed')
        .like('deadline', `${thisMonth}%`);

      if (activeGoals && activeGoals.length > 0) {
        allCompletedGoals = false;
        break;
      }

      if (!completedGoals || completedGoals.length === 0) {
        allCompletedGoals = false;
        break;
      }
    }

    if (allCompletedGoals) {
      const { data: existing } = await supabase
        .from('team_achievements')
        .select('id')
        .eq('team_id', teamId)
        .eq('achievement_type', 'team_goals_complete')
        .gte('achieved_at', `${thisMonth}-01`)
        .maybeSingle();

      if (!existing) {
        await recordTeamAchievement(
          'team_goals_complete',
          '今月の目標達成チーム',
          'チームメンバー全員が今月の目標を達成しました！',
          { month: thisMonth }
        );
      }
    }
  };

  const recordTeamAchievement = async (
    type: string,
    title: string,
    description: string,
    metadata: any = {}
  ) => {
    if (!teamId) return;

    const { error } = await supabase.rpc('record_team_achievement', {
      p_team_id: teamId,
      p_achievement_type: type,
      p_title: title,
      p_description: description,
      p_metadata: metadata,
    });

    if (!error) {
      loadTeamAchievements();
    }
  };

  return {
    achievements,
    loading,
    checkTeamStreak,
    checkTeamPersonalBests,
    checkTeamGoals,
    recordTeamAchievement,
  };
}
