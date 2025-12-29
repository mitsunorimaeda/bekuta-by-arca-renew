// src/lib/nutritionLogic.ts

/* =========================
 * 基本型定義
 * ========================= */

export type Sex = 'male' | 'female';

export type ActivityLevel = 'low' | 'medium' | 'high';

export type NutritionGoal = 'maintain' | 'fat_loss' | 'muscle_gain';

export interface NutritionTarget {
  calories: number;
  protein: number; // g
  fat: number;     // g
  carbs: number;   // g
}

/* =========================
 * ① 基礎代謝（BMR）
 * Mifflin-St Jeor式
 * ========================= */

export function calculateBMR(params: {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
}): number {
  const { sex, age, heightCm, weightKg } = params;

  const base =
    10 * weightKg +
    6.25 * heightCm -
    5 * age;

  const sexAdjustment = sex === 'male' ? 5 : -161;

  return Math.round(base + sexAdjustment);
}

/* =========================
 * ② 総消費量（TDEE）
 * ========================= */

export function calculateTDEE(params: {
  bmr: number;
  activityLevel: ActivityLevel;
}): number {
  const { bmr, activityLevel } = params;

  const multiplier: Record<ActivityLevel, number> = {
    low: 1.4,      // ほぼ運動なし
    medium: 1.6,   // 週3-5回
    high: 1.8,     // ほぼ毎日
  };

  return Math.round(bmr * multiplier[activityLevel]);
}

/* =========================
 * ③ 目的別 栄養目標
 * ========================= */

export function getNutritionTarget(params: {
  tdee: number;
  goal: NutritionGoal;
  weightKg: number;
}): NutritionTarget {
  const { tdee, goal, weightKg } = params;

  // 目的別カロリー調整
  const calorieAdjustment: Record<NutritionGoal, number> = {
    maintain: 0,
    fat_loss: -300,
    muscle_gain: +300,
  };

  const calories = tdee + calorieAdjustment[goal];

  // タンパク質（体重×係数）
  const proteinPerKg: Record<NutritionGoal, number> = {
    maintain: 1.5,
    fat_loss: 2.0,
    muscle_gain: 2.0,
  };

  const protein = Math.round(weightKg * proteinPerKg[goal]);

  // 脂質：総カロリーの25%
  const fat = Math.round((calories * 0.25) / 9);

  // 炭水化物：残り
  const carbs = Math.round(
    (calories - protein * 4 - fat * 9) / 4
  );

  return {
    calories,
    protein,
    fat,
    carbs,
  };
}

/* =========================
 * ④ 実績との差分
 * ========================= */

export function calculateNutritionDiff(params: {
  target: NutritionTarget;
  actual: NutritionTarget;
}) {
  const { target, actual } = params;

  return {
    calories: actual.calories - target.calories,
    protein: actual.protein - target.protein,
    fat: actual.fat - target.fat,
    carbs: actual.carbs - target.carbs,
  };
}

/* =========================
 * ⑤ 翻訳（食品ベース）
 * ========================= */

export function translateNutritionToFood(target: NutritionTarget) {
  const examples: string[] = [];

  if (target.carbs >= 300) {
    examples.push('ごはん 大盛り2杯分');
  } else if (target.carbs >= 200) {
    examples.push('ごはん 普通盛り2杯分');
  } else {
    examples.push('ごはん 普通盛り1杯分');
  }

  if (target.protein >= 120) {
    examples.push('鶏むね肉 300g');
  } else if (target.protein >= 80) {
    examples.push('鶏むね肉 200g');
  } else {
    examples.push('卵2個＋納豆1パック');
  }

  return {
    examples,
    message:
      'まずは「これくらい食べてOK」という感覚を持つことが大切です。',
  };
}