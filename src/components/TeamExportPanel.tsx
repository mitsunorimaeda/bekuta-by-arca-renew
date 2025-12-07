import React, { useState, useEffect } from 'react';
import { User, Team, TrainingRecord, supabase } from '../lib/supabase';
import { calculateACWR, ACWRData } from '../lib/acwr';
import {
  exportTeamToCSV,
  getDateRange,
  TeamExportData
} from '../lib/exportUtils';
import {
  Download,
  Calendar,
  FileSpreadsheet,
  X,
  Users,
  TrendingUp
} from 'lucide-react';

interface TeamExportPanelProps {
  team: Team;
  onClose: () => void;
}

export function TeamExportPanel({ team, onClose }: TeamExportPanelProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'quarter' | 'custom'>('month');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [teamData, setTeamData] = useState<TeamExportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTeamData();
  }, [team.id, selectedPeriod, customStartDate, customEndDate]);

  const fetchTeamData = async () => {
    setLoading(true);
    try {
      // チームの選手を取得
      const { data: athletes, error: athletesError } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'athlete')
        .eq('team_id', team.id);

      if (athletesError) throw athletesError;

      if (!athletes || athletes.length === 0) {
        setTeamData(null);
        setLoading(false);
        return;
      }

      const dateRange = selectedPeriod === 'custom' && customStartDate && customEndDate
        ? { start: customStartDate, end: customEndDate }
        : getDateRange(selectedPeriod);

      const athleteIds = athletes.map(athlete => athlete.id);

      // 全選手の練習記録を取得
      const { data: allRecords, error: recordsError } = await supabase
        .from('training_records')
        .select('*')
        .in('user_id', athleteIds)
        .gte('date', dateRange.start)
        .lte('date', dateRange.end)
        .order('date', { ascending: true });

      if (recordsError) throw recordsError;

      // 選手ごとのデータを構築
      const athletesData = athletes.map(athlete => {
        const athleteRecords = allRecords?.filter(r => r.user_id === athlete.id) || [];
        const acwrData = calculateACWR(athleteRecords);
        const latestACWR = acwrData.length > 0 ? acwrData[acwrData.length - 1] : null;

        return {
          user: athlete,
          trainingRecords: athleteRecords,
          acwrData,
          latestACWR: latestACWR?.acwr,
          riskLevel: latestACWR?.riskLevel
        };
      });

      // チームサマリーを計算
      const activeAthletes = athletesData.filter(a => a.trainingRecords.length > 0);
      const acwrValues = activeAthletes
        .map(a => a.latestACWR)
        .filter(acwr => acwr !== undefined) as number[];
      
      const averageACWR = acwrValues.length > 0 
        ? acwrValues.reduce((sum, acwr) => sum + acwr, 0) / acwrValues.length
        : 0;

      const highRiskAthletes = activeAthletes.filter(a => 
        a.riskLevel === 'high' || a.riskLevel === 'caution'
      ).length;

      const teamSummary = {
        totalAthletes: athletes.length,
        activeAthletes: activeAthletes.length,
        averageACWR: Number(averageACWR.toFixed(2)),
        highRiskAthletes
      };

      setTeamData({
        teamName: team.name,
        athletes: athletesData,
        teamSummary,
        exportDate: new Date().toLocaleString('ja-JP'),
        dateRange
      });

    } catch (error) {
      console.error('Error fetching team data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!teamData) return;

    setIsExporting(true);

    try {
      exportTeamToCSV(teamData);

      setTimeout(() => {
        setIsExporting(false);
      }, 1000);

    } catch (error) {
      console.error('Export error:', error);
      alert('エクスポートに失敗しました。もう一度お試しください。');
      setIsExporting(false);
    }
  };

  const getPeriodLabel = () => {
    switch (selectedPeriod) {
      case 'week': return '過去1週間';
      case 'month': return '過去1ヶ月';
      case 'quarter': return '過去3ヶ月';
      case 'custom': return 'カスタム期間';
      default: return '過去1ヶ月';
    }
  };

  const getTotalRecords = () => {
    if (!teamData) return 0;
    return teamData.athletes.reduce((total, athlete) => total + athlete.trainingRecords.length, 0);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Users className="w-8 h-8" />
              <div>
                <h2 className="text-2xl font-bold">チームデータエクスポート</h2>
                <p className="text-purple-100">{team.name}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="bg-purple-500 hover:bg-purple-400 rounded-full p-2 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* 期間選択 */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
              <Calendar className="w-5 h-5 mr-2" />
              エクスポート期間
            </h3>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              {[
                { value: 'week', label: '1週間' },
                { value: 'month', label: '1ヶ月' },
                { value: 'quarter', label: '3ヶ月' },
                { value: 'custom', label: 'カスタム' }
              ].map(period => (
                <button
                  key={period.value}
                  onClick={() => setSelectedPeriod(period.value as any)}
                  className={`p-3 rounded-lg text-sm font-medium transition-colors ${
                    selectedPeriod === period.value
                      ? 'bg-purple-600 text-white'
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {period.label}
                </button>
              ))}
            </div>

            {selectedPeriod === 'custom' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    開始日
                  </label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              </div>
            )}

            {teamData && (
              <div className="mt-4 p-3 bg-purple-50 rounded-lg">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                  <div className="text-center">
                    <div className="font-bold text-purple-700">{teamData.teamSummary.totalAthletes}</div>
                    <div className="text-purple-600">総選手数</div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-purple-700">{teamData.teamSummary.activeAthletes}</div>
                    <div className="text-purple-600">アクティブ</div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-purple-700">{getTotalRecords()}</div>
                    <div className="text-purple-600">練習記録</div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-purple-700">{teamData.teamSummary.averageACWR}</div>
                    <div className="text-purple-600">平均ACWR</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
              <p className="text-gray-600">チームデータを読み込み中...</p>
            </div>
          ) : !teamData ? (
            <div className="text-center py-8">
              <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">データがありません</h3>
              <p className="text-gray-600">選択した期間にチームの練習記録がありません。</p>
            </div>
          ) : (
            <>
              {/* データエクスポート */}
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                  <Download className="w-5 h-5 mr-2 text-green-600" />
                  データエクスポート
                </h3>
                
                <button
                  onClick={handleExport}
                  disabled={isExporting}
                  className="w-full bg-green-600 hover:bg-green-700 text-white p-4 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
                >
                  <FileSpreadsheet className="w-5 h-5" />
                  <span>チームデータ（CSV）</span>
                </button>
                
                <p className="text-xs text-gray-600 mt-2">
                  全選手の練習記録とACWRデータをCSV形式でエクスポート
                </p>
              </div>

              {/* 高リスク選手の警告 */}
              {teamData.teamSummary.highRiskAthletes > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <TrendingUp className="w-6 h-6 text-red-600 mr-3" />
                    <div>
                      <h4 className="font-semibold text-red-900">注意が必要な選手</h4>
                      <p className="text-sm text-red-700">
                        {teamData.teamSummary.highRiskAthletes}名の選手が高リスク状態です。
                        個別に詳細を確認してください。
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {isExporting && (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-2"></div>
                  <p className="text-sm text-gray-600">エクスポート中...</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}