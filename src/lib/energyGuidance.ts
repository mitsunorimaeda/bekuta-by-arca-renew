// src/lib/energyGuidance.ts

export type EnergyGuidanceLevel =
  | 'recovery_low'     // 回復不足（睡眠/ストレスで赤信号）
  | 'high_load'        // 高負荷
  | 'medium_load'      // やや高め
  | 'low_load'         // 軽め
  | 'no_data';         // データ不足

export type EnergyGuidanceInput = {
  load?: number | null;        // sRPE = RPE * duration_min
  sleepHours?: number | null;  // 睡眠時間
  stress?: number | null;      // ストレス(0-10想定)
};

export type EnergyGuidanceOutput = {
  level: EnergyGuidanceLevel;
  title: string;
  message: string;
  flags: {
    isRecoveryLow: boolean;
    isHighLoad: boolean;
    isMediumLoad: boolean;
    isLowLoad: boolean;
  };
  debug: {
    load: number | null;
    sleepHours: number | null;
    stress: number | null;
  };
};

/**
 * 今日の状態から「食事を減らすべきか/回復優先か/いつも通りか」を判定する。
 * - ここは「判断だけ」を担う（UI/DB/Supabaseは触らない）
 */
export function getDailyEnergyGuidance(input: EnergyGuidanceInput): EnergyGuidanceOutput {
  const load = isFiniteNumber(input.load) ? Number(input.load) : null;
  const sleepHours = isFiniteNumber(input.sleepHours) ? Number(input.sleepHours) : null;
  const stress = isFiniteNumber(input.stress) ? Number(input.stress) : null;

  // 回復不足判定（今あなたがAthleteViewで書いていた条件をそのまま採用）
  const isRecoveryLow =
    (sleepHours !== null && sleepHours < 6) ||
    (stress !== null && stress >= 7);

  const isHighLoad = load !== null && load >= 600;
  const isMediumLoad = load !== null && load >= 400 && load < 600;
  const isLowLoad = load !== null && load <= 150;

  // データ不足（loadも睡眠もストレスも無い）
  const noData = load === null && sleepHours === null && stress === null;

  if (noData) {
    return {
      level: 'no_data',
      title: 'データがまだありません',
      message: '今日の練習・睡眠・ストレスのどれかを入力すると、目安が表示されます。',
      flags: { isRecoveryLow: false, isHighLoad: false, isMediumLoad: false, isLowLoad: false },
      debug: { load, sleepHours, stress },
    };
  }

  // 優先順位：回復不足 > 高負荷 > やや高め > 軽め > 通常
  if (isRecoveryLow) {
    return {
      level: 'recovery_low',
      title: '回復が追いついていないサイン',
      message:
        '今日は「減らさない」が正解。炭水化物＋タンパク質を優先し、睡眠を最優先に。',
      flags: { isRecoveryLow, isHighLoad, isMediumLoad, isLowLoad },
      debug: { load, sleepHours, stress },
    };
  }

  if (isHighLoad) {
    return {
      level: 'high_load',
      title: '負荷が高めの日',
      message:
        '炭水化物とタンパク質をしっかり。練習後の補食＋水分で回復を加速。',
      flags: { isRecoveryLow, isHighLoad, isMediumLoad, isLowLoad },
      debug: { load, sleepHours, stress },
    };
  }

  if (isMediumLoad) {
    return {
      level: 'medium_load',
      title: 'やや高めの日',
      message:
        '補食（炭水化物＋タンパク質）を入れて回復を早めよう。睡眠もいつもより意識。',
      flags: { isRecoveryLow, isHighLoad, isMediumLoad, isLowLoad },
      debug: { load, sleepHours, stress },
    };
  }

  if (isLowLoad) {
    return {
      level: 'low_load',
      title: '軽めの日',
      message:
        '回復を進めつつ、食事量を極端に削らない。コンディションを整える日に。',
      flags: { isRecoveryLow, isHighLoad, isMediumLoad, isLowLoad },
      debug: { load, sleepHours, stress },
    };
  }

  // 通常（どの条件にも強く当てはまらない）
  return {
    level: 'medium_load', // ※ “通常”用のlevelを増やしたいなら 'normal' を追加してOK
    title: 'いつも通りでOK',
    message: '水分と炭水化物を忘れずに。練習後はタンパク質もセットで。',
    flags: { isRecoveryLow, isHighLoad, isMediumLoad, isLowLoad },
    debug: { load, sleepHours, stress },
  };
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}