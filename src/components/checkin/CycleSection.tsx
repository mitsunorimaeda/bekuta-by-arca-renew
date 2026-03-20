import React, { useState } from 'react';
import { Droplets, AlertCircle } from 'lucide-react';
import {
  SYMPTOM_OPTIONS,
  FLOW_OPTIONS,
  SYMPTOM_CATEGORY_LABELS,
  type FlowIntensity,
  type SymptomCategory,
} from '../../lib/cycleConstants';

type Props = {
  selectedDate: string;
  onSave: (data: {
    isPeriodDay: boolean;
    flowIntensity: FlowIntensity | null;
    symptoms: string[];
  }) => Promise<void>;
  error?: string | null;
};

export function CycleSection({ selectedDate, onSave, error }: Props) {
  const [periodStatus, setPeriodStatus] = useState<'yes' | 'no' | null>(null);
  const [flowIntensity, setFlowIntensity] = useState<FlowIntensity | null>(null);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [showSymptoms, setShowSymptoms] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const toggleSymptom = (value: string) => {
    setSymptoms(prev =>
      prev.includes(value) ? prev.filter(s => s !== value) : [...prev, value]
    );
  };

  const handleSave = async () => {
    if (periodStatus === null) return;
    try {
      setSaving(true);
      await onSave({
        isPeriodDay: periodStatus === 'yes',
        flowIntensity: periodStatus === 'yes' ? flowIntensity : null,
        symptoms,
      });
      setSaved(true);
    } catch {
      // error prop で表示
    } finally {
      setSaving(false);
    }
  };

  // カテゴリごとにグループ化
  const grouped = SYMPTOM_OPTIONS.reduce((acc, opt) => {
    const cat = opt.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(opt);
    return acc;
  }, {} as Record<SymptomCategory, typeof SYMPTOM_OPTIONS[number][]>);

  return (
    <div className="space-y-4 bg-white dark:bg-gray-800 p-5 rounded-lg shadow">
      <div className="flex items-center gap-2">
        <Droplets className="w-5 h-5 text-pink-600 dark:text-pink-400" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          からだの記録
        </h3>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 rounded-lg text-sm">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Step 1: 今日は生理？ */}
      <div>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          今日は生理中？
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPeriodStatus('yes')}
            className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${
              periodStatus === 'yes'
                ? 'bg-red-500 text-white shadow-sm'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
            }`}
          >
            💧 生理中
          </button>
          <button
            type="button"
            onClick={() => setPeriodStatus('no')}
            className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${
              periodStatus === 'no'
                ? 'bg-gray-600 text-white shadow-sm'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
            }`}
          >
            生理じゃない
          </button>
        </div>
      </div>

      {/* Step 2: 出血量（生理中のみ） */}
      {periodStatus === 'yes' && (
        <div>
          <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">出血量</p>
          <div className="flex gap-2">
            {FLOW_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFlowIntensity(flowIntensity === opt.value ? null : opt.value)}
                className={`flex-1 py-2 px-2 rounded-lg text-xs font-medium transition-colors ${
                  flowIntensity === opt.value
                    ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-2 border-red-300 dark:border-red-700'
                    : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-600'
                }`}
              >
                {opt.icon} {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 3: 症状 */}
      {periodStatus !== null && (
        <div>
          <div
            onClick={() => setShowSymptoms(!showSymptoms)}
            className="flex items-center justify-between bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-3 cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
          >
            <div>
              <p className="text-sm font-medium text-purple-700 dark:text-purple-400">
                🩺 今の体調・症状は？
              </p>
              <p className="text-xs text-purple-500 dark:text-purple-500 mt-0.5">
                {symptoms.length > 0
                  ? `${symptoms.length}件選択中`
                  : '記録するとPMS傾向がわかるようになります'}
              </p>
            </div>
            <span className="text-purple-400">
              {showSymptoms ? '▲' : '▼'}
            </span>
          </div>

          {showSymptoms && (
            <div className="mt-3 space-y-3">
              {(Object.entries(grouped) as [SymptomCategory, typeof SYMPTOM_OPTIONS[number][]][]).map(
                ([category, options]) => (
                  <div key={category}>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">
                      {SYMPTOM_CATEGORY_LABELS[category]}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {options.map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => toggleSymptom(opt.value)}
                          className={`py-1.5 px-3 rounded-full text-xs transition-colors ${
                            symptoms.includes(opt.value)
                              ? 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-400 border border-pink-300 dark:border-pink-700'
                              : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-600'
                          }`}
                        >
                          {opt.icon} {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      )}

      {/* 保存ボタン */}
      {periodStatus !== null && !saved && (
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3 bg-pink-600 hover:bg-pink-700 disabled:bg-pink-300 text-white font-medium rounded-xl transition-colors"
        >
          {saving ? '保存中...' : 'からだの記録を保存'}
        </button>
      )}

      {saved && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 text-center">
          <p className="text-sm font-medium text-green-700 dark:text-green-400">
            記録しました
          </p>
        </div>
      )}
    </div>
  );
}
