import React, { useState, useEffect } from 'react';
import { Plus, Clock, Zap, Calendar, AlertCircle, CheckCircle, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';
import { getDataEntryFeedback, ProgressFeedback } from '../lib/acwrProgressFeedback';
import { TrainingRecord } from '../lib/supabase';
import { GenericDuplicateModal } from './GenericDuplicateModal';
import { VectorArrowPicker } from '../components/VectorArrowPicker';
import { SignalPicker } from './SignalPicker';
import type { TrainingRecordForm } from '../lib/normalizeRecords';
import { Toast } from './ui/Toast'; // ✅ パスは構成に合わせて調整

interface TrainingFormProps {
  userId: string;

  onSubmit: (data: {
    rpe: number;
    duration_min: number;
    date: string;
    arrow_score: number;
    signal_score: number;
  }) => Promise<void>;

  onCheckExisting: (date: string) => Promise<TrainingRecord | null>;

  onUpdate: (
    recordId: string,
    data: { rpe: number; duration_min: number; arrow_score: number; signal_score: number }
  ) => Promise<void>;

  loading: boolean;
  lastRecord?: TrainingRecordForm | null;

  weeklyAverage?: { rpe: number; duration: number; load: number } | null;
  daysWithData?: number;
  consecutiveDays?: number;
}

// ローカル時間の今日を YYYY-MM-DD で取得
const getTodayLocalDateString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export function TrainingForm({
  userId,
  onSubmit,
  onCheckExisting,
  onUpdate,
  loading,
  lastRecord,
  weeklyAverage,
  daysWithData = 0,
  consecutiveDays = 0,
}: TrainingFormProps) {
  const today = getTodayLocalDateString();

  const [rpe, setRpe] = useState<number>(0); // 0 = 休養日
  const [duration, setDuration] = useState<number>(0);
  const [selectedDate, setSelectedDate] = useState<string>(today);

  const [arrowScore, setArrowScore] = useState<number>(50);
  const [signalScore, setSignalScore] = useState<number>(50);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>('');
  const [warning, setWarning] = useState<string>('');
  const [successFeedback, setSuccessFeedback] = useState<ProgressFeedback | null>(null);

  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [existingRecord, setExistingRecord] = useState<TrainingRecord | null>(null);
  const [pendingData, setPendingData] = useState<{
    rpe: number;
    duration_min: number;
    date: string;
    arrow_score: number;
    signal_score: number;
  } | null>(null);

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
    setRpe(0);
    setDuration(0);
    setArrowScore(50);
    setSignalScore(50);
    setSelectedDate(today);
  };

  const applySuccessEffects = () => {
    // ストリーク用：休養日でも「1日入力した」とみなす
    const feedback = getDataEntryFeedback(daysWithData + 1, consecutiveDays + 1);
    if (feedback) {
      setSuccessFeedback(feedback);
      if (feedback.showConfetti) {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || loading) return; // ✅ 二重送信ガード
    setError('');

    // 入力バリデーション（休養日のルール）
    if (rpe === 0 && duration > 0) {
      setError('RPE 0（休養日）の場合は、時間も 0 分にしてください。');
      showToast('error', '入力内容を確認してください（休養日のルール）');
      return;
    }
    if (rpe > 0 && duration === 0) {
      setError('RPE が 1 以上のときは、練習時間も 1 分以上を入力してください。');
      showToast('error', '入力内容を確認してください（時間が 0 分）');
      return;
    }

    // 既存記録チェック
    try {
      const existing = await onCheckExisting(selectedDate);
      if (existing) {
        setExistingRecord(existing);
        setPendingData({
          rpe,
          duration_min: duration,
          date: selectedDate,
          arrow_score: arrowScore,
          signal_score: signalScore,
        });
        setShowDuplicateModal(true);
        return;
      }
    } catch (err) {
      console.error('Error checking existing training record:', err);
      setError('既存データの確認に失敗しました');
      showToast('error', '既存データの確認に失敗しました');
      return;
    }

    setSubmitting(true);

    try {
      await onSubmit({
        rpe,
        duration_min: duration,
        date: selectedDate,
        arrow_score: arrowScore,
        signal_score: signalScore,
      });

      applySuccessEffects();

      // ✅ 成功Toast（これが“手応え”）
      showToast('success', '練習記録を保存しました ✅');

      resetForm();
    } catch (error) {
      console.error('Error submitting training record:', error);
      if (error instanceof Error) {
        if (error.message.includes('duplicate key value violates unique constraint')) {
          const msg = `${new Date(selectedDate).toLocaleDateString('ja-JP')}の記録は既に存在します。`;
          setError(msg);
          showToast('error', msg);
        } else {
          setError(error.message || '記録の追加に失敗しました。');
          showToast('error', error.message || '記録の追加に失敗しました');
        }
      } else {
        setError('記録の追加に失敗しました。');
        showToast('error', '記録の追加に失敗しました');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleOverwrite = async () => {
    if (!existingRecord || !pendingData) return;
    if (submitting || loading) return;

    setSubmitting(true);
    setShowDuplicateModal(false);
    setError('');

    try {
      await onUpdate(existingRecord.id, {
        rpe: pendingData.rpe,
        duration_min: pendingData.duration_min,
        arrow_score: pendingData.arrow_score,
        signal_score: pendingData.signal_score,
      });

      applySuccessEffects();

      // ✅ 上書き成功Toast
      showToast('success', '上書きして保存しました ✅');

      resetForm();

      setExistingRecord(null);
      setPendingData(null);
    } catch (error) {
      console.error('Error updating record:', error);
      setError('記録の更新に失敗しました');
      showToast('error', '記録の更新に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelOverwrite = () => {
    setShowDuplicateModal(false);
    setExistingRecord(null);
    setPendingData(null);
  };

  const checkForWarnings = (currentRpe: number, currentDuration: number) => {
    if (currentRpe === 0 || currentDuration === 0) {
      setWarning('');
      return;
    }
    const currentLoad = currentRpe * currentDuration;
    if (weeklyAverage && currentLoad > weeklyAverage.load * 2) {
      setWarning('いつもの2倍以上の負荷です。入力内容を確認してください。');
    } else if (weeklyAverage && currentLoad > weeklyAverage.load * 1.5) {
      setWarning('いつもより高い負荷です。');
    } else if (currentLoad > 1000) {
      setWarning('非常に高い負荷です。入力内容を確認してください。');
    } else {
      setWarning('');
    }
  };

  const handleRpeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newRpe = Number(e.target.value);
    setRpe(newRpe);
    checkForWarnings(newRpe, duration);
  };

  const handleDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDuration = Number(e.target.value);
    setDuration(newDuration);
    checkForWarnings(rpe, newDuration);
  };

  const rpeLabels = [
    '0 - 休養・まったく運動していない',
    '1 - 非常に楽である',
    '2 - 楽である',
    '3 - 少しきつい',
    '4 - ややきつい',
    '5 - きつい',
    '6 - さらにきつい',
    '7 - とてもきつい',
    '8 - かなりきつい',
    '9 - 非常にきつい',
    '10 - 最大限にきつい (限界)',
  ];

  useEffect(() => {
    if (!successFeedback) return;
    const timer = setTimeout(() => setSuccessFeedback(null), 5000);
    return () => clearTimeout(timer);
  }, [successFeedback]);

  const loadValue = rpe * duration;

  return (
    <>
      {/* ✅ Toast */}
      <Toast open={toastOpen} type={toastType} message={toastMsg} onClose={() => setToastOpen(false)} />

      <GenericDuplicateModal
        isOpen={showDuplicateModal}
        onClose={handleCancelOverwrite}
        onOverwrite={handleOverwrite}
        onCancel={handleCancelOverwrite}
        title="練習記録"
        date={selectedDate}
        existingValues={[
          { label: 'RPE', value: existingRecord?.rpe?.toString() || '-' },
          { label: '時間', value: `${existingRecord?.duration_min || 0}分` },
          { label: '矢印', value: `${(existingRecord as any)?.arrow_score ?? '-'} / 100` },
          { label: '電波', value: `${(existingRecord as any)?.signal_score ?? '-'} / 100` },
        ]}
        newValues={[
          { label: 'RPE', value: pendingData?.rpe?.toString() || '-' },
          { label: '時間', value: `${pendingData?.duration_min || 0}分` },
          { label: '矢印', value: `${pendingData?.arrow_score ?? '-'} / 100` },
          { label: '電波', value: `${pendingData?.signal_score ?? '-'} / 100` },
        ]}
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        {successFeedback && (
          <div
            className={`rounded-lg border-2 p-4 animate-in slide-in-from-top-2 duration-300 ${
              successFeedback.type === 'milestone'
                ? 'bg-green-50 dark:bg-green-900/20 border-green-500 dark:border-green-700'
                : successFeedback.type === 'success'
                ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 dark:border-blue-700'
                : 'bg-purple-50 dark:bg-purple-900/20 border-purple-500 dark:border-purple-700'
            }`}
          >
            <div className="flex items-start gap-3">
              {successFeedback.type === 'milestone' ? (
                <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
              ) : (
                <Sparkles className="w-6 h-6 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <h4
                  className={`font-semibold text-base mb-1 ${
                    successFeedback.type === 'milestone'
                      ? 'text-green-700 dark:text-green-300'
                      : successFeedback.type === 'success'
                      ? 'text-blue-700 dark:text-blue-300'
                      : 'text-purple-700 dark:text-purple-300'
                  }`}
                >
                  {successFeedback.title}
                </h4>
                <p
                  className={`text-sm ${
                    successFeedback.type === 'milestone'
                      ? 'text-green-600 dark:text-green-400'
                      : successFeedback.type === 'success'
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-purple-600 dark:text-purple-400'
                  }`}
                >
                  {successFeedback.message}
                </p>
              </div>
            </div>
          </div>
        )}

        {lastRecord && (
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-sm">
            <p className="text-blue-600 dark:text-blue-400 mb-1">前回の記録</p>
            <p className="text-blue-700 dark:text-blue-300">
              RPE {lastRecord.rpe ?? '-'} × {lastRecord.duration_min ?? '-'}分 = 負荷{' '}
              {(lastRecord.rpe ?? 0) * (lastRecord.duration_min ?? 0)}
            </p>
          </div>
        )}

        {/* 日付 */}
        <div>
          <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <Calendar className="w-4 h-4 mr-2" />
            日付
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            disabled={submitting || loading}
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 disabled:opacity-60"
          />
        </div>

        {/* RPE */}
        <div>
          <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <Zap className="w-4 h-4 mr-2" />
            RPE（運動強度）
          </label>

          <input
            type="range"
            min="0"
            max="10"
            value={rpe}
            onChange={handleRpeChange}
            disabled={submitting || loading}
            className="w-full"
          />

          <div className="mt-2 text-sm text-gray-700 dark:text-gray-200">{rpeLabels[rpe]}</div>
        </div>

        {/* 時間（分） */}
        <div>
          <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <Clock className="w-4 h-4 mr-2" />
            練習時間（分）
          </label>
          <input
            type="number"
            min="0"
            max="480"
            value={duration}
            onChange={handleDurationChange}
            disabled={submitting || loading}
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 disabled:opacity-60"
            style={{ fontSize: '16px' }}
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">※ 休養日は「RPE=0 / 時間=0」</p>
        </div>

        {/* 負荷 */}
        <div className="bg-gray-50 dark:bg-gray-800/60 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-300">今日の負荷</span>
            <span className="text-lg font-semibold text-gray-900 dark:text-white">{loadValue}</span>
          </div>
        </div>

        {/* 矢印 / 電波 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-gray-50 dark:bg-gray-800/60 rounded-lg p-4">
            <VectorArrowPicker value={arrowScore} onChange={setArrowScore} />
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-center">
              矢印（成長実感）: {arrowScore}/100
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-800/60 rounded-lg p-4">
            <SignalPicker value={signalScore} onChange={setSignalScore} />
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-center">
              電波（意図理解）: {signalScore}/100
            </div>
          </div>
        </div>

        {/* warning / error */}
        {warning && (
          <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-yellow-700 dark:text-yellow-300">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{warning}</span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* 送信 */}
        <button
          type="submit"
          disabled={loading || submitting}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
        >
          <Plus className="w-4 h-4 mr-2" />
          {submitting ? '保存中...' : '記録する'}
        </button>
      </form>
    </>
  );
}