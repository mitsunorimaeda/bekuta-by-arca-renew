import React from 'react';
import { Lightbulb, CheckCircle, AlertTriangle, Target, ArrowRight } from 'lucide-react';

interface TrendRecommendationsProps {
  recommendations: string[];
}

export function TrendRecommendations({ recommendations }: TrendRecommendationsProps) {
  const categorizeRecommendation = (recommendation: string) => {
    const lowerRec = recommendation.toLowerCase();
    
    if (lowerRec.includes('高い') || lowerRec.includes('リスク') || lowerRec.includes('注意') || lowerRec.includes('下げ')) {
      return {
        type: 'warning' as const,
        icon: AlertTriangle,
        color: 'text-orange-600',
        bgColor: 'bg-orange-50',
        borderColor: 'border-orange-200'
      };
    } else if (lowerRec.includes('良好') || lowerRec.includes('維持') || lowerRec.includes('適切')) {
      return {
        type: 'positive' as const,
        icon: CheckCircle,
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200'
      };
    } else {
      return {
        type: 'neutral' as const,
        icon: Target,
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200'
      };
    }
  };

  const getPriorityLevel = (recommendation: string) => {
    const lowerRec = recommendation.toLowerCase();
    
    if (lowerRec.includes('即座') || lowerRec.includes('緊急') || lowerRec.includes('高リスク')) {
      return { level: '高', color: 'text-red-600 bg-red-100' };
    } else if (lowerRec.includes('検討') || lowerRec.includes('注意') || lowerRec.includes('見直し')) {
      return { level: '中', color: 'text-yellow-600 bg-yellow-100' };
    } else {
      return { level: '低', color: 'text-blue-600 bg-blue-100' };
    }
  };

  if (recommendations.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-6 text-center">
        <Lightbulb className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">推奨事項を準備中</h3>
        <p className="text-gray-600">
          データ分析に基づいた個別の推奨事項が生成されます。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h4 className="text-md font-medium text-gray-900 flex items-center">
        <Lightbulb className="w-5 h-5 text-yellow-600 mr-2" />
        推奨事項
      </h4>

      <div className="space-y-3">
        {recommendations.map((recommendation, index) => {
          const category = categorizeRecommendation(recommendation);
          const priority = getPriorityLevel(recommendation);
          const IconComponent = category.icon;

          return (
            <div
              key={index}
              className={`${category.bgColor} ${category.borderColor} border rounded-lg p-4 transition-all duration-200 hover:shadow-md`}
            >
              <div className="flex items-start space-x-3">
                <IconComponent className={`w-5 h-5 ${category.color} mt-0.5 flex-shrink-0`} />
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${priority.color}`}>
                      優先度: {priority.level}
                    </span>
                    <ArrowRight className="w-4 h-4 text-gray-400" />
                  </div>
                  <p className={`${category.color} text-sm leading-relaxed`}>
                    {recommendation}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Action Summary */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-4">
        <h5 className="font-medium text-purple-900 mb-2 flex items-center">
          <Target className="w-4 h-4 mr-2" />
          アクションプラン
        </h5>
        
        <div className="space-y-2 text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
            <span className="text-purple-800">
              高優先度の推奨事項: {recommendations.filter(r => getPriorityLevel(r).level === '高').length}件
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
            <span className="text-purple-800">
              中優先度の推奨事項: {recommendations.filter(r => getPriorityLevel(r).level === '中').length}件
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <span className="text-purple-800">
              低優先度の推奨事項: {recommendations.filter(r => getPriorityLevel(r).level === '低').length}件
            </span>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-purple-200">
          <p className="text-xs text-purple-700">
            💡 推奨事項は定期的に更新されます。継続的な練習記録の入力により、より精度の高い分析が可能になります。
          </p>
        </div>
      </div>
    </div>
  );
}