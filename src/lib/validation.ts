// src/lib/validation.ts
// Zodベースの一元バリデーションスキーマ
import { z } from 'zod';

// =========================
// 共通バリデーション
// =========================
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日付の形式が正しくありません（YYYY-MM-DD）');
const notesField = z.string().max(500, 'メモは500文字以内で入力してください').optional().or(z.literal(''));

// =========================
// 練習記録
// =========================
export const trainingSchema = z.object({
  rpe: z.number()
    .min(0, 'RPEは0以上で入力してください')
    .max(10, 'RPEは10以下で入力してください'),
  duration_min: z.number()
    .int('練習時間は整数で入力してください')
    .min(0, '練習時間は0以上で入力してください')
    .max(480, '練習時間は480分（8時間）以下で入力してください'),
  date: dateString,
  arrow_score: z.number().min(0).max(100).optional().nullable(),
  signal_score: z.number().min(0).max(100).optional().nullable(),
}).refine(
  (data) => !(data.rpe === 0 && data.duration_min > 0),
  { message: 'RPEが0の場合、練習時間も0にしてください', path: ['rpe'] }
).refine(
  (data) => !(data.rpe > 0 && data.duration_min === 0),
  { message: '練習時間が0の場合、RPEも0にしてください', path: ['duration_min'] }
);

// =========================
// 体重記録
// =========================
export const weightSchema = z.object({
  weight_kg: z.number()
    .min(20, '体重は20kg以上で入力してください')
    .max(200, '体重は200kg以下で入力してください'),
  date: dateString,
  notes: notesField,
});

// =========================
// 睡眠記録
// =========================
export const sleepSchema = z.object({
  sleep_hours: z.number()
    .min(0, '睡眠時間は0以上で入力してください')
    .max(24, '睡眠時間は24時間以下で入力してください'),
  sleep_quality: z.number()
    .int()
    .min(1, '睡眠の質は1〜5で入力してください')
    .max(5, '睡眠の質は1〜5で入力してください'),
  bedtime: z.string().optional().or(z.literal('')),
  waketime: z.string().optional().or(z.literal('')),
  notes: notesField,
});

// =========================
// モチベーション記録
// =========================
export const motivationSchema = z.object({
  motivation_level: z.number()
    .int('モチベーションは整数で入力してください')
    .min(1, 'モチベーションは1〜10で入力してください')
    .max(10, 'モチベーションは1〜10で入力してください'),
  energy_level: z.number()
    .int('エネルギーは整数で入力してください')
    .min(1, 'エネルギーは1〜10で入力してください')
    .max(10, 'エネルギーは1〜10で入力してください'),
  stress_level: z.number()
    .int('ストレスは整数で入力してください')
    .min(1, 'ストレスは1〜10で入力してください')
    .max(10, 'ストレスは1〜10で入力してください'),
  notes: notesField,
});

// =========================
// 基礎体温
// =========================
export const basalTemperatureSchema = z.object({
  temperature_celsius: z.number()
    .min(35.0, '体温は35.0°C以上で入力してください')
    .max(42.0, '体温は42.0°C以下で入力してください'),
  measurement_date: dateString,
  measurement_time: z.string().optional().or(z.literal('')),
  notes: notesField,
});

// =========================
// 月経周期
// =========================
export const menstrualCycleSchema = z.object({
  cycle_start_date: dateString,
  period_end_date: dateString.optional().or(z.literal('')),
  flow_intensity: z.enum(['light', 'moderate', 'heavy']).optional(),
  notes: notesField,
}).refine(
  (data) => {
    if (data.period_end_date && data.cycle_start_date) {
      return new Date(data.period_end_date) >= new Date(data.cycle_start_date);
    }
    return true;
  },
  { message: '生理終了日は開始日以降にしてください', path: ['period_end_date'] }
);

// =========================
// プロフィール
// =========================
export const profileSchema = z.object({
  name: z.string()
    .min(1, '名前を入力してください')
    .max(50, '名前は50文字以内で入力してください'),
  phone_number: z.string()
    .regex(/^(070|080|090)\d{8}$/, '携帯電話番号の形式が正しくありません（例: 09012345678）')
    .optional()
    .or(z.literal('')),
  gender: z.enum(['male', 'female', 'other', '']).optional(),
  height_cm: z.number()
    .min(100, '身長は100cm以上で入力してください')
    .max(250, '身長は250cm以下で入力してください')
    .optional()
    .nullable(),
  date_of_birth: dateString.optional().or(z.literal('')),
});

// =========================
// ヘルパー関数
// =========================

/**
 * Zodスキーマでバリデーションを実行し、エラーメッセージを返す
 */
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): {
  success: boolean;
  data?: T;
  errors?: Record<string, string>;
  firstError?: string;
} {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join('.') || '_root';
    if (!errors[key]) {
      errors[key] = issue.message;
    }
  }

  const firstError = result.error.issues[0]?.message;
  return { success: false, errors, firstError };
}

// 型エクスポート
export type TrainingInput = z.infer<typeof trainingSchema>;
export type WeightInput = z.infer<typeof weightSchema>;
export type SleepInput = z.infer<typeof sleepSchema>;
export type MotivationInput = z.infer<typeof motivationSchema>;
export type BasalTemperatureInput = z.infer<typeof basalTemperatureSchema>;
export type MenstrualCycleInput = z.infer<typeof menstrualCycleSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
