/**
 * -----------------------------------------------------
 * パフォーマンス測定の計算式・共通ユーティリティ（完全統合版）
 * cmj_as（腕振りCMJ）対応済み
 * 050_l（0-5-0 左）対応済み
 * 秒系フォーマット（小数2桁）対応済み
 * -----------------------------------------------------
 */

/**
 * VO2max 推定計算
 */
export const calculateVO2max = {
  cooperTest: (distance: number): number => {
    if (distance <= 0) return 0;
    return Math.max(0, (distance - 504.9) / 44.73);
  },

  run1500m: (minutes: number, seconds: number): number => {
    return minutes * 60 + seconds;
  },

  yoyoIR1: (distance: number): number => {
    if (distance <= 0) return 0;
    return distance * 0.0084 + 36.4;
  },

  yoyoIR2: (distance: number): number => {
    if (distance <= 0) return 0;
    return distance * 0.0136 + 45.3;
  },

  shuttleRun20m: (count: number): number => {
    if (count <= 0) return 0;

    const vo2maxTable: Record<number, number> = {
      8: 27.8, 9: 28.0, 10: 28.3, 11: 28.5, 12: 28.7, 13: 28.9,
      14: 29.2, 15: 29.4, 16: 29.6, 17: 29.8, 18: 30.1, 19: 30.3,
      20: 30.5, 21: 30.7, 22: 31.0, 23: 31.2, 24: 31.4, 25: 31.6,
      26: 31.9, 27: 32.1, 28: 32.3, 29: 32.5, 30: 32.8, 31: 33.0,
      32: 33.2, 33: 33.4, 34: 33.7, 35: 33.9, 36: 34.1, 37: 34.3,
      38: 34.6, 39: 34.8, 40: 35.0, 41: 35.2, 42: 35.5, 43: 35.7,
      44: 35.9, 45: 36.1, 46: 36.4, 47: 36.6, 48: 36.8, 49: 37.0,
      50: 37.3, 51: 37.5, 52: 37.7, 53: 37.9, 54: 38.2, 55: 38.4,
      56: 38.6, 57: 38.8, 58: 39.1, 59: 39.3, 60: 39.5,
      61: 39.7, 62: 40.0, 63: 40.2, 64: 40.4, 65: 40.6,
      66: 40.9, 67: 41.1, 68: 41.3, 69: 41.5, 70: 41.8,
      71: 42.0, 72: 42.2, 73: 42.4, 74: 42.7, 75: 42.9,
      76: 43.1, 77: 43.3, 78: 43.6, 79: 43.8, 80: 44.0,
      81: 44.2, 82: 44.5, 83: 44.7, 84: 44.9, 85: 45.1,
      86: 45.4, 87: 45.6, 88: 45.8, 89: 46.0, 90: 46.3,
      91: 46.5, 92: 46.7, 93: 46.9, 94: 47.2, 95: 47.4,
      96: 47.6, 97: 47.8, 98: 48.1, 99: 48.3, 100: 48.5,
      101: 48.7, 102: 49.0, 103: 49.2, 104: 49.4, 105: 49.6,
      106: 49.9, 107: 50.1, 108: 50.3, 109: 50.5, 110: 50.8,
      111: 51.0, 112: 51.2, 113: 51.4, 114: 51.7, 115: 51.9,
      116: 52.1, 117: 52.3, 118: 52.6, 119: 52.8, 120: 53.0,
      121: 53.2, 122: 53.5, 123: 53.7, 124: 53.9, 125: 54.1,
      126: 54.4, 127: 54.6, 128: 54.8, 129: 55.0, 130: 55.3,
      131: 55.5, 132: 55.7, 133: 55.9, 134: 56.2, 135: 56.4,
      136: 56.6, 137: 56.8, 138: 57.1, 139: 57.3, 140: 57.5,
      141: 57.7, 142: 58.0, 143: 58.2, 144: 58.4, 145: 58.6,
      146: 58.9, 147: 59.1, 148: 59.5, 149: 59.8, 150: 60.0,
      151: 60.2, 152: 60.4, 153: 60.7, 154: 60.9, 155: 61.1,
      156: 61.1, 157: 61.3
    };

    if (vo2maxTable[count]) return vo2maxTable[count];
    if (count < 8) return 27.8;
    if (count > 157) return 61.3 + 0.2 * (count - 157);

    const low = Math.floor(count);
    const high = Math.ceil(count);
    return (
      vo2maxTable[low] +
      (vo2maxTable[high] - vo2maxTable[low]) * (count - low)
    );
  }
};

/**
 * 1RM 計算
 */
export const calculate1RM = {
  epley: (weight: number, reps: number): number => {
    if (weight <= 0 || reps <= 0) return 0;
    if (reps === 1) return weight;
    return Math.round(weight * (1 + reps / 30) * 10) / 10;
  },

  brzycki: (weight: number, reps: number): number => {
    if (weight <= 0 || reps <= 0 || reps >= 37) return 0;
    if (reps === 1) return weight;
    return Math.round(weight * (36 / (37 - reps)) * 10) / 10;
  }
};

/**
 * primary_value 計算（種目名 → 計算式）
 */
export function calculatePrimaryValue(
  testName: string,
  values: Record<string, any>
): number | null {
  try {
    switch (testName) {

      // -------------------------------
      // ジャンプ系（跳躍高）
      // -------------------------------
      case 'cmj':
      case 'cmj_as':
        return parseFloat(values.height) || null;

      // -------------------------------
      // 立ち幅跳び
      // -------------------------------
      case 'standing_long_jump':
      case 'standing_five_jump':
        return parseFloat(values.distance) || null;

      // -------------------------------
      // 反応系ジャンプ（RSI）
      // -------------------------------
      case 'dj_rsi':
        if (values.height && values.contact_time) {
          return (parseFloat(values.height) / 100) /
            (parseFloat(values.contact_time) / 1000);
        }
        return null;

      case 'rj_rsi':
        if (values.avg_height && values.avg_contact_time) {
          return (parseFloat(values.avg_height) / 100) /
            (parseFloat(values.avg_contact_time) / 1000);
        }
        return null;

      // -------------------------------
      // 持久系
      // -------------------------------
      case 'cooper_test':
        return calculateVO2max.cooperTest(parseFloat(values.distance));

      case '1500m_run':
        return calculateVO2max.run1500m(
          parseFloat(values.time_minutes),
          parseFloat(values.time_seconds)
        );

      case 'yoyo_ir1':
        return calculateVO2max.yoyoIR1(parseFloat(values.distance));

      case 'yoyo_ir2':
        return calculateVO2max.yoyoIR2(parseFloat(values.distance));

      case 'shuttle_run_20m':
        return calculateVO2max.shuttleRun20m(parseFloat(values.count));

      // -------------------------------
      // 筋力系：1RM
      // -------------------------------
      case 'bench_press':
      case 'back_squat':
      case 'deadlift':
        return calculate1RM.epley(
          parseFloat(values.weight),
          parseFloat(values.reps)
        );

      case 'bulgarian_squat_r':
      case 'bulgarian_squat_l':
        return calculate1RM.epley(
          parseFloat(values.weight),
          parseFloat(values.reps)
        );

      // -------------------------------
      // 新規追加種目
      // -------------------------------
      case 'sqj':
        return parseFloat(values.height) || null;

      case '1000m_run':
        return (
          parseFloat(values.time_minutes) * 60 +
          parseFloat(values.time_seconds)
        );

      case 'pull_up':
        return parseFloat(values.count) || null;

      case 'side_step_test':
        return parseFloat(values.count) || null;

      // -------------------------------
      // アジリティ（タイム）
      // 050_l（DB名）を追加して左も計算できるようにする
      // 050-l は過去互換（残してOK）
      // -------------------------------
      case '050_r':
      case '050_l':  // ✅ 追加（これが左が保存できない原因の根治）
      case '050-l':  // 互換用（不要なら消してOK）
      case 'pro_agility_r':
      case 'pro_agility_l':
      case 'arrowhead_r':
      case 'arrowhead_l':
        return parseFloat(values.time) || null;

      // -------------------------------
      // Sprint 系（タイム）
      // -------------------------------
      case 'sprint_5m':
      case 'sprint_10m':
      case 'sprint_15m':
      case 'sprint_20m':
      case 'sprint_30m':
      case 'sprint_50m':
        return parseFloat(values.time) || null;

      default:
        return null;
    }
  } catch (error) {
    console.error('Error calculating primary value:', error);
    return null;
  }
}

/**
 * values から primary_value を抽出
 */
export function extractPrimaryValue(values: Record<string, any>) {
  if (!values) return null;

  if (values.primary_value !== undefined && values.primary_value !== null) {
    return Number(values.primary_value);
  }

  const numericKeys = Object.keys(values).filter(
    (key) => !isNaN(Number(values[key]))
  );

  return numericKeys.length > 0 ? Number(values[numericKeys[0]]) : null;
}

/**
 * 最新の primary_value を取得
 */
export function getLatestPrimaryValue(records: any[]) {
  if (!records?.length) return null;

  const latest = [...records].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )[0];

  return extractPrimaryValue(latest.values);
}

/**
 * 単位
 */
export function getCalculatedUnit(testName: string): string {
  switch (testName) {
    case 'cmj':
    case 'cmj_as':
    case 'standing_long_jump':
    case 'standing_five_jump':
      return 'cm';

    case 'cooper_test':
    case 'yoyo_ir1':
    case 'yoyo_ir2':
    case 'shuttle_run_20m':
      return 'ml/kg/min';

    case '1000m_run':
    case '1500m_run':
    case 'arrowhead_r':
    case 'arrowhead_l':
    case '050_r':
    case '050_l':  // ✅ 追加
    case '050-l':
    case 'pro_agility_r':
    case 'pro_agility_l':
      return '秒';

    case 'bench_press':
    case 'back_squat':
    case 'deadlift':
    case 'bulgarian_squat_r':
    case 'bulgarian_squat_l':
      return 'kg';

    case 'dj_rsi':
    case 'rj_rsi':
      return 'RSI';

    case 'sprint_5m':
    case 'sprint_10m':
    case 'sprint_15m':
    case 'sprint_20m':
    case 'sprint_30m':
    case 'sprint_50m':
      return '秒';

    default:
      return '';
  }
}

/**
 * 表示ラベル
 */
export function getCalculatedValueLabel(testName: string): string {
  switch (testName) {
    case 'sqj':
    case 'cmj':
    case 'cmj_as':
      return '跳躍高';

    case 'standing_long_jump':
    case 'standing_five_jump':
      return '距離';

    case 'cooper_test':
    case 'yoyo_ir1':
    case 'yoyo_ir2':
    case 'shuttle_run_20m':
      return '推定VO2max';

    case '1500m_run':
    case '1000m_run':
    case 'arrowhead_r':
    case 'arrowhead_l':
    case '050_r':
    case '050_l':  // ✅ 追加
    case '050-l':
    case 'pro_agility_r':
    case 'pro_agility_l':
      return 'タイム';

    case 'bench_press':
    case 'back_squat':
    case 'deadlift':
    case 'bulgarian_squat_r':
    case 'bulgarian_squat_l':
      return '推定1RM';

    case 'dj_rsi':
    case 'rj_rsi':
      return 'RSI';

    default:
      return '計算値';
  }
}

/**
 * -----------------------------------------------------
 * 追加：表示用フォーマッタ（秒は小数2桁）
 * -----------------------------------------------------
 * 例）
 * formatCalculatedValue('050_l', 2.5) => "2.50"
 * formatCalculatedValue('bench_press', 102.34) => "102.3"（kgは小数1桁の例）
 */
export function formatCalculatedValue(testName: string, value: number | null): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-';

  // 秒系は小数2桁で固定
  const secTests = new Set([
    '050_r', '050_l', '050-l',
    'pro_agility_r', 'pro_agility_l',
    'arrowhead_r', 'arrowhead_l',
    'sprint_5m', 'sprint_10m', 'sprint_15m', 'sprint_20m', 'sprint_30m', 'sprint_50m',
  ]);

  if (secTests.has(testName)) return Number(value).toFixed(2);

  // kg系：小数1桁（必要なら2桁にしてOK）
  const kgTests = new Set([
    'bench_press', 'back_squat', 'deadlift',
    'bulgarian_squat_r', 'bulgarian_squat_l',
  ]);
  if (kgTests.has(testName)) return (Math.round(value * 10) / 10).toFixed(1);

  // それ以外はそのまま（必要ならここもルール化OK）
  return String(value);
}