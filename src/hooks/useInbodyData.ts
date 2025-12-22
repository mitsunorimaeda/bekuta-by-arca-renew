// src/hooks/useInbodyData.ts
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';

type InbodyRow = Database['public']['Tables']['inbody_records']['Row'];

export type InbodyRecordLite = {
  id: string;
  measured_at: string; // 'YYYY-MM-DD' 想定（多少崩れても Date で判定）
  height: number | null;
  weight: number | null;
  body_fat_percent: number | null;

  // ✅ 追加（表示で使う）
  fat_mass: number | null;       // 体脂肪量(kg)
  fat_free_mass: number | null;  // 除脂肪量(kg)
};

function toNumber(v: any): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toDateValue(measured_at: string): number {
  // 'YYYY-MM-DD' or 'YYYY/MM/DD' などでもパースできるようにする
  const s = String(measured_at || '').trim();
  if (!s) return 0;

  // 明示的に "T00:00:00" を付けてローカルズレを減らす
  const normalized = s.includes('T') ? s : s.replace(/\//g, '-');
  const dt = new Date(normalized + (normalized.includes('T') ? '' : 'T00:00:00'));
  const t = dt.getTime();
  return Number.isFinite(t) ? t : 0;
}

function calcFatMass(weight: number | null, pbf: number | null) {
  if (weight == null || pbf == null) return null;
  const v = weight * (pbf / 100);
  return Number.isFinite(v) ? v : null;
}

function calcFFM(weight: number | null, fatMass: number | null) {
  if (weight == null || fatMass == null) return null;
  const v = weight - fatMass;
  return Number.isFinite(v) ? v : null;
}

export function useInbodyData(userId: string | null | undefined) {
  const [records, setRecords] = useState<InbodyRecordLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ✅ 最新判定：文字列比較ではなく Date 比較に変更
  const latest = useMemo(() => {
    if (records.length === 0) return null;
    return records.reduce<InbodyRecordLite | null>((acc, r) => {
      if (!acc) return r;
      return toDateValue(r.measured_at) > toDateValue(acc.measured_at) ? r : acc;
    }, null);
  }, [records]);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error } = await supabase
          .from('inbody_records')
          .select('id, measured_at, height, weight, body_fat_percent, user_id')
          .eq('user_id', userId)
          .order('measured_at', { ascending: true });

        if (error) throw error;
        if (cancelled) return;

        const normalized: InbodyRecordLite[] = (data ?? []).map((r: InbodyRow) => {
          const height = toNumber((r as any).height);
          const weight = toNumber((r as any).weight);
          const pbf = toNumber((r as any).body_fat_percent);

          const fatMass = calcFatMass(weight, pbf);
          const ffm = calcFFM(weight, fatMass);

          return {
            id: (r as any).id,
            measured_at: String((r as any).measured_at),
            height,
            weight,
            body_fat_percent: pbf,
            fat_mass: fatMass,
            fat_free_mass: ffm,
          };
        });

        setRecords(normalized);
      } catch (e: any) {
        console.error('[useInbodyData]', e);
        setError(e?.message ?? 'InBodyデータの取得に失敗しました');
        setRecords([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { records, latest, loading, error };
}