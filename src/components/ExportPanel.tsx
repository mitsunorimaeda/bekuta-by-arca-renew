import React, { useState } from 'react';
import { User, TrainingRecord } from '../lib/supabase';
import { ACWRData } from '../lib/acwr';
import { TrendAnalysis } from '../lib/trendAnalysis';
import {
  exportToCSV,
  exportToJSON,
  getDateRange,
  ExportData
} from '../lib/exportUtils';
import {
  Download,
  Calendar,
  FileSpreadsheet,
  FileJson,
  X,
  Clock
} from 'lucide-react';

interface ExportPanelProps {
  user: User;
  trainingRecords: TrainingRecord[];
  acwrData: ACWRData[];
  trendAnalysis?: TrendAnalysis;
  onClose: () => void;
}

export function ExportPanel({ 
  user, 
  trainingRecords, 
  acwrData, 
  trendAnalysis, 
  onClose 
}: ExportPanelProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'quarter' | 'custom'>('month');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async (format: 'csv' | 'json') => {
    setIsExporting(true);

    try {
      const dateRange = selectedPeriod === 'custom'
        ? { start: customStartDate, end: customEndDate }
        : getDateRange(selectedPeriod);

      const filteredRecords = trainingRecords.filter(record =>
        record.date >= dateRange.start && record.date <= dateRange.end
      );

      const filteredACWR = acwrData.filter(data =>
        data.date >= dateRange.start && data.date <= dateRange.end
      );

      const exportData: ExportData = {
        user,
        trainingRecords: filteredRecords,
        acwrData: filteredACWR,
        trendAnalysis,
        exportDate: new Date().toLocaleString('ja-JP'),
        dateRange
      };

      switch (format) {
        case 'csv':
          exportToCSV(exportData);
          break;
        case 'json':
          exportToJSON(exportData);
          break;
      }

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

  const getRecordCount = () => {
    if (selectedPeriod === 'custom' && customStartDate && customEndDate) {
      return trainingRecords.filter(record => 
        record.date >= customStartDate && record.date <= customEndDate
      ).length;
    } else if (selectedPeriod !== 'custom') {
      const dateRange = getDateRange(selectedPeriod);
      return trainingRecords.filter(record => 
        record.date >= dateRange.start && record.date <= dateRange.end
      ).length;
    }
    return 0;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-blue-600 text-white p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Download className="w-8 h-8" />
              <div>
                <h2 className="text-2xl font-bold">データエクスポート</h2>
                <p className="text-green-100">{user.name}さんの練習データ</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="bg-green-500 hover:bg-green-400 rounded-full p-2 transition-colors"
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
                      ? 'bg-blue-600 text-white'
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

            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center text-sm text-blue-700">
                <Clock className="w-4 h-4 mr-2" />
                <span>
                  {getPeriodLabel()}: {getRecordCount()}件の練習記録
                </span>
              </div>
            </div>
          </div>

          {/* データエクスポート */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
              <Download className="w-5 h-5 mr-2 text-green-600" />
              データエクスポート
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={() => handleExport('csv')}
                disabled={isExporting}
                className="bg-green-600 hover:bg-green-700 text-white p-3 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span className="text-sm">CSV形式</span>
              </button>
              
              <button
                onClick={() => handleExport('json')}
                disabled={isExporting}
                className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
              >
                <FileJson className="w-4 h-4" />
                <span className="text-sm">JSON形式</span>
              </button>
            </div>
            
            <div className="mt-3 text-xs text-gray-600 space-y-1">
              <p>• CSV: Excel等で開ける表形式データ</p>
              <p>• JSON: 詳細な構造化データ（開発者向け）</p>
            </div>
          </div>

          {/* 使用方法 */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">💡 エクスポートデータの活用方法</h4>
            <div className="text-sm text-blue-700 space-y-1">
              <p>• <strong>CSV:</strong> Excel等で開いて分析、他システムへのインポート</p>
              <p>• <strong>JSON:</strong> 詳細な構造化データ、バックアップ・プログラム利用に最適</p>
            </div>
          </div>

          {isExporting && (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p className="text-sm text-gray-600">エクスポート中...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}