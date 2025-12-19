// src/lib/acwr.ts
type RecordLike = {
  date: string;        // YYYY-MM-DD
  load: number | null; // 1日あたりの負荷（sRPE等）
};

function toISO(d: Date) {
  return d.toISOString().slice(0, 10);
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function calculateACWR(records: RecordLike[]) {
  // 1) 日別に合算
  const dailyMap = new Map<string, number>();
  for (const r of records) {
    if (!r?.date) continue;
    const load = typeof r.load === 'number' && isFinite(r.load) ? r.load : 0;
    dailyMap.set(r.date, (dailyMap.get(r.date) ?? 0) + load);
  }

  const dates = Array.from(dailyMap.keys()).sort();
  if (dates.length === 0) return [];

  // 2) 連続日付を生成（空白日は0）
  const start = new Date(dates[0]);
  const end = new Date(dates[dates.length - 1]);

  const series: { date: string; load: number }[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const key = toISO(d);
    series.push({ date: key, load: dailyMap.get(key) ?? 0 });
  }

  // 3) rolling計算（急性=直近7日合計, 慢性=過去28日合計/4）
  const out: any[] = [];
  for (let i = 0; i < series.length; i++) {
    const date = series[i].date;

    // ★ここが重要：21日分揃うまで “計算しない”
    if (i < 20) {
      out.push({ date, acwr: null, acuteLoad: null, chronicLoad: null });
      continue;
    }

    const acuteSum = series.slice(i - 6, i + 1).reduce((s, x) => s + x.load, 0);
    const chronicSum = series.slice(i - 27, i + 1).reduce((s, x) => s + x.load, 0);
    const chronic = chronicSum / 4; // 4週平均（週負荷の平均）

    const acwr = chronic > 0 ? acuteSum / chronic : null;

    out.push({
      date,
      acuteLoad: Number(acuteSum.toFixed(1)),
      chronicLoad: chronic > 0 ? Number(chronic.toFixed(1)) : null,
      acwr: acwr != null ? Number(acwr.toFixed(2)) : null,
    });
  }

  return out;
}