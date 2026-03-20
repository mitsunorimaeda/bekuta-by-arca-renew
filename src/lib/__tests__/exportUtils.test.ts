import { describe, it, expect, vi } from 'vitest';
import { getDateRange, getRiskLevelJapanese } from '../exportUtils';

// date モジュールをモック（getTodayJST を固定日にする）
vi.mock('../date', () => ({
  getTodayJST: () => new Date(2026, 2, 21), // 2026-03-21
  formatDateJST: (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  },
}));

describe('getDateRange', () => {
  it('week → 7日前〜今日', () => {
    const range = getDateRange('week');
    expect(range.end).toBe('2026-03-21');
    expect(range.start).toBe('2026-03-14');
  });

  it('month → 1ヶ月前〜今日', () => {
    const range = getDateRange('month');
    expect(range.end).toBe('2026-03-21');
    expect(range.start).toBe('2026-02-21');
  });

  it('quarter → 3ヶ月前〜今日', () => {
    const range = getDateRange('quarter');
    expect(range.end).toBe('2026-03-21');
    expect(range.start).toBe('2025-12-21');
  });

  it('custom → カスタム範囲', () => {
    const range = getDateRange('custom', '2026-01-01', '2026-01-31');
    expect(range.start).toBe('2026-01-01');
    expect(range.end).toBe('2026-01-31');
  });

  it('custom で開始日・終了日がない → エラー', () => {
    expect(() => getDateRange('custom')).toThrow('カスタム期間には開始日と終了日が必要です');
  });
});

describe('getRiskLevelJapanese', () => {
  it('各レベルの日本語変換', () => {
    expect(getRiskLevelJapanese('high')).toBe('高リスク');
    expect(getRiskLevelJapanese('caution')).toBe('注意');
    expect(getRiskLevelJapanese('good')).toBe('良好');
    expect(getRiskLevelJapanese('low')).toBe('低負荷');
  });

  it('不明なレベル → "不明"', () => {
    expect(getRiskLevelJapanese('unknown')).toBe('不明');
    expect(getRiskLevelJapanese('')).toBe('不明');
  });
});
