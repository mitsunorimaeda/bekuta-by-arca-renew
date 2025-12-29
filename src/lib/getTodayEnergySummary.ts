// src/lib/getTodayEnergySummary.ts

export type EnergyStatus = 'low' | 'ok' | 'high' | 'unknown';

export type TodayEnergySummaryInput = {
  date: string; // 'YYYY-MM-DD' (JST想定)

  // 優先：daily_energy_snapshots から取得できるならそれを使う
  snapshot?: {
    bmr?: number | null;           // kcal/day
    tdee?: number | null;          // kcal/day
    srpe?: number | null;          // load (RPE*min)
    activity_factor?: number | null;
  } | null;

  // 画像AIなどの nutrition_logs から「今日の摂取カロリー合計」を渡す
  intakeCalories?: number | null;

  // snapshot が無い場合の推定用（最低限）
  fallback?: {
    weightKg7dAvg?: number | null;     // 直近7日平均体重
    leanMassKg?: number | null;        // 除脂肪体重（あるなら最優先）
    heightCm?: number | null;
    age?: number | null;
    gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say' | null;
    todayLoad?: number | null;         // 今日の sRPE（RPE*分）
  } | null;
};

export type TodayEnergySummary = {
  date: string;

  bmr: number | null;
  tdee: number | null;
  intake: number | null;

  balance: number | null; // intake - tdee（+は食べ過ぎ側、-は不足側）

  status: EnergyStatus;
  statusLabel: string;

  // UIで説明に使えるメタ
  meta: {
    bmrSource: 'snapshot' | 'leanMass' | 'mifflin' | 'none';
    tdeeSource: 'snapshot' | 'estimated' | 'none';
  };
};

// --- 推定式（最初は“安全に”簡易でOK） ---

// Katch-McArdle（除脂肪体重があるなら強い）
// BMR = 370 + 21.6 * LBM(kg)
function estimateBmrFromLeanMass(leanMassKg: number): number {
  return Math.round(370 + 21.6 * leanMassKg);
}

// Mifflin-St Jeor（体重/身長/年齢/性別が揃うなら）
// 男: 10W + 6.25H - 5A + 5
// 女: 10W + 6.25H - 5A - 161
function estimateBmrMifflin(params: {
  weightKg: number;
  heightCm: number;
  age: number;
  gender: 'male' | 'female';
}): number {
  const { weightKg: W, heightCm: H, age: A, gender } = params;
  const base = 10 * W + 6.25 * H - 5 * A;
  return Math.round(gender === 'male' ? base + 5 : base - 161);
}

// load（sRPE）からの “追加消費” 仮推定（後で精密化してOK）
function estimateExtraFromLoad(load: number): number {
  // いまAthleteViewにある段階と整合
  if (load >= 600) return 700;
  if (load >= 400) return 500;
  if (load >= 150) return 300;
  return 200;
}

// activity factor 仮（snapshot が無いとき）
function defaultActivityFactor(): number {
  return 1.55; // “ふつうに活動”の中間
}

export function getTodayEnergySummary(input: TodayEnergySummaryInput): TodayEnergySummary {
  const intake = typeof input.intakeCalories === 'number' ? input.intakeCalories : null;

  // --- 1) BMR ---
  let bmr: number | null = null;
  let bmrSource: TodayEnergySummary['meta']['bmrSource'] = 'none';

  const snapBmr = input.snapshot?.bmr ?? null;
  if (typeof snapBmr === 'number' && Number.isFinite(snapBmr) && snapBmr > 0) {
    bmr = snapBmr;
    bmrSource = 'snapshot';
  } else {
    const lean = input.fallback?.leanMassKg ?? null;
    if (typeof lean === 'number' && lean > 0) {
      bmr = estimateBmrFromLeanMass(lean);
      bmrSource = 'leanMass';
    } else {
      const w = input.fallback?.weightKg7dAvg ?? null;
      const h = input.fallback?.heightCm ?? null;
      const a = input.fallback?.age ?? null;
      const g = input.fallback?.gender ?? null;

      if (
        typeof w === 'number' && w > 0 &&
        typeof h === 'number' && h > 0 &&
        typeof a === 'number' && a > 0 &&
        (g === 'male' || g === 'female')
      ) {
        bmr = estimateBmrMifflin({ weightKg: w, heightCm: h, age: a, gender: g });
        bmrSource = 'mifflin';
      }
    }
  }

  // --- 2) TDEE ---
  let tdee: number | null = null;
  let tdeeSource: TodayEnergySummary['meta']['tdeeSource'] = 'none';

  const snapTdee = input.snapshot?.tdee ?? null;
  if (typeof snapTdee === 'number' && Number.isFinite(snapTdee) && snapTdee > 0) {
    tdee = snapTdee;
    tdeeSource = 'snapshot';
  } else if (bmr) {
    const af = (input.snapshot?.activity_factor ?? null) ?? defaultActivityFactor();
    const load = input.fallback?.todayLoad ?? input.snapshot?.srpe ?? 0;
    const extra = estimateExtraFromLoad(Number(load ?? 0));
    tdee = Math.round(bmr * af + extra);
    tdeeSource = 'estimated';
  }

  // --- 3) balance & status ---
  const balance = (intake != null && tdee != null) ? Math.round(intake - tdee) : null;

  let status: EnergyStatus = 'unknown';
  let statusLabel = '未判定';

  if (balance != null) {
    // バンドは仮：運用しながら調整
    if (balance <= -350) {
      status = 'low';
      statusLabel = '不足気味';
    } else if (balance >= 350) {
      status = 'high';
      statusLabel = '過多気味';
    } else {
      status = 'ok';
      statusLabel = '概ね適正';
    }
  }

  return {
    date: input.date,
    bmr,
    tdee,
    intake,
    balance,
    status,
    statusLabel,
    meta: {
      bmrSource,
      tdeeSource,
    },
  };
}