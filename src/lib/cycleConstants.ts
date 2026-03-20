/**
 * 月経周期関連の共通定数
 */

export type SymptomCategory = 'physical' | 'emotional' | 'behavioral';

export const SYMPTOM_OPTIONS = [
  // 身体症状
  { value: 'cramps', label: '腹痛', icon: '😣', category: 'physical' as SymptomCategory },
  { value: 'back_pain', label: '腰痛', icon: '🦴', category: 'physical' as SymptomCategory },
  { value: 'headache', label: '頭痛', icon: '🤕', category: 'physical' as SymptomCategory },
  { value: 'fatigue', label: '疲労感', icon: '😴', category: 'physical' as SymptomCategory },
  { value: 'bloating', label: 'むくみ', icon: '🫧', category: 'physical' as SymptomCategory },
  { value: 'breast_tenderness', label: '胸の張り', icon: '💗', category: 'physical' as SymptomCategory },
  { value: 'acne', label: '肌荒れ', icon: '😖', category: 'physical' as SymptomCategory },
  { value: 'nausea', label: '吐き気', icon: '🤢', category: 'physical' as SymptomCategory },
  { value: 'diarrhea', label: 'お腹の不調', icon: '💨', category: 'physical' as SymptomCategory },
  // 感情症状（PMS関連）
  { value: 'mood_swings', label: '気分の波', icon: '🎭', category: 'emotional' as SymptomCategory },
  { value: 'irritability', label: 'イライラ', icon: '😤', category: 'emotional' as SymptomCategory },
  { value: 'anxiety', label: '不安感', icon: '😰', category: 'emotional' as SymptomCategory },
  { value: 'crying', label: '涙もろい', icon: '😢', category: 'emotional' as SymptomCategory },
  // 行動症状（PMS関連）
  { value: 'food_cravings', label: '食欲増加', icon: '🍫', category: 'behavioral' as SymptomCategory },
  { value: 'insomnia', label: '眠れない', icon: '🌙', category: 'behavioral' as SymptomCategory },
  { value: 'oversleeping', label: '眠すぎる', icon: '💤', category: 'behavioral' as SymptomCategory },
  { value: 'poor_concentration', label: '集中できない', icon: '🌀', category: 'behavioral' as SymptomCategory },
] as const;

export type SymptomValue = (typeof SYMPTOM_OPTIONS)[number]['value'];

/** カテゴリ別に症状をグループ化するためのラベル */
export const SYMPTOM_CATEGORY_LABELS: Record<SymptomCategory, string> = {
  physical: 'からだ',
  emotional: 'きもち',
  behavioral: 'せいかつ',
};

export type FlowIntensity = 'spotting' | 'light' | 'moderate' | 'heavy';

export const FLOW_OPTIONS: { value: FlowIntensity; label: string; icon: string }[] = [
  { value: 'spotting', label: 'おりもの', icon: '·' },
  { value: 'light', label: '軽い', icon: '💧' },
  { value: 'moderate', label: '普通', icon: '💧💧' },
  { value: 'heavy', label: '多い', icon: '💧💧💧' },
];

/** デフォルトの周期長（データ不足時のフォールバック） */
export const DEFAULT_CYCLE_LENGTH = 28;

/** デフォルトの生理日数 */
export const DEFAULT_PERIOD_DURATION = 5;

/** 旧 symptom value → 新 value のマッピング（後方互換） */
export const SYMPTOM_COMPAT: Record<string, string> = {
  mood_changes: 'mood_swings',
};
