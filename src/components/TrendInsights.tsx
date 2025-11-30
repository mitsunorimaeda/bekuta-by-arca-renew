import React from 'react';
import { TrendInsight } from '../lib/trendAnalysis';
import { AlertTriangle, CheckCircle, Info, TrendingUp, TrendingDown, Target } from 'lucide-react';

interface TrendInsightsProps {
  insights: TrendInsight[];
}

export function TrendInsights({ insights }: TrendInsightsProps) {
  const getInsightStyle = (type: TrendInsight['type']) => {
    switch (type) {
      case 'warning':
        return {
          bgColor: 'bg-orange-50',
          borderColor: 'border-orange-200',
          textColor: 'text-orange-800',
          iconColor: 'text-orange-600',
          icon: AlertTriangle
        };
      case 'positive':
        return {
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          textColor: 'text-green-800',
          iconColor: 'text-green-600',
          icon: CheckCircle
        };
      default:
        return {
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          textColor: 'text-blue-800',
          iconColor: 'text-blue-600',
          icon: Info
        };
    }
  };

  if (insights.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-6 text-center">
        <Info className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">インサイトを生成中</h3>
        <p className="text-gray-600">
          十分なデータが蓄積されると、詳細な分析結果とインサイトが表示されます。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h4 className="text-md font-medium text-gray-900 flex items-center">
        <TrendingUp className="w-5 h-5 text-purple-600 mr-2" />
        分析インサイト
      </h4>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {insights.map((insight, index) => {
          const style = getInsightStyle(insight.type);
          const IconComponent = style.icon;

          return (
            <div
              key={index}
              className={`${style.bgColor} ${style.borderColor} border rounded-lg p-4`}
            >
              <div className="flex items-start space-x-3">
                <IconComponent className={`w-5 h-5 ${style.iconColor} mt-0.5 flex-shrink-0`} />
                <div className="flex-1">
                  <h5 className={`font-semibold ${style.textColor} mb-1`}>
                    {insight.title}
                  </h5>
                  <p className={`text-sm ${style.textColor} mb-3`}>
                    {insight.description}
                  </p>
                  
                  {(insight.value !== undefined || insight.comparison) && (
                    <div className="bg-white bg-opacity-50 rounded p-2 space-y-1">
                      {insight.value !== undefined && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">現在の値:</span>
                          <span className={`font-bold ${style.textColor}`}>
                            {insight.value}
                          </span>
                        </div>
                      )}
                      {insight.comparison && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">比較:</span>
                          <span className="font-medium text-gray-700">
                            {insight.comparison}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary Statistics */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h5 className="font-medium text-gray-900 mb-3 flex items-center">
          <Target className="w-4 h-4 text-gray-600 mr-2" />
          インサイト概要
        </h5>
        
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-orange-600">
              {insights.filter(i => i.type === 'warning').length}
            </div>
            <div className="text-sm text-gray-600">警告</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600">
              {insights.filter(i => i.type === 'positive').length}
            </div>
            <div className="text-sm text-gray-600">良好</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-blue-600">
              {insights.filter(i => i.type === 'neutral').length}
            </div>
            <div className="text-sm text-gray-600">情報</div>
          </div>
        </div>
      </div>
    </div>
  );
}