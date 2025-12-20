// src/hooks/useAthleteDerivedValues.ts
import { useMemo } from 'react';
import { toJSTDateString } from '../lib/date';

// ====== Types (軽量: DB Row っぽい shape を受ける想定) ======
type TrainingRecord = {
  date: string | null | undefined;
  rpe: number | null | undefined;
  duration_min: number | null | undefined;
  load?: number | null | undefined;
};

type WeightRecord = {
  date: string | null | undefined;
  weight_kg?: string | number | null | undefined;
};

type SleepRecord = {
  date: string | null | undefined;
  sleep_hours?: string | number | null | undefined; // "7.00" 対応
  sleep_quality?: number | null | undefined;
  bedtime?: string | null | undefined;
  waketime?: string | null | undefined;
  notes?: string | null | undefined;
};

type MotivationRecord = {
  date: string | null | undefined;
  motivation?: number | null | undefined;
  motivation_level?: number | null | undefined;
  notes?: string | null | undefined;
};

function isValidYMD(dateStr: unknown): dateStr is string {
  return typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
}

function safeTime(dateStr: string | null | undefined): number | null {
  if (!isValidYMD(dateStr)) return null;
  const t = new Date(dateStr).getTime();
  return Number.isFinite(t) ? t : null;
}

// ✅ 共通：最新レコードを返す
function pickLatestByDate<T extends { date: string | null | undefined }>(items: T[]): T | null {
  let best: T | null = null;
  let bestT = -Infinity;

  for (const r of items) {
    const t = safeTime(r?.date);
    if (t === null) continue;
    if (!best || t > bestT) {
      best = r;
      bestT = t;
    }
  }
  return best;
}

export function useAthleteDerivedValues(params: {
  trainingRecords?: TrainingRecord[];
  weightRecords?: WeightRecord[];
  sleepRecords?: SleepRecord[];
  motivationRecords?: MotivationRecord[];
}) {
  const trainingRecords = params.trainingRecords ?? [];
  const weightRecords = params.weightRecords ?? [];
  const sleepRecords = params.sleepRecords ?? [];
  const motivationRecords = params.motivationRecords ?? [];

  const lastTrainingRecord = useMemo(() => pickLatestByDate(trainingRecords), [trainingRecords]);
  const lastWeightRecord = useMemo(() => pickLatestByDate(weightRecords), [weightRecords]);
  const lastSleepRecord = useMemo(() => pickLatestByDate(sleepRecords), [sleepRecords]);
  const lastMotivationRecord = useMemo(() => pickLatestByDate(motivationRecords), [motivationRecords]);

  const daysWithTrainingData = useMemo(() => {
    const s = new Set<string>();
    for (const r of trainingRecords) {
      if (isValidYMD(r?.date)) s.add(r.date);
    }
    return s.size;
  }, [trainingRecords]);

  const consecutiveTrainingDays = useMemo(() => {
    const dateSet = new Set<string>();
    for (const r of trainingRecords) {
      if (isValidYMD(r?.date)) dateSet.add(r.date);
    }
    if (dateSet.size === 0) return 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // ✅ 今日に記録が無ければ「昨日」から
    const start = new Date(today);
    const todayStr = toJSTDateString(start);
    if (!dateSet.has(todayStr)) start.setDate(start.getDate() - 1);

    let consecutive = 0;
    const cur = new Date(start);

    for (let i = 0; i < 365; i++) {
      const dateStr = toJSTDateString(cur);
      if (dateSet.has(dateStr)) {
        consecutive++;
        cur.setDate(cur.getDate() - 1);
      } else {
        break;
      }
    }
    return consecutive;
  }, [trainingRecords]);

  const weeklyAverage = useMemo(() => {
    if (!trainingRecords.length) return null;

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const oneWeekAgoT = oneWeekAgo.getTime();

    let n = 0;
    let totalRpe = 0;
    let totalDuration = 0;
    let totalLoad = 0;

    for (const r of trainingRecords) {
      const t = safeTime(r?.date);
      if (t === null) continue;
      if (t < oneWeekAgoT) continue;

      n++;
      totalRpe += Number.isFinite(Number(r.rpe)) ? Number(r.rpe) : 0;
      totalDuration += Number.isFinite(Number(r.duration_min)) ? Number(r.duration_min) : 0;
      totalLoad += Number.isFinite(Number(r.load)) ? Number(r.load) : 0;
    }

    if (n === 0) return null;

    return {
      rpe: totalRpe / n,
      duration: totalDuration / n,
      load: totalLoad / n,
    };
  }, [trainingRecords]);

  return {
    lastTrainingRecord,
    lastWeightRecord,
    lastSleepRecord,
    lastMotivationRecord,
    daysWithTrainingData,
    consecutiveTrainingDays,
    weeklyAverage,
  };
}