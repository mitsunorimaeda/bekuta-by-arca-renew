import { useMemo } from 'react';
import { toJSTDateString } from '../lib/date';

type Dated = { date: string | null | undefined };
type TrainingRecord = {
  date: string | null | undefined;
  rpe: number | null | undefined;
  duration_min: number | null | undefined;
  load?: number | null;
};

function isValidYMD(dateStr: unknown): dateStr is string {
  // ざっくり YYYY-MM-DD のみ許可（ズレた形式で new Date が壊れるのを防ぐ）
  return typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
}

function safeTime(dateStr: string | null | undefined): number | null {
  if (!isValidYMD(dateStr)) return null;
  const t = new Date(dateStr).getTime();
  return Number.isFinite(t) ? t : null;
}

export function useAthleteDerivedValues(params: {
  trainingRecords?: TrainingRecord[];
  sleepRecords?: Dated[];
  motivationRecords?: Dated[];
}) {
  const trainingRecords = params.trainingRecords ?? [];
  const sleepRecords = params.sleepRecords ?? [];
  const motivationRecords = params.motivationRecords ?? [];

  const lastTrainingRecord = useMemo(() => {
    let best: TrainingRecord | null = null;
    let bestT = -Infinity;

    for (const r of trainingRecords) {
      const t = safeTime(r?.date);
      if (t === null) continue;
      if (!best || t > bestT) {
        best = r;
        bestT = t;
      }
    }
    return best;
  }, [trainingRecords]);

  const lastSleepRecord = useMemo(() => {
    let best: Dated | null = null;
    let bestT = -Infinity;

    for (const r of sleepRecords) {
      const t = safeTime(r?.date);
      if (t === null) continue;
      if (!best || t > bestT) {
        best = r;
        bestT = t;
      }
    }
    return best;
  }, [sleepRecords]);

  const lastMotivationRecord = useMemo(() => {
    let best: Dated | null = null;
    let bestT = -Infinity;

    for (const r of motivationRecords) {
      const t = safeTime(r?.date);
      if (t === null) continue;
      if (!best || t > bestT) {
        best = r;
        bestT = t;
      }
    }
    return best;
  }, [motivationRecords]);

  const daysWithTrainingData = useMemo(() => {
    const s = new Set<string>();
    for (const r of trainingRecords) {
      if (isValidYMD(r?.date)) s.add(r.date);
    }
    return s.size;
  }, [trainingRecords]);

  const consecutiveTrainingDays = useMemo(() => {
    if (!trainingRecords.length) return 0;

    const dateSet = new Set<string>();
    for (const r of trainingRecords) {
      if (isValidYMD(r?.date)) dateSet.add(r.date);
    }
    if (dateSet.size === 0) return 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let consecutive = 0;
    const cur = new Date(today);

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
    lastSleepRecord,
    lastMotivationRecord,
    daysWithTrainingData,
    consecutiveTrainingDays,
    weeklyAverage,
  };
}