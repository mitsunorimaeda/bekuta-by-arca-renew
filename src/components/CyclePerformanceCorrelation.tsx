import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, Activity } from 'lucide-react';
import { useMenstrualCycleData } from '../hooks/useMenstrualCycleData';
import { useTrainingData } from '../hooks/useTrainingData';
import { usePerformanceData } from '../hooks/usePerformanceData';

interface CyclePerformanceCorrelationProps {
  userId: string;
}

export function CyclePerformanceCorrelation({ userId }: CyclePerformanceCorrelationProps) {
  const { cycles, getCyclePhase } = useMenstrualCycleData(userId);
  const { records: trainingRecords } = useTrainingData(userId);
  const { records: performanceRecords } = usePerformanceData(userId, 'jump');

  const analyzeCorrelation = () => {
    const phaseData = {
      menstrual: { count: 0, totalLoad: 0, totalRPE: 0, performances: 0, totalScore: 0 },
      follicular: { count: 0, totalLoad: 0, totalRPE: 0, performances: 0, totalScore: 0 },
      ovulatory: { count: 0, totalLoad: 0, totalRPE: 0, performances: 0, totalScore: 0 },
      luteal: { count: 0, totalLoad: 0, totalRPE: 0, performances: 0, totalScore: 0 },
    };

    trainingRecords.forEach((record) => {
      const recordDate = new Date(record.date);
      for (const cycle of cycles) {
        const phase = getCyclePhase(cycle, recordDate);
        if (phase && phase in phaseData) {
          phaseData[phase as keyof typeof phaseData].count++;
          phaseData[phase as keyof typeof phaseData].totalLoad += record.load;
          phaseData[phase as keyof typeof phaseData].totalRPE += record.rpe;
          break;
        }
      }
    });

    performanceRecords.forEach((record) => {
      const recordDate = new Date(record.test_date);
      for (const cycle of cycles) {
        const phase = getCyclePhase(cycle, recordDate);
        if (phase && phase in phaseData) {
          phaseData[phase as keyof typeof phaseData].performances++;
          phaseData[phase as keyof typeof phaseData].totalScore += record.score;
          break;
        }
      }
    });

    return Object.entries(phaseData).map(([phase, data]) => ({
      phase: phase === 'menstrual' ? '月経期' : phase === 'follicular' ? '卵胞期' : phase === 'ovulatory' ? '排卵期' : '黄体期',
      avgLoad: data.count > 0 ? (data.totalLoad / data.count).toFixed(1) : 0,
      avgRPE: data.count > 0 ? (data.totalRPE / data.count).toFixed(1) : 0,
      avgPerformance: data.performances > 0 ? (data.totalScore / data.performances).toFixed(1) : 0,
      sessionCount: data.count,
    }));
  };

  const correlationData = analyzeCorrelation();
  const hasData = correlationData.some((d) => d.sessionCount > 0);

  const getInsights = () => {
    if (!hasData) return [];

    const insights: string[] = [];
    const sortedByLoad = [...correlationData].sort((a, b) => Number(b.avgLoad) - Number(a.avgLoad));
    const sortedByPerformance = [...correlationData].sort(
      (a, b) => Number(b.avgPerformance) - Number(a.avgPerformance)
    );

    if (sortedByLoad[0]?.avgLoad > 0) {
      insights.push(
        `${sortedByLoad[0].phase}に最も高いトレーニング負荷（平均${sortedByLoad[0].avgLoad}）`
      );
    }

    if (sortedByPerformance[0]?.avgPerformance > 0) {
      insights.push(
        `${sortedByPerformance[0].phase}に最高のパフォーマンス`
      );
    }

    const follicular = correlationData.find((d) => d.phase === 'Follicular');
    const luteal = correlationData.find((d) => d.phase === 'Luteal');

    if (follicular && luteal && Number(follicular.avgRPE) < Number(luteal.avgRPE)) {
      insights.push(
        '卵胞期は主観的運動強度が低い - トレーニング強度を上げることを検討してください'
      );
    }

    return insights;
  };

  const insights = getInsights();

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
      <div className="flex items-center gap-2 mb-6">
        <TrendingUp className="w-6 h-6 text-purple-600 dark:text-purple-400" />
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
          周期とパフォーマンスの相関
        </h3>
      </div>

      {!hasData ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>相関を表示するにはデータが不足しています。</p>
          <p className="text-sm mt-2">周期とトレーニングデータを記録し続けてください！</p>
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={correlationData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
              <XAxis dataKey="phase" stroke="#6B7280" style={{ fontSize: '12px' }} />
              <YAxis stroke="#6B7280" style={{ fontSize: '12px' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#F3F4F6',
                }}
              />
              <Legend />
              <Bar dataKey="avgLoad" fill="#3B82F6" name="平均負荷" />
              <Bar dataKey="avgRPE" fill="#EF4444" name="平均RPE" />
              <Bar dataKey="avgPerformance" fill="#10B981" name="平均パフォーマンス" />
            </BarChart>
          </ResponsiveContainer>

          {insights.length > 0 && (
            <div className="mt-6 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <h4 className="font-semibold text-purple-900 dark:text-purple-100 mb-2">
                インサイト
              </h4>
              <ul className="space-y-2 text-sm text-purple-800 dark:text-purple-200">
                {insights.map((insight, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-purple-500 mt-1">•</span>
                    <span>{insight}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
            <p>{trainingRecords.length}回のトレーニングと{performanceRecords.length}回のパフォーマンステストに基づく</p>
          </div>
        </>
      )}
    </div>
  );
}
