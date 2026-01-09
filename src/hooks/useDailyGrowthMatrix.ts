import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

type TrainingRow = {
  user_id: string;
  date: string;
  rpe: number;
  duration_min: number;
  load: number | null;
  growth_vector: number | null;
  intent_signal: number | null;
  arrow_score: number | null;
  signal_score: number | null;
};

export type MatrixPoint = {
  user_id: string;
  name: string;
  x: number; // understanding 0-100
  y: number; // growth 0-100
  load: number; // sRPE
  rpe: number;
  duration_min: number;
};

const chunk = <T,>(arr: T[], size: number) => {
  const res: T[][] = [];
  for (let i = 0; i < arr.length; i += size) res.push(arr.slice(i, i + size));
  return res;
};

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

export function useDailyGrowthMatrix(params: {
  date: string;
  athletes: { id: string; name?: string | null; nickname?: string | null; email?: string | null }[];
}) {
  const { date, athletes } = params;

  const [points, setPoints] = useState<MatrixPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const a of athletes) {
      m[a.id] = a.nickname || a.name || a.email || '名前未設定';
    }
    return m;
  }, [athletes]);

  useEffect(() => {
    const ids = athletes.map(a => a.id).filter(Boolean);
    if (!date || ids.length === 0) {
      setPoints([]);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const rows: TrainingRow[] = [];
        for (const idChunk of chunk(ids, 50)) {
          const { data, error } = await supabase
            .from('training_records')
            .select(
              'user_id,date,rpe,duration_min,load,growth_vector,intent_signal,arrow_score,signal_score'
            )
            .in('user_id', idChunk)
            .eq('date', date);

          if (error) throw error;
          rows.push(...((data ?? []) as TrainingRow[]));
        }

        if (cancelled) return;

        const pts: MatrixPoint[] = rows.map(r => {
          const xRaw = (r.intent_signal ?? r.signal_score ?? 50) as number;
          const yRaw = (r.growth_vector ?? r.arrow_score ?? 50) as number;

          // load は generated だけど念のためフォールバック
          const loadRaw =
            typeof r.load === 'number'
              ? r.load
              : (r.rpe ?? 0) * (r.duration_min ?? 0);

          return {
            user_id: r.user_id,
            name: nameMap[r.user_id] || '名前未設定',
            x: clamp(Number(xRaw) || 50, 0, 100),
            y: clamp(Number(yRaw) || 50, 0, 100),
            load: clamp(Number(loadRaw) || 0, 0, 999999),
            rpe: r.rpe ?? 0,
            duration_min: r.duration_min ?? 0,
          };
        });

        setPoints(pts);
      } catch (e: any) {
        console.error('[useDailyGrowthMatrix] error', e);
        if (!cancelled) {
          setError(e?.message ?? '取得に失敗しました');
          setPoints([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [date, athletes, nameMap]);

  const teamAvg = useMemo(() => {
    if (!points || points.length === 0) return null;

    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

    return {
      x: avg(points.map(p => p.x)),
      y: avg(points.map(p => p.y)),
      load: avg(points.map(p => p.load)),
    };
  }, [points]);

  return { points, teamAvg, loading, error };
}