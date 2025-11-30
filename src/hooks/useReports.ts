import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { generateTeamReport, TeamReportSummary, ReportPeriod, getPeriodDates } from '../lib/reportGeneration';

export interface ReportConfig {
  id: string;
  name: string;
  description: string;
  organization_id: string | null;
  team_id: string | null;
  created_by: string | null;
  period_type: 'weekly' | 'monthly' | 'quarterly' | 'semi_annual' | 'annual' | 'custom';
  include_training_load: boolean;
  include_acwr: boolean;
  include_weight: boolean;
  include_sleep: boolean;
  include_motivation: boolean;
  include_performance: boolean;
  include_alerts: boolean;
  compare_with_previous: boolean;
  include_team_average: boolean;
  highlight_high_risk: boolean;
  settings: any;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface GeneratedReport {
  id: string;
  config_id: string | null;
  schedule_id: string | null;
  report_type: string;
  title: string;
  period_start: string;
  period_end: string;
  organization_id: string | null;
  team_id: string | null;
  athlete_ids: string[];
  summary_data: any;
  detailed_data: any;
  insights: string[];
  recommendations: string[];
  pdf_url: string | null;
  generation_status: string;
  error_message: string | null;
  generated_by: string | null;
  generated_at: string;
  viewed_at: string | null;
  view_count: number;
  created_at: string;
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

      setReports(data || []);
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

      const { data: insertedReport, error: insertError } = await supabase
        .from('generated_reports')
        .insert({
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
          detailed_data: reportData,
          insights: reportData.insights,
          recommendations: reportData.recommendations,
          generation_status: 'completed'
        })
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
        .update({ viewed_at: new Date().toISOString() })
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

      setConfigs(data || []);
    } catch (err: any) {
      console.error('Error fetching report configs:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const createConfig = async (config: Partial<ReportConfig>): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase
        .from('report_configs')
        .insert(config);

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
        .update(updates)
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
