// src/lib/normalizeRecords.ts
// 目的：
// - DB Row / any / null を受け取っても壊れない
// - Form が期待する shape に必ず揃える
// - UnifiedDailyCheckIn 用に “別shape” が必要なら変換関数で明示する

export type ISODate = string; // "YYYY-MM-DD"

// ===== 共通ユーティリティ =====
function isISODate(v: any): v is ISODate {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function toISODateOrNull(v: any): ISODate | null {
  if (isISODate(v)) return v;
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  if (typeof v === 'string') {
    // "2025-12-21T..." 等を許容
    const m = v.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m?.[1] && isISODate(m[1])) return m[1];
  }
  return null;
}

function toNumberOrNull(v: any): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function toIntOrNull(v: any): number | null {
  const n = toNumberOrNull(v);
  if (n === null) return null;
  return Math.round(n);
}

// ===== Training =====
// DBの想定: { id, user_id, date, rpe, duration_min, arrow_score?, signal_score?, load? }
export type TrainingRecordForm = {
  id?: string;
  date: ISODate;              // 必須（Formが扱いやすい）
  rpe: number | null;         // null許容（未入力状態）
  duration_min: number | null;
  arrow_score: number | null;
  signal_score: number | null;
};

export function normalizeTrainingRecord(input: any): TrainingRecordForm | null {
  if (!input) return null;

  const date = toISODateOrNull(input.date);
  if (!date) return null;

  return {
    id: typeof input.id === 'string' ? input.id : undefined,
    date,
    rpe: toNumberOrNull(input.rpe),
    duration_min: toIntOrNull(input.duration_min ?? input.duration_time ?? input.duration), // 揺れ吸収
    arrow_score: toNumberOrNull(input.arrow_score),
    signal_score: toNumberOrNull(input.signal_score),
  };
}

// UnifiedDailyCheckIn が「矢印/電波を入力する」前提なら TrainingRecordForm をそのまま使ってOK。
// もしCheckIn側で別名を使っているなら、ここで明示的に変換する。
export type TrainingRecordCheckIn = TrainingRecordForm;

export function toCheckInTrainingRecord(form: TrainingRecordForm | null): TrainingRecordCheckIn | null {
  if (!form) return null;
  return { ...form };
}

// ===== Sleep =====
// DBの想定: { id, user_id, date, sleep_hours, sleep_quality }
export type SleepRecordForm = {
  id?: string;
  date: ISODate;
  sleep_hours: number | null;     // 例: 6.5
  sleep_quality: number | null;   // 例: 1-5
};

export function normalizeSleepRecord(input: any): SleepRecordForm | null {
  if (!input) return null;

  const date = toISODateOrNull(input.date);
  if (!date) return null;

  return {
    id: typeof input.id === 'string' ? input.id : undefined,
    date,
    sleep_hours: toNumberOrNull(input.sleep_hours),
    sleep_quality: toNumberOrNull(input.sleep_quality),
  };
}

// ===== Motivation =====
// DBの想定: { id, user_id, date, motivation_level, energy_level, stress_level }
export type MotivationRecordForm = {
    id?: string;
    date: ISODate;
    motivation_level: number | null; // 1-10
    energy_level: number | null;     // 1-10
    stress_level: number | null;     // 1-10
    notes?: string | null;           // ← あるなら吸収（任意）
  };
  
  export function normalizeMotivationRecord(input: any): MotivationRecordForm | null {
    if (!input) return null;
  
    const date = toISODateOrNull(input.date);
    if (!date) return null;
  
    // 旧カラム motivation を使ってた時期があるなら拾う
    const motivation = toNumberOrNull(input.motivation_level ?? input.motivation);
  
    return {
      id: typeof input.id === 'string' ? input.id : undefined,
      date,
      motivation_level: motivation,
      energy_level: toNumberOrNull(input.energy_level),
      stress_level: toNumberOrNull(input.stress_level),
      notes: input.notes ?? null,
    };
  }
  
  /** ✅ Formに渡す “前回記録” は null を持たない型にする */
  export type MotivationLastRecordInfo = {
    date: ISODate;
    motivation_level: number;
    energy_level: number;
    stress_level: number;
    notes?: string | null;
  };
  
  const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
  
  export function toMotivationLastRecordInfo(
    input: any,
    defaults: { motivation?: number; energy?: number; stress?: number } = {}
  ): MotivationLastRecordInfo | null {
    const normalized = normalizeMotivationRecord(input);
    if (!normalized) return null;
  
    const motivation_level = clamp(
      (normalized.motivation_level ?? defaults.motivation ?? 5),
      1, 10
    );
    const energy_level = clamp(
      (normalized.energy_level ?? defaults.energy ?? 5),
      1, 10
    );
    const stress_level = clamp(
      (normalized.stress_level ?? defaults.stress ?? 5),
      1, 10
    );
  
    return {
      date: normalized.date,
      motivation_level,
      energy_level,
      stress_level,
      notes: normalized.notes ?? null,
    };
  }


// ===== Weight =====
// DB想定: { id, user_id, date, weight_kg }
export type WeightRecordForm = {
    id?: string;
    date: ISODate;
    weight_kg: number | null;
  };

  export function normalizeWeightRecord(input: any): WeightRecordForm | null {
    if (!input) return null;
  
    const date = toISODateOrNull(input.date);
    if (!date) return null;
  
    return {
      id: typeof input.id === 'string' ? input.id : undefined,
      date,
      weight_kg: toNumberOrNull(input.weight_kg),
    };
  }