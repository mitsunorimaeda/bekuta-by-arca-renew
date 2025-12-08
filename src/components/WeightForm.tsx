import React, { useState } from 'react';
import { Scale, Calendar, AlertCircle, FileText } from 'lucide-react';
import { WeightRecord } from '../lib/supabase';
import { GenericDuplicateModal } from './GenericDuplicateModal';
import { getTodayJSTString } from '../lib/date';

interface WeightFormProps {
  onSubmit: (data: { weight_kg: number; date: string; notes?: string }) => Promise<void>;
  onCheckExisting: (date: string) => Promise<WeightRecord | null>;
  onUpdate: (id: string, data: { weight_kg: number; notes?: string }) => Promise<void>;
  loading: boolean;
}

export function WeightForm({ onSubmit, onCheckExisting, onUpdate, loading }: WeightFormProps) {
  const [weight, setWeight] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(getTodayJSTString());
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>('');
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [existingRecord, setExistingRecord] = useState<WeightRecord | null>(null);
  const [pendingData, setPendingData] = useState<{ weight_kg: number; date: string; notes?: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const weightNum = parseFloat(weight);
    if (isNaN(weightNum) || weightNum <= 0 || weightNum >= 500) {
      setError('体重は0〜500kgの範囲で入力してください。');
      return;
    }

    // Check for existing record
    const existing = await onCheckExisting(selectedDate);
    if (existing) {
      setExistingRecord(existing);
      setPendingData({
        weight_kg: weightNum,
        date: selectedDate,
        notes: notes.trim() || undefined
      });
      setShowDuplicateModal(true);
      return;
    }

    setSubmitting(true);

    try {
      await onSubmit({
        weight_kg: weightNum,
        date: selectedDate,
        notes: notes.trim() || undefined
      });
      setWeight('');
      setNotes('');
      setSelectedDate(getTodayJSTString());
    } catch (error) {
      console.error('Error submitting weight record:', error);
      if (error instanceof Error) {
        setError(error.message || '記録の追加に失敗しました。');
      } else {
        setError('記録の追加に失敗しました。');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleOverwrite = async () => {
    if (!existingRecord || !pendingData) return;

    setSubmitting(true);
    setShowDuplicateModal(false);

    try {
      await onUpdate(existingRecord.id, {
        weight_kg: pendingData.weight_kg,
        notes: pendingData.notes
      });

      setWeight('');
      setNotes('');
      setSelectedDate(getTodayJSTString());
      setExistingRecord(null);
      setPendingData(null);
    } catch (error) {
      console.error('Error updating record:', error);
      setError('記録の更新に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelOverwrite = () => {
    setShowDuplicateModal(false);
    setExistingRecord(null);
    setPendingData(null);
  };

  return (
    <>
      <GenericDuplicateModal
        isOpen={showDuplicateModal}
        onClose={handleCancelOverwrite}
        onOverwrite={handleOverwrite}
        onCancel={handleCancelOverwrite}
        title="体重記録"
        date={selectedDate}
        existingValues={[
          { label: '体重', value: `${existingRecord?.weight_kg || 0} kg` }
        ]}
        newValues={[
          { label: '体重', value: `${pendingData?.weight_kg || 0} kg` }
        ]}
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
        <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          <Calendar className="w-4 h-4 mr-2" />
          測定日
        </label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          max={getTodayJSTString()}
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-base bg-white dark:bg-gray-700 dark:text-white"
          style={{ fontSize: '16px' }}
        />
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {selectedDate === getTodayJSTString() ? '今日の体重記録' : '過去の体重記録'}
        </p>
      </div>

      <div>
        <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          <Scale className="w-4 h-4 mr-2" />
          体重（kg）
        </label>
        <input
          type="number"
          step="0.1"
          min="1"
          max="499"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-base bg-white dark:bg-gray-700 dark:text-white"
          placeholder="65.5"
          required
          style={{ fontSize: '16px' }}
        />
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">小数点第1位まで入力可能（例: 65.5kg）</p>
      </div>

      <div>
        <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          <FileText className="w-4 h-4 mr-2" />
          メモ（任意）
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-base bg-white dark:bg-gray-700 dark:text-white resize-none"
          placeholder="体調や食事の記録など..."
          rows={3}
          maxLength={500}
          style={{ fontSize: '16px' }}
        />
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {notes.length}/500文字
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mr-2" />
            <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={submitting || loading || !weight}
        className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center touch-target"
        style={{
          WebkitTapHighlightColor: 'transparent',
          touchAction: 'manipulation'
        }}
      >
        {submitting ? (
          <>
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
            記録中...
          </>
        ) : (
          <>
            <Scale className="w-5 h-5 mr-2" />
            体重を記録
          </>
        )}
      </button>
    </form>
    </>
  );
}
