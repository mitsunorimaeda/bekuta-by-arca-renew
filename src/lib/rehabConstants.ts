/** 部位のグループ定義（怪我登録・テンプレート分類で共通利用） */
export const BODY_PART_OPTIONS = [
  {
    group: "体幹部",
    items: [
      { id: "upper_back", label: "上背部 (胸椎・肩甲骨周り)" },
      { id: "lumbar", label: "腰背部 (腰椎・骨盤周り)" },
      { id: "thoracic_front", label: "胸部" },
      { id: "abdominal", label: "腹部" },
    ]
  },
  {
    group: "上肢",
    items: [
      { id: "shoulder", label: "肩関節" },
      { id: "elbow", label: "肘関節" },
      { id: "wrist_hand", label: "手関節・手指" },
    ]
  },
  {
    group: "下肢",
    items: [
      { id: "hip", label: "股関節" },
      { id: "knee", label: "膝関節" },
      { id: "ankle", label: "足関節" },
      { id: "foot", label: "足部・趾" },
    ]
  }
];

/** 全部位をフラットなリストで取得 */
export function getAllBodyParts() {
  return BODY_PART_OPTIONS.flatMap(g => g.items);
}

/** body_part_key からラベルを取得 */
export function getBodyPartLabel(key: string | null | undefined): string {
  if (!key) return '部位未設定';
  const found = getAllBodyParts().find(p => p.id === key);
  return found?.label || key;
}

// ─── Purpose（処方の目的）───

export type PrescriptionPurpose = 'rehab' | 'performance' | 'conditioning';

export const PURPOSE_OPTIONS: { id: PrescriptionPurpose; label: string; color: string; icon: string }[] = [
  { id: 'rehab', label: 'リハビリ', color: 'red', icon: 'Stethoscope' },
  { id: 'performance', label: 'パフォーマンス', color: 'blue', icon: 'Zap' },
  { id: 'conditioning', label: 'コンディショニング', color: 'green', icon: 'Activity' },
];

export function getPurposeLabel(purpose: string | null | undefined): string {
  return PURPOSE_OPTIONS.find(p => p.id === purpose)?.label || 'リハビリ';
}

export function getPurposeColor(purpose: string | null | undefined): string {
  return PURPOSE_OPTIONS.find(p => p.id === purpose)?.color || 'red';
}

// ─── Scope（テンプレートの公開範囲）───

export type TemplateScope = 'global' | 'team';

export const SCOPE_OPTIONS: { id: TemplateScope; label: string }[] = [
  { id: 'global', label: 'ARCA公式' },
  { id: 'team', label: 'チーム' },
];

// ─── InputType（エクササイズの入力タイプ）───

export type InputType = 'check' | 'weight' | 'duration' | 'reps';

export const INPUT_TYPE_OPTIONS: { id: InputType; label: string; description: string }[] = [
  { id: 'check', label: 'チェック', description: '完了 / 痛みありの2択' },
  { id: 'weight', label: 'ウエイト', description: '重量(kg) × 回数 × セット数' },
  { id: 'duration', label: '時間・距離', description: '時間(分) or 距離(km)' },
  { id: 'reps', label: 'レップ数', description: '回数のみ記録' },
];

// ─── Exercise Categories（エクササイズカテゴリ）───

export type ExerciseCategory =
  | 'training' | 'care' | 'cardio' | 'mental' | 'life'
  | 'strength' | 'agility' | 'recovery' | 'flexibility' | 'tactical';

export interface CategoryConfig {
  id: ExerciseCategory;
  label: string;
  color: string;
  purposes: PrescriptionPurpose[];
}

export const EXERCISE_CATEGORIES: CategoryConfig[] = [
  // 既存（リハビリ + 共通）
  { id: 'training', label: '筋力TR', color: 'text-red-500', purposes: ['rehab', 'conditioning'] },
  { id: 'care', label: 'ケア・治療', color: 'text-green-500', purposes: ['rehab', 'conditioning'] },
  { id: 'cardio', label: '有酸素', color: 'text-blue-500', purposes: ['rehab', 'performance', 'conditioning'] },
  { id: 'mental', label: 'メンタル', color: 'text-purple-500', purposes: ['rehab', 'performance', 'conditioning'] },
  { id: 'life', label: '生活習慣', color: 'text-yellow-500', purposes: ['rehab'] },
  // 新規（パフォーマンス + 共通）
  { id: 'strength', label: 'ストレングス', color: 'text-orange-500', purposes: ['performance', 'conditioning'] },
  { id: 'agility', label: 'アジリティ', color: 'text-cyan-500', purposes: ['performance', 'conditioning'] },
  { id: 'recovery', label: 'リカバリー', color: 'text-emerald-500', purposes: ['performance', 'conditioning'] },
  { id: 'flexibility', label: '柔軟性', color: 'text-pink-500', purposes: ['performance', 'conditioning'] },
  { id: 'tactical', label: '戦術', color: 'text-indigo-500', purposes: ['performance'] },
];

/** purpose に応じたカテゴリを取得 */
export function getCategoriesForPurpose(purpose: PrescriptionPurpose): CategoryConfig[] {
  return EXERCISE_CATEGORIES.filter(c => c.purposes.includes(purpose));
}

/** カテゴリIDからラベルを取得 */
export function getCategoryLabel(categoryId: string): string {
  return EXERCISE_CATEGORIES.find(c => c.id === categoryId)?.label || categoryId;
}

/** カテゴリIDからカラーを取得 */
export function getCategoryColor(categoryId: string): string {
  return EXERCISE_CATEGORIES.find(c => c.id === categoryId)?.color || 'text-gray-500';
}

// ─── デフォルトフェーズ名 ───

export const DEFAULT_PHASES: Record<PrescriptionPurpose, { title: string; description: string }[]> = {
  rehab: [
    { title: 'Phase 1: 急性期・炎症管理', description: '安静・RICE処置・組織保護' },
    { title: 'Phase 2: 可動域回復・柔軟性', description: 'ROM正常化・ストレッチ' },
    { title: 'Phase 3: 筋力回復・安定性', description: '段階的負荷・固有受容覚' },
    { title: 'Phase 4: 競技復帰準備', description: '競技動作・アジリティ' },
    { title: 'Phase 5: 完全復帰・再発予防', description: 'フルパフォーマンス・予防プログラム' },
  ],
  performance: [
    { title: 'Phase 1: 基礎期', description: '基礎体力・フォーム習得' },
    { title: 'Phase 2: 強化期', description: '負荷漸増・専門的トレーニング' },
    { title: 'Phase 3: 実戦期', description: '競技特異的・パフォーマンス最大化' },
  ],
  conditioning: [
    { title: 'Phase 1: 評価・基礎', description: '現状評価・基礎コンディショニング' },
    { title: 'Phase 2: 改善・維持', description: '弱点改善・コンディション維持' },
    { title: 'Phase 3: 最適化', description: 'パフォーマンス最適化・予防' },
  ],
};

// ─── item_results 型（後方互換）───

export interface ItemResultDetail {
  status: 'none' | 'done' | 'pain';
  weight?: number;
  reps?: number;
  sets?: number;
  duration?: string;
  distance?: number;
}

/** item_results の値を正規化（文字列→オブジェクト変換で後方互換） */
export function normalizeItemResult(value: string | ItemResultDetail): ItemResultDetail {
  if (typeof value === 'string') {
    return { status: value as 'none' | 'done' | 'pain' };
  }
  return value;
}

/** item_results からステータスだけ取得（後方互換ヘルパー） */
export function getItemStatus(value: string | ItemResultDetail | undefined): 'none' | 'done' | 'pain' {
  if (!value) return 'none';
  if (typeof value === 'string') return value as 'none' | 'done' | 'pain';
  return value.status;
}
