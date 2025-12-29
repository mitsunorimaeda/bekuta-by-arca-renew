// src/lib/nutritionCalc.js
// Bekuta Nutrition: 計算ロジックは「AIに渡す前」にここで確定させる
// - FFM(除脂肪体重) / BMR / TDEE
// - 目標kcal/PFCの算出（ルール固定）
// - 今日の合計との差分（不足・過多）
// 注意: 性別/年齢が無い場合でも動くように fallback を用意
// ✅ 本番向け改善ポイント
// - payloadで null を 0 にしない（safeNumOrNull）
// - targetCal の下限ガード（BMR基準など）
// - TDEEが出ない場合の rough 推定を activityLevel で変える
// - 炭水化物が0に落ちる場合の最低ライン（minCarbG）
// - bmr/tdee の算出方法と confidence を返す

// -------------------------
// helpers
// -------------------------
export function clamp(n, min, max) {
  if (typeof n !== "number" || !Number.isFinite(n)) return min;
  return Math.min(Math.max(n, min), max);
}

export function round1(n) {
  return Math.round(n * 10) / 10;
}
export function round0(n) {
  return Math.round(n);
}

export function safeNum(n, fallback = 0) {
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
}

// ✅ 重要：null/undefined/NaN を「0」にしない（payload用）
export function safeNumOrNull(n) {
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

// -------------------------
// FFM (Fat Free Mass)
// -------------------------
// weightKg * (1 - bodyFatPercent/100)
export function calcFFMFromBodyFatPercent(weightKg, bodyFatPercent) {
  const w = safeNum(weightKg, 0);
  const pbf = safeNum(bodyFatPercent, NaN);
  if (!Number.isFinite(pbf)) return null; // 体脂肪率が無ければ計算不可
  const ffm = w * (1 - pbf / 100);
  return ffm > 0 ? round1(ffm) : null;
}

// -------------------------
// BMR
// -------------------------
// Katch-McArdle: BMR = 370 + 21.6 * FFM
export function calcBMR_KatchMcArdle(ffmKg) {
  const ffm = safeNum(ffmKg, NaN);
  if (!Number.isFinite(ffm)) return null;
  const bmr = 370 + 21.6 * ffm;
  return bmr > 0 ? round0(bmr) : null;
}

// Mifflin-St Jeor:
// male: 10w + 6.25h - 5a + 5
// female: 10w + 6.25h - 5a - 161
export function calcBMR_Mifflin({ weightKg, heightCm, age, sex }) {
  const w = safeNum(weightKg, NaN);
  const h = safeNum(heightCm, NaN);
  const a = safeNum(age, NaN);
  if (![w, h, a].every(Number.isFinite)) return null;

  const base = 10 * w + 6.25 * h - 5 * a;
  const s = (sex || "").toLowerCase(); // "male" | "female"
  const adj = s === "male" ? 5 : s === "female" ? -161 : -78; // 未指定なら中間寄せ
  const bmr = base + adj;
  return bmr > 0 ? round0(bmr) : null;
}

// -------------------------
// TDEE
// -------------------------
// activityFactor (例):
// sedentary 1.2
// light 1.375
// moderate 1.55
// high 1.725
// athlete 1.9
export function activityFactorFromLevel(level) {
  const l = (level || "").toLowerCase();
  switch (l) {
    case "sedentary":
    case "low":
      return 1.2;
    case "light":
      return 1.375;
    case "moderate":
      return 1.55;
    case "high":
      return 1.725;
    case "athlete":
    case "very_high":
      return 1.9;
    default:
      return 1.55; // デフォルトは中間
  }
}

export function calcTDEE(bmrKcal, activityLevel) {
  const bmr = safeNum(bmrKcal, NaN);
  if (!Number.isFinite(bmr)) return null;
  const af = activityFactorFromLevel(activityLevel);
  const tdee = bmr * af;
  return tdee > 0 ? round0(tdee) : null;
}

// ✅ TDEEが出ないときの rough 推定（activityで変える）
export function roughCaloriesFromWeight(weightKg, activityLevel = "moderate") {
  const w = safeNum(weightKg, NaN);
  if (!Number.isFinite(w) || w <= 0) return null;

  // ラフ目安（スポーツ現場寄り）
  // low: 28, light: 30, moderate: 33, high: 36, athlete: 40
  const l = (activityLevel || "").toLowerCase();
  const factor =
    l === "sedentary" || l === "low" ? 28 :
    l === "light" ? 30 :
    l === "moderate" ? 33 :
    l === "high" ? 36 :
    l === "athlete" || l === "very_high" ? 40 :
    33;

  return round0(w * factor);
}

// -------------------------
// Daily Target (kcal / PFC)
// -------------------------
// 基本方針（おすすめ）
// - タンパク質: 体重 or FFM ベースで固定（筋量維持を優先）
// - 脂質: 体重ベースで最低ラインを確保
// - 炭水化物: 残りをCで埋める（トレーニング燃料）
//
// goalType 例: "loss_maintain_muscle" | "maintain" | "gain"
export function buildDailyTargets({
  weightKg,
  bodyFatPercent, // optional
  ffmKg, // optional（あれば最優先）
  heightCm, // optional
  age, // optional
  sex, // optional

  activityLevel = "moderate",
  goalType = "maintain",

  // 目標カロリーを強制したい場合に指定（例: プラン作成時に固定）
  targetCaloriesOverride = null,

  // タンパク質係数
  proteinPerKg = null,     // 例: 2.0 (体重kgあたり)
  proteinPerFFM = null,    // 例: 2.4 (FFM kgあたり)

  // 脂質係数
  fatPerKg = null,         // 例: 0.8 (体重kgあたり)
  minFatG = 40,            // 最低脂質（ホルモン・皮膚など）

  // ✅ 炭水化物の最低ライン（スポーツ現場の安全弁）
  // 例: 体重×2g を目安にしたいなら、呼び出し側で weightKg*2 を渡す
  minCarbG = 0,

  // 減量/増量のkcal調整（TDEEからの差）
  deficitKcal = 0,         // 減量なら 200〜500
  surplusKcal = 0,         // 増量なら 100〜300

  // ✅ targetCal 下限ガード（BMRが出る場合に使う）
  // 例：成長期・競技者は「BMRの1.05〜1.2倍」を下限にすると安全寄り
  minCaloriesByBMRRatio = 1.05,

  // 目標カロリーの上限（暴走防止）
  maxCalories = 6000
}) {
  const w = safeNum(weightKg, NaN);
  if (!Number.isFinite(w) || w <= 0) {
    throw new Error("weightKg is required");
  }

  // どれだけ情報が揃っているか（confidence用）
  const missing = [];
  if (!Number.isFinite(bodyFatPercent)) missing.push("bodyFatPercent");
  if (!Number.isFinite(ffmKg)) missing.push("ffmKg");
  if (!Number.isFinite(heightCm)) missing.push("heightCm");
  if (!Number.isFinite(age)) missing.push("age");
  if (!sex) missing.push("sex");

  // FFM 推定（与えられていない場合は体脂肪率から計算）
  const ffm =
    Number.isFinite(ffmKg) ? round1(ffmKg) : calcFFMFromBodyFatPercent(w, bodyFatPercent);

  // BMRは原則：FFMがあればKatch、なければMifflin（情報が足りなければ null）
  const bmrFromFFM = ffm ? calcBMR_KatchMcArdle(ffm) : null;
  const bmrFromMifflin = calcBMR_Mifflin({ weightKg: w, heightCm, age, sex });

  const bmr = bmrFromFFM ?? bmrFromMifflin ?? null;
  const bmrMethod = bmrFromFFM ? "katch" : bmrFromMifflin ? "mifflin" : "none";

  const tdee = bmr ? calcTDEE(bmr, activityLevel) : null;
  const tdeeMethod = tdee ? "bmr_x_activity" : "none";

  // 目標カロリー（raw）
  let targetCalRaw = null;

  if (Number.isFinite(targetCaloriesOverride)) {
    targetCalRaw = round0(targetCaloriesOverride);
  } else if (tdee) {
    if (goalType === "loss_maintain_muscle") {
      targetCalRaw = round0(tdee - (deficitKcal || 300));
    } else if (goalType === "gain") {
      targetCalRaw = round0(tdee + (surplusKcal || 200));
    } else {
      targetCalRaw = round0(tdee);
    }
  } else {
    // tdeeが出ない場合の fallback（activityを反映）
    const rough = roughCaloriesFromWeight(w, activityLevel);
    targetCalRaw = round0(rough ?? (w * 33));
  }

  // ✅ 下限ガード（BMRが出る場合）
  // 低すぎるtargetCalは、Cが0になりやすく、体調/集中/回復を壊しやすい
  let targetCal = targetCalRaw;
  if (bmr) {
    const minByBmr = round0(bmr * safeNum(minCaloriesByBMRRatio, 1.05));
    targetCal = clamp(targetCal, minByBmr, maxCalories);
  } else {
    targetCal = clamp(targetCal, 800, maxCalories); // BMRなしでも破綻しない下限
  }

  // タンパク質目標
  const defaultProteinKg =
    goalType === "loss_maintain_muscle" ? 2.0 :
    goalType === "gain" ? 1.8 :
    1.6;

  const pG = (() => {
    if (Number.isFinite(proteinPerFFM) && ffm) return round0(ffm * proteinPerFFM);
    if (Number.isFinite(proteinPerKg)) return round0(w * proteinPerKg);
    if (ffm && goalType === "loss_maintain_muscle") return round0(ffm * 2.4);
    return round0(w * defaultProteinKg);
  })();

  // 脂質目標
  const defaultFatKg =
    goalType === "loss_maintain_muscle" ? 0.8 :
    goalType === "gain" ? 1.0 :
    0.9;

  const fG = clamp(
    round0(w * (Number.isFinite(fatPerKg) ? fatPerKg : defaultFatKg)),
    minFatG,
    200
  );

  // 炭水化物（残り）
  // kcal -> g: P=4, C=4, F=9
  const kcalFromPF = pG * 4 + fG * 9;
  const remaining = targetCal - kcalFromPF;
  let cG = Math.max(0, round0(remaining / 4));

  // ✅ 炭水化物の最低ライン
  // ここで「Cが0」を避ける。足りない分は "targetAdjusted" として扱う。
  const minC = Math.max(0, round0(safeNum(minCarbG, 0)));
  let targetCalAdjusted = targetCal;
  let adjustedReason = null;

  if (minC > 0 && cG < minC) {
    cG = minC;
    targetCalAdjusted = round0(kcalFromPF + cG * 4);
    adjustedReason = "minCarbG_applied";
  }

  // confidence（ざっくり）
  // - high: FFM or (age+height+sex) が揃う
  // - mid: 体重+活動だけ
  // - low: 体重のみ
  const confidence = (() => {
    const hasFFM = !!ffm;
    const hasMifflinInputs = [heightCm, age].every(Number.isFinite) && !!sex;
    if (hasFFM || hasMifflinInputs) return "high";
    if (activityLevel) return "mid";
    return "low";
  })();

  return {
    // 参照値
    ffmKg: ffm,
    bmrKcal: bmr,
    tdeeKcal: tdee,
    activityLevel,
    goalType,

    // メタ
    meta: {
      bmrMethod,
      tdeeMethod,
      confidence,
      missing,
      targetCalRaw,
      targetCalAdjusted,
      adjustedReason
    },

    // ターゲット（※UI/AIに渡すときは基本こちらを使う）
    // ただし adjustedReason がある場合は targetCalAdjusted を採用するか、
    // 「不足分として表示する」など、アプリ側で方針を決めてOK。
    target: {
      cal: targetCalAdjusted,
      p: pG,
      f: fG,
      c: cG
    }
  };
}

// -------------------------
// Gap (today vs target)
// -------------------------
export function calcGaps({ today, target }) {
  const t = today || { cal: 0, p: 0, f: 0, c: 0 };
  const g = target || { cal: 0, p: 0, f: 0, c: 0 };

  return {
    cal: round0(safeNum(g.cal, 0) - safeNum(t.cal, 0)),
    p: round1(safeNum(g.p, 0) - safeNum(t.p, 0)),
    f: round1(safeNum(g.f, 0) - safeNum(t.f, 0)),
    c: round1(safeNum(g.c, 0) - safeNum(t.c, 0)),
  };
}

// -------------------------
// Prompt payload builder (AIに渡す用のJSON)
// -------------------------
export function buildAIPayload({
  userName,
  profile,       // { weightKg, bodyFatPercent, ffmKg, age, heightCm, sex, activityLevel, goalType }
  targets,       // { cal,p,f,c }
  todayTotals,   // { cal,p,f,c }
  gaps,          // { cal,p,f,c }
  mealType,      // "朝食" etc
  notes = "",
  meta = null    // buildDailyTargets().meta を渡したい場合
}) {
  return {
    user_name: userName || "ユーザー",
    meal_type: mealType || null,

    profile: {
      weightKg: safeNumOrNull(profile?.weightKg),
      bodyFatPercent: safeNumOrNull(profile?.bodyFatPercent),
      ffmKg: safeNumOrNull(profile?.ffmKg),
      age: safeNumOrNull(profile?.age),
      heightCm: safeNumOrNull(profile?.heightCm),
      sex: profile?.sex || null,
      activityLevel: profile?.activityLevel || null,
      goalType: profile?.goalType || null
    },

    daily_target: {
      cal: safeNumOrNull(targets?.cal),
      p: safeNumOrNull(targets?.p),
      f: safeNumOrNull(targets?.f),
      c: safeNumOrNull(targets?.c),
    },

    today_totals: {
      cal: safeNumOrNull(todayTotals?.cal),
      p: safeNumOrNull(todayTotals?.p),
      f: safeNumOrNull(todayTotals?.f),
      c: safeNumOrNull(todayTotals?.c),
    },

    gaps: {
      cal: safeNumOrNull(gaps?.cal),
      p: safeNumOrNull(gaps?.p),
      f: safeNumOrNull(gaps?.f),
      c: safeNumOrNull(gaps?.c),
    },

    // optional: 計算の信頼度や推定メソッドをAIに共有（断定を避ける材料）
    meta: meta || null,

    notes
  };
}