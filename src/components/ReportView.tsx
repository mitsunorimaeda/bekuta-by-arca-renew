import React, { useState } from 'react';
import { Team } from '../lib/supabase';
import { useReports } from '../hooks/useReports';
import { useAuth } from '../hooks/useAuth';
import { useOrganizations } from '../hooks/useOrganizations';
import { ReportPeriod, getPeriodLabel } from '../lib/reportGeneration';
import {
  FileText,
  Calendar,
  TrendingUp,
  AlertTriangle,
  Users,
  Download,
  Eye,
  Trash2,
  Plus,
  RefreshCw,
  BarChart3,
  Clock
} from 'lucide-react';
import { AdvancedReportGenerator } from './AdvancedReportGenerator';
import { ReportHistoryManagement } from './ReportHistoryManagement';
import { ScheduledReportManagement } from './ScheduledReportManagement';

interface ReportViewProps {
  team: Team;
}

export function ReportView({ team }: ReportViewProps) {
  const { user } = useAuth();
  const { organizations } = useOrganizations(user?.id || '');
  const organizationId = team.organization_id || (organizations.length > 0 ? organizations[0].id : '');

  const { reports, loading, generateReport, markReportAsViewed, deleteReport, refreshReports } = useReports(team.id);
  const [generating, setGenerating] = useState(false);
  const [showGeneratePanel, setShowGeneratePanel] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<ReportPeriod['type']>('weekly');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'basic' | 'advanced' | 'scheduled' | 'history'>('basic');

  const handleGenerateReport = async () => {
    setGenerating(true);
    try {
      const result = await generateReport(
        team.id,
        selectedPeriod,
        selectedPeriod === 'custom' ? customStartDate : undefined,
        selectedPeriod === 'custom' ? customEndDate : undefined
      );

      if (result.success) {
        alert('レポートを生成しました！');
        setShowGeneratePanel(false);
      } else {
        alert(`エラー: ${result.error}`);
      }
    } catch (error) {
      console.error('Report generation error:', error);
      alert('レポート生成に失敗しました');
    } finally {
      setGenerating(false);
    }
  };

  const handleViewReport = (report: any) => {
    setSelectedReport(report);
    markReportAsViewed(report.id);
  };

  const handleDeleteReport = async (reportId: string) => {
    if (!confirm('このレポートを削除してもよろしいですか？')) return;

    const result = await deleteReport(reportId);
    if (result.success) {
      alert('レポートを削除しました');
    } else {
      alert(`エラー: ${result.error}`);
    }
  };

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case 'high': return 'text-red-600 bg-red-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'low': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getRiskLevelLabel = (level: string) => {
    switch (level) {
      case 'high': return '高リスク';
      case 'medium': return '中リスク';
      case 'low': return '低リスク';
      default: return '不明';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="bg-white rounded-xl shadow-sm p-2">
        <div className="flex gap-2">
          {[
            { id: 'basic', label: '基本レポート', icon: FileText },
            { id: 'advanced', label: '高度なレポート', icon: BarChart3 },
            { id: 'scheduled', label: 'スケジュール', icon: Calendar },
            { id: 'history', label: '履歴', icon: Clock },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <tab.icon className="w-5 h-5" />
              <span className="font-medium">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'advanced' && user && (
        <AdvancedReportGenerator organizationId={organizationId} userId={user.id} />
      )}

      {activeTab === 'scheduled' && user && (
        <ScheduledReportManagement organizationId={organizationId} userId={user.id} />
      )}

      {activeTab === 'history' && user && (
        <ReportHistoryManagement organizationId={organizationId} userId={user.id} />
      )}

      {activeTab === 'basic' && (
        <>
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                  <FileText className="w-7 h-7 mr-3 text-blue-600" />
                  チームレポート
                </h2>
                <p className="text-gray-600 mt-1">{team.name}の選手コンディションレポート</p>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={refreshReports}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg transition-colors flex items-center space-x-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>更新</span>
                </button>
                <button
                  onClick={() => setShowGeneratePanel(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>レポート生成</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mt-6">
              <div className="bg-blue-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-blue-600">{reports.length}</div>
                <div className="text-sm text-blue-700">生成済みレポート</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-green-600">
                  {reports.filter(r => r.viewed_at).length}
                </div>
                <div className="text-sm text-green-700">閲覧済み</div>
              </div>
              <div className="bg-yellow-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-yellow-600">
                  {reports.filter(r => !r.viewed_at).length}
                </div>
                <div className="text-sm text-yellow-700">未閲覧</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {reports[0]?.summary_data?.totalAthletes || 0}
                </div>
                <div className="text-sm text-purple-700">対象選手数</div>
              </div>
            </div>
          </div>

          {/* レポート一覧 */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">生成済みレポート</h3>

            {reports.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h4 className="text-lg font-medium text-gray-900 mb-2">レポートがありません</h4>
                <p className="text-gray-600 mb-4">「レポート生成」ボタンから新しいレポートを作成してください。</p>
                <button
                  onClick={() => setShowGeneratePanel(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors inline-flex items-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>レポート生成</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {reports.map((report) => (
                  <div
                    key={report.id}
                    className={`border rounded-lg p-4 hover:shadow-md transition-shadow ${
                      !report.viewed_at ? 'border-blue-300 bg-blue-50' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h4 className="text-lg font-semibold text-gray-900">{report.title}</h4>
                          {!report.viewed_at && (
                            <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full">
                              新規
                            </span>
                          )}
                        </div>

                        <div className="flex items-center space-x-4 text-sm text-gray-600 mb-3">
                          <span className="flex items-center">
                            <Calendar className="w-4 h-4 mr-1" />
                            {report.period_start} 〜 {report.period_end}
                          </span>
                          <span className="flex items-center">
                            <Clock className="w-4 h-4 mr-1" />
                            {new Date(report.generated_at).toLocaleString('ja-JP')}
                          </span>
                          <span className="flex items-center">
                            <Eye className="w-4 h-4 mr-1" />
                            {report.view_count}回閲覧
                          </span>
                        </div>

                        {report.summary_data && (
                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-3">
                            <div className="bg-gray-50 rounded p-2">
                              <div className="text-xs text-gray-600">選手数</div>
                              <div className="text-lg font-bold text-gray-900">
                                {report.summary_data.activeAthletes || 0}
                              </div>
                            </div>
                            <div className="bg-blue-50 rounded p-2">
                              <div className="text-xs text-blue-600">平均ACWR</div>
                              <div className="text-lg font-bold text-blue-900">
                                {(report.summary_data.teamAverageACWR || 0).toFixed(2)}
                              </div>
                            </div>
                            <div className="bg-red-50 rounded p-2">
                              <div className="text-xs text-red-600">高リスク</div>
                              <div className="text-lg font-bold text-red-900">
                                {report.summary_data.highRiskCount || 0}名
                              </div>
                            </div>
                            <div className="bg-yellow-50 rounded p-2">
                              <div className="text-xs text-yellow-600">中リスク</div>
                              <div className="text-lg font-bold text-yellow-900">
                                {report.summary_data.mediumRiskCount || 0}名
                              </div>
                            </div>
                            <div className="bg-orange-50 rounded p-2">
                              <div className="text-xs text-orange-600">アラート</div>
                              <div className="text-lg font-bold text-orange-900">
                                {report.summary_data.criticalAlerts || 0}件
                              </div>
                            </div>
                          </div>
                        )}

                        {report.insights && report.insights.length > 0 && (
                          <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                            <div className="flex items-start">
                              <TrendingUp className="w-4 h-4 text-yellow-600 mr-2 mt-0.5 flex-shrink-0" />
                              <div className="text-sm text-yellow-800">
                                {report.insights[0]}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center space-x-2 ml-4">
                        <button
                          onClick={() => handleViewReport(report)}
                          className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg transition-colors"
                          title="詳細表示"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteReport(report.id)}
                          className="bg-red-600 hover:bg-red-700 text-white p-2 rounded-lg transition-colors"
                          title="削除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
      </div>

      {/* レポート生成パネル */}
      {showGeneratePanel && (
            <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-t-2xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <BarChart3 className="w-8 h-8" />
                      <div>
                        <h2 className="text-2xl font-bold">レポート生成</h2>
                        <p className="text-blue-100">{team.name}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowGeneratePanel(false)}
                      className="bg-blue-500 hover:bg-blue-400 rounded-full p-2 transition-colors"
                    >
                      <span className="text-2xl">×</span>
                    </button>
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                      <Calendar className="w-5 h-5 mr-2 text-blue-600" />
                      レポート期間の選択
                    </h3>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                      {[
                        { value: 'weekly', label: '1週間' },
                        { value: 'monthly', label: '1ヶ月' },
                        { value: 'quarterly', label: '3ヶ月' },
                        { value: 'semi_annual', label: '6ヶ月' },
                        { value: 'annual', label: '1年' },
                        { value: 'custom', label: 'カスタム' }
                      ].map((period) => (
                        <button
                          key={period.value}
                          onClick={() => setSelectedPeriod(period.value as any)}
                          className={`p-3 rounded-lg text-sm font-medium transition-colors ${
                            selectedPeriod === period.value
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {period.label}
                        </button>
                      ))}
                    </div>

                    {selectedPeriod === 'custom' && (
                      <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            開始日
                          </label>
                          <input
                            type="date"
                            value={customStartDate}
                            onChange={(e) => setCustomStartDate(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            終了日
                          </label>
                          <input
                            type="date"
                            value={customEndDate}
                            onChange={(e) => setCustomEndDate(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-medium text-blue-900 mb-2">レポートに含まれるデータ</h4>
                    <div className="text-sm text-blue-700 space-y-1">
                      <p>✓ トレーニング負荷とACWR分析</p>
                      <p>✓ 体重変化の推移</p>
                      <p>✓ 睡眠とモチベーションデータ</p>
                      <p>✓ パフォーマンステスト結果</p>
                      <p>✓ 怪我リスクアラート</p>
                      <p>✓ チーム平均との比較</p>
                      <p>✓ インサイトと推奨事項</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-end space-x-3">
                    <button
                      onClick={() => setShowGeneratePanel(false)}
                      className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                      disabled={generating}
                    >
                      キャンセル
                    </button>
                    <button
                      onClick={handleGenerateReport}
                      disabled={generating || (selectedPeriod === 'custom' && (!customStartDate || !customEndDate))}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors disabled:opacity-50 flex items-center space-x-2"
                    >
                      {generating ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          <span>生成中...</span>
                        </>
                      ) : (
                        <>
                          <BarChart3 className="w-4 h-4" />
                          <span>レポート生成</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
      )}

      {/* レポート詳細モーダル */}
      {selectedReport && (
            <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto">
              <div className="bg-white rounded-2xl shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
                <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-t-2xl sticky top-0 z-10">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold">{selectedReport.title}</h2>
                      <p className="text-blue-100">
                        {selectedReport.period_start} 〜 {selectedReport.period_end}
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedReport(null)}
                      className="bg-blue-500 hover:bg-blue-400 rounded-full p-2 transition-colors"
                    >
                      <span className="text-2xl">×</span>
                    </button>
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  {/* サマリー */}
                  {selectedReport.summary_data && (
                    <div className="bg-gray-50 rounded-lg p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">チーム概要</h3>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="bg-white rounded-lg p-4 text-center">
                          <div className="text-2xl font-bold text-gray-900">
                            {selectedReport.summary_data.activeAthletes}
                          </div>
                          <div className="text-sm text-gray-600">活動選手数</div>
                        </div>
                        <div className="bg-white rounded-lg p-4 text-center">
                          <div className="text-2xl font-bold text-blue-600">
                            {selectedReport.summary_data.teamAverageACWR?.toFixed(2) || '0.00'}
                          </div>
                          <div className="text-sm text-gray-600">平均ACWR</div>
                        </div>
                        <div className="bg-white rounded-lg p-4 text-center">
                          <div className="text-2xl font-bold text-red-600">
                            {selectedReport.summary_data.highRiskCount}
                          </div>
                          <div className="text-sm text-gray-600">高リスク選手</div>
                        </div>
                        <div className="bg-white rounded-lg p-4 text-center">
                          <div className="text-2xl font-bold text-orange-600">
                            {selectedReport.summary_data.criticalAlerts}
                          </div>
                          <div className="text-sm text-gray-600">重要アラート</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* インサイト */}
                  {selectedReport.insights && selectedReport.insights.length > 0 && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                        <TrendingUp className="w-5 h-5 mr-2 text-yellow-600" />
                        インサイト
                      </h3>
                      <div className="space-y-2">
                        {selectedReport.insights.map((insight: string, index: number) => (
                          <p key={index} className="text-sm text-gray-700">
                            • {insight}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 推奨事項 */}
                  {selectedReport.recommendations && selectedReport.recommendations.length > 0 && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                        <AlertTriangle className="w-5 h-5 mr-2 text-blue-600" />
                        推奨事項
                      </h3>
                      <div className="space-y-2">
                        {selectedReport.recommendations.map((rec: string, index: number) => (
                          <p key={index} className="text-sm text-gray-700">
                            • {rec}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 選手別データ */}
                  {selectedReport.detailed_data?.athletes && (
                    <div className="bg-white border border-gray-200 rounded-lg p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                        <Users className="w-5 h-5 mr-2 text-gray-600" />
                        選手別データ
                      </h3>
                      <div className="space-y-4">
                        {selectedReport.detailed_data.athletes.map((athlete: any) => (
                          <div key={athlete.athleteId} className="border border-gray-200 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="text-lg font-semibold text-gray-900">{athlete.athleteName}</h4>
                              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getRiskLevelColor(athlete.acwrData.riskLevel)}`}>
                                {getRiskLevelLabel(athlete.acwrData.riskLevel)}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
                              <div>
                                <div className="text-gray-600">トレーニング</div>
                                <div className="font-semibold text-gray-900">{athlete.trainingRecords.totalSessions}回</div>
                              </div>
                              <div>
                                <div className="text-gray-600">ACWR</div>
                                <div className="font-semibold text-gray-900">{athlete.acwrData.current.toFixed(2)}</div>
                              </div>
                              <div>
                                <div className="text-gray-600">睡眠</div>
                                <div className="font-semibold text-gray-900">
                                  {athlete.sleepData.averageHours?.toFixed(1) || '-'}h
                                </div>
                              </div>
                              <div>
                                <div className="text-gray-600">モチベ</div>
                                <div className="font-semibold text-gray-900">
                                  {athlete.motivationData.averageMotivation?.toFixed(1) || '-'}
                                </div>
                              </div>
                              <div>
                                <div className="text-gray-600">アラート</div>
                                <div className="font-semibold text-red-600">{athlete.alerts.high}件</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
      )}
        </>
      )}
    </div>
  );
}
