import React, { useState, useEffect, useCallback } from 'react';
import { Heart, Zap, AlertCircle, AlertTriangle, X } from 'lucide-react';
import { getTodayJSTString } from '../lib/date';

interface LastRecordInfo {
  date: string;
  motivation_level: number;
  energy_level: number;
  stress_level: number;
}

type MotivationPayload = {
  motivation_level: number;
  energy_level: number;
  stress_level: number;
  date: string;
  notes?: string;
};

interface MotivationFormProps {
  /** 新規保存（基本は insert） */
  onSubmit: (data: MotivationPayload) => Promise<void>;

  /** ✅ 追加：同日の既存レコード確認（なければ null） */
  onCheckExisting?: (date: string) => Promise<LastRecordInfo | null>;

  /** ✅ 追加：上書き保存（update/upsert） */
  onOverwrite?: (data: MotivationPayload) => Promise<void>;

  loading?: boolean;

  /** 前回の記録（任意） */
  lastRecord?: LastRecordInfo | null;
}

/** YYYY-MM-DD をそのまま取り出す（ISOでも可） */
function toYMD(input: string) {
  const m = input?.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : '';
}

export function MotivationForm({
  onSubmit,
  onCheckExisting,
  onOverwrite,
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

  // 上書き確認モーダル用
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [existingSameDay, setExistingSameDay] = useState<LastRecordInfo | null>(null);
  const [pendingPayload, setPendingPayload] = useState<MotivationPayload | null>(null);

  // 🔁 前回記録が入ってきたタイミングで、一度だけスライダー初期値に反映
  useEffect(() => {
    if (lastRecord && !initializedFromLast) {
      setMotivationLevel(lastRecord.motivation_level);
      setEnergyLevel(lastRecord.energy_level);
      setStressLevel(lastRecord.stress_level);
      setInitializedFromLast(true);
    }
  }, [lastRecord, initializedFromLast]);

  const resetForm = useCallback(() => {
    setMotivationLevel(5);
    setEnergyLevel(5);
    setStressLevel(5);
    setDate(getTodayJSTString());
    setNotes('');
    setInitializedFromLast(false);
  }, []);

  const doSubmit = useCallback(
    async (payload: MotivationPayload) => {
      await onSubmit(payload);
      resetForm();
    },
    [onSubmit, resetForm]
  );

  const doOverwrite = useCallback(
    async (payload: MotivationPayload) => {
      if (onOverwrite) {
        await onOverwrite(payload);
      } else {
        // 上書きハンドラが無い場合はフォールバック（ただし本来は親で onOverwrite を渡すのがおすすめ）
        await onSubmit(payload);
      }
      resetForm();
    },
    [onOverwrite, onSubmit, resetForm]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const ymd = toYMD(date) || getTodayJSTString();

      const payload: MotivationPayload = {
        motivation_level: motivationLevel,
        energy_level: energyLevel,
        stress_level: stressLevel,
        date: ymd,
        notes: notes || undefined,
      };

      // ✅ 既存チェック（関数が渡っている時だけ）
      if (onCheckExisting) {
        const existing = await onCheckExisting(ymd);
        if (existing) {
          // 同日のデータがある → 上書き確認
          setExistingSameDay(existing);
          setPendingPayload(payload);
          setIsConfirmOpen(true);
          return;
        }
      }

      // なければ通常保存
      await doSubmit(payload);
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
    color: string,
    previousValue?: number
  ) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {icon}
        {label}
      </label>

      {/* 前回表示 */}
      {previousValue !== undefined && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">
          前回: <span className="font-semibold">{previousValue}</span> / 10
          {lastRecord?.date && <span className="ml-1">（{lastRecord.date}）</span>}
        </p>
      )}

      <div className="flex items-center space-x-3">
        <span className="text-xs text-gray-500 dark:text-gray-400 w-12">
          {lowLabel}
        </span>
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

  const ConfirmOverwriteModal = () => {
    if (!isConfirmOpen || !pendingPayload || !existingSameDay) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[85vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white z-10">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0 w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-yellow-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                同じ日付の記録があります
              </h3>
            </div>
            <button
              onClick={() => setIsConfirmOpen(false)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-4">
            <p className="text-gray-600 text-sm">
              {pendingPayload.date} のモチベーション記録は既に存在します。上書きしますか？
            </p>

            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-2">既存 → 新規</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">モチベ</span>
                  <span className="font-semibold">
                    {existingSameDay.motivation_level} → {pendingPayload.motivation_level}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">エネルギー</span>
                  <span className="font-semibold">
                    {existingSameDay.energy_level} → {pendingPayload.energy_level}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">ストレス</span>
                  <span className="font-semibold">
                    {existingSameDay.stress_level} → {pendingPayload.stress_level}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-sm text-yellow-800">
                上書きすると既存データは置き換わります（元には戻せません）。
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end space-x-3 p-6 border-t bg-gray-50 rounded-b-lg sticky bottom-0 z-10">
            <button
              type="button"
              onClick={() => {
                setIsConfirmOpen(false);
                setPendingPayload(null);
                setExistingSameDay(null);
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              disabled={loading}
            >
              キャンセル
            </button>

            <button
              type="button"
              onClick={async () => {
                try {
                  setError('');
                  await doOverwrite(pendingPayload);
                  setIsConfirmOpen(false);
                  setPendingPayload(null);
                  setExistingSameDay(null);
                } catch (err) {
                  setError('上書きに失敗しました');
                  console.error('Error overwriting motivation record:', err);
                }
              }}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
            >
              上書きする
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <ConfirmOverwriteModal />

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
          'text-blue-500',
          lastRecord?.motivation_level
        )}

        {renderSlider(
          energyLevel,
          setEnergyLevel,
          'エネルギーレベル',
          <Zap className="w-4 h-4 inline mr-2 text-green-500" />,
          '疲労',
          '充実',
          'text-green-500',
          lastRecord?.energy_level
        )}

        {renderSlider(
          stressLevel,
          setStressLevel,
          'ストレスレベル',
          <AlertCircle className="w-4 h-4 inline mr-2 text-red-500" />,
          'リラックス',
          '高ストレス',
          'text-red-500',
          lastRecord?.stress_level
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
              モチベーション記録を保存
            </>
          )}
        </button>
      </form>
    </>
  );
}