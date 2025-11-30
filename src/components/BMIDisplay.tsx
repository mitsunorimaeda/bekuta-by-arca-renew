import React from 'react';
import { Activity, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import { getBMIAnalysis, calculateAge } from '../lib/bmiCalculations';

interface BMIDisplayProps {
  weightKg: number;
  heightCm: number;
  dateOfBirth?: string | null;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say' | null;
}

export function BMIDisplay({ weightKg, heightCm, dateOfBirth, gender }: BMIDisplayProps) {
  const age = dateOfBirth ? calculateAge(dateOfBirth) : undefined;
  const analysis = getBMIAnalysis(weightKg, heightCm, age, gender);

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'underweight':
        return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'normal':
        return 'text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400';
      case 'overweight':
        return 'text-orange-600 bg-orange-50 dark:bg-orange-900/20 dark:text-orange-400';
      case 'obese':
        return 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400';
      default:
        return 'text-gray-600 bg-gray-50 dark:bg-gray-700 dark:text-gray-400';
    }
  };

  const getRiskIcon = () => {
    if (analysis.healthRisk === 'high') {
      return <AlertCircle className="w-5 h-5 text-red-500" />;
    } else if (analysis.healthRisk === 'increased') {
      return <AlertCircle className="w-5 h-5 text-yellow-500" />;
    }
    return <Activity className="w-5 h-5 text-green-500" />;
  };

  const isWithinIdealRange = weightKg >= analysis.idealWeightRange.min && weightKg <= analysis.idealWeightRange.max;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 transition-colors">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">BMI分析</h3>
        {getRiskIcon()}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">現在のBMI</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              {analysis.bmi.toFixed(1)}
            </p>
          </div>
          <div className={`px-4 py-2 rounded-lg font-medium text-sm ${getCategoryColor(analysis.category)}`}>
            {analysis.categoryLabel}
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            {age && gender ? `${age}歳・${gender === 'male' ? '男性' : gender === 'female' ? '女性' : ''}の` : ''}適正体重範囲
          </p>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">最小</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {analysis.idealWeightRange.min.toFixed(1)} kg
              </p>
            </div>
            <div className="flex-1 mx-4">
              <div className="relative h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                <div
                  className="absolute h-full bg-green-500 rounded-full"
                  style={{
                    left: '0%',
                    width: '100%'
                  }}
                />
                {!isWithinIdealRange && (
                  <div
                    className="absolute h-full w-1 bg-red-500"
                    style={{
                      left: `${Math.min(100, Math.max(0, ((weightKg - analysis.idealWeightRange.min) / (analysis.idealWeightRange.max - analysis.idealWeightRange.min)) * 100))}%`
                    }}
                  />
                )}
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">最大</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {analysis.idealWeightRange.max.toFixed(1)} kg
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
          {weightKg < analysis.idealWeightRange.min ? (
            <>
              <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <p className="text-sm text-blue-700 dark:text-blue-300 flex-1 ml-3">
                適正範囲まで <strong>{(analysis.idealWeightRange.min - weightKg).toFixed(1)} kg</strong> の増量が推奨されます
              </p>
            </>
          ) : weightKg > analysis.idealWeightRange.max ? (
            <>
              <TrendingDown className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <p className="text-sm text-blue-700 dark:text-blue-300 flex-1 ml-3">
                適正範囲まで <strong>{(weightKg - analysis.idealWeightRange.max).toFixed(1)} kg</strong> の減量が推奨されます
              </p>
            </>
          ) : (
            <>
              <Activity className="w-5 h-5 text-green-600 dark:text-green-400" />
              <p className="text-sm text-green-700 dark:text-green-300 flex-1 ml-3">
                適正体重範囲内です
              </p>
            </>
          )}
        </div>

        {age && gender && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            ※ 年齢・性別を考慮した適正体重範囲を表示しています
          </p>
        )}
      </div>
    </div>
  );
}
