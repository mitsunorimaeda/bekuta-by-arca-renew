import React, { useMemo, useState } from 'react';
import { Calendar, Droplets, AlertCircle, Zap, Cloud, Battery, Brain, Wind, Heart, Sparkles, Target } from 'lucide-react';

type Flow = 'light' | 'moderate' | 'heavy';

const SYMPTOM_OPTIONS = [
  { value: 'cramps', label: '生理痛', icon: Zap },
  { value: 'mood_changes', label: '気分の変化', icon: Cloud },
  { value: 'fatigue', label: '疲労感', icon: Battery },
  { value: 'headache', label: '頭痛', icon: Brain },
  { value: 'bloating', label: '膨満感', icon: Wind },
  { value: 'breast_tenderness', label: '胸の張り', icon: Heart },
  { value: 'acne', label: 'ニキビ', icon: Sparkles },
  { value: 'back_pain', label: '腰痛', icon: Target },
];

type Props = {
  selectedDate: string;

  // Unified側の state を受け取って表示・編集する
  periodStart: boolean;
  setPeriodStart: (v: boolean) => void;

  flowIntensity: Flow;
  setFlowIntensity: (v: Flow) => void;

  symptoms: string[];
  setSymptoms: (v: string[]) => void;

  cycleNotes: string;
  setCycleNotes: (v: string) => void;

  periodDuration: number;
  setPeriodDuration: (v: number) => void;

  cycleLength: number;
  setCycleLength: (v: number) => void;

  error?: string | null;
};

export function CycleSection({
  selectedDate,
  periodStart,
  setPeriodStart,
  flowIntensity,
  setFlowIntensity,
  symptoms,
  setSymptoms,
  cycleNotes,
  setCycleNotes,
  periodDuration,
  setPeriodDuration,
  cycleLength,
  setCycleLength,
  error,
}: Props) {
  // “終了日→期間自動計算”を残したい場合だけローカルで持つ（保存は duration を使う）
  const [periodEndDate, setPeriodEndDate] = useState<string>('');

  const computedPeriodDays = useMemo(() => {
    if (!selectedDate || !periodEndDate) return null;
    const start = new Date(selectedDate);
    const end = new Date(periodEndDate);
    const days = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return Number.isFinite(days) && days > 0 ? days : null;
  }, [selectedDate, periodEndDate]);

  const toggleSymptom = (s: string) => {
    setSymptoms(symptoms.includes(s) ? symptoms.filter((x) => x !== s) : [...symptoms, s]);
  };

  return (
    <div className="space-y-6 bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
      <div className="flex items-center gap-2 mb-2">
        <Droplets className="w-6 h-6 text-pink-600 dark:text-pink-400" />
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">月経周期を記録</h3>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 rounded-lg">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      )}

      {/* 今日が月経開始 */}
      <div className="bg-pink-50 dark:bg-pink-900/20 rounded-lg p-4">
        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
            今日が月経開始（出血1日目）
          </span>
          <input
            type="checkbox"
            checked={periodStart}
            onChange={(e) => setPeriodStart(e.target.checked)}
            className="h-5 w-5 accent-pink-600"
          />
        </label>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          ※開始日の登録をトリガーに周期を保存します
        </p>
      </div>

      {/* 開始日（Unifiedの selectedDate を使うので表示だけ） */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          <Calendar className="inline w-4 h-4 mr-1" />
          生理開始日（今日の入力日）
        </label>
        <div className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-100">
          {selectedDate}
        </div>
      </div>

      {/* 終了日（任意） */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          <Calendar className="inline w-4 h-4 mr-1" />
          生理終了日（任意）
        </label>
        <input
          type="date"
          value={periodEndDate}
          min={selectedDate}
          onChange={(e) => {
            const v = e.target.value;
            setPeriodEndDate(v);
            // 入力されたら duration を自動更新（あくまで任意）
            if (v) {
              const start = new Date(selectedDate);
              const end = new Date(v);
              const days = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
              if (Number.isFinite(days) && days > 0) setPeriodDuration(days);
            }
          }}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-pink-500 dark:bg-gray-700 dark:text-white"
        />
        {computedPeriodDays != null && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">生理期間: {computedPeriodDays}日間</p>
        )}
      </div>

      {/* 経血量 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">経血量</label>
        <select
          value={flowIntensity}
          onChange={(e) => setFlowIntensity(e.target.value as Flow)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-pink-500 dark:bg-gray-700 dark:text-white"
        >
          <option value="light">少ない</option>
          <option value="moderate">普通</option>
          <option value="heavy">多い</option>
        </select>
      </div>

      {/* 症状 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">症状</label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {SYMPTOM_OPTIONS.map((s) => {
            const Icon = s.icon;
            const active = symptoms.includes(s.value);
            return (
              <button
                key={s.value}
                type="button"
                onClick={() => toggleSymptom(s.value)}
                className={`px-3 py-2 text-sm rounded-lg border-2 transition-all flex items-center justify-center gap-1.5 ${
                  active
                    ? 'border-pink-500 bg-pink-50 dark:bg-pink-900/20 text-pink-700 dark:text-pink-300 scale-105'
                    : 'border-gray-300 dark:border-gray-600 hover:border-pink-300 dark:hover:border-pink-700 text-gray-700 dark:text-gray-300 hover:scale-105'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{s.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 期間/周期（任意） */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">月経期間（日）</label>
          <input
            type="number"
            min={1}
            max={14}
            value={periodDuration}
            onChange={(e) => setPeriodDuration(Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-pink-500 dark:bg-gray-700 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">周期（日）</label>
          <input
            type="number"
            min={20}
            max={45}
            value={cycleLength}
            onChange={(e) => setCycleLength(Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-pink-500 dark:bg-gray-700 dark:text-white"
          />
        </div>
      </div>

      {/* メモ */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">メモ</label>
        <textarea
          value={cycleNotes}
          onChange={(e) => setCycleNotes(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-pink-500 dark:bg-gray-700 dark:text-white"
          placeholder="その他のメモ..."
        />
      </div>

      <div className="text-xs text-gray-500 dark:text-gray-400">
        ※ 保存は下の「次へ/完了」ボタンで行います
      </div>
    </div>
  );
}