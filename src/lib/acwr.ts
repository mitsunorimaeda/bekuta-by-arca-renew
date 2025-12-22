// src/lib/acwr.ts

export type RecordLike = {
  date: string;        // YYYY-MM-DD
  load: number | null; // 1日あたりの負荷（sRPE等）
};

export type RiskLevel =
  | 'high'
  | 'caution'
  | 'good'
  | 'low'
  | 'unknown';

export type ACWRData = {
  date: string;                 // YYYY-MM-DD
  acwr: number | null;
  acuteLoad: number | null;
  chronicLoad: number | null;
  riskLevel?: RiskLevel;
};

// -------------------------
// Date helpers (UTC固定：YYYY-MM-DDのズレ対策)
// -------------------------
function parseISODateOnlyUTC(iso: string): Date {
  // iso: YYYY-MM-DD
  const [y, m, d] = iso.split('-').map((v) => Number(v));
  // UTCの00:00:00として扱う
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
}

function toISOUTC(d: Date) {
  return d.toISOString().slice(0, 10);
}

function addDaysUTC(d: Date, n: number) {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

// -------------------------
// Risk helpers
// -------------------------
export function getRiskLabel(riskLevel: RiskLevel | string | undefined): string {
  switch (riskLevel) {
    case 'high': return '高リスク';
    case 'caution': return '注意';
    case 'good': return '良好';
    case 'low': return '低負荷';
    default: return '不明';
  }
}

// ✅ Chart/表示用：acwr数値でもriskLevelでもOK
export function getRiskColor(v: number | null | undefined | RiskLevel): string {
  // riskLevel 文字列で来た場合
  if (typeof v === 'string') {
    switch (v) {
      case 'high': return '#ef4444';    // red
      case 'caution': return '#f59e0b'; // amber
      case 'good': return '#22c55e';    // green
      case 'low': return '#3b82f6';     // blue
      default: return '#94a3b8';        // gray
    }
  }

  // acwr 数値で来た場合
  const acwr = v;
  if (acwr == null || !Number.isFinite(acwr)) return '#94a3b8'; // gray
  if (acwr > 1.5) return '#ef4444'; // red
  if (acwr >= 1.3) return '#f59e0b'; // amber
  if (acwr >= 0.8) return '#22c55e'; // green
  return '#3b82f6'; // blue
}

// -------------------------
// ACWR calc
// -------------------------
export function calculateACWR(records: RecordLike[]): ACWRData[] {
  // 1) 日別に合算
  const dailyMap = new Map<string, number>();
  for (const r of records) {
    if (!r?.date) continue;
    const load = typeof r.load === 'number' && Number.isFinite(r.load) ? r.load : 0;
    dailyMap.set(r.date, (dailyMap.get(r.date) ?? 0) + load);
  }

  const dates = Array.from(dailyMap.keys()).sort();
  if (dates.length === 0) return [];

  // 2) 連続日付を生成（空白日は0）※UTC固定
  const start = parseISODateOnlyUTC(dates[0]);
  const end = parseISODateOnlyUTC(dates[dates.length - 1]);

  const series: { date: string; load: number }[] = [];
  for (let d = start; d <= end; d = addDaysUTC(d, 1)) {
    const key = toISOUTC(d);
    series.push({ date: key, load: dailyMap.get(key) ?? 0 });
  }

  // 3) rolling計算（急性=直近7日合計, 慢性=過去28日合計/4）
  const out: ACWRData[] = [];

  for (let i = 0; i < series.length; i++) {
    const date = series[i].date;

    // ★重要：28日（0〜27）揃うまで計算しない
    if (i < 27) {
      out.push({ date, acwr: null, acuteLoad: null, chronicLoad: null, riskLevel: 'unknown' });
      continue;
    }

    const acuteSum = series.slice(i - 6, i + 1).reduce((s, x) => s + x.load, 0);
    const chronicSum = series.slice(i - 27, i + 1).reduce((s, x) => s + x.load, 0);
    const chronic = chronicSum / 4; // 4週平均（週負荷の平均）

    const acwr = chronic > 0 ? acuteSum / chronic : null;
    const acwrVal = acwr != null ? Number(acwr.toFixed(2)) : null;

    const riskLevel: RiskLevel =
      acwrVal == null ? 'unknown' :
      acwrVal > 1.5 ? 'high' :
      acwrVal >= 1.3 ? 'caution' :
      acwrVal >= 0.8 ? 'good' : 'low';

    out.push({
      date,
      acuteLoad: Number(acuteSum.toFixed(1)),
      chronicLoad: chronic > 0 ? Number(chronic.toFixed(1)) : null,
      acwr: acwrVal,
      riskLevel,
    });
  }

  return out;
}