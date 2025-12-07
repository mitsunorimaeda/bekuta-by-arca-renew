import React, { useState, useEffect } from 'react';
import { FileText, Download, Calendar, Users, User, Building2, Filter, TrendingUp } from 'lucide-react';
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

export function AdvancedReportGenerator({ organizationId, userId }: AdvancedReportGeneratorProps) {
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null);
  const [reportType, setReportType] = useState<'individual' | 'team' | 'organization'>('team');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [selectedTeam, setSelectedTeam] = useState('');
  const [selectedAthlete, setSelectedAthlete] = useState('');
  const [teams, setTeams] = useState<any[]>([]);
  const [athletes, setAthletes] = useState<any[]>([]);
  const [includeMetrics, setIncludeMetrics] = useState({
    acwr: true,
    training_load: true,
    performance: true,
    injury_risk: true,
    attendance: true,
    trends: true,
  });
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetchTemplates();
    fetchTeams();
  }, [organizationId]);

  useEffect(() => {
    if (selectedTeam) {
      fetchAthletes(selectedTeam);
    }
  }, [selectedTeam]);

  const fetchTemplates = async () => {
    const { data } = await supabase
      .from('report_templates')
      .select('*')
      .eq('organization_id', organizationId)
      .order('name');

    setTemplates(data || []);
  };

  const fetchTeams = async () => {
    const { data } = await supabase
      .from('teams')
      .select('id, name')
      .eq('organization_id', organizationId)
      .order('name');

    setTeams(data || []);
  };

  const fetchAthletes = async (teamId: string) => {
    const { data } = await supabase
      .from('team_member_assignments')
      .select(`
        user_id,
        users!inner(id, name)
      `)
      .eq('team_id', teamId);

    const athleteList = data?.map((m) => ({
      id: m.user_id,
      name: (m.users as any).name,
    })) || [];

    setAthletes(athleteList);
  };

  const generateReport = async () => {
    setGenerating(true);

    try {
      const parameters = {
        report_type: reportType,
        date_range: dateRange,
        team_id: selectedTeam,
        athlete_id: selectedAthlete,
        metrics: includeMetrics,
      };

      const { data, error } = await supabase
        .from('report_history')
        .insert({
          organization_id: organizationId,
          template_id: selectedTemplate?.id || null,
          report_type: reportType,
          generated_by: userId,
          parameters,
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;

      alert('レポート生成を開始しました。完了後、レポート履歴からダウンロードできます。');
    } catch (error) {
      console.error('Error generating report:', error);
      alert('レポート生成に失敗しました');
    } finally {
      setGenerating(false);
    }
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

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
      <div className="flex items-center gap-2 mb-6">
        <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
          高度なレポート生成
        </h3>
      </div>

      <div className="space-y-6">
        {/* Report Type Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            レポートタイプ
          </label>
          <div className="grid grid-cols-3 gap-3">
            {(['individual', 'team', 'organization'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setReportType(type)}
                className={`p-4 border-2 rounded-lg flex flex-col items-center gap-2 transition-colors ${
                  reportType === type
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-300 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-700'
                }`}
              >
                {getIcon(type)}
                <span className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                  {type === 'individual' ? '個人' : type === 'team' ? 'チーム' : '組織'}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Template Selection */}
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
        </div>

        {/* Team Selection (for team and individual reports) */}
        {(reportType === 'team' || reportType === 'individual') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              チーム
            </label>
            <select
              value={selectedTeam}
              onChange={(e) => setSelectedTeam(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              required
            >
              <option value="">チームを選択</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Athlete Selection (for individual reports) */}
        {reportType === 'individual' && selectedTeam && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              アスリート
            </label>
            <select
              value={selectedAthlete}
              onChange={(e) => setSelectedAthlete(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              required
            >
              <option value="">アスリートを選択</option>
              {athletes.map((athlete) => (
                <option key={athlete.id} value={athlete.id}>
                  {athlete.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Metrics Selection */}
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
                  onChange={(e) =>
                    setIncludeMetrics({ ...includeMetrics, [key]: e.target.checked })
                  }
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">
                  {key.replace(/_/g, ' ')}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Generate Button */}
        <button
          onClick={generateReport}
          disabled={generating || !dateRange.start || !dateRange.end}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <Download className="w-5 h-5" />
          {generating ? '生成中...' : 'レポートを生成'}
        </button>
      </div>
    </div>
  );
}
