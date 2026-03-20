import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateAlerts,
  filterActiveAlerts,
  sortAlertsByPriority,
  isAlertExpired,
  getAlertStyle,
  getAlertTypeLabel,
  DEFAULT_ALERT_RULES,
  type Alert,
  type AlertRule,
} from '../alerts';

// formatDateJST をモックして日付を安定させる
vi.mock('../date', () => ({
  formatDateJST: (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  },
}));

// ルールをIDつきで用意
function rulesWithIds(): AlertRule[] {
  return DEFAULT_ALERT_RULES.map((r, i) => ({ ...r, id: `rule-${i}` }));
}

// 日付を生成（daysAgo日前）
function daysAgoStr(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayStr(): string {
  return daysAgoStr(0);
}

describe('generateAlerts', () => {
  const userId = 'u1';
  const userName = 'テスト選手';
  const rules = rulesWithIds();

  it('ACWR ≥ 1.5 → high_risk アラート', () => {
    // 21日以上のトレーニングデータが必要
    const training = Array.from({ length: 25 }, (_, i) => ({
      date: daysAgoStr(i),
      rpe: 5,
      duration_min: 60,
    }));
    const acwr = [{ date: todayStr(), acwr: 1.6 }];

    const alerts = generateAlerts(userId, userName, acwr, training, rules);
    const highRisk = alerts.find((a) => a.type === 'high_risk');
    expect(highRisk).toBeDefined();
    expect(highRisk!.priority).toBe('high');
    expect(highRisk!.acwr_value).toBe(1.6);
  });

  it('ACWR ≥ 1.3 (< 1.5) → caution アラート', () => {
    const training = Array.from({ length: 25 }, (_, i) => ({
      date: daysAgoStr(i),
      rpe: 5,
      duration_min: 60,
    }));
    const acwr = [{ date: todayStr(), acwr: 1.35 }];

    const alerts = generateAlerts(userId, userName, acwr, training, rules);
    const caution = alerts.find((a) => a.type === 'caution');
    expect(caution).toBeDefined();
    expect(caution!.priority).toBe('medium');
  });

  it('ACWR < 0.8 → low_load アラート', () => {
    const training = Array.from({ length: 25 }, (_, i) => ({
      date: daysAgoStr(i),
      rpe: 5,
      duration_min: 60,
    }));
    const acwr = [{ date: todayStr(), acwr: 0.6 }];

    const alerts = generateAlerts(userId, userName, acwr, training, rules);
    const lowLoad = alerts.find((a) => a.type === 'low_load');
    expect(lowLoad).toBeDefined();
    expect(lowLoad!.priority).toBe('low');
  });

  it('5日以上未トレーニング → no_data アラート', () => {
    const training = [{ date: daysAgoStr(7), rpe: 5, duration_min: 60 }];

    const alerts = generateAlerts(userId, userName, [], training, rules);
    const noData = alerts.find((a) => a.type === 'no_data');
    expect(noData).toBeDefined();
    expect(noData!.priority).toBe('medium');
    expect(noData!.days_since_last_training).toBeGreaterThanOrEqual(5);
  });

  it('sRPE ≥ 600 → srpe_high アラート', () => {
    // RPE 8 × 80分 = 640
    const training = [{ date: todayStr(), rpe: 8, duration_min: 80 }];

    const alerts = generateAlerts(userId, userName, [], training, rules);
    const srpeHigh = alerts.find((a) => a.type === 'srpe_high');
    expect(srpeHigh).toBeDefined();
    expect(srpeHigh!.srpe_value).toBe(640);
  });

  it('sRPE spike ≥ 1.6x → srpe_spike アラート', () => {
    // 直近7日: RPE 5 × 60分 = 300 → 平均300
    // 今日: RPE 8 × 80分 = 640 → ratio 2.13
    const pastTraining = Array.from({ length: 7 }, (_, i) => ({
      date: daysAgoStr(i + 1),
      rpe: 5,
      duration_min: 60,
    }));
    const todayTraining = { date: todayStr(), rpe: 8, duration_min: 80 };

    const alerts = generateAlerts(
      userId,
      userName,
      [],
      [...pastTraining, todayTraining],
      rules
    );
    const spike = alerts.find((a) => a.type === 'srpe_spike');
    expect(spike).toBeDefined();
    expect(spike!.srpe_spike_ratio).toBeGreaterThanOrEqual(1.6);
  });

  it('21日未満のデータ → ACWRアラートが生成されない', () => {
    // 15日分しかデータがない
    const training = Array.from({ length: 15 }, (_, i) => ({
      date: daysAgoStr(i),
      rpe: 5,
      duration_min: 60,
    }));
    const acwr = [{ date: todayStr(), acwr: 2.0 }]; // 高いACWRでも

    const alerts = generateAlerts(userId, userName, acwr, training, rules);
    const acwrAlerts = alerts.filter(
      (a) => a.type === 'high_risk' || a.type === 'caution' || a.type === 'low_load'
    );
    expect(acwrAlerts).toHaveLength(0);
  });

  it('無効なルールは無視される', () => {
    const disabledRules = rules.map((r) => ({ ...r, enabled: false }));
    const training = Array.from({ length: 25 }, (_, i) => ({
      date: daysAgoStr(i),
      rpe: 5,
      duration_min: 60,
    }));
    const acwr = [{ date: todayStr(), acwr: 2.0 }];

    const alerts = generateAlerts(userId, userName, acwr, training, disabledRules);
    expect(alerts).toHaveLength(0);
  });

  it('空データ → アラートなし', () => {
    const alerts = generateAlerts(userId, userName, [], [], rules);
    expect(alerts).toHaveLength(0);
  });
});

describe('isAlertExpired', () => {
  it('expires_at が過去 → true', () => {
    const alert = {
      expires_at: new Date(Date.now() - 1000).toISOString(),
    } as Alert;
    expect(isAlertExpired(alert)).toBe(true);
  });

  it('expires_at が未来 → false', () => {
    const alert = {
      expires_at: new Date(Date.now() + 100000).toISOString(),
    } as Alert;
    expect(isAlertExpired(alert)).toBe(false);
  });

  it('expires_at なし → false', () => {
    const alert = {} as Alert;
    expect(isAlertExpired(alert)).toBe(false);
  });
});

describe('filterActiveAlerts', () => {
  const baseAlert: Alert = {
    id: 'a1',
    user_id: 'u1',
    type: 'high_risk',
    priority: 'high',
    title: 'テスト',
    message: 'テスト',
    is_read: false,
    is_dismissed: false,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 100000).toISOString(),
  };

  it('却下済みを除外', () => {
    const alerts = [
      baseAlert,
      { ...baseAlert, id: 'a2', is_dismissed: true },
    ];
    expect(filterActiveAlerts(alerts)).toHaveLength(1);
    expect(filterActiveAlerts(alerts)[0].id).toBe('a1');
  });

  it('期限切れを除外', () => {
    const alerts = [
      baseAlert,
      {
        ...baseAlert,
        id: 'a2',
        expires_at: new Date(Date.now() - 1000).toISOString(),
      },
    ];
    expect(filterActiveAlerts(alerts)).toHaveLength(1);
  });

  it('有効なアラートのみ残す', () => {
    const alerts = [
      baseAlert,
      { ...baseAlert, id: 'a2', is_dismissed: true },
      {
        ...baseAlert,
        id: 'a3',
        expires_at: new Date(Date.now() - 1000).toISOString(),
      },
    ];
    const active = filterActiveAlerts(alerts);
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe('a1');
  });
});

describe('sortAlertsByPriority', () => {
  it('high > medium > low の順', () => {
    const alerts: Alert[] = [
      {
        id: 'low',
        user_id: 'u1',
        type: 'low_load',
        priority: 'low',
        title: '',
        message: '',
        is_read: false,
        is_dismissed: false,
        created_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'high',
        user_id: 'u1',
        type: 'high_risk',
        priority: 'high',
        title: '',
        message: '',
        is_read: false,
        is_dismissed: false,
        created_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'med',
        user_id: 'u1',
        type: 'caution',
        priority: 'medium',
        title: '',
        message: '',
        is_read: false,
        is_dismissed: false,
        created_at: '2026-01-01T00:00:00Z',
      },
    ];

    const sorted = sortAlertsByPriority(alerts);
    expect(sorted[0].id).toBe('high');
    expect(sorted[1].id).toBe('med');
    expect(sorted[2].id).toBe('low');
  });

  it('同優先度は作成日時の降順', () => {
    const alerts: Alert[] = [
      {
        id: 'old',
        user_id: 'u1',
        type: 'high_risk',
        priority: 'high',
        title: '',
        message: '',
        is_read: false,
        is_dismissed: false,
        created_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'new',
        user_id: 'u1',
        type: 'high_risk',
        priority: 'high',
        title: '',
        message: '',
        is_read: false,
        is_dismissed: false,
        created_at: '2026-03-01T00:00:00Z',
      },
    ];

    const sorted = sortAlertsByPriority(alerts);
    expect(sorted[0].id).toBe('new');
    expect(sorted[1].id).toBe('old');
  });
});

describe('getAlertStyle', () => {
  it('high → red系', () => {
    const style = getAlertStyle({ priority: 'high' } as Alert);
    expect(style.bgColor).toContain('red');
  });

  it('medium → yellow系', () => {
    const style = getAlertStyle({ priority: 'medium' } as Alert);
    expect(style.bgColor).toContain('yellow');
  });

  it('low → blue系', () => {
    const style = getAlertStyle({ priority: 'low' } as Alert);
    expect(style.bgColor).toContain('blue');
  });
});

describe('getAlertTypeLabel', () => {
  it('各タイプの日本語ラベル', () => {
    expect(getAlertTypeLabel('high_risk')).toBe('高リスク');
    expect(getAlertTypeLabel('caution')).toBe('注意');
    expect(getAlertTypeLabel('low_load')).toBe('低負荷');
    expect(getAlertTypeLabel('no_data')).toBe('データなし');
    expect(getAlertTypeLabel('reminder')).toBe('リマインダー');
    expect(getAlertTypeLabel('srpe_high')).toBe('高負荷（sRPE）');
    expect(getAlertTypeLabel('srpe_spike')).toBe('急増（sRPE）');
  });
});
