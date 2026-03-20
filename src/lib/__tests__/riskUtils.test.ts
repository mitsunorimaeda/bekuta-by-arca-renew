import { describe, it, expect } from 'vitest';
import { calcRiskForAthlete, sortAthletesByRisk, getRiskColor, getRiskLabel, riskPriority } from '../riskUtils';

const base = { id: 'u1', name: 'テスト選手' };

describe('calcRiskForAthlete', () => {
  // =====================
  // HIGH リスク
  // =====================
  it('14日以上未入力 → HIGH + 理由「未入力」', () => {
    const r = calcRiskForAthlete({ ...base, noData: { daysSinceLast: 14 } });
    expect(r.riskLevel).toBe('high');
    expect(r.reasons).toContain('未入力');
  });

  it('ACWR ≥ 1.5 + 共有ON → HIGH + 理由「負荷急増」', () => {
    const r = calcRiskForAthlete({
      ...base,
      acwrInfo: { currentACWR: 1.5 },
      weekCard: { is_sharing_active: true },
    });
    expect(r.riskLevel).toBe('high');
    expect(r.reasons).toContain('負荷急増');
  });

  it('睡眠 ≤ 5.0h + 共有ON → HIGH + 理由「睡眠↓」', () => {
    const r = calcRiskForAthlete({
      ...base,
      weekCard: { is_sharing_active: true, sleep_hours_avg: 4.5 },
    });
    expect(r.riskLevel).toBe('high');
    expect(r.reasons).toContain('睡眠↓');
  });

  it('共有OFF → ACWR高値でもHIGHにならない', () => {
    const r = calcRiskForAthlete({
      ...base,
      acwrInfo: { currentACWR: 2.0 },
      weekCard: { is_sharing_active: false },
    });
    expect(r.riskLevel).toBe('low');
  });

  // =====================
  // CAUTION リスク
  // =====================
  it('ACWR ≥ 1.3 (< 1.5) + 共有ON → CAUTION + 理由「負荷やや高」', () => {
    const r = calcRiskForAthlete({
      ...base,
      acwrInfo: { currentACWR: 1.35 },
      weekCard: { is_sharing_active: true },
    });
    expect(r.riskLevel).toBe('caution');
    expect(r.reasons).toContain('負荷やや高');
  });

  it('7日以上未入力 (< 14日) → CAUTION', () => {
    const r = calcRiskForAthlete({ ...base, noData: { daysSinceLast: 10 } });
    expect(r.riskLevel).toBe('caution');
    expect(r.reasons).toContain('未入力');
  });

  it('睡眠 ≤ 5.5h (> 5.0h) + 共有ON → CAUTION', () => {
    const r = calcRiskForAthlete({
      ...base,
      weekCard: { is_sharing_active: true, sleep_hours_avg: 5.2 },
    });
    expect(r.riskLevel).toBe('caution');
    expect(r.reasons).toContain('睡眠↓');
  });

  it('黄体期 + ACWR ≥ 1.2 + 共有ON → CAUTION + 理由「黄体期+高負荷」', () => {
    const r = calcRiskForAthlete({
      ...base,
      acwrInfo: { currentACWR: 1.2 },
      weekCard: { is_sharing_active: true },
      cyclePhase: 'luteal',
    });
    expect(r.riskLevel).toBe('caution');
    expect(r.reasons).toContain('黄体期+高負荷');
  });

  it('月経期 + 睡眠 ≤ 6.0h + 共有ON → CAUTION + 理由「月経期+睡眠↓」', () => {
    const r = calcRiskForAthlete({
      ...base,
      weekCard: { is_sharing_active: true, sleep_hours_avg: 5.8 },
      cyclePhase: 'menstrual',
    });
    expect(r.riskLevel).toBe('caution');
    expect(r.reasons).toContain('月経期+睡眠↓');
  });

  // =====================
  // LOW リスク
  // =====================
  it('正常値 → LOW + 理由なし', () => {
    const r = calcRiskForAthlete({
      ...base,
      acwrInfo: { currentACWR: 1.0 },
      weekCard: { is_sharing_active: true, sleep_hours_avg: 7.5 },
    });
    expect(r.riskLevel).toBe('low');
    expect(r.reasons).toHaveLength(0);
  });

  it('データなし → LOW', () => {
    const r = calcRiskForAthlete({ ...base });
    expect(r.riskLevel).toBe('low');
  });

  // =====================
  // 理由の制限
  // =====================
  it('理由は最大2つまで', () => {
    const r = calcRiskForAthlete({
      ...base,
      noData: { daysSinceLast: 14 },
      acwrInfo: { currentACWR: 1.8 },
      weekCard: { is_sharing_active: true, sleep_hours_avg: 4.0 },
    });
    expect(r.riskLevel).toBe('high');
    expect(r.reasons.length).toBeLessThanOrEqual(2);
  });

  it('ACWRの値が返される', () => {
    const r = calcRiskForAthlete({
      ...base,
      acwrInfo: { currentACWR: 1.25 },
    });
    expect(r.acwr).toBe(1.25);
  });
});

describe('sortAthletesByRisk', () => {
  it('共有ON → HIGH → CAUTION → LOW の順', () => {
    const athletes = [
      { id: 'a', name: 'Low選手' },
      { id: 'b', name: 'High選手' },
      { id: 'c', name: 'Caution選手' },
    ];
    const riskMap = {
      a: { id: 'a', name: 'Low選手', riskLevel: 'low' as const, reasons: [], acwr: 0.9 },
      b: { id: 'b', name: 'High選手', riskLevel: 'high' as const, reasons: ['負荷急増'], acwr: 1.6 },
      c: { id: 'c', name: 'Caution選手', riskLevel: 'caution' as const, reasons: ['負荷やや高'], acwr: 1.3 },
    };
    const sorted = sortAthletesByRisk({ athletes, riskMap });
    expect(sorted[0].id).toBe('b'); // high
    expect(sorted[1].id).toBe('c'); // caution
    expect(sorted[2].id).toBe('a'); // low
  });

  it('共有OFFの選手は末尾', () => {
    const athletes = [
      { id: 'off', name: '共有OFF' },
      { id: 'on', name: '共有ON' },
    ];
    const riskMap = {
      off: { id: 'off', name: '共有OFF', riskLevel: 'high' as const, reasons: ['未入力'], acwr: 2.0 },
      on: { id: 'on', name: '共有ON', riskLevel: 'low' as const, reasons: [], acwr: 0.9 },
    };
    const weekCardMap = {
      off: { is_sharing_active: false },
      on: { is_sharing_active: true },
    };
    const sorted = sortAthletesByRisk({ athletes, riskMap, weekCardMap });
    expect(sorted[0].id).toBe('on');
    expect(sorted[1].id).toBe('off');
  });

  it('同リスクレベルはACWR降順', () => {
    const athletes = [
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
    ];
    const riskMap = {
      a: { id: 'a', name: 'A', riskLevel: 'high' as const, reasons: ['負荷急増'], acwr: 1.5 },
      b: { id: 'b', name: 'B', riskLevel: 'high' as const, reasons: ['負荷急増'], acwr: 1.8 },
    };
    const sorted = sortAthletesByRisk({ athletes, riskMap });
    expect(sorted[0].id).toBe('b'); // higher ACWR first
  });
});

describe('getRiskColor / getRiskLabel', () => {
  it('high → 赤系', () => {
    expect(getRiskColor('high')).toContain('red');
  });
  it('caution → amber系', () => {
    expect(getRiskColor('caution')).toContain('amber');
  });
  it('low → emerald系', () => {
    expect(getRiskColor('low')).toContain('emerald');
  });
  it('undefined → gray系', () => {
    expect(getRiskColor(undefined)).toContain('gray');
  });

  it('ラベル変換', () => {
    expect(getRiskLabel('high')).toBe('高リスク');
    expect(getRiskLabel('caution')).toBe('注意');
    expect(getRiskLabel('low')).toBe('安定');
    expect(getRiskLabel(undefined)).toBe('不明');
  });
});

describe('riskPriority', () => {
  it('high > caution > low', () => {
    expect(riskPriority.high).toBeGreaterThan(riskPriority.caution);
    expect(riskPriority.caution).toBeGreaterThan(riskPriority.low);
  });
});
