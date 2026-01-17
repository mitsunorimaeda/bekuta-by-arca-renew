import React, { useState, useEffect, useMemo } from 'react';
import { getTodayJSTString } from '../lib/date';
import { Plus, Calendar, AlertCircle, TrendingUp, Lock, Scale } from 'lucide-react';
import {
  calculatePrimaryValue,
  getCalculatedUnit,
  getCalculatedValueLabel,
  formatCalculatedValue,
} from '../lib/performanceCalculations';
import { useWeightData } from '../hooks/useWeightData';
import { PerformanceRecordWithTest } from '../hooks/usePerformanceData';
import { DuplicateRecordModal } from './DuplicateRecordModal';

interface PerformanceTestField {
  name: string;
  label: string;
  unit?: string;
  type?: 'number' | 'select' | string;
  required?: boolean;
  options?: { value: string; label: string }[];
}

interface PerformanceTestType {
  id: string;
  name: string;
  display_name: string;
  description?: string;
  unit: string;
  user_can_input?: boolean;
  fields: PerformanceTestField[] | any[];
}

interface PerformanceRecordFormProps {
  userId: string;
  userRole?: string;
  testTypes: PerformanceTestType[];
  onSubmit: (data: {
    test_type_id: string;
    date: string;
    values: Record<string, any>;
    notes?: string;
    is_official?: boolean;
  }) => Promise<{ data: any; isNewPersonalBest: boolean }>;
  onCheckExisting: (testTypeId: string, date: string) => Promise<PerformanceRecordWithTest | null>;
  onUpdate: (recordId: string, updates: any) => Promise<any>;
  loading: boolean;
  lastRecords?: Map<string, any>;
  personalBests?: Map<string, any>;
}

// ✅ 筋力系種目をここで一元管理（ベンチ・SQ・DL・ブルガリアン左右）
const strengthTestNames = [
  'bench_press',
  'back_squat',
  'deadlift',
  'bulgarian_squat_r',
  'bulgarian_squat_l',
];

export function PerformanceRecordForm({
  userId,
  userRole: _userRole,
  testTypes,
  onSubmit,
  onCheckExisting,
  onUpdate,
  loading,
  lastRecords,
  personalBests
}: PerformanceRecordFormProps) {
  const { getLatestWeight } = useWeightData(userId);

  const [selectedTestTypeId, setSelectedTestTypeId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(getTodayJSTString());
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>('');
  const [showPersonalBestMessage, setShowPersonalBestMessage] = useState(false);
  const [latestWeight, setLatestWeight] = useState<number | null>(null);
  const [relative1RM, setRelative1RM] = useState<number | null>(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [existingRecord, setExistingRecord] = useState<PerformanceRecordWithTest | null>(null);
  const [pendingData, setPendingData] = useState<any>(null);

  const selectedTestType = useMemo(
    () => testTypes.find(t => t.id === selectedTestTypeId),
    [testTypes, selectedTestTypeId]
  );

  useEffect(() => {
    if (!selectedTestType) return;

    // 初期化
    const initialValues: Record<string, any> = {};
    if (Array.isArray(selectedTestType.fields)) {
      selectedTestType.fields.forEach((field: any) => {
        initialValues[field.name] = '';
      });
    }
    setFormValues(initialValues);

    // ✅ 筋力測定種目の場合、最新体重を取得
    const isStrengthTest = strengthTestNames.includes(selectedTestType.name);
    if (isStrengthTest) {
      const weight = getLatestWeight();
      console.log('🏋️ Strength test selected, latest weight:', weight);
      setLatestWeight(weight);
    } else {
      setLatestWeight(null);
      setRelative1RM(null);
    }
  }, [selectedTestType, getLatestWeight]);

  const computePrimaryValue = (values: Record<string, any>): number | null => {
    if (!selectedTestType) return null;
    return calculatePrimaryValue(selectedTestType.name, values);
  };

  const getDisplayUnit = (): string => {
    if (!selectedTestType) return '';
    const calculatedUnit = getCalculatedUnit(selectedTestType.name);
    return calculatedUnit || selectedTestType.unit;
  };

  const getValueLabel = (): string => {
    if (!selectedTestType) return '計算値';
    return getCalculatedValueLabel(selectedTestType.name);
  };

  // ✅ 計算値の表示（utilに統一）
  const getPrimaryValueDisplay = (): string => {
    if (!selectedTestType) return '-';
    const primaryValue = computePrimaryValue(formValues);
    if (primaryValue === null) return '-';
    return formatCalculatedValue(selectedTestType.name, primaryValue);
  };

  const lastRecord = lastRecords?.get(selectedTestTypeId);
  const personalBest = personalBests?.get(selectedTestTypeId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedTestType) {
      setError('測定種目を選択してください');
      return;
    }

    const requiredFields = Array.isArray(selectedTestType.fields)
      ? selectedTestType.fields.filter((f: any) => f.required)
      : [];

    for (const field of requiredFields) {
      if (!formValues[field.name] || formValues[field.name] === '') {
        setError(`${field.label}を入力してください`);
        return;
      }
    }

    const primaryValue = computePrimaryValue(formValues);
    if (primaryValue === null) {
      setError('計算できない値が入力されています');
      return;
    }

    // ✅ primary_value をDBに綺麗に入れる（表示と同じ丸めに統一）
    const unit = getDisplayUnit();
    let normalizedPrimary: number;

    if (unit === '秒') {
      normalizedPrimary = Number(primaryValue.toFixed(2));
    } else if (unit === 'ml/kg/min') {
      normalizedPrimary = Number(primaryValue.toFixed(1));
    } else if (unit === 'RSI') {
      normalizedPrimary = Number(primaryValue.toFixed(2));
    } else if (unit === 'kg') {
      normalizedPrimary = Number(primaryValue.toFixed(1));
    } else {
      normalizedPrimary = primaryValue;
    }

    // ✅ 筋力測定の場合、相対1RMと測定時体重を追加（ブルガリアン含む）
    const isStrengthTest = strengthTestNames.includes(selectedTestType.name);

    const valuesWithRelative = {
      ...formValues,
      primary_value: normalizedPrimary,
      ...(isStrengthTest && latestWeight ? {
        relative_1rm: relative1RM,
        weight_at_test: latestWeight
      } : {})
    };

    // 重複チェック
    const existing = await onCheckExisting(selectedTestTypeId, selectedDate);
    if (existing) {
      setExistingRecord(existing);
      setPendingData({
        test_type_id: selectedTestTypeId,
        date: selectedDate,
        values: valuesWithRelative,
        notes: notes || undefined,
        is_official: true
      });
      setShowDuplicateModal(true);
      return;
    }

    setSubmitting(true);

    try {
      const result = await onSubmit({
        test_type_id: selectedTestTypeId,
        date: selectedDate,
        values: valuesWithRelative,
        notes: notes || undefined,
        is_official: true
      });

      if (result.isNewPersonalBest) {
        setShowPersonalBestMessage(true);
        setTimeout(() => setShowPersonalBestMessage(false), 5000);
      }

      setFormValues({});
      setNotes('');
      setSelectedTestTypeId('');
      setSelectedDate(getTodayJSTString());
      setRelative1RM(null);
      setLatestWeight(null);
    } catch (err) {
      console.error('Error submitting performance record:', err);
      setError('記録の追加に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOverwrite = async () => {
    if (!existingRecord || !pendingData) return;

    setSubmitting(true);
    setShowDuplicateModal(false);

    try {
      await onUpdate((existingRecord as any).id, {
        values: pendingData.values,
        notes: pendingData.notes
      });

      setFormValues({});
      setNotes('');
      setSelectedTestTypeId('');
      setSelectedDate(getTodayJSTString());
      setExistingRecord(null);
      setPendingData(null);
      setRelative1RM(null);
      setLatestWeight(null);
    } catch (err) {
      console.error('Error updating record:', err);
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

  const handleValueChange = (fieldName: string, value: string) => {
    const newValues = {
      ...formValues,
      [fieldName]: value
    };
    setFormValues(newValues);

    // ✅ 筋力測定で重量または回数が入力された場合、相対1RMを計算（ブルガリアン含む）
    const isStrengthTest = !!selectedTestType && strengthTestNames.includes(selectedTestType.name);

    if (isStrengthTest && (fieldName === 'weight' || fieldName === 'reps') && latestWeight) {
      const weight = parseFloat(newValues.weight || '0');
      const reps = parseFloat(newValues.reps || '0');

      console.log('💪 Calculating relative 1RM from:', { weight, reps, latestWeight });

      if (weight > 0 && reps > 0) {
        const oneRM = weight * (1 + reps / 30);
        const relative = oneRM / latestWeight;
        console.log('✅ 1RM:', oneRM.toFixed(1), 'kg, Relative 1RM:', relative.toFixed(2));
        setRelative1RM(Math.round(relative * 100) / 100);
      } else {
        setRelative1RM(null);
      }
    }
  };

  return (
    <>
      <DuplicateRecordModal
        isOpen={showDuplicateModal}
        onClose={handleCancelOverwrite}
        onOverwrite={handleOverwrite}
        onCancel={handleCancelOverwrite}
        existingRecord={existingRecord!}
        newValue={pendingData?.values?.primary_value || 0}
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        {showPersonalBestMessage && (
          <div className="bg-gradient-to-r from-yellow-50 to-yellow-100 dark:from-yellow-900/30 dark:to-yellow-800/30 border-2 border-yellow-400 dark:border-yellow-600 rounded-xl p-4 animate-bounce-subtle">
            <div className="flex items-center">
              <TrendingUp className="w-6 h-6 text-yellow-600 dark:text-yellow-400 mr-3" />
              <div>
                <p className="font-bold text-yellow-900 dark:text-yellow-100">🎉 パーソナルベスト更新！</p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">おめでとうございます！自己最高記録を達成しました！</p>
              </div>
            </div>
          </div>
        )}

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
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            測定種目
          </label>
          <select
            value={selectedTestTypeId}
            onChange={(e) => setSelectedTestTypeId(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-base bg-white dark:bg-gray-700 dark:text-white"
            style={{ fontSize: '16px' }}
          >
            <option value="">測定種目を選択</option>

            {testTypes
              .filter(testType => testType.user_can_input !== false)
              .map(testType => (
                <option key={testType.id} value={testType.id}>
                  {testType.display_name}
                </option>
              ))}

            {testTypes
              .filter(testType => testType.user_can_input === false)
              .map(testType => (
                <option key={testType.id} value={testType.id} disabled className="text-gray-400">
                  🔒 {testType.display_name}（専門業者測定）
                </option>
              ))}
          </select>

          {selectedTestType && (
            <div className="mt-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {selectedTestType.description}
              </p>
              {selectedTestType.user_can_input === false && (
                <div className="mt-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 flex items-start">
                  <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 mr-2 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-amber-700 dark:text-amber-300">
                    <p className="font-semibold">専門業者による測定が必要です</p>
                    <p className="mt-1">この測定は専用機器が必要なため、個人での入力はできません。測定データは専門業者によって記録されます。</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {selectedTestType && Array.isArray(selectedTestType.fields) && (
          <>
            {lastRecord && (
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-sm">
                <p className="text-blue-600 dark:text-blue-400 mb-1">前回の記録</p>
                <p className="text-blue-700 dark:text-blue-300">
                  {formatCalculatedValue(selectedTestType.name, Number(lastRecord.values?.primary_value))}
                  {' '}
                  {getDisplayUnit()}
                  {' '}
                  ({new Date(lastRecord.date).toLocaleDateString('ja-JP')})
                </p>
              </div>
            )}

            {personalBest && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3 text-sm">
                <p className="text-yellow-600 dark:text-yellow-400 mb-1 flex items-center">
                  <TrendingUp className="w-4 h-4 mr-1" />
                  パーソナルベスト
                </p>
                <p className="text-yellow-700 dark:text-yellow-300 font-semibold">
                  {formatCalculatedValue(selectedTestType.name, Number(personalBest.value))}
                  {' '}
                  {getDisplayUnit()}
                  {' '}
                  ({new Date(personalBest.date).toLocaleDateString('ja-JP')})
                </p>
              </div>
            )}

            <div className="space-y-4">
              {selectedTestType.fields.map((field: any) => (
                <div key={field.name}>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {field.label} {field.required && <span className="text-red-500">*</span>}
                    {field.unit && (
                      <span className="text-gray-500 text-xs ml-1">
                        ({field.unit})
                      </span>
                    )}
                  </label>

                  {field.type === 'select' ? (
                    <select
                      value={formValues[field.name] || ''}
                      onChange={(e) => handleValueChange(field.name, e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-base bg-white dark:bg-gray-700 dark:text-white"
                      style={{ fontSize: '16px' }}
                    >
                      <option value="">{field.label}を選択</option>
                      {field.options?.map((option: any) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={field.type === 'text' ? 'text' : 'number'}
                      inputMode={field.type === 'text' ? 'text' : 'decimal'}
                      step={field.type === 'text' ? undefined : '0.01'}
                      min={field.type === 'text' ? undefined : 0}
                      value={formValues[field.name] || ''}
                      onChange={(e) => handleValueChange(field.name, e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-base bg-white dark:bg-gray-700 dark:text-white"
                      placeholder={field.label}
                      style={{ fontSize: '16px' }}
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-4 transition-colors">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">{getValueLabel()}</span>
                <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {getPrimaryValueDisplay()} {getDisplayUnit()}
                </span>
              </div>
            </div>

            {/* ✅ 筋力測定の場合、相対1RMと測定時体重を表示（ブルガリアン含む） */}
            {selectedTestType && strengthTestNames.includes(selectedTestType.name) && (
              <div className="space-y-3">
                {latestWeight && (
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center">
                        <Scale className="w-4 h-4 text-green-600 dark:text-green-400 mr-2" />
                        <span className="text-sm font-medium text-green-700 dark:text-green-300">
                          測定時の体重
                        </span>
                      </div>
                      <span className="text-lg font-bold text-green-600 dark:text-green-400">
                        {latestWeight.toFixed(1)} kg
                      </span>
                    </div>
                    <p className="text-xs text-green-600 dark:text-green-400">
                      最新の体重記録から自動取得
                    </p>
                  </div>
                )}

                {relative1RM && latestWeight && (
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg p-4 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
                        相対1RM（体重比）
                      </span>
                      <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                        {relative1RM.toFixed(2)}
                      </span>
                    </div>
                    <p className="text-xs text-purple-600 dark:text-purple-400">
                      1RM {getPrimaryValueDisplay()} kg ÷ 体重 {latestWeight.toFixed(1)} kg = {relative1RM.toFixed(2)}
                    </p>
                  </div>
                )}

                {!latestWeight && (
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                    <div className="flex items-start">
                      <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mr-2 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-200">
                          体重記録がありません
                        </p>
                        <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                          相対1RM（体重比）を計算するには、体重記録を追加してください。
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            メモ（任意）
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-base bg-white dark:bg-gray-700 dark:text-white resize-none"
            placeholder="コンディションや気づいたことを記録..."
            style={{ fontSize: '16px' }}
          />
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
          disabled={submitting || loading || !selectedTestTypeId || selectedTestType?.user_can_input === false}
          className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center"
          style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
        >
          {submitting ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
          ) : (
            <Plus className="w-5 h-5 mr-2" />
          )}
          {submitting ? '記録中...' : '測定記録を追加'}
        </button>
      </form>
    </>
  );
}