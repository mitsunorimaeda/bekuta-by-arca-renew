/**
 * 月経周期関連の共通定数
 */

export const SYMPTOM_OPTIONS = [
  { value: 'cramps', label: '腹痛', icon: '😣' },
  { value: 'mood_changes', label: '気分の変動', icon: '😢' },
  { value: 'fatigue', label: '疲労感', icon: '😴' },
  { value: 'headache', label: '頭痛', icon: '🤕' },
  { value: 'bloating', label: 'むくみ', icon: '🫧' },
  { value: 'breast_tenderness', label: '胸の張り', icon: '💗' },
  { value: 'acne', label: '肌荒れ', icon: '😖' },
  { value: 'back_pain', label: '腰痛', icon: '🦴' },
] as const;

export type SymptomValue = (typeof SYMPTOM_OPTIONS)[number]['value'];

export type FlowIntensity = 'light' | 'moderate' | 'heavy';

export const FLOW_OPTIONS: { value: FlowIntensity; label: string; icon: string }[] = [
  { value: 'light', label: '軽い', icon: '💧' },
  { value: 'moderate', label: '普通', icon: '💧💧' },
  { value: 'heavy', label: '多い', icon: '💧💧💧' },
];

/** デフォルトの周期長（データ不足時のフォールバック） */
export const DEFAULT_CYCLE_LENGTH = 28;

/** デフォルトの生理日数 */
export const DEFAULT_PERIOD_DURATION = 5;
