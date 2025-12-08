import React, { useState } from 'react';
import { X, CheckCircle, Activity, Scale, Moon, Heart, Zap, Calendar } from 'lucide-react';
import { TrainingRecord, WeightRecord, SleepRecord, MotivationRecord } from '../lib/supabase';
import { GenericDuplicateModal } from './GenericDuplicateModal';
import { getTodayJSTString } from '../lib/date';

interface UnifiedDailyCheckInProps {
  userId: string;
  userGender?: 'male' | 'female' | null;
  onTrainingSubmit: (data: { rpe: number; duration_min: number; date: string }) => Promise<void>;
  onTrainingCheckExisting: (date: string) => Promise<TrainingRecord | null>;
  onTrainingUpdate: (id: string, data: { rpe: number; duration_min: number }) => Promise<void>;
  onWeightSubmit: (data: { weight_kg: number; date: string; notes?: string }) => Promise<void>;
  onWeightCheckExisting: (date: string) => Promise<WeightRecord | null>;
  onWeightUpdate: (id: string, data: { weight_kg: number; notes?: string }) => Promise<void>;
  onSleepSubmit: (data: { sleep_hours: number; sleep_quality: number; date: string; notes?: string }) => Promise<void>;
  onSleepCheckExisting: (date: string) => Promise<SleepRecord | null>;
  onSleepUpdate: (id: string, data: any) => Promise<void>;
  onMotivationSubmit: (data: { motivation_level: number; energy_level: number; stress_level: number; date: string; notes?: string }) => Promise<void>;
  onMotivationCheckExisting: (date: string) => Promise<MotivationRecord | null>;
  onMotivationUpdate: (id: string, data: any) => Promise<void>;
  onCycleSubmit: (data: {
    cycle_start_date: string;
    period_duration_days?: number;
    cycle_length_days?: number;
    symptoms?: string[];
    flow_intensity?: string;
    notes?: string;
  }) => Promise<any>;
  onCycleUpdate: (id: string, data: { period_duration_days?: number; cycle_length_days?: number; symptoms?: string[]; flow_intensity?: string; notes?: string }) => Promise<any>;
  onClose: () => void;
  lastTrainingRecord?: { rpe: number; duration_min: number; date: string } | null;
  lastWeightRecord?: { weight_kg: number; date: string } | null;
  lastSleepRecord?: {
    sleep_hours: number;
    sleep_quality: number | null;
    date: string;
  } | null;
  lastMotivationRecord?: {
    motivation_level: number;
    energy_level: number;
    stress_level: number;
    date: string;
  } | null;
}

export function UnifiedDailyCheckIn({
  userGender,
  onTrainingSubmit,
  onTrainingCheckExisting,
  onTrainingUpdate,
  onWeightSubmit,
  onWeightCheckExisting,
  onWeightUpdate,
  onSleepSubmit,
  onSleepCheckExisting,
  onSleepUpdate,
  onMotivationSubmit,
  onMotivationCheckExisting,
  onMotivationUpdate,
  onCycleSubmit,
  onCycleUpdate,
  onClose,
  lastTrainingRecord,
  lastWeightRecord,
  lastSleepRecord,       // ★ 追加
  lastMotivationRecord   // ★ 追加
}: UnifiedDailyCheckInProps) {
  const today = getTodayJSTString();;

  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [activeSection, setActiveSection] = useState<'training' | 'weight' | 'conditioning' | 'cycle'>('training');

  const [rpe, setRpe] = useState<number>(lastTrainingRecord?.rpe || 5);
  const [duration, setDuration] = useState<number>(lastTrainingRecord?.duration_min || 60);

  const [weight, setWeight] = useState<string>(lastWeightRecord?.weight_kg ? String(lastWeightRecord.weight_kg) : '');
  const [weightNotes, setWeightNotes] = useState<string>('');

  // ★ 前回睡眠から初期値
  const [sleepHours, setSleepHours] = useState<number>(
    lastSleepRecord?.sleep_hours ?? 7);
  const [sleepQuality, setSleepQuality] = useState<number>(
    (lastSleepRecord?.sleep_quality ?? 3));
  const [sleepNotes, setSleepNotes] = useState<string>('');

   // ★ 前回モチベーションから初期値
   const [motivationLevel, setMotivationLevel] = useState<number>(
    lastMotivationRecord?.motivation_level ?? 7
  );
  const [energyLevel, setEnergyLevel] = useState<number>(
    lastMotivationRecord?.energy_level ?? 7
  );
  const [stressLevel, setStressLevel] = useState<number>(
    lastMotivationRecord?.stress_level ?? 5
  );
  const [conditioningNotes, setConditioningNotes] = useState<string>('');

  // Menstrual cycle tracking (for female users)
  const [periodStart, setPeriodStart] = useState<boolean>(false);
  const [periodDuration, setPeriodDuration] = useState<number>(5);
  const [cycleLength, setCycleLength] = useState<number>(28);
  const [flowIntensity, setFlowIntensity] = useState<'light' | 'moderate' | 'heavy'>('moderate');
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [cycleNotes, setCycleNotes] = useState<string>('');

  const [completedSections, setCompletedSections] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>('');

  // Duplicate detection states
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateType, setDuplicateType] = useState<'training' | 'weight' | 'sleep' | 'motivation' | 'cycle' | null>(null);
  const [existingRecord, setExistingRecord] = useState<any>(null);
  const [pendingData, setPendingData] = useState<any>(null);

  const handleSectionComplete = async (section: 'training' | 'weight' | 'conditioning' | 'cycle') => {
    console.log('[UnifiedDailyCheckIn] handleSectionComplete called:', section);
    console.log('[UnifiedDailyCheckIn] Current values:', {
      rpe,
      duration,
      weight,
      sleepHours,
      sleepQuality,
      motivationLevel,
      energyLevel,
      stressLevel
    });
    setSubmitting(true);
    setError('');
    try {
      if (section === 'training') {
        console.log('[UnifiedDailyCheckIn] Submitting training data:', { rpe, duration_min: duration, date: selectedDate });
        console.log('[UnifiedDailyCheckIn] Checking for existing record...');
        const existing = await onTrainingCheckExisting(selectedDate);
        console.log('[UnifiedDailyCheckIn] Existing record check result:', existing);
        if (existing) {
          console.log('[UnifiedDailyCheckIn] Found existing record, showing duplicate modal');
          setDuplicateType('training');
          setExistingRecord(existing);
          setPendingData({ rpe, duration_min: duration, date: selectedDate });
          setShowDuplicateModal(true);
          setSubmitting(false);
          return;
        }
        console.log('[UnifiedDailyCheckIn] No existing record, calling onTrainingSubmit...');
        await onTrainingSubmit({ rpe, duration_min: duration, date: selectedDate });
        console.log('[UnifiedDailyCheckIn] Training data submitted successfully');
        setCompletedSections((prev) => new Set(prev).add('training'));
        setActiveSection('weight');
      } else if (section === 'weight') {
        if (weight) {
          const existing = await onWeightCheckExisting(selectedDate);
          if (existing) {
            setDuplicateType('weight');
            setExistingRecord(existing);
            setPendingData({
              weight_kg: Number(weight),
              date: selectedDate,
              notes: weightNotes || undefined
            });
            setShowDuplicateModal(true);
            setSubmitting(false);
            return;
          }
          await onWeightSubmit({
            weight_kg: Number(weight),
            date: selectedDate,
            notes: weightNotes || undefined
          });
          setCompletedSections((prev) => new Set(prev).add('weight'));
        }
        setActiveSection('conditioning');
      } else if (section === 'conditioning') {
        const existingSleep = await onSleepCheckExisting(selectedDate);
        if (existingSleep) {
          setDuplicateType('sleep');
          setExistingRecord(existingSleep);
          setPendingData({
            sleep_hours: sleepHours,
            sleep_quality: sleepQuality,
            date: selectedDate,
            notes: sleepNotes || undefined
          });
          setShowDuplicateModal(true);
          setSubmitting(false);
          return;
        }

        const existingMotivation = await onMotivationCheckExisting(selectedDate);
        if (existingMotivation) {
          setDuplicateType('motivation');
          setExistingRecord(existingMotivation);
          setPendingData({
            motivation_level: motivationLevel,
            energy_level: energyLevel,
            stress_level: stressLevel,
            date: selectedDate,
            notes: conditioningNotes || undefined
          });
          setShowDuplicateModal(true);
          setSubmitting(false);
          return;
        }

        await onSleepSubmit({
          sleep_hours: sleepHours,
          sleep_quality: sleepQuality,
          date: selectedDate,
          notes: sleepNotes || undefined
        });
        await onMotivationSubmit({
          motivation_level: motivationLevel,
          energy_level: energyLevel,
          stress_level: stressLevel,
          date: selectedDate,
          notes: conditioningNotes || undefined
        });
        setCompletedSections((prev) => new Set(prev).add('conditioning'));

        if (userGender === 'female') {
          setActiveSection('cycle');
        } else {
          setTimeout(() => {
            onClose();
          }, 500);
        }
      } else if (section === 'cycle') {
        if (periodStart) {
          await onCycleSubmit({
            cycle_start_date: selectedDate,
            period_duration_days: periodDuration,
            cycle_length_days: cycleLength,
            flow_intensity: flowIntensity,
            symptoms: symptoms.length > 0 ? symptoms : undefined,
            notes: cycleNotes || undefined
          });
        }
        setCompletedSections((prev) => new Set(prev).add('cycle'));
        setTimeout(() => {
          onClose();
        }, 500);
      }
    } catch (err) {
      console.error(`[UnifiedDailyCheckIn] Error submitting ${section}:`, err);
      const errorMessage = err instanceof Error ? err.message : '不明なエラー';
      if (err && typeof err === 'object' && 'code' in err) {
        console.error('[UnifiedDailyCheckIn] Error code:', (err as any).code);
      }
      if (err && typeof err === 'object' && 'details' in err) {
        console.error('[UnifiedDailyCheckIn] Error details:', (err as any).details);
      }
      setError(
        `${
          section === 'training'
            ? '練習'
            : section === 'weight'
            ? '体重'
            : section === 'cycle'
            ? '周期'
            : 'コンディション'
        }記録の保存に失敗しました: ${errorMessage}`
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleOverwrite = async () => {
    if (!existingRecord || !pendingData || !duplicateType) return;

    setShowDuplicateModal(false);
    setSubmitting(true);

    try {
      if (duplicateType === 'training') {
        await onTrainingUpdate(existingRecord.id, {
          rpe: pendingData.rpe,
          duration_min: pendingData.duration_min
        });
        setCompletedSections((prev) => new Set(prev).add('training'));
        setActiveSection('weight');
      } else if (duplicateType === 'weight') {
        await onWeightUpdate(existingRecord.id, {
          weight_kg: pendingData.weight_kg,
          notes: pendingData.notes
        });
        setCompletedSections((prev) => new Set(prev).add('weight'));
        setActiveSection('conditioning');
      } else if (duplicateType === 'sleep') {
        await onSleepUpdate(existingRecord.id, pendingData);

        const existingMotivation = await onMotivationCheckExisting(selectedDate);
        if (existingMotivation) {
          setDuplicateType('motivation');
          setExistingRecord(existingMotivation);
          setPendingData({
            motivation_level: motivationLevel,
            energy_level: energyLevel,
            stress_level: stressLevel,
            date: selectedDate,
            notes: conditioningNotes || undefined
          });
          setShowDuplicateModal(true);
          setSubmitting(false);
          return;
        }

        await onMotivationSubmit({
          motivation_level: motivationLevel,
          energy_level: energyLevel,
          stress_level: stressLevel,
          date: selectedDate,
          notes: conditioningNotes || undefined
        });
        setCompletedSections((prev) => new Set(prev).add('conditioning'));
        setTimeout(() => {
          onClose();
        }, 500);
      } else if (duplicateType === 'motivation') {
        await onMotivationUpdate(existingRecord.id, pendingData);
        setCompletedSections((prev) => new Set(prev).add('conditioning'));
        setTimeout(() => {
          onClose();
        }, 500);
      }

      setExistingRecord(null);
      setPendingData(null);
      setDuplicateType(null);
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
    setDuplicateType(null);
  };

  const getSectionIcon = (section: string) => {
    switch (section) {
      case 'training':
        return Activity;
      case 'weight':
        return Scale;
      case 'conditioning':
        return Heart;
      case 'cycle':
        return Calendar;
      default:
        return Activity;
    }
  };

  const rpeLabels = [
    '0 - まったく楽である',
    '1 - 非常に楽である',
    '2 - 楽である',
    '3 - 少しきつい',
    '4 - ややきつい',
    '5 - きつい',
    '6 - かなりきつい',
    '7 - 非常にきつい',
    '8 - 極度にきつい',
    '9 - 限界に近い',
    '10 - 限界'
  ];

  const getModalTitle = () => {
    switch (duplicateType) {
      case 'training':
        return '練習記録';
      case 'weight':
        return '体重記録';
      case 'sleep':
        return '睡眠記録';
      case 'motivation':
        return 'モチベーション記録';
      default:
        return '';
    }
  };

  const getModalValues = () => {
    if (!existingRecord || !pendingData) return { existing: [], pending: [] };

    switch (duplicateType) {
      case 'training':
        return {
          existing: [
            { label: 'RPE', value: existingRecord.rpe?.toString() || '-' },
            { label: '時間', value: `${existingRecord.duration_min || 0}分` }
          ],
          pending: [
            { label: 'RPE', value: pendingData.rpe?.toString() || '-' },
            { label: '時間', value: `${pendingData.duration_min || 0}分` }
          ]
        };
      case 'weight':
        return {
          existing: [{ label: '体重', value: `${existingRecord.weight_kg || 0} kg` }],
          pending: [{ label: '体重', value: `${pendingData.weight_kg || 0} kg` }]
        };
      case 'sleep':
        return {
          existing: [
            { label: '睡眠時間', value: `${existingRecord.sleep_hours || 0}時間` },
            { label: '睡眠の質', value: `${existingRecord.sleep_quality || 0}/5` }
          ],
          pending: [
            { label: '睡眠時間', value: `${pendingData.sleep_hours || 0}時間` },
            { label: '睡眠の質', value: `${pendingData.sleep_quality || 0}/5` }
          ]
        };
      case 'motivation':
        return {
          existing: [
            { label: 'モチベーション', value: `${existingRecord.motivation_level || 0}/10` },
            { label: 'エネルギー', value: `${existingRecord.energy_level || 0}/10` },
            { label: 'ストレス', value: `${existingRecord.stress_level || 0}/10` }
          ],
          pending: [
            { label: 'モチベーション', value: `${pendingData.motivation_level || 0}/10` },
            { label: 'エネルギー', value: `${pendingData.energy_level || 0}/10` },
            { label: 'ストレス', value: `${pendingData.stress_level || 0}/10` }
          ]
        };
      default:
        return { existing: [], pending: [] };
    }
  };

  const modalValues = getModalValues();

  console.log('[UnifiedDailyCheckIn] Component is rendering');
  console.log('[UnifiedDailyCheckIn] Active section:', activeSection);
  console.log('[UnifiedDailyCheckIn] Submitting:', submitting);
  console.log('[UnifiedDailyCheckIn] showDuplicateModal:', showDuplicateModal);
  console.log('[UnifiedDailyCheckIn] duplicateType:', duplicateType);

  return (
    <>
      <GenericDuplicateModal
        isOpen={showDuplicateModal}
        onClose={handleCancelOverwrite}
        onOverwrite={handleOverwrite}
        onCancel={handleCancelOverwrite}
        title={getModalTitle()}
        date={selectedDate}
        existingValues={modalValues.existing}
        newValues={modalValues.pending}
      />

      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6 z-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">今日の記録</h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400 mb-4">
              <Calendar className="w-4 h-4" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent border-none text-gray-900 dark:text-white font-medium focus:outline-none"
              />
            </div>

            <div className="flex space-x-2">
              {(userGender === 'female'
                ? (['training', 'weight', 'conditioning', 'cycle'] as const)
                : (['training', 'weight', 'conditioning'] as const)
              ).map((section) => {
                const Icon = getSectionIcon(section);
                const isActive = activeSection === section;
                const isCompleted = completedSections.has(section);

                return (
                  <button
                    key={section}
                    onClick={() => setActiveSection(section)}
                    className={`flex-1 py-3 px-4 rounded-lg font-medium text-sm transition-all flex items-center justify-center space-x-2 ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-lg'
                        : isCompleted
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {isCompleted ? <CheckCircle className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                    <span className="hidden sm:inline">
                      {section === 'training'
                        ? '練習'
                        : section === 'weight'
                        ? '体重'
                        : section === 'cycle'
                        ? '周期'
                        : 'コンディション'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-6">
            {activeSection === 'training' && (
              <div className="space-y-6">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-lg">
                    <Activity className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">練習記録</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">RPEと練習時間を記録</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    RPE (主観的運動強度): {rpe}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    value={rpe}
                    onChange={(e) => setRpe(Number(e.target.value))}
                    className="w-full h-2 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">{rpeLabels[rpe]}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    練習時間: {duration}分
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="480"
                    step="15"
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className="w-full h-2 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                    <span>0分</span>
                    <span>4時間</span>
                    <span>8時間</span>
                  </div>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                  <p className="text-sm text-blue-900 dark:text-blue-200">
                    <strong>トレーニング負荷:</strong> {rpe * duration}
                  </p>
                </div>
              </div>
            )}

            {activeSection === 'weight' && (
              <div className="space-y-6">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="bg-green-100 dark:bg-green-900/30 p-3 rounded-lg">
                    <Scale className="w-6 h-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text:white">体重記録</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">体重を記録</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    体重 (kg)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    placeholder="例: 65.5"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white text-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    メモ (任意)
                  </label>
                  <textarea
                    value={weightNotes}
                    onChange={(e) => setWeightNotes(e.target.value)}
                    placeholder="測定時の状況など"
                    rows={2}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>

                {lastWeightRecord && (
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                    <p className="text-sm text-green-900 dark:text-green-200">
                      <strong>前回の記録:</strong> {Number(lastWeightRecord.weight_kg).toFixed(1)} kg
                    </p>
                  </div>
                )}
              </div>
            )}

            {activeSection === 'conditioning' && (
              <div className="space-y-6">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="bg-purple-100 dark:bg-purple-900/30 p-3 rounded-lg">
                    <Heart className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">コンディション</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">睡眠とメンタル状態を記録</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <Moon className="w-4 h-4 inline mr-1" />
                    睡眠時間: {sleepHours}時間
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="12"
                    step="0.5"
                    value={sleepHours}
                    onChange={(e) => setSleepHours(Number(e.target.value))}
                    className="w-full h-2 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    睡眠の質: {sleepQuality}/5
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={sleepQuality}
                    onChange={(e) => setSleepQuality(Number(e.target.value))}
                    className="w-full h-2 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {sleepQuality === 5 && '最高の睡眠'}
                    {sleepQuality === 4 && '良い睡眠'}
                    {sleepQuality === 3 && '普通'}
                    {sleepQuality === 2 && 'やや不足'}
                    {sleepQuality === 1 && '睡眠不足'}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <Zap className="w-4 h-4 inline mr-1" />
                    モチベーション: {motivationLevel}/10
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={motivationLevel}
                    onChange={(e) => setMotivationLevel(Number(e.target.value))}
                    className="w-full h-2 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    エネルギー: {energyLevel}/10
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={energyLevel}
                    onChange={(e) => setEnergyLevel(Number(e.target.value))}
                    className="w-full h-2 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    ストレス: {stressLevel}/10
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={stressLevel}
                    onChange={(e) => setStressLevel(Number(e.target.value))}
                    className="w-full h-2 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    メモ (任意)
                  </label>
                  <textarea
                    value={conditioningNotes}
                    onChange={(e) => setConditioningNotes(e.target.value)}
                    placeholder="体調の詳細など"
                    rows={2}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>
            )}

            {activeSection === 'cycle' && userGender === 'female' && (
              // （cycle セクションは元のまま・省略せずコピペでOK）
              // ここは既存コードそのままで大丈夫なので、今のファイルをそのまま使ってください
              // 必要ならまた丸っと貼ります 👍
              <>
                {/* ここに cycle 部分の既存コード */}
              </>
            )}

            {error && (
              <div className="mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
              </div>
            )}

            {activeSection !== 'cycle' && (
              <div className="flex space-x-3 mt-6">
                {activeSection !== 'training' && (
                  <button
                    onClick={() => {
                      if (activeSection === 'weight') setActiveSection('training');
                      else if (activeSection === 'conditioning') setActiveSection('weight');
                    }}
                    className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-colors"
                  >
                    戻る
                  </button>
                )}
                <button
                  onClick={() => {
                    console.log('[UnifiedDailyCheckIn] Button clicked!', activeSection);
                    handleSectionComplete(activeSection);
                  }}
                  disabled={submitting || (activeSection === 'weight' && !weight)}
                  className={`flex-1 px-6 py-3 rounded-lg font-medium transition-colors ${
                    activeSection === 'training'
                      ? 'bg-blue-600 hover:bg-blue-700'
                      : activeSection === 'weight'
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-purple-600 hover:bg-purple-700'
                  } text-white disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {submitting ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    </div>
                  ) : activeSection === 'conditioning' && userGender !== 'female' ? (
                    '完了'
                  ) : (
                    '次へ'
                  )}
                </button>
              </div>
            )}

            <div className="mt-4 flex justify-center">
              <button
                onClick={onClose}
                className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              >
                後で記録する
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}