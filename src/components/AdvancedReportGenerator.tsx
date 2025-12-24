// src/components/AdvancedReportGenerator.tsx
/// <reference deno-lint-ignore-file no-explicit-any />
import React, { useEffect, useMemo, useState } from 'react';
import {
  FileText,
  Download,
  Calendar,
  Users,
  User,
  Building2,
  Filter,
  RefreshCcw,
  ExternalLink,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface AdvancedReportGeneratorProps {
  organizationId: string;
  userId: string;
}

interface ReportTemplate {
  id: string;
  name: string;
  description: string | null;
  report_type: 'individual' | 'team' | 'organization';
}

type TeamRow = { id: string; name: string };
type AthleteRow = { id: string; name: string };

type ReportHistoryRow = {
  id: string;
  report_type: 'individual' | 'team' | 'organization';
  status: 'pending' | 'completed' | 'failed';
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  file_path: string | null;
  report_url: string | null;
  error_message: string | null;
  parameters: any;
};

export function AdvancedReportGenerator({ organizationId, userId }: AdvancedReportGeneratorProps) {
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null);

  const [reportType, setReportType] = useState<'individual' | 'team' | 'organization'>('team');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  const [selectedTeam, setSelectedTeam] = useState('');
  const [selectedAthlete, setSelectedAthlete] = useState('');

  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [athletes, setAthletes] = useState<AthleteRow[]>([]);

  const [includeMetrics, setIncludeMetrics] = useState({
    acwr: true,
    training_load: true,
    performance: true,
    injury_risk: true,
    attendance: true,
    trends: true,
  });

  const [loadingTeams, setLoadingTeams] = useState(false);
  const [loadingAthletes, setLoadingAthletes] = useState(false);

  const [generating, setGenerating] = useState(false);

  // 生成直後にURLを表示する用
  const [latestResult, setLatestResult] = useState<{
    report_history_id: string;
    report_url: string | null;
    file_path: string | null;
  } | null>(null);

  // 履歴（直近）
  const [history, setHistory] = useState<ReportHistoryRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (!organizationId) return;
    fetchTemplates();
    fetchTeams();
    fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  useEffect(() => {
    // reportType が変わったら矛盾しやすい選択をリセット
    setSelectedTemplate((prev) => (prev && prev.report_type === reportType ? prev : null));

    if (reportType === 'organization') {
      setSelectedTeam('');
      setSelectedAthlete('');
      setAthletes([]);
    } else if (reportType === 'team') {
      setSelectedAthlete('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportType]);

  useEffect(() => {
    if (!selectedTeam) {
      setAthletes([]);
      setSelectedAthlete('');
      return;
    }
    fetchAthletes(selectedTeam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTeam]);

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('report_templates')
        .select('*')
        .eq('organization_id', organizationId)
        .order('name');

      if (error) throw error;
      setTemplates((data || []) as ReportTemplate[]);
    } catch (e) {
      console.error('[AdvancedReportGenerator] fetchTemplates failed:', e);
      setTemplates([]);
    }
  };

  const fetchTeams = async () => {
    try {
      setLoadingTeams(true);
      const { data, error } = await supabase
        .from('teams')
        .select('id, name')
        .eq('organization_id', organizationId)
        .order('name');

      if (error) throw error;
      setTeams((data || []) as TeamRow[]);
    } catch (e) {
      console.error('[AdvancedReportGenerator] fetchTeams failed:', e);
      setTeams([]);
    } finally {
      setLoadingTeams(false);
    }
  };

  const fetchAthletes = async (teamId: string) => {
    try {
      setLoadingAthletes(true);
      setAthletes([]);
      setSelectedAthlete('');

      const { data, error } = await supabase
        .from('team_member_assignments')
        .select('user_id, users!inner(id, name)')
        .eq('team_id', teamId);

      if (error) throw error;

      const athleteList =
        data?.map((m: any) => ({
          id: m.user_id as string,
          name: (m.users as any)?.name || 'unknown',
        })) || [];

      athleteList.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
      setAthletes(athleteList);
    } catch (e) {
      console.error('[AdvancedReportGenerator] fetchAthletes failed:', e);
      setAthletes([]);
    } finally {
      setLoadingAthletes(false);
    }
  };

  const fetchHistory = async () => {
    try {
      setLoadingHistory(true);
      const { data, error } = await supabase
        .from('report_history')
        .select(
          'id, report_type, status, created_at, started_at, completed_at, file_path, report_url, error_message, parameters'
        )
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setHistory((data || []) as ReportHistoryRow[]);
    } catch (e) {
      console.error('[AdvancedReportGenerator] fetchHistory failed:', e);
      setHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const dateError = useMemo(() => {
    if (!dateRange.start || !dateRange.end) return null;
    if (dateRange.start > dateRange.end) return '開始日が終了日より後になっています';
    return null;
  }, [dateRange.start, dateRange.end]);

  const validationError = useMemo(() => {
    if (!dateRange.start || !dateRange.end) return '期間（開始日・終了日）を入力してください';
    if (dateError) return dateError;

    if (reportType === 'team' && !selectedTeam) return 'チームを選択してください';
    if (reportType === 'individual') {
      if (!selectedTeam) return 'チームを選択してください';
      if (!selectedAthlete) return 'アスリートを選択してください';
    }

    const anyMetricOn = Object.values(includeMetrics).some(Boolean);
    if (!anyMetricOn) return '含める指標を1つ以上選択してください';

    return null;
  }, [dateRange.start, dateRange.end, dateError, reportType, selectedTeam, selectedAthlete, includeMetrics]);

  const canGenerate = !generating && !validationError;

  const generateReport = async () => {
    if (validationError) {
      window.alert(validationError);
      return;
    }

    setGenerating(true);
    setLatestResult(null);

    try {
      // 1) report_history を作成（id取得）
      const parameters = {
        report_type: reportType,
        date_range: dateRange,
        team_id: reportType === 'organization' ? null : selectedTeam,
        athlete_id: reportType === 'individual' ? selectedAthlete : null,
        metrics: includeMetrics,
      };

      const { data: created, error: insertErr } = await supabase
        .from('report_history')
        .insert({
          organization_id: organizationId,
          template_id: selectedTemplate?.id || null,
          report_type: reportType,
          generated_by: userId,
          parameters,
          status: 'pending',
        })
        .select('id')
        .single();

      if (insertErr) throw insertErr;
      const reportHistoryId = created?.id as string;
      if (!reportHistoryId) throw new Error('Failed to create report_history');

      // 2) Edge Function を呼ぶ（ここで生成が走って report_url が返る想定）
      // supabase-js の invoke はログイン済みなら Authorization を自動で付けます
      const { data: fnData, error: fnErr } = await supabase.functions.invoke('generate_report', {
        body: { report_history_id: reportHistoryId },
      });

      if (fnErr) {
        console.error('[AdvancedReportGenerator] invoke error:', fnErr);
        throw fnErr;
      }

      // 3) 返ってきたURLを表示（＆履歴再取得）
      const result = {
        report_history_id: reportHistoryId,
        report_url: fnData?.report_url ?? null,
        file_path: fnData?.file_path ?? null,
      };
      setLatestResult(result);

      await fetchHistory();

      if (result.report_url) {
        window.alert('レポート生成が完了しました。ダウンロードできます。');
      } else {
        window.alert('生成は完了しましたが、URLがまだありません（Storage設定を確認してください）');
      }
    } catch (e: any) {
      console.error('[AdvancedReportGenerator] generateReport failed:', e);
      window.alert(`レポート生成に失敗しました：${e?.message ?? e}`);
      await fetchHistory();
    } finally {
      setGenerating(false);
    }
  };

  const openReport = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'individual':
        return <User className="w-5 h-5" />;
      case 'team':
        return <Users className="w-5 h-5" />;
      case 'organization':
        return <Building2 className="w-5 h-5" />;
      default:
        return <FileText className="w-5 h-5" />;
    }
  };

  const metricLabel: Record<string, string> = {
    acwr: 'ACWR',
    training_load: 'トレーニング負荷',
    performance: 'パフォーマンス',
    injury_risk: '傷害リスク',
    attendance: '出欠/稼働',
    trends: 'トレンド',
  };

  const statusBadge = (s: ReportHistoryRow['status']) => {
    const base = 'px-2 py-1 text-xs rounded-full';
    if (s === 'completed') return `${base} bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300`;
    if (s === 'failed') return `${base} bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300`;
    return `${base} bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200`;
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow space-y-6">
      <div className="flex items-center gap-2">
        <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">高度なレポート生成</h3>
      </div>

      {/* ====== Generator ====== */}
      <div className="space-y-6">
        {/* Report Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            レポートタイプ
          </label>
          <div className="grid grid-cols-3 gap-3">
            {(['individual', 'team', 'organization'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setReportType(type)}
                className={`p-4 border-2 rounded-lg flex flex-col items-center gap-2 transition-colors ${
                  reportType === type
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-300 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-700'
                }`}
              >
                {getIcon(type)}
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {type === 'individual' ? '個人' : type === 'team' ? 'チーム' : '組織'}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Template */}
        {templates.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              テンプレート（任意）
            </label>
            <select
              value={selectedTemplate?.id || ''}
              onChange={(e) => {
                const template = templates.find((t) => t.id === e.target.value);
                setSelectedTemplate(template || null);
                if (template) setReportType(template.report_type);
              }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="">カスタムレポート</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Date Range */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <Calendar className="inline w-4 h-4 mr-1" />
            期間
          </label>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">開始日</label>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">終了日</label>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>
          {dateError && <div className="mt-2 text-sm text-red-600 dark:text-red-400">{dateError}</div>}
        </div>

        {/* Team */}
        {(reportType === 'team' || reportType === 'individual') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">チーム</label>
            <select
              value={selectedTeam}
              onChange={(e) => setSelectedTeam(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              disabled={loadingTeams}
            >
              <option value="">{loadingTeams ? '読み込み中…' : 'チームを選択'}</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Athlete */}
        {reportType === 'individual' && selectedTeam && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              アスリート
            </label>
            <select
              value={selectedAthlete}
              onChange={(e) => setSelectedAthlete(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              disabled={loadingAthletes}
            >
              <option value="">{loadingAthletes ? '読み込み中…' : 'アスリートを選択'}</option>
              {athletes.map((athlete) => (
                <option key={athlete.id} value={athlete.id}>
                  {athlete.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Metrics */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <Filter className="inline w-4 h-4 mr-1" />
            含める指標
          </label>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(includeMetrics).map(([key, value]) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={value}
                  onChange={(e) => setIncludeMetrics({ ...includeMetrics, [key]: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {metricLabel[key] ?? key.replace(/_/g, ' ')}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Generate Button */}
        <button
          type="button"
          onClick={generateReport}
          disabled={!canGenerate}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <Download className="w-5 h-5" />
          {generating ? '生成中...' : 'レポートを生成'}
        </button>

        {validationError && (
          <div className="text-sm text-gray-600 dark:text-gray-300">※ {validationError}</div>
        )}

        {/* Latest Result */}
        {latestResult && (
          <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800">
            <div className="text-sm text-gray-700 dark:text-gray-200">
              <div className="font-semibold mb-1">最新の生成結果</div>
              <div className="break-all">report_history_id: {latestResult.report_history_id}</div>
              {latestResult.file_path && <div className="break-all">file_path: {latestResult.file_path}</div>}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {latestResult.report_url ? (
                <>
                  <button
                    type="button"
                    onClick={() => openReport(latestResult.report_url!)}
                    className="px-3 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm flex items-center gap-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    レポートを開く
                  </button>
                  <a
                    href={latestResult.report_url}
                    className="px-3 py-2 rounded bg-gray-900 hover:bg-black text-white text-sm flex items-center gap-2"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Download className="w-4 h-4" />
                    ダウンロード
                  </a>
                </>
              ) : (
                <div className="text-sm text-orange-700 dark:text-orange-300">
                  report_url がまだありません（Storage/署名URL生成を確認）
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ====== History ====== */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-gray-900 dark:text-white">レポート履歴（最新20件）</h4>
          <button
            type="button"
            onClick={fetchHistory}
            disabled={loadingHistory}
            className="px-3 py-2 rounded bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-sm flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCcw className="w-4 h-4" />
            更新
          </button>
        </div>

        {loadingHistory ? (
          <div className="text-sm text-gray-600 dark:text-gray-300">読み込み中…</div>
        ) : history.length === 0 ? (
          <div className="text-sm text-gray-600 dark:text-gray-300">履歴がありません。</div>
        ) : (
          <div className="space-y-3">
            {history.map((h) => (
              <div
                key={h.id}
                className="p-4 rounded-lg bg-gray-50 dark:bg-gray-700/40 border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={statusBadge(h.status)}>{h.status}</span>
                      <span className="text-sm text-gray-800 dark:text-gray-100">
                        {h.report_type.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-300 mt-1 break-all">
                      id: {h.id}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {h.report_url ? (
                      <button
                        type="button"
                        onClick={() => openReport(h.report_url!)}
                        className="px-3 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm flex items-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        開く
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="px-3 py-2 rounded bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 text-sm flex items-center gap-2 opacity-60 cursor-not-allowed"
                      >
                        <Download className="w-4 h-4" />
                        なし
                      </button>
                    )}
                  </div>
                </div>

                {h.error_message && (
                  <div className="mt-2 text-sm text-red-600 dark:text-red-300">
                    {h.error_message}
                  </div>
                )}

                <div className="mt-2 text-xs text-gray-600 dark:text-gray-300 grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>created: {h.created_at}</div>
                  <div>completed: {h.completed_at ?? '-'}</div>
                  <div className="break-all">file_path: {h.file_path ?? '-'}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}