import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Mail, Plus, Edit2, Trash2, Power, PowerOff } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ScheduledReportManagementProps {
  organizationId: string;
  userId: string;
}

interface ScheduledReport {
  id: string;
  name: string;
  schedule_type: 'daily' | 'weekly' | 'monthly';
  schedule_config: Record<string, any>;
  recipients: string[];
  is_active: boolean;
  next_run: string | null;
  template_id: string;
}

export function ScheduledReportManagement({ organizationId, userId }: ScheduledReportManagementProps) {
  const [scheduledReports, setScheduledReports] = useState<ScheduledReport[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingReport, setEditingReport] = useState<ScheduledReport | null>(null);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    name: '',
    schedule_type: 'weekly' as 'daily' | 'weekly' | 'monthly',
    day_of_week: '1',
    day_of_month: '1',
    time: '09:00',
    recipients: '',
  });

  useEffect(() => {
    fetchScheduledReports();
  }, [organizationId]);

  const fetchScheduledReports = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('scheduled_reports')
        .select('*')
        .eq('organization_id', organizationId)
        .order('name');

      if (error) throw error;
      setScheduledReports(data || []);
    } catch (error) {
      console.error('Error fetching scheduled reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const scheduleConfig: Record<string, any> = {
        time: formData.time,
      };

      if (formData.schedule_type === 'weekly') {
        scheduleConfig.day_of_week = parseInt(formData.day_of_week);
      } else if (formData.schedule_type === 'monthly') {
        scheduleConfig.day_of_month = parseInt(formData.day_of_month);
      }

      const recipients = formData.recipients
        .split(',')
        .map((email) => email.trim())
        .filter((email) => email);

      const { data: nextRunData } = await supabase.rpc('calculate_next_run', {
        p_schedule_type: formData.schedule_type,
        p_schedule_config: scheduleConfig,
      });

      const reportData = {
        organization_id: organizationId,
        template_id: organizationId,
        name: formData.name,
        schedule_type: formData.schedule_type,
        schedule_config: scheduleConfig,
        recipients,
        next_run: nextRunData,
        created_by: userId,
      };

      if (editingReport) {
        const { error } = await supabase
          .from('scheduled_reports')
          .update(reportData)
          .eq('id', editingReport.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('scheduled_reports')
          .insert(reportData);

        if (error) throw error;
      }

      setShowForm(false);
      setEditingReport(null);
      setFormData({
        name: '',
        schedule_type: 'weekly',
        day_of_week: '1',
        day_of_month: '1',
        time: '09:00',
        recipients: '',
      });
      fetchScheduledReports();
    } catch (error) {
      console.error('Error saving scheduled report:', error);
      alert('スケジュールの保存に失敗しました');
    }
  };

  const toggleActive = async (report: ScheduledReport) => {
    try {
      const { error } = await supabase
        .from('scheduled_reports')
        .update({ is_active: !report.is_active })
        .eq('id', report.id);

      if (error) throw error;
      fetchScheduledReports();
    } catch (error) {
      console.error('Error toggling report:', error);
    }
  };

  const deleteReport = async (id: string) => {
    if (!confirm('このスケジュールを削除しますか？')) return;

    try {
      const { error } = await supabase
        .from('scheduled_reports')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchScheduledReports();
    } catch (error) {
      console.error('Error deleting report:', error);
      alert('削除に失敗しました');
    }
  };

  const getScheduleText = (report: ScheduledReport) => {
    const config = report.schedule_config;
    const time = config.time || '09:00';

    switch (report.schedule_type) {
      case 'daily':
        return `毎日 ${time}`;
      case 'weekly':
        const days = ['日', '月', '火', '水', '木', '金', '土'];
        const dayOfWeek = config.day_of_week || 1;
        return `毎週${days[dayOfWeek]}曜日 ${time}`;
      case 'monthly':
        const dayOfMonth = config.day_of_month || 1;
        return `毎月${dayOfMonth}日 ${time}`;
      default:
        return '不明';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Calendar className="w-6 h-6 text-green-600 dark:text-green-400" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
            スケジュールレポート
          </h3>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
        >
          <Plus className="w-5 h-5" />
          新規作成
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-4">
            {editingReport ? 'スケジュール編集' : '新規スケジュール'}
          </h4>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                スケジュール名
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 dark:bg-gray-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                頻度
              </label>
              <select
                value={formData.schedule_type}
                onChange={(e) =>
                  setFormData({ ...formData, schedule_type: e.target.value as any })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 dark:bg-gray-800 dark:text-white"
              >
                <option value="daily">毎日</option>
                <option value="weekly">毎週</option>
                <option value="monthly">毎月</option>
              </select>
            </div>

            {formData.schedule_type === 'weekly' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  曜日
                </label>
                <select
                  value={formData.day_of_week}
                  onChange={(e) => setFormData({ ...formData, day_of_week: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 dark:bg-gray-800 dark:text-white"
                >
                  <option value="0">日曜日</option>
                  <option value="1">月曜日</option>
                  <option value="2">火曜日</option>
                  <option value="3">水曜日</option>
                  <option value="4">木曜日</option>
                  <option value="5">金曜日</option>
                  <option value="6">土曜日</option>
                </select>
              </div>
            )}

            {formData.schedule_type === 'monthly' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  日付
                </label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={formData.day_of_month}
                  onChange={(e) => setFormData({ ...formData, day_of_month: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 dark:bg-gray-800 dark:text-white"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                時刻
              </label>
              <input
                type="time"
                value={formData.time}
                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 dark:bg-gray-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                送信先メールアドレス（カンマ区切り）
              </label>
              <input
                type="text"
                required
                value={formData.recipients}
                onChange={(e) => setFormData({ ...formData, recipients: e.target.value })}
                placeholder="user1@example.com, user2@example.com"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 dark:bg-gray-800 dark:text-white"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
              >
                保存
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingReport(null);
                }}
                className="flex-1 py-2 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 text-gray-700 dark:text-white rounded-lg transition-colors"
              >
                キャンセル
              </button>
            </div>
          </div>
        </form>
      )}

      {scheduledReports.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>スケジュールされたレポートがありません</p>
        </div>
      ) : (
        <div className="space-y-3">
          {scheduledReports.map((report) => (
            <div
              key={report.id}
              className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg flex items-center justify-between"
            >
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                  {report.name}
                </h4>
                <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {getScheduleText(report)}
                  </div>
                  <div className="flex items-center gap-1">
                    <Mail className="w-4 h-4" />
                    {report.recipients.length} 人
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleActive(report)}
                  className={`p-2 rounded-lg transition-colors ${
                    report.is_active
                      ? 'text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/20'
                      : 'text-gray-400 dark:text-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                  title={report.is_active ? '無効化' : '有効化'}
                >
                  {report.is_active ? (
                    <Power className="w-5 h-5" />
                  ) : (
                    <PowerOff className="w-5 h-5" />
                  )}
                </button>
                <button
                  onClick={() => deleteReport(report.id)}
                  className="p-2 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  title="削除"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
