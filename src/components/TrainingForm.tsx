import React, { useState, useEffect } from 'react';
import { Plus, Clock, Zap, Calendar, AlertCircle, CheckCircle, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';
import { getDataEntryFeedback, ProgressFeedback } from '../lib/acwrProgressFeedback';
import { TrainingRecord } from '../lib/supabase';
import { GenericDuplicateModal } from './GenericDuplicateModal';

interface TrainingFormProps {
  userId: string;
  onSubmit: (data: { rpe: number; duration_min: number; date: string }) => Promise<void>;
  onCheckExisting: (date: string) => Promise<TrainingRecord | null>;
  onUpdate: (recordId: string, data: { rpe: number; duration_min: number }) => Promise<void>;
  loading: boolean;
  lastRecord?: { rpe: number; duration_min: number; date: string } | null;
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

  const [rpe, setRpe] = useState<number>(0);           // 0 = 休養日
  const [duration, setDuration] = useState<number>(0); // 休養日初期値 0 分
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>('');
  const [warning, setWarning] = useState<string>('');
  const [successFeedback, setSuccessFeedback] = useState<ProgressFeedback | null>(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [existingRecord, setExistingRecord] = useState<TrainingRecord | null>(null);
  const [pendingData, setPendingData] =
    useState<{ rpe: number; duration_min: number; date: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // 入力バリデーション（休養日のルール）
    if (rpe === 0 && duration > 0) {
      setError('RPE 0（休養日）の場合は、時間も 0 分にしてください。');
      return;
    }
    if (rpe > 0 && duration === 0) {
      setError('RPE が 1 以上のときは、練習時間も 1 分以上を入力してください。');
      return;
    }

    // 既存記録チェック
    const existing = await onCheckExisting(selectedDate);
    if (existing) {
      setExistingRecord(existing);
      setPendingData({ rpe, duration_min: duration, date: selectedDate });
      setShowDuplicateModal(true);
      return;
    }

    setSubmitting(true);

    try {
      await onSubmit({ rpe, duration_min: duration, date: selectedDate });

      // ストリーク用：休養日でも「1日入力した」とみなす
      const feedback = getDataEntryFeedback(daysWithData + 1, consecutiveDays + 1);
      if (feedback) {
        setSuccessFeedback(feedback);
        if (feedback.showConfetti) {
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
          });
        }
      }

      // 成功後リセット（今日・休養日状態に戻す）
      setRpe(0);
      setDuration(0);
      setSelectedDate(today);
    } catch (error) {
      console.error('Error submitting training record:', error);
      if (error instanceof Error) {
        if (error.message.includes('duplicate key value violates unique constraint')) {
          setError(
            `${new Date(selectedDate).toLocaleDateString(
              'ja-JP',
            )}の記録は既に存在します。既存の記録を編集してください。`,
          );
        } else {
          setError(error.message || '記録の追加に失敗しました。');
        }
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
        rpe: pendingData.rpe,
        duration_min: pendingData.duration_min,
      });

      const feedback = getDataEntryFeedback(daysWithData + 1, consecutiveDays + 1);
      if (feedback) {
        setSuccessFeedback(feedback);
        if (feedback.showConfetti) {
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
          });
        }
      }

      setRpe(0);
      setDuration(0);
      setSelectedDate(today);
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

  const checkForWarnings = (currentRpe: number, currentDuration: number) => {
    // 休養日 or 時間 0 のときは警告なし
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
    if (successFeedback) {
      const timer = setTimeout(() => {
        setSuccessFeedback(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [successFeedback]);

  const loadValue = rpe * duration; // 休養日は 0 になる

  return (
    <>
      <GenericDuplicateModal
        isOpen={showDuplicateModal}
        onClose={handleCancelOverwrite}
        onOverwrite={handleOverwrite}
        onCancel={handleCancelOverwrite}
        title="練習記録"
        date={selectedDate}
        existingValues={[
          { label: 'RPE', value: existingRecord?.rpe.toString() || '-' },
          { label: '時間', value: `${existingRecord?.duration_min || 0}分` },
        ]}
        newValues={[
          { label: 'RPE', value: pendingData?.rpe.toString() || '-' },
          { label: '時間', value: `${pendingData?.duration_min || 0}分` },
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
              RPE {lastRecord.rpe} × {lastRecord.duration_min}分 = 負荷{' '}
              {lastRecord.rpe * lastRecord.duration_min}
            </p>
          </div>
        )}

        {weeklyAverage && (
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-sm">
            <p className="text-gray-600 dark:text-gray-400 mb-1">今週の平均</p>
            <p className="text-gray-700 dark:text-gray-300">
              RPE {weeklyAverage.rpe.toFixed(1)} × {weeklyAverage.duration.toFixed(0)}分 = 負荷{' '}
              {weeklyAverage.load.toFixed(0)}
            </p>
          </div>
        )}

        <div>
          <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            <Calendar className="w-4 h-4 mr-2" />
            練習日
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            max={today}
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-base bg-white dark:bg-gray-700 dark:text-white"
            style={{ fontSize: '16px' }}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {selectedDate === today ? '今日の記録' : '過去の記録'}
          </p>
        </div>

        <div>
          <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            <Zap className="w-4 h-4 mr-2" />
            RPE（運動強度）
          </label>
          <div className="space-y-2">
            <input
              type="range"
              min="0"
              max="10"
              value={rpe}
              onChange={handleRpeChange}
              className="w-full h-2 rounded-lg appearance-none cursor-pointer"
              style={{
                WebkitAppearance: 'none',
                background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${
                  (rpe / 10) * 100
                }%, #9ca3af ${(rpe / 10) * 100}%, #9ca3af 100%)`,
              }}
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>0</span>
              <span>5</span>
              <span>10</span>
            </div>
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600 mb-1">{rpe}</div>
              <div className="text-sm text-blue-700">{rpeLabels[rpe]}</div>
            </div>
          </div>
        </div>

        <div>
          <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            <Clock className="w-4 h-4 mr-2" />
            練習時間（分）
          </label>
          <input
            type="number"
            min="0"
            max="480"
            value={duration}
            onChange={handleDurationChange}
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-base bg-white dark:bg-gray-700 dark:text-white"
            placeholder="0"
            style={{ fontSize: '16px' }}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            オフ日の場合は「RPE 0 ＋ 時間 0 分」で休養日として記録されます。
          </p>
        </div>

        {warning && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mr-2" />
              <span className="text-sm text-yellow-700 dark:text-yellow-300">{warning}</span>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mr-2" />
              <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
            </div>
          </div>
        )}

        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 transition-colors">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">計算される負荷値</span>
            <span className="text-lg font-semibold text-gray-900 dark:text-white">
              {loadValue}
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            負荷 = RPE × 練習時間（休養日は 0 として扱われます）
          </p>
        </div>

        <button
          type="submit"
          disabled={submitting || loading}
          className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center touch-target"
          style={{
            WebkitTapHighlightColor: 'transparent',
            touchAction: 'manipulation',
          }}
        >
          {submitting ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
          ) : (
            <Plus className="w-5 h-5 mr-2" />
          )}
          {submitting ? '記録中...' : '練習記録を追加'}
        </button>
      </form>
    </>
  );
}