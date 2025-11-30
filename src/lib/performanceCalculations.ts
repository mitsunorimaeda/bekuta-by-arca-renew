/**
 * パフォーマンス測定の計算式ユーティリティ
 * VO2max推定、1RM計算などの機能を提供します
 */

/**
 * VO2max（最大酸素摂取量）推定計算
 */
export const calculateVO2max = {
  /**
   * クーパーテスト（12分間走）からVO2maxを推定
   * 計算式: VO2max = (距離(m) - 504.9) / 44.73
   * @param distance 12分間の走行距離（メートル）
   * @returns VO2max (ml/kg/min)
   */
  cooperTest: (distance: number): number => {
    if (distance <= 0) return 0;
    const vo2max = (distance - 504.9) / 44.73;
    return Math.max(0, vo2max);
  },

  /**
   * 1500m走のタイム測定（VO2max計算なし）
   * @param minutes 完走時間（分）
   * @param seconds 完走時間（秒）
   * @returns タイム（秒）
   */
  run1500m: (minutes: number, seconds: number): number => {
    const totalSeconds = minutes * 60 + seconds;
    return totalSeconds;
  },

  /**
   * Yo-Yo Test IR1からVO2maxを推定
   * 計算式: VO2max = 距離 × 0.0084 + 36.4
   * @param distance 走行距離（メートル）
   * @returns VO2max (ml/kg/min)
   */
  yoyoIR1: (distance: number): number => {
    if (distance <= 0) return 0;
    const vo2max = distance * 0.0084 + 36.4;
    return Math.max(0, vo2max);
  },

  /**
   * Yo-Yo Test IR2からVO2maxを推定
   * 計算式: VO2max = 距離 × 0.0136 + 45.3
   * @param distance 走行距離（メートル）
   * @returns VO2max (ml/kg/min)
   */
  yoyoIR2: (distance: number): number => {
    if (distance <= 0) return 0;
    const vo2max = distance * 0.0136 + 45.3;
    return Math.max(0, vo2max);
  },

  /**
   * 20mシャトルランからVO2maxを推定
   * 文部科学省の換算表を使用（6〜19歳対象、往復持久走）
   * 参考：平成12年3月改訂
   * @param count 往復回数
   * @returns VO2max (ml/kg/min)
   */
  shuttleRun20m: (count: number): number => {
    if (count <= 0) return 0;

    // 文部科学省の20mシャトルラン最大酸素摂取量推定表
    // 往復回数からVO2maxへの換算テーブル
    const vo2maxTable: Record<number, number> = {
      8: 27.8, 9: 28.0, 10: 28.3, 11: 28.5, 12: 28.7, 13: 28.9, 14: 29.2, 15: 29.4,
      16: 29.6, 17: 29.8, 18: 30.1, 19: 30.3, 20: 30.5, 21: 30.7, 22: 31.0, 23: 31.2,
      24: 31.4, 25: 31.6, 26: 31.9, 27: 32.1, 28: 32.3, 29: 32.5, 30: 32.8, 31: 33.0,
      32: 33.2, 33: 33.4, 34: 33.7, 35: 33.9, 36: 34.1, 37: 34.3, 38: 34.6, 39: 34.8,
      40: 35.0, 41: 35.2, 42: 35.5, 43: 35.7, 44: 35.9, 45: 36.1, 46: 36.4, 47: 36.6,
      48: 36.8, 49: 37.0, 50: 37.3, 51: 37.5, 52: 37.7, 53: 37.9, 54: 38.2, 55: 38.4,
      56: 38.6, 57: 38.8, 58: 39.1, 59: 39.3, 60: 39.5, 61: 39.7, 62: 40.0, 63: 40.2,
      64: 40.4, 65: 40.6, 66: 40.9, 67: 41.1, 68: 41.3, 69: 41.5, 70: 41.8, 71: 42.0,
      72: 42.2, 73: 42.4, 74: 42.7, 75: 42.9, 76: 43.1, 77: 43.3, 78: 43.6, 79: 43.8,
      80: 44.0, 81: 44.2, 82: 44.5, 83: 44.7, 84: 44.9, 85: 45.1, 86: 45.4, 87: 45.6,
      88: 45.8, 89: 46.0, 90: 46.3, 91: 46.5, 92: 46.7, 93: 46.9, 94: 47.2, 95: 47.4,
      96: 47.6, 97: 47.8, 98: 48.1, 99: 48.3, 100: 48.5, 101: 48.7, 102: 49.0, 103: 49.2,
      104: 49.4, 105: 49.6, 106: 49.9, 107: 50.1, 108: 50.3, 109: 50.5, 110: 50.8, 111: 51.0,
      112: 51.2, 113: 51.4, 114: 51.7, 115: 51.9, 116: 52.1, 117: 52.3, 118: 52.6, 119: 52.8,
      120: 53.0, 121: 53.2, 122: 53.5, 123: 53.7, 124: 53.9, 125: 54.1, 126: 54.4, 127: 54.6,
      128: 54.8, 129: 55.0, 130: 55.3, 131: 55.5, 132: 55.7, 133: 55.9, 134: 56.2, 135: 56.4,
      136: 56.6, 137: 56.8, 138: 57.1, 139: 57.3, 140: 57.5, 141: 57.7, 142: 58.0, 143: 58.2,
      144: 58.4, 145: 58.6, 146: 58.9, 147: 59.1, 148: 59.5, 149: 59.8, 150: 60.0, 151: 60.2,
      152: 60.4, 153: 60.7, 154: 60.9, 155: 61.1, 156: 61.1, 157: 61.3
    };

    // テーブルに該当する値がある場合はそれを返す
    if (vo2maxTable[count]) {
      return vo2maxTable[count];
    }

    // テーブルの範囲外の場合
    if (count < 8) {
      // 8回未満は最小値を返す
      return 27.8;
    } else if (count > 157) {
      // 157回超は線形補間で推定（最後の傾斜を使用）
      const slope = (61.3 - 61.1) / (157 - 156); // 約0.2
      return 61.3 + slope * (count - 157);
    }

    // テーブル間の値は線形補間
    const lowerCount = Math.floor(count);
    const upperCount = Math.ceil(count);
    const lowerVO2 = vo2maxTable[lowerCount] || 0;
    const upperVO2 = vo2maxTable[upperCount] || 0;

    if (lowerVO2 && upperVO2) {
      const ratio = count - lowerCount;
      return lowerVO2 + (upperVO2 - lowerVO2) * ratio;
    }

    return 0;
  }
};

/**
 * 1RM（最大挙上重量）計算
 */
export const calculate1RM = {
  /**
   * Epley式で1RMを計算
   * 計算式: 1RM = 重量 × (1 + 回数 / 30)
   *
   * @param weight 使用重量（kg）
   * @param reps 反復回数
   * @returns 推定1RM (kg)
   */
  epley: (weight: number, reps: number): number => {
    if (weight <= 0 || reps <= 0) return 0;

    // 1回の場合は重量そのものが1RM
    if (reps === 1) return weight;

    const oneRM = weight * (1 + reps / 30);
    return Math.round(oneRM * 10) / 10; // 小数点第1位まで
  },

  /**
   * Brzycki式で1RMを計算（参考用）
   * 計算式: 1RM = 重量 × (36 / (37 - 回数))
   *
   * @param weight 使用重量（kg）
   * @param reps 反復回数
   * @returns 推定1RM (kg)
   */
  brzycki: (weight: number, reps: number): number => {
    if (weight <= 0 || reps <= 0) return 0;
    if (reps === 1) return weight;
    if (reps >= 37) return 0; // 計算不可能

    const oneRM = weight * (36 / (37 - reps));
    return Math.round(oneRM * 10) / 10;
  }
};

/**
 * パフォーマンスデータから主要指標を計算
 * 測定種目に応じて適切な計算式を選択します
 *
 * @param testName 測定種目名
 * @param values 測定値
 * @param userAge ユーザーの年齢（オプション）
 * @returns 計算された主要指標
 */
export function calculatePrimaryValue(
  testName: string,
  values: Record<string, any>,
  userAge?: number
): number | null {
  try {
    switch (testName) {
      // ジャンプ系
      case 'cmj':
      case 'standing_long_jump':
        return parseFloat(values.height || values.distance) || null;

      case 'standing_five_jump':
        return parseFloat(values.distance) || null;

      case 'dj_rsi':
        if (values.height && values.contact_time) {
          const heightM = parseFloat(values.height) / 100;
          const contactTimeS = parseFloat(values.contact_time) / 1000;
          return contactTimeS > 0 ? heightM / contactTimeS : null;
        }
        return null;

      case 'rj_rsi':
        if (values.avg_height && values.avg_contact_time) {
          const heightM = parseFloat(values.avg_height) / 100;
          const contactTimeS = parseFloat(values.avg_contact_time) / 1000;
          return contactTimeS > 0 ? heightM / contactTimeS : null;
        }
        return null;

      // 全身持久力
      case 'cooper_test':
        return calculateVO2max.cooperTest(parseFloat(values.distance));

      case '1500m_run':
        return calculateVO2max.run1500m(
          parseFloat(values.time_minutes || 0),
          parseFloat(values.time_seconds || 0)
        );

      case 'yoyo_ir1':
        return calculateVO2max.yoyoIR1(parseFloat(values.distance));

      case 'yoyo_ir2':
        return calculateVO2max.yoyoIR2(parseFloat(values.distance));

      case 'shuttle_run_20m':
        return calculateVO2max.shuttleRun20m(parseFloat(values.count));

      // 筋力
      case 'bench_press':
      case 'back_squat':
      case 'deadlift':
        return calculate1RM.epley(
          parseFloat(values.weight),
          parseFloat(values.reps)
        );

      default:
        return null;
    }
  } catch (error) {
    console.error('Error calculating primary value:', error);
    return null;
  }
}

/**
 * 計算値の表示単位を取得
 *
 * @param testName 測定種目名
 * @returns 表示単位
 */
export function getCalculatedUnit(testName: string): string {
  switch (testName) {
    case 'cooper_test':
    case 'yoyo_ir1':
    case 'yoyo_ir2':
    case 'shuttle_run_20m':
      return 'ml/kg/min';

    case '1500m_run':
      return '秒';

    case 'bench_press':
    case 'back_squat':
    case 'deadlift':
      return 'kg';

    case 'dj_rsi':
    case 'rj_rsi':
      return 'RSI';

    default:
      return '';
  }
}

/**
 * 計算値の説明を取得
 *
 * @param testName 測定種目名
 * @returns 計算値の説明
 */
export function getCalculatedValueLabel(testName: string): string {
  switch (testName) {
    case 'cooper_test':
    case 'yoyo_ir1':
    case 'yoyo_ir2':
    case 'shuttle_run_20m':
      return '推定VO2max';

    case '1500m_run':
      return 'タイム';

    case 'bench_press':
    case 'back_squat':
    case 'deadlift':
      return '推定1RM';

    case 'dj_rsi':
    case 'rj_rsi':
      return 'RSI';

    case 'cmj':
      return '跳躍高';

    case 'standing_long_jump':
    case 'standing_five_jump':
      return '距離';

    default:
      return '計算値';
  }
}
