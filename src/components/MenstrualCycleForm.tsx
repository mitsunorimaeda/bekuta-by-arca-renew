import React, { useState } from 'react';
import { Calendar, Droplets, AlertCircle, Zap, Cloud, Battery, Brain, Wind, Heart, Sparkles, Target } from 'lucide-react';
import { useMenstrualCycleData } from '../hooks/useMenstrualCycleData';

interface MenstrualCycleFormProps {
  userId: string;
  onSuccess?: () => void;
}

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

export function MenstrualCycleForm({ userId, onSuccess }: MenstrualCycleFormProps) {
  const { addCycle } = useMenstrualCycleData(userId);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    cycle_start_date: '',
    period_end_date: '',
    flow_intensity: '' as 'light' | 'moderate' | 'heavy' | '',
    symptoms: [] as string[],
    notes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const cycleData: any = {
        cycle_start_date: formData.cycle_start_date,
        symptoms: formData.symptoms,
      };

      // 生理終了日が入力されている場合は、生理期間を自動計算
      if (formData.period_end_date) {
        const periodStart = new Date(formData.cycle_start_date);
        const periodEnd = new Date(formData.period_end_date);
        cycleData.period_duration_days = Math.floor((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      }

      if (formData.flow_intensity) {
        cycleData.flow_intensity = formData.flow_intensity;
      }

      if (formData.notes) {
        cycleData.notes = formData.notes;
      }

      await addCycle(cycleData);

      setFormData({
        cycle_start_date: '',
        period_end_date: '',
        flow_intensity: '',
        symptoms: [],
        notes: '',
      });

      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : '周期データの保存に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleSymptom = (symptom: string) => {
    setFormData((prev) => ({
      ...prev,
      symptoms: prev.symptoms.includes(symptom)
        ? prev.symptoms.filter((s) => s !== symptom)
        : [...prev.symptoms, symptom],
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
      <div className="flex items-center gap-2 mb-4">
        <Droplets className="w-6 h-6 text-pink-600 dark:text-pink-400" />
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">月経周期を記録</h3>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 rounded-lg">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <Calendar className="inline w-4 h-4 mr-1" />
            生理開始日 *
          </label>
          <input
            type="date"
            required
            value={formData.cycle_start_date}
            onChange={(e) => setFormData({ ...formData, cycle_start_date: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-pink-500 dark:bg-gray-700 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <Calendar className="inline w-4 h-4 mr-1" />
            生理終了日
          </label>
          <input
            type="date"
            value={formData.period_end_date}
            min={formData.cycle_start_date}
            onChange={(e) => setFormData({ ...formData, period_end_date: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-pink-500 dark:bg-gray-700 dark:text-white"
          />
          {formData.cycle_start_date && formData.period_end_date && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              生理期間: {Math.floor((new Date(formData.period_end_date).getTime() - new Date(formData.cycle_start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1}日間
            </p>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          経血量
        </label>
        <select
          value={formData.flow_intensity}
          onChange={(e) => setFormData({ ...formData, flow_intensity: e.target.value as any })}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-pink-500 dark:bg-gray-700 dark:text-white"
        >
          <option value="">選択...</option>
          <option value="light">少ない</option>
          <option value="moderate">普通</option>
          <option value="heavy">多い</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          症状
        </label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {SYMPTOM_OPTIONS.map((symptom) => {
            const Icon = symptom.icon;
            return (
              <button
                key={symptom.value}
                type="button"
                onClick={() => toggleSymptom(symptom.value)}
                className={`px-3 py-2 text-sm rounded-lg border-2 transition-all flex items-center justify-center gap-1.5 ${
                  formData.symptoms.includes(symptom.value)
                    ? 'border-pink-500 bg-pink-50 dark:bg-pink-900/20 text-pink-700 dark:text-pink-300 scale-105'
                    : 'border-gray-300 dark:border-gray-600 hover:border-pink-300 dark:hover:border-pink-700 text-gray-700 dark:text-gray-300 hover:scale-105'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{symptom.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          メモ
        </label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-pink-500 dark:bg-gray-700 dark:text-white"
          placeholder="その他のメモ..."
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full py-3 bg-pink-600 hover:bg-pink-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? '保存中...' : '周期データを保存'}
      </button>
    </form>
  );
}
