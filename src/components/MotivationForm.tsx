import React, { useState, useEffect } from 'react';
import { Heart, Zap, AlertCircle, Loader2 } from 'lucide-react';
import { getTodayJSTString } from '../lib/date';
import { DuplicateRecordModal, ExistingMotivationRecord } from "./DuplicateRecordModal";
import { Toast } from './ui/Toast'; // ✅ パスは構成に合わせて調整

interface LastRecordInfo {
  date: string;
  motivation_level: number;
  energy_level: number;
  stress_level: number;
}

interface MotivationFormProps {
  onSubmit: (data: {
    motivation_level: number;
    energy_level: number;
    stress_level: number;
    date: string;
    notes?: string;
  }) => Promise<void>;

  // ✅ 既存チェック + 上書き更新
  onCheckExisting?: (date: string) => Promise<ExistingMotivationRecord | null>;
  onUpdate?: (
    id: string,
    data: {
      motivation_level: number;
      energy_level: number;
      stress_level: number;
      notes?: string;
    }
  ) => Promise<void>;

  loading?: boolean;
  lastRecord?: LastRecordInfo | null;
}

export function MotivationForm({
  onSubmit,
  onCheckExisting,
  onUpdate,
  loading = false,
  lastRecord,
}: MotivationFormProps) {
  const [motivationLevel, setMotivationLevel] = useState(5);
  const [energyLevel, setEnergyLevel] = useState(5);
  const [stressLevel, setStressLevel] = useState(5);
  const [date, setDate] = useState(getTodayJSTString());
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [initializedFromLast, setInitializedFromLast] = useState(false);

  // ✅ 手応え用：フォーム内 saving（親loadingと別）
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

  // ✅ 上書きモーダル用
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [existingRecord, setExistingRecord] = useState<ExistingMotivationRecord | null>(null);
  const [pendingData, setPendingData] = useState<{
    motivation_level: number;
    energy_level: number;
    stress_level: number;
    date: string;
    notes?: string;
  } | null>(null);

  useEffect(() => {
    if (lastRecord && !initializedFromLast) {
      setMotivationLevel(lastRecord.motivation_level);
      setEnergyLevel(lastRecord.energy_level);
      setStressLevel(lastRecord.stress_level);
      setInitializedFromLast(true);
    }
  }, [lastRecord, initializedFromLast]);

  const resetForm = () => {
    setMotivationLevel(5);
    setEnergyLevel(5);
    setStressLevel(5);
    setDate(getTodayJSTString());
    setNotes('');
    setInitializedFromLast(false);
  };

  const isBusy = loading || saving;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (isBusy) return; // ✅ 二重押し防止

    const payload = {
      motivation_level: motivationLevel,
      energy_level: energyLevel,
      stress_level: stressLevel,
      date,
      notes: notes || undefined,
    };

    setSaving(true);
    try {
      // ✅ 既存チェック（あればモーダルへ）
      if (onCheckExisting) {
        const existing = await onCheckExisting(date);
        if (existing) {
          setExistingRecord(existing);
          setPendingData(payload);
          setShowDuplicateModal(true);
          return; // ✅ ここで送信止める（finallyで saving解除）
        }
      }

      await onSubmit(payload);
      resetForm();
      showToast('success', '記録しました ✅');
    } catch (err: any) {
      setError('モチベーション記録の追加に失敗しました');
      console.error('Error submitting motivation record:', err);
      showToast('error', `保存に失敗しました：${err?.message ?? '不明なエラー'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleOverwrite = async () => {
    if (!existingRecord || !pendingData) return;
    if (isBusy) return;

    setError('');
    setShowDuplicateModal(false);
    setSaving(true);

    try {
      // ✅ update が渡されているなら update を優先（idで更新）
      if (onUpdate) {
        await onUpdate(existingRecord.id, {
          motivation_level: pendingData.motivation_level,
          energy_level: pendingData.energy_level,
          stress_level: pendingData.stress_level,
          notes: pendingData.notes,
        });
      } else {
        // fallback
        await onSubmit(pendingData);
      }

      setExistingRecord(null);
      setPendingData(null);
      resetForm();
      showToast('success', '上書きして記録しました ✅');
    } catch (err: any) {
      setError('上書きに失敗しました');
      console.error('Error overwriting motivation record:', err);
      showToast('error', `上書きに失敗しました：${err?.message ?? '不明なエラー'}`);
    } finally {
      setSaving(false);
    }
  };

  const renderSlider = (
    value: number,
    onChange: (value: number) => void,
    label: string,
    icon: React.ReactNode,
    lowLabel: string,
    highLabel: string,
    colorTextClass: string,
    previousValue?: number,
    accentHex?: string
  ) => {
    // ✅ 線形グラデ（つまみ位置まで色を出す）
    const pct = (value - 1) * 11.11; // 1〜10 を 0〜100 に近似
    const active = accentHex ?? '#3b82f6';
    const inactive = '#9ca3af';

    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {icon}
          {label}
        </label>

        {previousValue !== undefined && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">
            前回: <span className="font-semibold">{previousValue}</span> / 10
            {lastRecord?.date && <span className="ml-1">（{lastRecord.date}）</span>}
          </p>
        )}

        <div className="flex items-center space-x-3">
          <span className="text-xs text-gray-500 dark:text-gray-400 w-12">{lowLabel}</span>
          <input
            type="range"
            min="1"
            max="10"
            value={value}
            onChange={(e) => onChange(parseInt(e.target.value))}
            disabled={isBusy}
            className="flex-1 h-2 rounded-lg appearance-none cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
              background: `linear-gradient(to right, ${active} 0%, ${active} ${pct}%, ${inactive} ${pct}%, ${inactive} 100%)`,
            }}
          />
          <span className="text-xs text-gray-500 dark:text-gray-400 w-12 text-right">{highLabel}</span>
        </div>

        <div className="text-center mt-2">
          <span className={`text-2xl font-bold ${colorTextClass}`}>{value}</span>
          <span className="text-sm text-gray-500 dark:text-gray-400"> / 10</span>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* ✅ Toast */}
      <Toast
        open={toastOpen}
        type={toastType}
        message={toastMsg}
        onClose={() => setToastOpen(false)}
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">日付</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            required
            disabled={isBusy}
          />
        </div>

        {renderSlider(
          motivationLevel,
          setMotivationLevel,
          'モチベーション',
          <Heart className="w-4 h-4 inline mr-2 text-blue-500" />,
          '低い',
          '高い',
          'text-blue-500',
          lastRecord?.motivation_level,
          '#3b82f6'
        )}

        {renderSlider(
          energyLevel,
          setEnergyLevel,
          'エネルギーレベル',
          <Zap className="w-4 h-4 inline mr-2 text-green-500" />,
          '疲労',
          '充実',
          'text-green-500',
          lastRecord?.energy_level,
          '#10b981'
        )}

        {renderSlider(
          stressLevel,
          setStressLevel,
          'ストレスレベル',
          <AlertCircle className="w-4 h-4 inline mr-2 text-red-500" />,
          'リラックス',
          '高ストレス',
          'text-red-500',
          lastRecord?.stress_level,
          '#ef4444'
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">メモ（任意）</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="今日の出来事や気持ちを記録..."
            rows={3}
            disabled={isBusy}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white resize-none disabled:opacity-60"
          />
        </div>

        <button
          type="submit"
          disabled={isBusy}
          className={`w-full px-4 py-3 rounded-lg font-medium transition-colors flex items-center justify-center ${
            isBusy
              ? 'bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-300 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {isBusy ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              保存中…
            </span>
          ) : (
            <>
              <Heart className="w-5 h-5 mr-2" />
              モチベーションを記録する
            </>
          )}
        </button>
      </form>

      {/* ✅ 上書きモーダル */}
      {existingRecord && pendingData && (
        <DuplicateRecordModal
          isOpen={showDuplicateModal}
          onClose={() => {
            setShowDuplicateModal(false);
            // ✅ 閉じる時に状態を戻す（次回に残さない）
            setExistingRecord(null);
            setPendingData(null);
          }}
          onCancel={() => {
            setShowDuplicateModal(false);
            setExistingRecord(null);
            setPendingData(null);
          }}
          onOverwrite={handleOverwrite}
          existingRecord={existingRecord}
          newValue={{
            motivation_level: pendingData.motivation_level,
            energy_level: pendingData.energy_level,
            stress_level: pendingData.stress_level,
            notes: pendingData.notes,
          }}
        />
      )}
    </>
  );
}