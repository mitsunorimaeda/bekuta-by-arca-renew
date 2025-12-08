import React, { useState } from 'react';
import { Moon, Star } from 'lucide-react';
import { SleepRecord } from '../lib/supabase';
import { GenericDuplicateModal } from './GenericDuplicateModal';
import { getTodayJSTString } from '../lib/date';

interface SleepFormProps {
  onSubmit: (data: {
    sleep_hours: number;
    date: string;
    sleep_quality?: number;
    notes?: string;
  }) => Promise<void>;
  onCheckExisting: (date: string) => Promise<SleepRecord | null>;
  onUpdate: (id: string, data: any) => Promise<void>;
  loading?: boolean;
}

export function SleepForm({
  onSubmit,
  onCheckExisting,
  onUpdate,
  loading = false,
}: SleepFormProps) {
  const [sleepHours, setSleepHours] = useState('');
  const [date, setDate] = useState(getTodayJSTString());
  const [sleepQuality, setSleepQuality] = useState<number>(3);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [existingRecord, setExistingRecord] = useState<SleepRecord | null>(null);
  const [pendingData, setPendingData] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const hours = parseFloat(sleepHours);
    if (isNaN(hours) || hours <= 0 || hours > 24) {
      setError('睡眠時間は0〜24時間の範囲で入力してください');
      return;
    }

    const data = {
      sleep_hours: hours,
      date,
      sleep_quality: sleepQuality,
      notes: notes || undefined,
    };

    // 既存レコードチェック
    const existing = await onCheckExisting(date);
    if (existing) {
      setExistingRecord(existing);
      setPendingData(data);
      setShowDuplicateModal(true);
      return;
    }

    try {
      await onSubmit(data);

      // フォームリセット
      setSleepHours('');
      setDate(getTodayJSTString());
      setSleepQuality(3);
      setNotes('');
    } catch (err) {
      setError('睡眠記録の追加に失敗しました');
      console.error('Error submitting sleep record:', err);
    }
  };

  const handleOverwrite = async () => {
    if (!existingRecord || !pendingData) return;

    setShowDuplicateModal(false);

    try {
      await onUpdate(existingRecord.id, pendingData);

      setSleepHours('');
      setDate(getTodayJSTString());
      setSleepQuality(3);
      setNotes('');
      setExistingRecord(null);
      setPendingData(null);
    } catch (err) {
      setError('記録の更新に失敗しました');
      console.error('Error updating record:', err);
    }
  };

  const handleCancelOverwrite = () => {
    setShowDuplicateModal(false);
    setExistingRecord(null);
    setPendingData(null);
  };

  const renderStars = () => {
    return (
      <div className="flex items-center justify-center space-x-2">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => setSleepQuality(star)}
            className={`transition-colors ${
              star <= sleepQuality
                ? 'text-yellow-400 hover:text-yellow-500'
                : 'text-gray-300 dark:text-gray-600 hover:text-gray-400'
            }`}
          >
            <Star
              className={`w-6 h-6 ${star <= sleepQuality ? 'fill-current' : ''}`}
            />
          </button>
        ))}
      </div>
    );
  };

  return (
    <>
      <GenericDuplicateModal
        isOpen={showDuplicateModal}
        onClose={handleCancelOverwrite}
        onOverwrite={handleOverwrite}
        onCancel={handleCancelOverwrite}
        title="睡眠記録"
        date={date}
        existingValues={[
          { label: '睡眠時間', value: `${existingRecord?.sleep_hours || 0}時間` },
          { label: '睡眠の質', value: `${existingRecord?.sleep_quality || 0}/5` },
        ]}
        newValues={[
          { label: '睡眠時間', value: `${pendingData?.sleep_hours || 0}時間` },
          { label: '睡眠の質', value: `${pendingData?.sleep_quality || 0}/5` },
        ]}
      />

      <form onSubmit={handleSubmit} className="space-y-4">
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

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            睡眠時間（時間）
          </label>
          <input
            type="number"
            step="0.5"
            min="0"
            max="24"
            value={sleepHours}
            onChange={(e) => setSleepHours(e.target.value)}
            placeholder="例: 7.5"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            required
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            推奨: 7-9時間
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            睡眠の質
          </label>
          {renderStars()}
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
            {sleepQuality === 5 && '最高の睡眠'}
            {sleepQuality === 4 && '良い睡眠'}
            {sleepQuality === 3 && '普通'}
            {sleepQuality === 2 && 'やや不足'}
            {sleepQuality === 1 && '睡眠不足'}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            メモ（任意）
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="夜中に目が覚めた、寝つきが悪かった など..."
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
        >
          {loading ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
          ) : (
            <>
              <Moon className="w-5 h-5 mr-2" />
              睡眠記録を追加
            </>
          )}
        </button>
      </form>
    </>
  );
}