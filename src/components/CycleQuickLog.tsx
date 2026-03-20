import React, { useState } from 'react';
import { Droplets, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { SYMPTOM_OPTIONS, FLOW_OPTIONS, type FlowIntensity } from '../lib/cycleConstants';

interface CycleQuickLogProps {
  onPeriodStart: (date?: string) => Promise<unknown>;
  onPeriodEnd: (date?: string) => Promise<unknown>;
  hasOpenCycle: boolean;
}

export function CycleQuickLog({ onPeriodStart, onPeriodEnd, hasOpenCycle }: CycleQuickLogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 詳細入力用のstate（将来的に追加情報を付与する場合）
  const [selectedFlow, setSelectedFlow] = useState<FlowIntensity | null>(null);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handlePeriodStart = async () => {
    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      await onPeriodStart();
      showSuccess('生理開始を記録しました');
      setShowDetails(false);
      setSelectedFlow(null);
      setSelectedSymptoms([]);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : '記録に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePeriodEnd = async () => {
    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      await onPeriodEnd();
      showSuccess('生理終了を記録しました');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : '記録に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleSymptom = (value: string) => {
    setSelectedSymptoms(prev =>
      prev.includes(value)
        ? prev.filter(s => s !== value)
        : [...prev, value]
    );
  };

  return (
    <div className="space-y-3">
      {/* メインボタン */}
      <div className="flex gap-3">
        <button
          onClick={handlePeriodStart}
          disabled={isSubmitting}
          className="flex-1 flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white font-bold py-4 px-4 rounded-xl transition-colors shadow-sm"
        >
          <Droplets className="w-5 h-5" />
          <span>生理が始まった</span>
        </button>

        {hasOpenCycle && (
          <button
            onClick={handlePeriodEnd}
            disabled={isSubmitting}
            className="flex-1 flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-bold py-4 px-4 rounded-xl transition-colors shadow-sm border border-gray-200 dark:border-gray-600"
          >
            <Check className="w-5 h-5" />
            <span>生理が終わった</span>
          </button>
        )}
      </div>

      {/* 詳細入力トグル */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="w-full flex items-center justify-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 py-1"
      >
        <span>症状・出血量を追加</span>
        {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {/* 詳細入力パネル */}
      {showDetails && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-4">
          {/* 出血量 */}
          <div>
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">出血量</p>
            <div className="flex gap-2">
              {FLOW_OPTIONS.map(option => (
                <button
                  key={option.value}
                  onClick={() => setSelectedFlow(selectedFlow === option.value ? null : option.value)}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    selectedFlow === option.value
                      ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-2 border-red-300 dark:border-red-700'
                      : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-600'
                  }`}
                >
                  {option.icon} {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* 症状 */}
          <div>
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">今の症状</p>
            <div className="flex flex-wrap gap-2">
              {SYMPTOM_OPTIONS.map(option => (
                <button
                  key={option.value}
                  onClick={() => toggleSymptom(option.value)}
                  className={`py-1.5 px-3 rounded-full text-sm transition-colors ${
                    selectedSymptoms.includes(option.value)
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-300 dark:border-blue-700'
                      : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-600'
                  }`}
                >
                  {option.icon} {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* フィードバック */}
      {successMessage && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 text-center">
          <p className="text-sm font-medium text-green-700 dark:text-green-400">
            {successMessage}
          </p>
        </div>
      )}
      {errorMessage && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-center">
          <p className="text-sm font-medium text-red-700 dark:text-red-400">
            {errorMessage}
          </p>
        </div>
      )}
    </div>
  );
}
