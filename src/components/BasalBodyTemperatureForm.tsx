import React, { useState } from 'react';
import { Thermometer, Calendar, Clock, AlertCircle } from 'lucide-react';
import { useBasalBodyTemperature } from '../hooks/useBasalBodyTemperature';
import { getTodayJSTString } from '../lib/date';

interface BasalBodyTemperatureFormProps {
  userId: string;
  onSuccess?: () => void;
}

export function BasalBodyTemperatureForm({ userId, onSuccess }: BasalBodyTemperatureFormProps) {
  const { addTemperature } = useBasalBodyTemperature(userId);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = getTodayJSTString();
  const currentTime = new Date().toTimeString().slice(0, 5);

  const [formData, setFormData] = useState({
    measurement_date: today,
    temperature_celsius: '',
    measurement_time: currentTime,
    notes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const temperatureData: any = {
        measurement_date: formData.measurement_date,
        temperature_celsius: parseFloat(formData.temperature_celsius),
      };

      if (formData.measurement_time) {
        temperatureData.measurement_time = formData.measurement_time;
      }

      if (formData.notes) {
        temperatureData.notes = formData.notes;
      }

      await addTemperature(temperatureData);

      setFormData({
        measurement_date: today,
        temperature_celsius: '',
        measurement_time: currentTime,
        notes: '',
      });

      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : '体温データの保存に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
      <div className="flex items-center gap-2 mb-4">
        <Thermometer className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">基礎体温を記録</h3>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 rounded-lg">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      )}

      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          <strong>ヒント:</strong> 基礎体温は起床後すぐ、ベッドから出る前や身体活動をする前に測定してください。
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <Calendar className="inline w-4 h-4 mr-1" />
            測定日 *
          </label>
          <input
            type="date"
            required
            value={formData.measurement_date}
            max={today}
            onChange={(e) => setFormData({ ...formData, measurement_date: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <Clock className="inline w-4 h-4 mr-1" />
            測定時刻
          </label>
          <input
            type="time"
            value={formData.measurement_time}
            onChange={(e) => setFormData({ ...formData, measurement_time: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          <Thermometer className="inline w-4 h-4 mr-1" />
          体温（℃） *
        </label>
        <input
          type="number"
          step="0.01"
          min="35.0"
          max="42.0"
          required
          value={formData.temperature_celsius}
          onChange={(e) => setFormData({ ...formData, temperature_celsius: e.target.value })}
          placeholder="例: 36.5"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
        />
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          正常範囲: 36.1 - 37.0℃
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          メモ
        </label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          placeholder="体温に影響する要因（体調不良、寝不足など）..."
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? '保存中...' : '体温を保存'}
      </button>
    </form>
  );
}
