import React, { useState } from 'react';
import { Heart, Zap, AlertCircle } from 'lucide-react';

interface MotivationFormProps {
  onSubmit: (data: {
    motivation_level: number;
    energy_level: number;
    stress_level: number;
    date: string;
    notes?: string;
  }) => Promise<void>;
  loading?: boolean;
}

export function MotivationForm({ onSubmit, loading = false }: MotivationFormProps) {
  const [motivationLevel, setMotivationLevel] = useState(5);
  const [energyLevel, setEnergyLevel] = useState(5);
  const [stressLevel, setStressLevel] = useState(5);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      await onSubmit({
        motivation_level: motivationLevel,
        energy_level: energyLevel,
        stress_level: stressLevel,
        date,
        notes: notes || undefined,
      });

      setMotivationLevel(5);
      setEnergyLevel(5);
      setStressLevel(5);
      setDate(new Date().toISOString().split('T')[0]);
      setNotes('');
    } catch (err) {
      setError('モチベーション記録の追加に失敗しました');
      console.error('Error submitting motivation record:', err);
    }
  };

  const renderSlider = (
    value: number,
    onChange: (value: number) => void,
    label: string,
    icon: React.ReactNode,
    lowLabel: string,
    highLabel: string,
    color: string
  ) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {icon}
        {label}
      </label>
      <div className="flex items-center space-x-3">
        <span className="text-xs text-gray-500 dark:text-gray-400 w-12">{lowLabel}</span>
        <input
          type="range"
          min="1"
          max="10"
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value))}
          className={`flex-1 h-2 rounded-lg appearance-none cursor-pointer ${color}`}
          style={{
            background: `linear-gradient(to right, ${
              color.includes('blue')
                ? '#3b82f6'
                : color.includes('green')
                ? '#10b981'
                : '#ef4444'
            } 0%, ${
              color.includes('blue')
                ? '#3b82f6'
                : color.includes('green')
                ? '#10b981'
                : '#ef4444'
            } ${(value - 1) * 11.11}%, #9ca3af ${(value - 1) * 11.11}%, #9ca3af 100%)`,
          }}
        />
        <span className="text-xs text-gray-500 dark:text-gray-400 w-12 text-right">
          {highLabel}
        </span>
      </div>
      <div className="text-center mt-2">
        <span className={`text-2xl font-bold ${color}`}>{value}</span>
        <span className="text-sm text-gray-500 dark:text-gray-400"> / 10</span>
      </div>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          日付
        </label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          required
        />
      </div>

      {renderSlider(
        motivationLevel,
        setMotivationLevel,
        'モチベーション',
        <Heart className="w-4 h-4 inline mr-2 text-blue-500" />,
        '低い',
        '高い',
        'text-blue-500'
      )}

      {renderSlider(
        energyLevel,
        setEnergyLevel,
        'エネルギーレベル',
        <Zap className="w-4 h-4 inline mr-2 text-green-500" />,
        '疲労',
        '充実',
        'text-green-500'
      )}

      {renderSlider(
        stressLevel,
        setStressLevel,
        'ストレスレベル',
        <AlertCircle className="w-4 h-4 inline mr-2 text-red-500" />,
        'リラックス',
        '高ストレス',
        'text-red-500'
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          メモ（任意）
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="今日の出来事や気持ちを記録..."
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white resize-none"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
      >
        {loading ? (
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
        ) : (
          <>
            <Heart className="w-5 h-5 mr-2" />
            モチベーション記録を追加
          </>
        )}
      </button>
    </form>
  );
}