import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';
import type { FlowIntensity } from '../lib/cycleConstants';

type DailyLog = Database['public']['Tables']['menstrual_daily_logs']['Row'];
type DailyLogInsert = Database['public']['Tables']['menstrual_daily_logs']['Insert'];

export type { DailyLog };

export function useMenstrualDailyLog(userId: string) {
  const [dailyLogs, setDailyLogs] = useState<DailyLog[]>([]);
  const [loading, setLoading] = useState(false);

  /** 指定範囲のログを取得 */
  const fetchLogs = useCallback(async (startDate: string, endDate: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('menstrual_daily_logs')
        .select('*')
        .eq('user_id', userId)
        .gte('log_date', startDate)
        .lte('log_date', endDate)
        .order('log_date', { ascending: false });

      if (error) throw error;
      setDailyLogs(data || []);
    } catch {
      setDailyLogs([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const refetch = useCallback(() => {
    const end = new Date().toISOString().slice(0, 10);
    const start = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    fetchLogs(start, end);
  }, [fetchLogs]);

  /** 初期ロード + 他コンポーネントからの保存通知でリフレッシュ */
  useEffect(() => {
    refetch();
    // 他のコンポーネント（モーダル等）でdaily logが保存された時にrefetch
    const handleUpdate = () => refetch();
    window.addEventListener('menstrual-daily-log-updated', handleUpdate);
    return () => window.removeEventListener('menstrual-daily-log-updated', handleUpdate);
  }, [refetch]);

  /** 日別ログをupsert（同日は上書き） */
  const upsertDailyLog = useCallback(async (params: {
    logDate: string;
    isPeriodDay: boolean;
    flowIntensity?: FlowIntensity | null;
    symptoms?: string[];
    notes?: string | null;
  }) => {
    // organization_id を取得
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error('認証が必要です');

    const { data: userProfile } = await supabase
      .from('users')
      .select('team_id')
      .eq('id', userData.user.id)
      .maybeSingle();

    let organizationId: string | null = null;
    if (userProfile?.team_id) {
      const { data: team } = await supabase
        .from('teams')
        .select('organization_id')
        .eq('id', userProfile.team_id)
        .maybeSingle();
      organizationId = team?.organization_id || null;
    }

    const row: DailyLogInsert = {
      user_id: userId,
      organization_id: organizationId,
      log_date: params.logDate,
      is_period_day: params.isPeriodDay,
      flow_intensity: params.flowIntensity || null,
      symptoms: params.symptoms || [],
      notes: params.notes || null,
    };

    const { data, error } = await supabase
      .from('menstrual_daily_logs')
      .upsert(row, { onConflict: 'user_id,log_date' })
      .select()
      .single();

    if (error) throw error;

    // ローカル state 更新
    if (data) {
      setDailyLogs(prev => {
        const filtered = prev.filter(l => l.log_date !== params.logDate);
        return [data, ...filtered].sort((a, b) =>
          b.log_date.localeCompare(a.log_date)
        );
      });
      // 他のhookインスタンスに通知（モーダル↔ページ間の同期）
      window.dispatchEvent(new Event('menstrual-daily-log-updated'));
    }

    return data;
  }, [userId]);

  /** 特定日のログを取得 */
  const getDailyLog = useCallback((date: string): DailyLog | null => {
    return dailyLogs.find(l => l.log_date === date) || null;
  }, [dailyLogs]);

  return {
    dailyLogs,
    loading,
    upsertDailyLog,
    getDailyLog,
    fetchLogs,
    refetch,
  };
}
