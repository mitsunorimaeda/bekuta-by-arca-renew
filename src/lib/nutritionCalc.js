// src/lib/nutritionCalc.js
// Bekuta Nutrition: 計算ロジックは「AIに渡す前」にここで確定させる
// - FFM(除脂肪体重) / BMR / TDEE
// - 目標kcal/PFCの算出（ルール固定）
// - 今日の合計との差分（不足・過多）
// 注意: 性別/年齢が無い場合でも動くように fallback を用意

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
  
  // -------------------------
  // Daily Target (kcal / PFC)
  // -------------------------
  // 基本方針（おすすめ）
  // - タンパク質: 体重 or FFM ベースで固定（筋量維持を優先）
  // - 脂質: 体重ベースで最低ラインを確保
  // - 炭水化物: 残りをCで埋める（トレーニング燃料）
  //
  // goalType 例: "loss_maintain_muscle" | "maintain" | "gain"
  // ※あなたの運用で増やしてOK
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
  
    // 減量/増量のkcal調整（TDEEからの差）
    deficitKcal = 0,         // 減量なら 200〜500
    surplusKcal = 0          // 増量なら 100〜300
  }) {
    const w = safeNum(weightKg, NaN);
    if (!Number.isFinite(w) || w <= 0) {
      throw new Error("weightKg is required");
    }
  
    // FFM 推定（与えられていない場合は体脂肪率から計算）
    const ffm =
      Number.isFinite(ffmKg) ? round1(ffmKg) : calcFFMFromBodyFatPercent(w, bodyFatPercent);
  
    // BMRは原則：FFMがあればKatch、なければMifflin（情報が足りなければ null）
    const bmrFromFFM = ffm ? calcBMR_KatchMcArdle(ffm) : null;
    const bmrFromMifflin = calcBMR_Mifflin({ weightKg: w, heightCm, age, sex });
  
    const bmr = bmrFromFFM ?? bmrFromMifflin ?? null;
    const tdee = bmr ? calcTDEE(bmr, activityLevel) : null;
  
    // 目標カロリー
    let targetCal = null;
    if (Number.isFinite(targetCaloriesOverride)) {
      targetCal = round0(targetCaloriesOverride);
    } else if (tdee) {
      if (goalType === "loss_maintain_muscle") {
        targetCal = round0(tdee - (deficitKcal || 300));
      } else if (goalType === "gain") {
        targetCal = round0(tdee + (surplusKcal || 200));
      } else {
        targetCal = round0(tdee);
      }
    } else {
      // tdeeが出ない場合の最低限fallback（とりあえず体重ベースの雑推定）
      // 例: 体重×35 = 高活動のラフな目安
      const rough = w * 35;
      targetCal = round0(rough);
    }
  
    // タンパク質目標
    // 減量&筋維持：2.0g/kg体重 or 2.4g/kgFFM を推奨
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
    const cG = Math.max(0, round0(remaining / 4));
  
    return {
      // 参照値
      ffmKg: ffm,
      bmrKcal: bmr,
      tdeeKcal: tdee,
      activityLevel,
      goalType,
  
      // ターゲット
      target: {
        cal: targetCal,
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
      cal: round0(g.cal - t.cal),
      p: round1(g.p - t.p),
      f: round1(g.f - t.f),
      c: round1(g.c - t.c),
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
    notes = ""
  }) {
    return {
      user_name: userName || "ユーザー",
      meal_type: mealType,
      profile: {
        weightKg: safeNum(profile?.weightKg, null),
        bodyFatPercent: safeNum(profile?.bodyFatPercent, null),
        ffmKg: safeNum(profile?.ffmKg, null),
        age: safeNum(profile?.age, null),
        heightCm: safeNum(profile?.heightCm, null),
        sex: profile?.sex || null,
        activityLevel: profile?.activityLevel || null,
        goalType: profile?.goalType || null
      },
      daily_target: targets,
      today_totals: todayTotals,
      gaps,
      notes
    };
  }