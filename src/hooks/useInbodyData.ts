// src/hooks/useInbodyData.ts
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';

type InbodyRow = Database['public']['Tables']['inbody_records']['Row'];

export type InbodyRecordLite = {
  id: string;
  measured_at: string; // 'YYYY-MM-DD'
  height: number | null;
  weight: number | null;
  body_fat_percent: number | null;
};

function toNumber(v: any): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function useInbodyData(userId: string | null | undefined) {
  const [records, setRecords] = useState<InbodyRecordLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const latest = useMemo(() => {
    if (records.length === 0) return null;
    return records.reduce((acc, r) => (!acc || r.measured_at > acc.measured_at ? r : acc), null as any);
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
          .select('id, measured_at, height, weight, body_fat_percent')
          .eq('user_id', userId)
          .order('measured_at', { ascending: true });

        if (error) throw error;
        if (cancelled) return;

        const normalized = (data ?? []).map((r: InbodyRow) => ({
          id: r.id,
          measured_at: String(r.measured_at),
          height: toNumber(r.height),
          weight: toNumber(r.weight),
          body_fat_percent: toNumber(r.body_fat_percent),
        }));

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