// supabase/functions/alert-daily-summary/_acwr.ts

export const MIN_DAYS_FOR_ACWR = 21;

export type TrainingRecord = {
  user_id: string;
  date: string;          // "YYYY-MM-DD"
  rpe: number | null;
  duration_min: number | null;
  load?: number | null;
};

export type ACWRPoint = {
  date: string;
  acwr: number;
  acuteLoad: number;
  chronicLoad: number;
  hasEnoughDays: boolean;
  lastTrainingDate: string;
  daysSinceLastTraining: number;
};

// 日付文字列をDateに
function toDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map((x) => Number(x));
  return new Date(Date.UTC(y, m - 1, d));
}

// JST日付 "YYYY-MM-DD"
function formatJstDate(d: Date): string {
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const day = String(jst.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * training_records から ACWR の時系列を計算
 * - sRPE = RPE × duration_min
 * - acuteLoad = 直近7日間の合計
 * - chronicLoad = 直近28日間の合計を4で割った「週平均負荷」
 * - ACWR = acuteLoad / chronicLoad
 */
export function calculateACWRSeries(
  records: TrainingRecord[],
): ACWRPoint[] {
  if (!records || records.length === 0) return [];

  // 日付順にソート
  const sorted = [...records].sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  // 日別の負荷を集計
  const dailyMap = new Map<string, number>();
  for (const rec of sorted) {
    const date = rec.date;
    const baseLoad =
      rec.load ??
      ((rec.rpe ?? 0) * (rec.duration_min ?? 0));

    if (!dailyMap.has(date)) {
      dailyMap.set(date, 0);
    }
    dailyMap.set(date, (dailyMap.get(date) ?? 0) + baseLoad);
  }

  const dates = Array.from(dailyMap.keys()).sort();
  const today = new Date();
  const lastTrainingDate = dates[dates.length - 1];
  const daysSinceLastTraining = Math.floor(
    (today.getTime() - toDate(lastTrainingDate).getTime()) /
      (1000 * 60 * 60 * 24),
  );

  const result: ACWRPoint[] = [];

  for (let i = 0; i < dates.length; i++) {
    const currentDate = dates[i];
    const current = toDate(currentDate);

    // 直近7日（acute）
    const acuteStart = new Date(
      current.getTime() - 6 * 24 * 60 * 60 * 1000,
    );
    let acuteLoad = 0;

    // 直近28日（chronic集計用）
    const chronicStart = new Date(
      current.getTime() - 27 * 24 * 60 * 60 * 1000,
    );
    let chronicSum = 0;

    for (const d of dates) {
      const dd = toDate(d);
      const load = dailyMap.get(d) ?? 0;
      if (dd >= acuteStart && dd <= current) {
        acuteLoad += load;
      }
      if (dd >= chronicStart && dd <= current) {
        chronicSum += load;
      }
    }

    // chronicLoad = 28日分の合計 / 4（週平均負荷）
    const chronicLoad = chronicSum > 0 ? chronicSum / 4 : 0;
    const acwr =
      chronicLoad > 0 ? acuteLoad / chronicLoad : 0;

    // データ開始日から何日たっているか
    const firstDate = toDate(dates[0]);
    const diffDays = Math.floor(
      (current.getTime() - firstDate.getTime()) /
        (1000 * 60 * 60 * 24),
    );
    const hasEnoughDays = diffDays + 1 >= MIN_DAYS_FOR_ACWR;

    result.push({
      date: currentDate,
      acwr,
      acuteLoad,
      chronicLoad,
      hasEnoughDays,
      lastTrainingDate,
      daysSinceLastTraining,
    });
  }

  return result;
}