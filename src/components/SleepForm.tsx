import React, { useState, useEffect } from 'react';
import { Moon, Star, Loader2 } from 'lucide-react';
import { SleepRecord } from '../lib/supabase';
import { GenericDuplicateModal } from './GenericDuplicateModal';
import { getTodayJSTString } from '../lib/date';
import type { SleepRecordForm } from '../lib/normalizeRecords';
import { Toast } from './ui/Toast'; // ✅ パスはあなたの構成に合わせて調整（例: ../components/ui/Toast）

interface SleepFormProps {
  onSubmit: (data: {
    sleep_hours: number;
    date: string;
    sleep_quality?: number;
    notes?: string;
  }) => Promise<void>;

  onCheckExisting: (date: string) => Promise<SleepRecord | null>;

  onUpdate: (
    id: string,
    data: {
      sleep_hours: number;
      date: string;
      sleep_quality?: number;
      notes?: string;
    }
  ) => Promise<void>;

  loading?: boolean;

  /** ✅ 前回の睡眠記録（正規化済みフォーム型で統一） */
  lastRecord?: SleepRecordForm | null;
}

export function SleepForm({
  onSubmit,
  onCheckExisting,
  onUpdate,
  loading = false,
  lastRecord,
}: SleepFormProps) {
  const [sleepHours, setSleepHours] = useState('');
  const [date, setDate] = useState(getTodayJSTString());
  const [sleepQuality, setSleepQuality] = useState<number>(3);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [existingRecord, setExistingRecord] = useState<SleepRecord | null>(null);

  const [pendingData, setPendingData] = useState<{
    sleep_hours: number;
    date: string;
    sleep_quality?: number;
    notes?: string;
  } | null>(null);

  // ✅ 手応え用：フォーム内で saving を持つ（親の loading と別）
  const [saving, setSaving] = useState(false);

  // ✅ Toast
  const [toastOpen, setToastOpen] = useState(false);
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const [toastMsg, setToastMsg] = useState('');

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToastType(type);
    setToastMsg(msg);
    setToastOpen(true);
  };

  const resetForm = () => {
    setSleepHours('');
    setDate(getTodayJSTString());
    setSleepQuality(3);
    setNotes('');
  };

  // ✅ 前回記録が変わったときに初期値を前回値に合わせる
  useEffect(() => {
    if (!lastRecord) return;

    if (lastRecord.sleep_hours != null) {
      setSleepHours(String(lastRecord.sleep_hours));
    }
    if (lastRecord.sleep_quality != null) {
      setSleepQuality(lastRecord.sleep_quality);
    }
  }, [lastRecord]);

  const validate = () => {
    const hours = parseFloat(sleepHours);
    if (isNaN(hours) || hours < 0 || hours > 24) {
      setError('睡眠時間は0〜24時間の範囲で入力してください');
      return null;
    }
    return hours;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (saving || loading) return; // ✅ 二重押し防止

    const hours = validate();
    if (hours == null) return;

    const data = {
      sleep_hours: hours,
      date,
      sleep_quality: sleepQuality,
      notes: notes || undefined,
    };

    setSaving(true);
    try {
      // 既存レコードチェック
      const existing = await onCheckExisting(date);
      if (existing) {
        setExistingRecord(existing);
        setPendingData(data);
        setShowDuplicateModal(true);
        return; // ✅ ここでは saving を finally で戻す
      }

      await onSubmit(data);

      resetForm();
      showToast('success', '記録しました ✅');
    } catch (err: any) {
      setError('睡眠記録の追加に失敗しました');
      console.error('Error submitting sleep record:', err);
      showToast('error', `保存に失敗しました：${err?.message ?? '不明なエラー'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleOverwrite = async () => {
    if (!existingRecord || !pendingData) return;
    if (saving || loading) return;

    setShowDuplicateModal(false);
    setSaving(true);
    setError('');

    try {
      await onUpdate(existingRecord.id, pendingData);

      resetForm();
      setExistingRecord(null);
      setPendingData(null);

      showToast('success', '上書きして記録しました ✅');
    } catch (err: any) {
      setError('記録の更新に失敗しました');
      console.error('Error updating record:', err);
      showToast('error', `上書きに失敗しました：${err?.message ?? '不明なエラー'}`);
    } finally {
      setSaving(false);
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
            <Star className={`w-6 h-6 ${star <= sleepQuality ? 'fill-current' : ''}`} />
          </button>
        ))}
      </div>
    );
  };

  const isBusy = loading || saving;

  return (
    <>
      {/* ✅ Toast */}
      <Toast
        open={toastOpen}
        type={toastType}
        message={toastMsg}
        onClose={() => setToastOpen(false)}
      />

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

        {/* 日付 */}
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
            disabled={isBusy}
          />
        </div>

        {/* 睡眠時間 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            睡眠時間（時間）
          </label>
          {lastRecord && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">
              前回（{lastRecord.date}）：{lastRecord.sleep_hours}時間
            </p>
          )}
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
            disabled={isBusy}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">推奨: 7-9時間</p>
        </div>

        {/* 睡眠の質 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            睡眠の質
          </label>
          {lastRecord && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">
              前回の質：{lastRecord.sleep_quality ?? '-'} / 5
            </p>
          )}
          {renderStars()}
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
            {sleepQuality === 5 && '最高の睡眠'}
            {sleepQuality === 4 && '良い睡眠'}
            {sleepQuality === 3 && '普通'}
            {sleepQuality === 2 && 'やや不足'}
            {sleepQuality === 1 && '睡眠不足'}
          </p>
        </div>

        {/* メモ */}
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
            disabled={isBusy}
          />
        </div>

        {/* 送信ボタン：手応え付き */}
        <button
          type="submit"
          disabled={isBusy}
          className={`w-full px-4 py-3 rounded-lg font-medium transition-colors flex items-center justify-center ${
            isBusy
              ? 'bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-300 cursor-not-allowed'
              : 'bg-indigo-600 hover:bg-indigo-700 text-white'
          }`}
        >
          {isBusy ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              保存中…
            </span>
          ) : (
            <>
              <Moon className="w-5 h-5 mr-2" />
              睡眠を記録する
            </>
          )}
        </button>
      </form>
    </>
  );
}