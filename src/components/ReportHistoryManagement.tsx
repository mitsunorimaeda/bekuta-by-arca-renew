import React, { useState, useEffect } from 'react';
import { FileText, Download, Clock, CheckCircle, XCircle, Trash2, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ReportHistoryManagementProps {
  organizationId: string;
  userId: string;
}

interface ReportHistoryItem {
  id: string;
  report_type: string;
  parameters: Record<string, any>;
  status: 'pending' | 'completed' | 'failed';
  error_message: string | null;
  created_at: string;
  generated_by: string;
  users?: { name: string };
}

export function ReportHistoryManagement({ organizationId, userId }: ReportHistoryManagementProps) {
  const [reports, setReports] = useState<ReportHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'completed' | 'pending' | 'failed'>('all');

  useEffect(() => {
    fetchReports();
  }, [organizationId, filter]);

  const fetchReports = async () => {
    try {
      setLoading(true);

      let query = supabase
        .from('report_history')
        .select(`
          *,
          users!report_history_generated_by_fkey(name)
        `)
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setReports(data || []);
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteReport = async (id: string) => {
    if (!confirm('このレポートを削除しますか？')) return;

    try {
      const { error } = await supabase
        .from('report_history')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setReports(reports.filter((r) => r.id !== id));
    } catch (error) {
      console.error('Error deleting report:', error);
      alert('レポートの削除に失敗しました');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />;
      default:
        return <Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />;
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-50 dark:bg-green-900/20';
      case 'failed':
        return 'bg-red-50 dark:bg-red-900/20';
      default:
        return 'bg-yellow-50 dark:bg-yellow-900/20';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return '完了';
      case 'failed':
        return '失敗';
      default:
        return '処理中';
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getReportTypeName = (type: string) => {
    switch (type) {
      case 'individual':
        return '個人レポート';
      case 'team':
        return 'チームレポート';
      case 'organization':
        return '組織レポート';
      default:
        return 'レポート';
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
          <FileText className="w-6 h-6 text-purple-600 dark:text-purple-400" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
            レポート履歴
          </h3>
        </div>
        <button
          onClick={fetchReports}
          className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          title="更新"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Filter Buttons */}
      <div className="flex gap-2 mb-6">
        {(['all', 'completed', 'pending', 'failed'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${
              filter === status
                ? 'bg-purple-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            {status === 'all' ? 'すべて' : getStatusText(status)}
          </button>
        ))}
      </div>

      {/* Reports List */}
      {reports.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>レポート履歴がありません</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <div
              key={report.id}
              className={`p-4 rounded-lg border-2 ${getStatusBg(report.status)} border-gray-200 dark:border-gray-700`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    {getStatusIcon(report.status)}
                    <h4 className="font-semibold text-gray-900 dark:text-white">
                      {getReportTypeName(report.report_type)}
                    </h4>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {formatDate(report.created_at)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
                    <div>
                      <span className="font-medium">生成者: </span>
                      {report.users?.name || 'Unknown'}
                    </div>
                    <div>
                      <span className="font-medium">ステータス: </span>
                      {getStatusText(report.status)}
                    </div>
                  </div>

                  {report.parameters && Object.keys(report.parameters).length > 0 && (
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      <span className="font-medium">パラメータ: </span>
                      {report.parameters.date_range && (
                        <span>
                          {report.parameters.date_range.start} ~ {report.parameters.date_range.end}
                        </span>
                      )}
                    </div>
                  )}

                  {report.error_message && (
                    <div className="mt-2 p-2 bg-red-100 dark:bg-red-900/30 rounded text-sm text-red-800 dark:text-red-200">
                      エラー: {report.error_message}
                    </div>
                  )}
                </div>

                <div className="flex gap-2 ml-4">
                  {report.status === 'completed' && (
                    <button
                      onClick={() => alert('ダウンロード機能は実装予定です')}
                      className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                      title="ダウンロード"
                    >
                      <Download className="w-5 h-5" />
                    </button>
                  )}
                  <button
                    onClick={() => deleteReport(report.id)}
                    className="p-2 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    title="削除"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
