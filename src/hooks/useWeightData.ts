// src/hooks/useWeightData.ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Database } from '../lib/database.types';

type WeightRecord = Database['public']['Tables']['weight_records']['Row'];
type WeightInsert = Database['public']['Tables']['weight_records']['Insert'];
type WeightUpdate = Database['public']['Tables']['weight_records']['Update'];

/**
 * YYYY-MM-DD / YYYY/MM/DD / YYYY-MM-DDTHH:mm:ss... を安全に Date(ローカル)へ
 * 例: '2025-01-04' -> new Date(2025,0,4)
 */
function parseYMDLocal(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;

  // まずは先頭10文字を狙う（YYYY-MM-DD）
  const head = String(dateStr).slice(0, 10).replace(/\//g, '-'); // YYYY/MM/DD -> YYYY-MM-DD
  const m = head.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    if (Number.isFinite(y) && Number.isFinite(mo) && Number.isFinite(d)) {
      return new Date(y, mo - 1, d); // ローカル
    }
  }

  // フォールバック（ISOっぽい文字列など）
  const t = new Date(String(dateStr)).getTime();
  if (Number.isFinite(t)) return new Date(t);

  return null;
}

function toDateKey(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  // 'YYYY-MM-DD...' を 'YYYY-MM-DD' に寄せる
  return String(dateStr).slice(0, 10).replace(/\//g, '-');
}

function sortByDateDesc(a: WeightRecord, b: WeightRecord): number {
  const ka = toDateKey(a.date);
  const kb = toDateKey(b.date);

  // YYYY-MM-DDなら文字列比較で高速・安定
  if (ka && kb) return kb.localeCompare(ka);

  // フォールバック
  const da = parseYMDLocal(a.date)?.getTime() ?? 0;
  const db = parseYMDLocal(b.date)?.getTime() ?? 0;
  return db - da;
}

function sortByDateAsc(a: WeightRecord, b: WeightRecord): number {
  return -sortByDateDesc(a, b);
}

export function useWeightData(userId: string) {
  const [records, setRecords] = useState<WeightRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const normalizeAndSet = useCallback((rows: WeightRecord[]) => {
    // ここで必ず「最新→過去」へ正規化（表示・最新取得の安定化）
    const sorted = [...rows].sort(sortByDateDesc);
    setRecords(sorted);
  }, []);

  const fetchRecords = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // DBでも降順にしておく（ただし最終的にJS側で必ず正規化）
      const { data, error: fetchError } = await supabase
        .from('weight_records')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false });

      if (fetchError) throw fetchError;

      normalizeAndSet((data || []) as WeightRecord[]);
    } catch (err) {
      console.error('Error fetching weight records:', err);
      setError(err instanceof Error ? err.message : '体重記録の取得に失敗しました');
      normalizeAndSet([]);
    } finally {
      setLoading(false);
    }
  }, [userId, normalizeAndSet]);

  useEffect(() => {
    if (userId) fetchRecords();
  }, [userId, fetchRecords]);

  const checkExistingRecord = useCallback(
    async (date: string): Promise<WeightRecord | null> => {
      try {
        const key = toDateKey(date);

        const { data, error } = await supabase
          .from('weight_records')
          .select('*')
          .eq('user_id', userId)
          // dateが timestamp/iso の可能性がある場合は一致が崩れることがあるので注意
          // 現状はYMDで保存している前提でOK
          .eq('date', key)
          .maybeSingle();

        if (error) throw error;
        return (data as WeightRecord) ?? null;
      } catch (e) {
        console.error('Error checking existing record:', e);
        return null;
      }
    },
    [userId]
  );

  const addWeightRecord = useCallback(
    async (data: { weight_kg: number; date: string; notes?: string }) => {
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (!authData.user) throw new Error('認証が必要です');

        const insertData: WeightInsert = {
          user_id: authData.user.id,
          weight_kg: data.weight_kg,
          date: toDateKey(data.date),
          notes: data.notes || null,
        };

        const { data: newRecord, error: insertError } = await supabase
          .from('weight_records')
          .insert(insertData)
          .select()
          .single();

        if (insertError) throw insertError;

        setRecords((prev) => {
          const merged = [newRecord as WeightRecord, ...prev];
          return merged.sort(sortByDateDesc);
        });
      } catch (err) {
        console.error('Error adding weight record:', err);
        throw err;
      }
    },
    []
  );

  const updateWeightRecord = useCallback(
    async (id: string, data: { weight_kg: number; notes?: string }) => {
      try {
        const updateData: WeightUpdate = {
          weight_kg: data.weight_kg,
          notes: data.notes || null,
        };

        const { data: updatedRecord, error: updateError } = await supabase
          .from('weight_records')
          .update(updateData)
          .eq('id', id)
          .select()
          .single();

        if (updateError) throw updateError;

        setRecords((prev) => {
          const next = prev.map((r) => (r.id === id ? (updatedRecord as WeightRecord) : r));
          return next.sort(sortByDateDesc);
        });
      } catch (err) {
        console.error('Error updating weight record:', err);
        throw err;
      }
    },
    []
  );

  const deleteWeightRecord = useCallback(async (id: string) => {
    try {
      const { error: deleteError } = await supabase.from('weight_records').delete().eq('id', id);
      if (deleteError) throw deleteError;

      setRecords((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      console.error('Error deleting weight record:', err);
      throw err;
    }
  }, []);

  /**
   * ✅ 最新体重：records[0] 前提を捨てる（常に date 最大を採用）
   * （records は正規化済みだが、念のため max date で確実に）
   */
  const getLatestWeight = useCallback((): number | null => {
    if (!records || records.length === 0) return null;

    const latest = records.reduce((best, r) => {
      if (!best) return r;
      const kb = toDateKey(best.date);
      const kr = toDateKey(r.date);
      return kr > kb ? r : best;
    }, null as WeightRecord | null);

    const v = Number(latest?.weight_kg);
    return Number.isFinite(v) ? v : null;
  }, [records]);

  /**
   * ✅ 直近N日変化：タイムゾーンずれを避けてYMDローカルで比較
   */
  const getWeightChange = useCallback(
    (days: number = 30): number | null => {
      if (!records || records.length < 2) return null;

      const now = new Date();
      const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      cutoff.setDate(cutoff.getDate() - days);

      // 古い→新しいで比較
      const asc = [...records].sort(sortByDateAsc);

      const recent = asc.filter((r) => {
        const d = parseYMDLocal(r.date);
        return d ? d.getTime() >= cutoff.getTime() : false;
      });

      if (recent.length < 2) return null;

      const first = Number(recent[0].weight_kg);
      const last = Number(recent[recent.length - 1].weight_kg);

      if (!Number.isFinite(first) || !Number.isFinite(last)) return null;
      return last - first;
    },
    [records]
  );

  return {
    records, // 最新→過去 に正規化済み
    loading,
    error,
    checkExistingRecord,
    addWeightRecord,
    updateWeightRecord,
    deleteWeightRecord,
    getLatestWeight,
    getWeightChange,
    refresh: fetchRecords,
  };
}