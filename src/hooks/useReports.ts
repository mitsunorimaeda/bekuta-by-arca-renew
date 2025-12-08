import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { generateTeamReport, ReportPeriod, getPeriodDates } from '../lib/reportGeneration';
import { getNowJSTISOString } from '../lib/date';

// DB の実態に寄せて「null 許容」にしておく
export interface ReportConfig {
  id: string;
  name: string;
  description: string | null;
  organization_id: string | null;
  team_id: string | null;
  created_by: string | null;
  period_type: 'weekly' | 'monthly' | 'quarterly' | 'semi_annual' | 'annual' | 'custom';
  include_training_load: boolean | null;
  include_acwr: boolean | null;
  include_weight: boolean | null;
  include_sleep: boolean | null;
  include_motivation: boolean | null;
  include_performance: boolean | null;
  include_alerts: boolean | null;
  compare_with_previous: boolean | null;
  include_team_average: boolean | null;
  highlight_high_risk: boolean | null;
  settings: any;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

// DB 側の型に合わせて null を許容 & report_type は optional に
export interface GeneratedReport {
  id: string;
  config_id: string | null;
  schedule_id: string | null;
  report_type?: string; // database.types に無くてもエラーにならないように optional
  title: string | null;
  period_start: string | null;
  period_end: string | null;
  organization_id: string | null;
  team_id: string | null;
  athlete_ids: string[] | null;
  summary_data: any;
  detailed_data: any;
  insights: string[] | null;
  recommendations: string[] | null;
  pdf_url: string | null;
  generation_status: string;
  error_message: string | null;
  generated_by: string | null;
  generated_at: string | null;
  viewed_at: string | null;
  view_count: number;
  created_at: string | null;
}

export function useReports(teamId: string | null) {
  const [reports, setReports] = useState<GeneratedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (teamId) {
      fetchReports();
    } else {
      setReports([]);
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  const fetchReports = async () => {
    if (!teamId) return;

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('generated_reports')
        .select('*')
        .eq('team_id', teamId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (fetchError) throw fetchError;

      // DB の Row 型 → GeneratedReport へのキャスト（フィールド名は同じなので OK）
      setReports((data || []) as GeneratedReport[]);
    } catch (err: any) {
      console.error('Error fetching reports:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const generateReport = async (
    teamId: string,
    periodType: ReportPeriod['type'],
    customStart?: string,
    customEnd?: string
  ): Promise<{ success: boolean; reportId?: string; error?: string }> => {
    try {
      const period = getPeriodDates(periodType, customStart, customEnd);
      const reportData = await generateTeamReport(teamId, period);

      const { data: team } = await supabase
        .from('teams')
        .select('name')
        .eq('id', teamId)
        .single();

      const title = `${team?.name || 'チーム'}レポート - ${period.start} 〜 ${period.end}`;

      // Supabase の generated_reports 型に合わせるため any キャストで緩める
      const insertPayload: any = {
        report_type: periodType,
        title,
        period_start: period.start,
        period_end: period.end,
        team_id: teamId,
        athlete_ids: reportData.athletes.map(a => a.athleteId),
        summary_data: {
          totalAthletes: reportData.totalAthletes,
          activeAthletes: reportData.activeAthletes,
          teamAverageLoad: reportData.teamAverageLoad,
          teamAverageACWR: reportData.teamAverageACWR,
          highRiskCount: reportData.highRiskCount,
          mediumRiskCount: reportData.mediumRiskCount,
          lowRiskCount: reportData.lowRiskCount,
          totalAlerts: reportData.totalAlerts,
          criticalAlerts: reportData.criticalAlerts
        },
        detailed_data: reportData,              // TeamReportSummary → Json 扱いにする
        insights: reportData.insights,
        recommendations: reportData.recommendations,
        generation_status: 'completed'
      };

      const { data: insertedReport, error: insertError } = await supabase
        .from('generated_reports')
        .insert(insertPayload)
        .select()
        .single();

      if (insertError) throw insertError;

      await fetchReports();

      return {
        success: true,
        reportId: insertedReport.id
      };
    } catch (err: any) {
      console.error('Error generating report:', err);
      return {
        success: false,
        error: err.message
      };
    }
  };

  const markReportAsViewed = async (reportId: string) => {
    try {
      const { error } = await supabase
        .from('generated_reports')
        .update({ viewed_at: getNowJSTISOString() })
        .eq('id', reportId);

      if (error) throw error;

      await fetchReports();
    } catch (err: any) {
      console.error('Error marking report as viewed:', err);
    }
  };

  const deleteReport = async (reportId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase
        .from('generated_reports')
        .delete()
        .eq('id', reportId);

      if (error) throw error;

      await fetchReports();

      return { success: true };
    } catch (err: any) {
      console.error('Error deleting report:', err);
      return {
        success: false,
        error: err.message
      };
    }
  };

  return {
    reports,
    loading,
    error,
    generateReport,
    markReportAsViewed,
    deleteReport,
    refreshReports: fetchReports
  };
}

export function useReportConfigs(organizationId: string | null) {
  const [configs, setConfigs] = useState<ReportConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (organizationId) {
      fetchConfigs();
    } else {
      setConfigs([]);
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  const fetchConfigs = async () => {
    if (!organizationId) return;

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('report_configs')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setConfigs((data || []) as ReportConfig[]);
    } catch (err: any) {
      console.error('Error fetching report configs:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const createConfig = async (config: Partial<ReportConfig>): Promise<{ success: boolean; error?: string }> => {
    try {
      // name など必須項目は UI 側で必ず入れる前提で any キャスト
      const { error } = await supabase
        .from('report_configs')
        .insert(config as any);

      if (error) throw error;

      await fetchConfigs();

      return { success: true };
    } catch (err: any) {
      console.error('Error creating report config:', err);
      return {
        success: false,
        error: err.message
      };
    }
  };

  const updateConfig = async (id: string, updates: Partial<ReportConfig>): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase
        .from('report_configs')
        .update(updates as any)
        .eq('id', id);

      if (error) throw error;

      await fetchConfigs();

      return { success: true };
    } catch (err: any) {
      console.error('Error updating report config:', err);
      return {
        success: false,
        error: err.message
      };
    }
  };

  const deleteConfig = async (id: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase
        .from('report_configs')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await fetchConfigs();

      return { success: true };
    } catch (err: any) {
      console.error('Error deleting report config:', err);
      return {
        success: false,
        error: err.message
      };
    }
  };

  return {
    configs,
    loading,
    error,
    createConfig,
    updateConfig,
    deleteConfig,
    refreshConfigs: fetchConfigs
  };
}