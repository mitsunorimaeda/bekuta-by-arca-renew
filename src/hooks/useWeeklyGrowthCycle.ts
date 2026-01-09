import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

type TrainingRow = {
  user_id: string;
  date: string; // YYYY-MM-DD
  rpe: number;
  duration_min: number;
  load: number | null;
  growth_vector: number | null;
  intent_signal: number | null;
  arrow_score: number | null;
  signal_score: number | null;
};

export type DailyCyclePoint = {
  date: string;
  x: number; // understanding avg (0-100)
  y: number; // growth avg (0-100)
  load: number; // load avg (sRPE)
  rpe: number; // rpe avg
  n: number; // record count
};

const chunk = <T,>(arr: T[], size: number) => {
  const res: T[][] = [];
  for (let i = 0; i < arr.length; i += size) res.push(arr.slice(i, i + size));
  return res;
};

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

const avg = (sum: number, n: number) => (n > 0 ? sum / n : 0);

// JST前提で「指定日を含む週（月〜日）」の範囲を返す
function getWeekRangeFromDateKey(dateKey: string) {
  // "YYYY-MM-DD" -> Date (JSTとして扱うため +09:00 を付与)
  const d = new Date(`${dateKey}T00:00:00+09:00`);
  const day = d.getDay(); // 0 Sun ... 6 Sat
  const diffToMon = (day + 6) % 7; // Mon=0
  const mon = new Date(d);
  mon.setDate(d.getDate() - diffToMon);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);

  const toKey = (x: Date) =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(x);

  return { start: toKey(mon), end: toKey(sun) };
}

export function useWeeklyGrowthCycle(params: {
  baseDate: string; // date input
  athleteIds: string[];
}) {
  const { baseDate, athleteIds } = params;

  const [teamDaily, setTeamDaily] = useState<DailyCyclePoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const weekRange = useMemo(() => {
    if (!baseDate) return { start: '', end: '' };
    return getWeekRangeFromDateKey(baseDate);
  }, [baseDate]);

  useEffect(() => {
    if (!weekRange.start || !weekRange.end) {
      setTeamDaily([]);
      setLoading(false);
      setError(null);
      return;
    }
    if (!athleteIds || athleteIds.length === 0) {
      setTeamDaily([]);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const all: TrainingRow[] = [];
        for (const ids of chunk(athleteIds, 50)) {
          const { data, error } = await supabase
            .from('training_records')
            .select(
              'user_id,date,rpe,duration_min,load,growth_vector,intent_signal,arrow_score,signal_score'
            )
            .in('user_id', ids)
            .gte('date', weekRange.start)
            .lte('date', weekRange.end);

          if (error) throw error;
          all.push(...((data ?? []) as TrainingRow[]));
        }

        if (cancelled) return;

        // 日別に平均化
        const map = new Map<
          string,
          { sumX: number; sumY: number; sumLoad: number; sumRpe: number; n: number }
        >();

        for (const r of all) {
          const xRaw = (r.intent_signal ?? r.signal_score ?? 50) as number;
          const yRaw = (r.growth_vector ?? r.arrow_score ?? 50) as number;
          const loadRaw =
            typeof r.load === 'number' && isFinite(r.load)
              ? r.load
              : (r.rpe ?? 0) * (r.duration_min ?? 0);

          const x = clamp(Number(xRaw) || 50, 0, 100);
          const y = clamp(Number(yRaw) || 50, 0, 100);
          const load = clamp(Number(loadRaw) || 0, 0, 999999);
          const rpe = clamp(Number(r.rpe) || 0, 0, 10);

          const key = r.date;
          const cur = map.get(key) ?? { sumX: 0, sumY: 0, sumLoad: 0, sumRpe: 0, n: 0 };
          cur.sumX += x;
          cur.sumY += y;
          cur.sumLoad += load;
          cur.sumRpe += rpe;
          cur.n += 1;
          map.set(key, cur);
        }

        // 週の7日を埋める（データなしの日も点として出したいならここで追加可）
        const days: string[] = [];
        {
          const start = new Date(`${weekRange.start}T00:00:00+09:00`);
          for (let i = 0; i < 7; i++) {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            const key = new Intl.DateTimeFormat('en-CA', {
              timeZone: 'Asia/Tokyo',
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
            }).format(d);
            days.push(key);
          }
        }

        const teamDailyPoints: DailyCyclePoint[] = days.map((date) => {
          const v = map.get(date);
          if (!v || v.n === 0) {
            return { date, x: 50, y: 50, load: 0, rpe: 0, n: 0 }; // データなし日は中央に置く（n=0で見分け可）
          }
          return {
            date,
            x: Math.round(avg(v.sumX, v.n) * 10) / 10,
            y: Math.round(avg(v.sumY, v.n) * 10) / 10,
            load: Math.round(avg(v.sumLoad, v.n)),
            rpe: Math.round(avg(v.sumRpe, v.n) * 10) / 10,
            n: v.n,
          };
        });

        setTeamDaily(teamDailyPoints);
      } catch (e: any) {
        console.error('[useWeeklyGrowthCycle] error', e);
        if (!cancelled) {
          setError(e?.message ?? '週データ取得に失敗しました');
          setTeamDaily([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [weekRange.start, weekRange.end, athleteIds]);

  return { weekRange, teamDaily, loading, error };
}