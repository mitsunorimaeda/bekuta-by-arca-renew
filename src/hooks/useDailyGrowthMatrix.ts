// src/hooks/useDailyGrowthMatrix.ts
import { useEffect, useMemo, useRef, useState } from 'react';
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

type AthleteLite = {
  id: string;
  name?: string | null;
  nickname?: string | null;
  email?: string | null;
};

export function useDailyGrowthMatrix(params: { date: string; athletes: AthleteLite[] }) {
  const { date, athletes } = params;

  const [points, setPoints] = useState<MatrixPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ✅ 依存安定化：配列を直接 useEffect に入れないためのキー
  const athletesKey = useMemo(() => {
    if (!Array.isArray(athletes) || athletes.length === 0) return '';
    return athletes
      .map((a) => {
        const display = a.nickname || a.name || a.email || '名前未設定';
        return `${a.id}:${display}`;
      })
      .sort()
      .join('|');
  }, [athletes]);

  const idsKey = useMemo(() => {
    if (!Array.isArray(athletes) || athletes.length === 0) return '';
    return athletes
      .map((a) => a.id)
      .filter(Boolean)
      .sort()
      .join(',');
  }, [athletes]);

  const ids = useMemo(() => {
    if (!idsKey) return [];
    return idsKey.split(',').filter(Boolean);
  }, [idsKey]);

  const nameMap = useMemo(() => {
    const m: Record<string, string> = {};
    if (!athletesKey) return m;

    // athletesKey から復元（順序安定）
    for (const token of athletesKey.split('|')) {
      const [id, ...rest] = token.split(':');
      const display = rest.join(':') || '名前未設定';
      if (id) m[id] = display;
    }
    return m;
  }, [athletesKey]);

  // ✅ 古いリクエスト結果を捨てる
  const reqSeqRef = useRef(0);

  useEffect(() => {
    if (!date || ids.length === 0) {
      setPoints([]);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const reqSeq = ++reqSeqRef.current;

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
        if (reqSeq !== reqSeqRef.current) return; // ✅ 後発が走ってたら捨てる

        // ✅ 同日に複数レコードがあっても user_id ごとに平均して1点にまとめる
        const acc = new Map<
          string,
          { sumX: number; sumY: number; sumLoad: number; sumRpe: number; sumDur: number; n: number }
        >();

        for (const r of rows) {
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
          const dur = clamp(Number(r.duration_min) || 0, 0, 100000);

          const cur = acc.get(r.user_id) ?? {
            sumX: 0,
            sumY: 0,
            sumLoad: 0,
            sumRpe: 0,
            sumDur: 0,
            n: 0,
          };
          cur.sumX += x;
          cur.sumY += y;
          cur.sumLoad += load;
          cur.sumRpe += rpe;
          cur.sumDur += dur;
          cur.n += 1;
          acc.set(r.user_id, cur);
        }

        const pts: MatrixPoint[] = Array.from(acc.entries()).map(([user_id, v]) => {
          const n = v.n || 1;
          return {
            user_id,
            name: nameMap[user_id] || '名前未設定',
            x: Math.round((v.sumX / n) * 10) / 10,
            y: Math.round((v.sumY / n) * 10) / 10,
            load: Math.round(v.sumLoad / n),
            rpe: Math.round((v.sumRpe / n) * 10) / 10,
            duration_min: Math.round(v.sumDur / n),
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
    // ✅ 依存は “安定キー” のみ
  }, [date, idsKey, athletesKey]);

  const teamAvg = useMemo(() => {
    if (!points || points.length === 0) return null;
    const mean = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    return {
      x: mean(points.map((p) => p.x)),
      y: mean(points.map((p) => p.y)),
      load: mean(points.map((p) => p.load)),
    };
  }, [points]);

  return { points, teamAvg, loading, error };
}