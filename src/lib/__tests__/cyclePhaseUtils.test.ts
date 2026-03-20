import { describe, it, expect } from 'vitest';
import {
  calculatePhaseBoundaries,
  getCyclePhaseForDate,
  predictNextCycle,
  getPhaseColor,
  getPhaseLabel,
  getPhaseEmoji,
  findPhaseForDate,
} from '../cyclePhaseUtils';
import type { CycleRecord } from '../cyclePhaseUtils';

describe('calculatePhaseBoundaries', () => {
  it('28日周期 / 5日月経 → 標準的な境界値', () => {
    const b = calculatePhaseBoundaries(5, 28);
    expect(b.menstrualEnd).toBe(5);       // 1-5日
    expect(b.follicularEnd).toBe(12);     // 6-12日
    expect(b.ovulatoryEnd).toBe(15);      // 13-15日
    expect(b.lutealEnd).toBe(28);         // 16-28日
  });

  it('短い周期（21日）でも正しく計算される', () => {
    const b = calculatePhaseBoundaries(4, 21);
    expect(b.menstrualEnd).toBe(4);
    expect(b.lutealEnd).toBe(21);
    expect(b.follicularEnd).toBeLessThan(b.ovulatoryEnd);
    expect(b.ovulatoryEnd).toBeLessThan(b.lutealEnd);
  });

  it('長い周期（35日）でも正しく計算される', () => {
    const b = calculatePhaseBoundaries(6, 35);
    expect(b.menstrualEnd).toBe(6);
    expect(b.lutealEnd).toBe(35);
    // 排卵日 ≈ 35 - 14 = 21
    expect(b.ovulatoryEnd).toBeLessThanOrEqual(22);
  });

  it('異常値はクランプされる（period < 1 → 1, cycle < 20 → 20）', () => {
    const b = calculatePhaseBoundaries(0, 15);
    expect(b.menstrualEnd).toBe(1);       // 最小1日
    expect(b.lutealEnd).toBe(20);         // 最小20日
  });

  it('異常値はクランプされる（period > 14 → 14, cycle > 60 → 60）', () => {
    const b = calculatePhaseBoundaries(20, 100);
    expect(b.menstrualEnd).toBe(14);      // 最大14日
    expect(b.lutealEnd).toBe(60);         // 最大60日
  });

  it('デフォルト引数で動く', () => {
    const b = calculatePhaseBoundaries();
    expect(b.menstrualEnd).toBe(5);       // DEFAULT_PERIOD_DURATION
    expect(b.lutealEnd).toBe(28);         // DEFAULT_CYCLE_LENGTH
  });

  it('フェーズ境界が正しい順序（menstrual < follicular < ovulatory < luteal）', () => {
    const b = calculatePhaseBoundaries(5, 28);
    expect(b.menstrualEnd).toBeLessThanOrEqual(b.follicularEnd);
    expect(b.follicularEnd).toBeLessThan(b.ovulatoryEnd);
    expect(b.ovulatoryEnd).toBeLessThan(b.lutealEnd);
  });
});

describe('getCyclePhaseForDate', () => {
  const cycle: CycleRecord = {
    cycle_start_date: '2026-03-01',
    period_duration_days: 5,
    cycle_length_days: 28,
  };

  it('1日目 → menstrual', () => {
    const info = getCyclePhaseForDate(cycle, '2026-03-01');
    expect(info?.phase).toBe('menstrual');
    expect(info?.dayInCycle).toBe(1);
  });

  it('5日目（月経最終日）→ menstrual', () => {
    const info = getCyclePhaseForDate(cycle, '2026-03-05');
    expect(info?.phase).toBe('menstrual');
  });

  it('6日目 → follicular', () => {
    const info = getCyclePhaseForDate(cycle, '2026-03-06');
    expect(info?.phase).toBe('follicular');
  });

  it('排卵期の日 → ovulatory', () => {
    // 28日周期の排卵日 = 28 - 14 = 14日目
    const info = getCyclePhaseForDate(cycle, '2026-03-14');
    expect(info?.phase).toBe('ovulatory');
  });

  it('黄体期（後半）→ luteal', () => {
    const info = getCyclePhaseForDate(cycle, '2026-03-25');
    expect(info?.phase).toBe('luteal');
  });

  it('28日目（最終日）→ luteal', () => {
    const info = getCyclePhaseForDate(cycle, '2026-03-28');
    expect(info?.phase).toBe('luteal');
  });

  it('周期開始前 → null', () => {
    const info = getCyclePhaseForDate(cycle, '2026-02-28');
    expect(info).toBeNull();
  });

  it('周期後 → null', () => {
    const info = getCyclePhaseForDate(cycle, '2026-03-29');
    expect(info).toBeNull();
  });

  it('phaseInfo に必要なフィールドが含まれる', () => {
    const info = getCyclePhaseForDate(cycle, '2026-03-10');
    expect(info).not.toBeNull();
    expect(info!.phaseLabel).toBeTruthy();
    expect(info!.phaseEmoji).toBeTruthy();
    expect(info!.trainingAdvice).toBeTruthy();
    expect(info!.totalCycleDays).toBe(28);
    expect(typeof info!.isHighPerformance).toBe('boolean');
    expect(typeof info!.isInjuryRisk).toBe('boolean');
  });
});

describe('findPhaseForDate', () => {
  it('複数周期から該当する周期のフェーズを返す', () => {
    const cycles: CycleRecord[] = [
      { cycle_start_date: '2026-03-01', period_duration_days: 5, cycle_length_days: 28 },
      { cycle_start_date: '2026-02-01', period_duration_days: 5, cycle_length_days: 28 },
    ];
    const info = findPhaseForDate(cycles, '2026-03-03');
    expect(info?.phase).toBe('menstrual');
  });

  it('どの周期にも該当しない → null', () => {
    const cycles: CycleRecord[] = [
      { cycle_start_date: '2026-01-01', period_duration_days: 5, cycle_length_days: 28 },
    ];
    expect(findPhaseForDate(cycles, '2026-06-01')).toBeNull();
  });
});

describe('predictNextCycle', () => {
  it('3周期以上 → 加重平均 + confidence=high', () => {
    const cycles: CycleRecord[] = [
      { cycle_start_date: '2026-03-01', cycle_length_days: 28, period_duration_days: 5 },
      { cycle_start_date: '2026-02-01', cycle_length_days: 30, period_duration_days: 5 },
      { cycle_start_date: '2026-01-01', cycle_length_days: 26, period_duration_days: 4 },
    ];
    const pred = predictNextCycle(cycles);
    expect(pred).not.toBeNull();
    expect(pred!.confidence).toBe('high');
    expect(pred!.cyclesUsed).toBe(3);
    // 加重平均: (28*3 + 30*2 + 26*1) / 6 = (84+60+26)/6 = 170/6 ≈ 28
    expect(pred!.averageCycleLength).toBe(28);
  });

  it('2周期 → confidence=medium', () => {
    const cycles: CycleRecord[] = [
      { cycle_start_date: '2026-03-01', cycle_length_days: 28, period_duration_days: 5 },
      { cycle_start_date: '2026-02-01', cycle_length_days: 30, period_duration_days: 5 },
    ];
    const pred = predictNextCycle(cycles);
    expect(pred!.confidence).toBe('medium');
  });

  it('1周期 → confidence=low', () => {
    const cycles: CycleRecord[] = [
      { cycle_start_date: '2026-03-01', cycle_length_days: 28, period_duration_days: 5 },
    ];
    const pred = predictNextCycle(cycles);
    expect(pred!.confidence).toBe('low');
    expect(pred!.averageCycleLength).toBe(28);
  });

  it('空配列 → null', () => {
    expect(predictNextCycle([])).toBeNull();
  });

  it('cycle_length_days がない周期 → デフォルト値を使用', () => {
    const cycles: CycleRecord[] = [
      { cycle_start_date: '2026-03-01' },
    ];
    const pred = predictNextCycle(cycles);
    expect(pred).not.toBeNull();
    expect(pred!.averageCycleLength).toBe(28); // DEFAULT
    expect(pred!.confidence).toBe('low');
  });

  it('予測日が正しく計算される', () => {
    const cycles: CycleRecord[] = [
      { cycle_start_date: '2026-03-01', cycle_length_days: 30, period_duration_days: 5 },
    ];
    const pred = predictNextCycle(cycles);
    // predictedStart と predictedEnd が返される
    expect(pred!.predictedStartDate).toBeTruthy();
    expect(pred!.predictedEndDate).toBeTruthy();
    // predictedEnd は predictedStart + (period - 1)日後
    const startDate = new Date(pred!.predictedStartDate + 'T00:00:00');
    const endDate = new Date(pred!.predictedEndDate + 'T00:00:00');
    const periodDiff = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    expect(periodDiff).toBe(4); // 5 - 1 = 4日後
    expect(pred!.averageCycleLength).toBe(30);
    expect(pred!.averagePeriodDuration).toBe(5);
  });
});

describe('getPhaseColor', () => {
  it('menstrual → red系', () => {
    const c = getPhaseColor('menstrual');
    expect(c.dot).toContain('red');
  });
  it('follicular → green系', () => {
    const c = getPhaseColor('follicular');
    expect(c.dot).toContain('green');
  });
  it('ovulatory → yellow系', () => {
    const c = getPhaseColor('ovulatory');
    expect(c.dot).toContain('yellow');
  });
  it('luteal → blue系', () => {
    const c = getPhaseColor('luteal');
    expect(c.dot).toContain('blue');
  });
});

describe('getPhaseLabel / getPhaseEmoji', () => {
  it('各フェーズの日本語ラベル', () => {
    expect(getPhaseLabel('menstrual')).toBe('月経期');
    expect(getPhaseLabel('follicular')).toBe('卵胞期');
    expect(getPhaseLabel('ovulatory')).toBe('排卵期');
    expect(getPhaseLabel('luteal')).toBe('黄体期');
  });

  it('各フェーズの絵文字', () => {
    expect(getPhaseEmoji('menstrual')).toBe('🔴');
    expect(getPhaseEmoji('follicular')).toBe('🌸');
    expect(getPhaseEmoji('ovulatory')).toBe('⚡');
    expect(getPhaseEmoji('luteal')).toBe('🌙');
  });
});
