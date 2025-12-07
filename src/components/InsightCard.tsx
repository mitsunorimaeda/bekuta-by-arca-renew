import React from 'react';
import { TrendingUp, TrendingDown, AlertTriangle, Info, Lightbulb } from 'lucide-react';
import { ACWRData } from '../lib/acwr';
import { Database } from '../lib/database.types';

type WeightRecord = Database['public']['Tables']['weight_records']['Row'];

interface InsightCardProps {
  acwrData: ACWRData[];
  weightData: WeightRecord[];
}

interface Insight {
  type: 'info' | 'warning' | 'success' | 'discovery';
  title: string;
  description: string;
  icon: React.ReactNode;
}

export function InsightCard({ acwrData, weightData }: InsightCardProps) {
  const generateInsights = (): Insight[] => {
    const insights: Insight[] = [];

    if (weightData.length < 2 || acwrData.length < 2) {
      return [{
        type: 'info',
        title: 'データを蓄積中',
        description: 'もう少しデータが蓄積されると、体重とACWRの関連性を分析できます。',
        icon: <Info className="w-5 h-5" />
      }];
    }

    const sortedWeights = [...weightData].sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const recentWeights = sortedWeights.slice(-7);
    if (recentWeights.length >= 2) {
      const firstWeight = Number(recentWeights[0].weight_kg);
      const lastWeight = Number(recentWeights[recentWeights.length - 1].weight_kg);
      const weightChange = lastWeight - firstWeight;
      const changePercent = ((weightChange / firstWeight) * 100).toFixed(1);

      if (Math.abs(weightChange) >= 2) {
        const recentACWR = acwrData.slice(-7);
        const highRiskDays = recentACWR.filter(d => d.riskLevel === 'high' || d.riskLevel === 'caution').length;

        if (weightChange < 0 && highRiskDays >= 2) {
          insights.push({
            type: 'warning',
            title: '注意: 体重減少と高負荷の組み合わせ',
            description: `最近1週間で体重が${Math.abs(weightChange).toFixed(1)}kg減少し、同時にACWRリスクが高い日が${highRiskDays}日ありました。疲労蓄積に注意が必要です。`,
            icon: <AlertTriangle className="w-5 h-5" />
          });
        } else if (Math.abs(weightChange) >= 2) {
          insights.push({
            type: 'info',
            title: `体重が${weightChange > 0 ? '増加' : '減少'}傾向`,
            description: `最近1週間で${changePercent}%（${weightChange > 0 ? '+' : ''}${weightChange.toFixed(1)}kg）変化しています。`,
            icon: weightChange > 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />
          });
        }
      }
    }

    const last30Days = acwrData.slice(-30);
    const goodDays = last30Days.filter(d => d.riskLevel === 'good').length;
    const highRiskDays = last30Days.filter(d => d.riskLevel === 'high').length;

    if (goodDays >= 20 && weightData.length >= 10) {
      const recent = sortedWeights.slice(-10);
      const avgWeight = recent.reduce((sum, w) => sum + Number(w.weight_kg), 0) / recent.length;
      const variance = recent.reduce((sum, w) => sum + Math.pow(Number(w.weight_kg) - avgWeight, 2), 0) / recent.length;

      if (variance < 1) {
        insights.push({
          type: 'success',
          title: '良好なバランス',
          description: '体重が安定し、ACWRも良好な範囲を維持しています。このペースを継続しましょう。',
          icon: <Lightbulb className="w-5 h-5" />
        });
      }
    }

    if (highRiskDays >= 5) {
      insights.push({
        type: 'warning',
        title: '高負荷の日が多め',
        description: `過去30日間で${highRiskDays}日が高リスクでした。休養と栄養補給を意識しましょう。`,
        icon: <AlertTriangle className="w-5 h-5" />
      });
    }

    const allWeights = sortedWeights.map(w => Number(w.weight_kg));
    if (allWeights.length >= 14) {
      const firstHalf = allWeights.slice(0, 7);
      const secondHalf = allWeights.slice(-7);

      const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

      const firstHalfACWR = acwrData.slice(0, 7).map(d => Number(d.acwr));
      const secondHalfACWR = acwrData.slice(-7).map(d => Number(d.acwr));

      const avgACWRFirst = firstHalfACWR.reduce((a, b) => a + b, 0) / firstHalfACWR.length;
      const avgACWRSecond = secondHalfACWR.reduce((a, b) => a + b, 0) / secondHalfACWR.length;

      if ((avgSecond < avgFirst - 1) && (avgACWRSecond > avgACWRFirst + 0.2)) {
        insights.push({
          type: 'discovery',
          title: '発見: 体重減少時にACWR上昇',
          description: '体重が減少している期間は、ACWRが高くなる傾向があります。栄養補給を意識しましょう。',
          icon: <Lightbulb className="w-5 h-5" />
        });
      }
    }

    if (insights.length === 0) {
      insights.push({
        type: 'info',
        title: '順調です',
        description: '現在のところ、特に注意すべき点はありません。このペースを維持しましょう。',
        icon: <Info className="w-5 h-5" />
      });
    }

    return insights;
  };

  const insights = generateInsights();

  const getColorClasses = (type: string) => {
    switch (type) {
      case 'warning':
        return {
          bg: 'bg-yellow-50 dark:bg-yellow-900/20',
          border: 'border-yellow-200 dark:border-yellow-800',
          icon: 'text-yellow-600 dark:text-yellow-400',
          title: 'text-yellow-900 dark:text-yellow-200',
          desc: 'text-yellow-700 dark:text-yellow-300'
        };
      case 'success':
        return {
          bg: 'bg-green-50 dark:bg-green-900/20',
          border: 'border-green-200 dark:border-green-800',
          icon: 'text-green-600 dark:text-green-400',
          title: 'text-green-900 dark:text-green-200',
          desc: 'text-green-700 dark:text-green-300'
        };
      case 'discovery':
        return {
          bg: 'bg-purple-50 dark:bg-purple-900/20',
          border: 'border-purple-200 dark:border-purple-800',
          icon: 'text-purple-600 dark:text-purple-400',
          title: 'text-purple-900 dark:text-purple-200',
          desc: 'text-purple-700 dark:text-purple-300'
        };
      default:
        return {
          bg: 'bg-blue-50 dark:bg-blue-900/20',
          border: 'border-blue-200 dark:border-blue-800',
          icon: 'text-blue-600 dark:text-blue-400',
          title: 'text-blue-900 dark:text-blue-200',
          desc: 'text-blue-700 dark:text-blue-300'
        };
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
        <Lightbulb className="w-5 h-5 mr-2 text-yellow-500" />
        インサイト
      </h3>
      {insights.map((insight, index) => {
        const colors = getColorClasses(insight.type);
        return (
          <div
            key={index}
            className={`${colors.bg} ${colors.border} border rounded-lg p-4 transition-colors`}
          >
            <div className="flex items-start">
              <div className={`${colors.icon} mr-3 mt-0.5`}>
                {insight.icon}
              </div>
              <div className="flex-1">
                <h4 className={`font-semibold ${colors.title} mb-1`}>
                  {insight.title}
                </h4>
                <p className={`text-sm ${colors.desc}`}>
                  {insight.description}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
