import React, { useState } from 'react';
import { Droplets, Check, ChevronDown, ChevronUp } from 'lucide-react';
import {
  SYMPTOM_OPTIONS,
  FLOW_OPTIONS,
  SYMPTOM_CATEGORY_LABELS,
  type FlowIntensity,
  type SymptomCategory,
} from '../lib/cycleConstants';

interface CycleQuickLogProps {
  onPeriodStart: (date?: string) => Promise<unknown | null>;
  onPeriodEnd: (date?: string) => Promise<unknown>;
  onDailyLog?: (data: {
    isPeriodDay: boolean;
    flowIntensity: FlowIntensity | null;
    symptoms: string[];
  }) => Promise<void>;
  hasOpenCycle: boolean;
}

export function CycleQuickLog({ onPeriodStart, onPeriodEnd, onDailyLog, hasOpenCycle }: CycleQuickLogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
      const result = await onPeriodStart();

      // 日別ログも同時に保存
      if (onDailyLog) {
        await onDailyLog({
          isPeriodDay: true,
          flowIntensity: selectedFlow,
          symptoms: selectedSymptoms,
        });
      }

      showSuccess(result === null ? '今日はすでに記録済みです' : '生理開始を記録しました');
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

      // 日別ログ: 生理終了日
      if (onDailyLog) {
        await onDailyLog({
          isPeriodDay: false,
          flowIntensity: null,
          symptoms: selectedSymptoms,
        });
      }

      showSuccess('生理終了を記録しました');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : '記録に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  /** 症状だけ記録（生理ボタン押さずに詳細保存） */
  const handleSaveDetails = async () => {
    if (!onDailyLog) return;
    if (!selectedFlow && selectedSymptoms.length === 0) return;
    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      await onDailyLog({
        isPeriodDay: hasOpenCycle, // 生理中なら true を維持
        flowIntensity: selectedFlow,
        symptoms: selectedSymptoms,
      });
      showSuccess('今日の症状を記録しました');
      setShowDetails(false);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : '記録に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleSymptom = (value: string) => {
    setSelectedSymptoms(prev =>
      prev.includes(value) ? prev.filter(s => s !== value) : [...prev, value]
    );
  };

  // カテゴリ別グループ化
  const grouped = SYMPTOM_OPTIONS.reduce((acc, opt) => {
    const cat = opt.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(opt);
    return acc;
  }, {} as Record<SymptomCategory, typeof SYMPTOM_OPTIONS[number][]>);

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

      {/* 症状記録カード */}
      <div
        onClick={() => setShowDetails(!showDetails)}
        className="flex items-center justify-between bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-3.5 cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
      >
        <div>
          <p className="text-sm font-medium text-purple-700 dark:text-purple-400">
            🩺 今日の体調・症状を記録
          </p>
          <p className="text-xs text-purple-500 dark:text-purple-500 mt-0.5">
            {selectedSymptoms.length > 0
              ? `${selectedSymptoms.length}件選択中`
              : '記録を続けるとPMS傾向がわかります'}
          </p>
        </div>
        {showDetails
          ? <ChevronUp className="w-5 h-5 text-purple-400" />
          : <ChevronDown className="w-5 h-5 text-purple-400" />
        }
      </div>

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
                  className={`flex-1 py-2 px-2 rounded-lg text-xs font-medium transition-colors ${
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

          {/* 症状（カテゴリ別） */}
          {(Object.entries(grouped) as [SymptomCategory, typeof SYMPTOM_OPTIONS[number][]][]).map(
            ([category, options]) => (
              <div key={category}>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                  {SYMPTOM_CATEGORY_LABELS[category]}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {options.map(option => (
                    <button
                      key={option.value}
                      onClick={() => toggleSymptom(option.value)}
                      className={`py-1.5 px-3 rounded-full text-xs transition-colors ${
                        selectedSymptoms.includes(option.value)
                          ? 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-400 border border-pink-300 dark:border-pink-700'
                          : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-600'
                      }`}
                    >
                      {option.icon} {option.label}
                    </button>
                  ))}
                </div>
              </div>
            )
          )}

          {/* 症状だけ保存ボタン */}
          {onDailyLog && (selectedFlow || selectedSymptoms.length > 0) && (
            <button
              onClick={handleSaveDetails}
              disabled={isSubmitting}
              className="w-full py-2.5 bg-pink-500 hover:bg-pink-600 disabled:bg-pink-300 text-white text-sm font-medium rounded-xl transition-colors"
            >
              {isSubmitting ? '保存中...' : '今日の記録を保存'}
            </button>
          )}
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
