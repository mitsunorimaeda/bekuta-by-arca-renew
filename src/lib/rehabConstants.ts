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
