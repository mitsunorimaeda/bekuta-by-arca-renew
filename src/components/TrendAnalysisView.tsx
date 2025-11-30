import React, { useState } from 'react';
import { TrendAnalysis, WeeklyTrend, MonthlyTrend, TrendInsight } from '../lib/trendAnalysis';
import { TrendChart } from './TrendChart';
import { TrendInsights } from './TrendInsights';
import { TrendRecommendations } from './TrendRecommendations';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Calendar, 
  BarChart3, 
  AlertTriangle,
  CheckCircle,
  Info,
  RefreshCw
} from 'lucide-react';

interface TrendAnalysisViewProps {
  trendAnalysis: TrendAnalysis | null;
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
}

export function TrendAnalysisView({ trendAnalysis, loading, error, onRefresh }: TrendAnalysisViewProps) {
  const [activeTab, setActiveTab] = useState<'weekly' | 'monthly' | 'insights'>('weekly');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('all');

  const getTrendIcon = (direction: string) => {
    switch (direction) {
      case 'increasing':
        return <TrendingUp className="w-5 h-5 text-red-500" />;
      case 'decreasing':
        return <TrendingDown className="w-5 h-5 text-blue-500" />;
      default:
        return <Minus className="w-5 h-5 text-green-500" />;
    }
  };

  const getTrendColor = (direction: string) => {
    switch (direction) {
      case 'increasing':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'decreasing':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      default:
        return 'text-green-600 bg-green-50 border-green-200';
    }
  };

  const getInsightIcon = (type: TrendInsight['type']) => {
    switch (type) {
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-orange-500" />;
      case 'positive':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      default:
        return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const formatDateRange = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    return `${start.getMonth() + 1}/${start.getDate()}~${end.getMonth() + 1}/${end.getDate()}`;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (!trendAnalysis) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <BarChart3 className="w-6 h-6 text-purple-600" />
            <h2 className="text-xl font-semibold text-gray-900">ACWR傾向分析</h2>
          </div>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg transition-colors flex items-center space-x-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>更新</span>
            </button>
          )}
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start">
            <Info className="w-5 h-5 text-amber-600 mr-3 mt-0.5" />
            <div>
              <h3 className="font-medium text-amber-900 mb-1">データ不足</h3>
              <p className="text-sm text-amber-700">
                {error || '十分なデータがありません。継続的な練習記録の入力をお願いします。'}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <BarChart3 className="w-6 h-6 text-purple-600" />
            <h2 className="text-xl font-semibold text-gray-900">ACWR傾向分析</h2>
          </div>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg transition-colors flex items-center space-x-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>更新</span>
            </button>
          )}
        </div>

        {error && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
            <div className="flex items-start">
              <Info className="w-5 h-5 text-amber-600 mr-3 mt-0.5" />
              <div>
                <h3 className="font-medium text-amber-900 mb-1">データ状況</h3>
                <p className="text-sm text-amber-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Overall Trend Summary */}
        <div className={`border rounded-lg p-4 ${getTrendColor(trendAnalysis.overallTrend.direction)}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {getTrendIcon(trendAnalysis.overallTrend.direction)}
              <div>
                <h3 className="font-semibold">全体的なトレンド</h3>
                <p className="text-sm opacity-90">{trendAnalysis.overallTrend.description}</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold">
                {trendAnalysis.overallTrend.percentage.toFixed(1)}%
              </div>
              <div className="text-sm opacity-75">変化率</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-xl shadow-sm">
        <div className="border-b border-gray-200">
          <nav className="flex px-6">
            <button
              onClick={() => setActiveTab('weekly')}
              className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                activeTab === 'weekly'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>週間分析</span>
            </button>
            <button
              onClick={() => setActiveTab('monthly')}
              className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ml-8 ${
                activeTab === 'monthly'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>月間分析</span>
            </button>
            <button
              onClick={() => setActiveTab('insights')}
              className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ml-8 ${
                activeTab === 'insights'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              <span>インサイト</span>
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'weekly' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">週間トレンド</h3>
                <select
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  className="text-sm border border-gray-300 rounded px-3 py-1"
                >
                  <option value="all">全期間</option>
                  <option value="last4">直近4週間</option>
                  <option value="last8">直近8週間</option>
                </select>
              </div>

              <TrendChart 
                data={trendAnalysis.weeklyTrends} 
                type="weekly"
                period={selectedPeriod}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {trendAnalysis.weeklyTrends.slice(-6).map((week, index) => (
                  <div key={`${week.startDate}-${week.endDate}`} className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-gray-900">
                        {formatDateRange(week.startDate, week.endDate)}
                      </h4>
                      <div className="flex items-center space-x-1">
                        {getTrendIcon(week.trend)}
                        <span className="text-sm text-gray-600">
                          {week.trendPercentage.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">平均ACWR:</span>
                        <span className="font-semibold">{week.averageACWR}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">練習日数:</span>
                        <span className="font-semibold">{week.trainingDays}日</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">リスク日:</span>
                        <span className={`font-semibold ${week.riskDays > 2 ? 'text-red-600' : 'text-green-600'}`}>
                          {week.riskDays}日
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">総負荷:</span>
                        <span className="font-semibold">{week.totalLoad}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'monthly' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">月間トレンド</h3>

              <TrendChart 
                data={trendAnalysis.monthlyTrends} 
                type="monthly"
                period={selectedPeriod}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {trendAnalysis.monthlyTrends.slice(-4).map((month) => (
                  <div key={`${month.year}-${month.month}`} className="bg-gray-50 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-medium text-gray-900">
                        {month.year}年{month.monthName}
                      </h4>
                      <div className="flex items-center space-x-1">
                        {getTrendIcon(month.trend)}
                        <span className="text-sm text-gray-600">
                          {month.trendPercentage.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-purple-600">
                          {month.averageACWR}
                        </div>
                        <div className="text-xs text-gray-600">平均ACWR</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">
                          {month.trainingDays}
                        </div>
                        <div className="text-xs text-gray-600">練習日数</div>
                      </div>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">最大ACWR:</span>
                        <span className="font-semibold">{month.maxACWR}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">最小ACWR:</span>
                        <span className="font-semibold">{month.minACWR}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">リスク日:</span>
                        <span className={`font-semibold ${month.riskDays > 6 ? 'text-red-600' : 'text-green-600'}`}>
                          {month.riskDays}日
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">総負荷:</span>
                        <span className="font-semibold">{month.totalLoad}</span>
                      </div>
                    </div>

                    {month.weeklyBreakdown.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <h5 className="text-sm font-medium text-gray-700 mb-2">週間内訳</h5>
                        <div className="space-y-1">
                          {month.weeklyBreakdown.map((week) => (
                            <div key={`${week.startDate}-${week.endDate}`} className="flex justify-between text-xs">
                              <span>{formatDateRange(week.startDate, week.endDate)}:</span>
                              <span className="font-medium">{week.averageACWR}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'insights' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">インサイトと推奨事項</h3>

              <TrendInsights insights={trendAnalysis.insights} />
              
              <TrendRecommendations recommendations={trendAnalysis.recommendations} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}