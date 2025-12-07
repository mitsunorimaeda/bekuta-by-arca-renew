// Goal metadata の公式型
export interface GoalMetadata {
    test_type_id?: string;      // どの測定種目に紐づくか
    linked_field?: string;      // primary_value / 任意のfield名
    auto_update?: boolean;      // 測定追加時に自動更新するか
    unit?: string;              // 表示する単位（cm, m/s, kg など）
    notes?: string;             // 補足メモ
  }
  
  // 初期化（undefined 回避）
  export function normalizeGoalMetadata(meta: any): GoalMetadata {
    return {
      test_type_id: meta?.test_type_id ?? undefined,
      linked_field: meta?.linked_field ?? "primary_value",
      auto_update: meta?.auto_update ?? false,
      unit: meta?.unit ?? undefined,
      notes: meta?.notes ?? undefined,
    };
  }