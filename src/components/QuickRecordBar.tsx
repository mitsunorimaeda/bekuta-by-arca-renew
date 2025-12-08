import React, { useState } from 'react';
import { Plus, Scale, Activity, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { getTodayJSTString } from '../lib/date';

interface QuickRecordBarProps {
  onTrainingSubmit: (data: { rpe: number; duration_min: number; date: string }) => Promise<void>;
  onWeightSubmit: (data: { weight_kg: number; date: string; notes?: string }) => Promise<void>;
  lastTrainingRecord?: { rpe: number; duration_min: number; date: string } | null;
  lastWeightRecord?: { weight_kg: number; date: string } | null;
}

export function QuickRecordBar({
  onTrainingSubmit,
  onWeightSubmit,
  lastTrainingRecord,
  lastWeightRecord
}: QuickRecordBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [rpe, setRpe] = useState<string>('');
  const [duration, setDuration] = useState<string>('');
  const [weight, setWeight] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string>('');

  const today = getTodayJSTString();;

  const handleQuickSubmit = async () => {
    if (!rpe && !weight) return;

    setSubmitting(true);
    setSuccessMessage('');

    try {
      const promises = [];

      if (rpe && duration) {
        promises.push(
          onTrainingSubmit({
            rpe: Number(rpe),
            duration_min: Number(duration),
            date: today
          })
        );
      }

      if (weight) {
        promises.push(
          onWeightSubmit({
            weight_kg: Number(weight),
            date: today
          })
        );
      }

      await Promise.all(promises);

      setSuccessMessage('記録しました！');
      setRpe('');
      setDuration('');
      setWeight('');

      setTimeout(() => {
        setSuccessMessage('');
        setIsExpanded(false);
      }, 2000);
    } catch (error) {
      console.error('Error in quick record:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = (rpe && duration) || weight;

  return (
    <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full py-3 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors rounded-lg px-2"
          style={{
            WebkitTapHighlightColor: 'transparent',
            touchAction: 'manipulation',
            minHeight: '44px'
          }}
        >
          <div className="flex items-center space-x-2">
            <Plus className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
              クイック記録
            </span>
            {successMessage && (
              <span className="flex items-center text-green-600 dark:text-green-400 text-sm ml-2">
                <Check className="w-4 h-4 mr-1" />
                {successMessage}
              </span>
            )}
          </div>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </button>

        {isExpanded && (
          <div className="pb-4 space-y-4 animate-in slide-in-from-top duration-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <div className="flex items-center mb-3">
                  <Activity className="w-4 h-4 text-blue-600 dark:text-blue-400 mr-2" />
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">練習記録</h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-600 dark:text-gray-400 block mb-1">RPE</label>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      value={rpe}
                      onChange={(e) => setRpe(e.target.value)}
                      placeholder={lastTrainingRecord ? `前回: ${lastTrainingRecord.rpe}` : '7'}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 dark:text-white text-sm"
                      style={{ fontSize: '16px' }}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600 dark:text-gray-400 block mb-1">時間（分）</label>
                    <input
                      type="number"
                      min="1"
                      max="480"
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      placeholder={lastTrainingRecord ? `前回: ${lastTrainingRecord.duration_min}` : '60'}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 dark:text-white text-sm"
                      style={{ fontSize: '16px' }}
                    />
                  </div>
                </div>
                {rpe && duration && (
                  <div className="mt-2 text-xs text-blue-700 dark:text-blue-300">
                    負荷: {Number(rpe) * Number(duration)}
                  </div>
                )}
              </div>

              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                <div className="flex items-center mb-3">
                  <Scale className="w-4 h-4 text-green-600 dark:text-green-400 mr-2" />
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">体重記録</h3>
                </div>
                <div>
                  <label className="text-xs text-gray-600 dark:text-gray-400 block mb-1">体重（kg）</label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    max="499"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    placeholder={lastWeightRecord ? `前回: ${Number(lastWeightRecord.weight_kg).toFixed(1)}` : '65.0'}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white dark:bg-gray-700 dark:text-white text-sm"
                    style={{ fontSize: '16px' }}
                  />
                </div>
              </div>
            </div>

            <button
              onClick={handleQuickSubmit}
              disabled={!canSubmit || submitting}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center"
              style={{
                WebkitTapHighlightColor: 'transparent',
                touchAction: 'manipulation',
                minHeight: '44px'
              }}
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  記録中...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  今日の記録を追加
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
