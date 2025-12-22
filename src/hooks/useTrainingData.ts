// src/hooks/useTrainingData.ts
import { useState, useEffect, useCallback } from 'react';
import { supabase, TrainingRecord, WeightRecord } from '../lib/supabase';
import { calculateACWR, ACWRData, RecordLike } from '../lib/acwr';
import { logEvent } from '../lib/logEvent';

type TrainingUpsertPayload = {
  rpe: number;
  duration_min: number;
  date: string; // "YYYY-MM-DD" or ISO string
  arrow_score: number;
  signal_score: number;
};

/**
 * ✅ 重要：DBの training_records.date の型に合わせる
 * - 'date'        : DB列が date 型（"YYYY-MM-DD" を保存する運用）
 * - 'timestamptz' : DB列が timestamptz 型（ISOを保存する運用）
 *
 * どっちか分からない場合：
 * ひとまず 'date' でOK（今のあなたの insert/update が ymd なので）
 */
const DATE_MODE: 'date' | 'timestamptz' = 'date';

function toNumber(v: any): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function toYMD(input: string) {
  // "2025-12-22" / "2025-12-22T..." / ISO string 両対応で YYYY-MM-DD を抜く
  if (!input) return null;
  const m = String(input).match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

function jstDayRangeISO(ymd: string) {
  // ymd = "2025-12-22"
  const startJST = new Date(`${ymd}T00:00:00+09:00`);
  const endJST = new Date(`${ymd}T23:59:59.999+09:00`);
  return {
    startISO: startJST.toISOString(),
    endISO: endJST.toISOString(),
  };
}

// DBに保存する date 値を統一（DATE_MODEにより変化）
function toDbDateValue(input: string): string {
  const ymd = toYMD(input);
  if (!ymd) throw new Error('Invalid date');

  if (DATE_MODE === 'date') {
    // date型なら YYYY-MM-DD を保存
    return ymd;
  }

  // timestamptz型なら JSTの00:00をISOで保存（ズレに強い）
  return jstDayRangeISO(ymd).startISO;
}

// DBから取ってきた date を YYYY-MM-DD に正規化（ACWR計算用）
function toACWRDateKey(dbDate: any): string | null {
  if (!dbDate) return null;

  // すでに YYYY-MM-DD ならそのまま
  if (typeof dbDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dbDate)) return dbDate;

  // ISOやtimestampなら YYYY-MM-DD を抽出
  const ymd = toYMD(String(dbDate));
  return ymd ?? null;
}

export function useTrainingData(userId: string) {
  const [trainingRecords, setTrainingRecords] = useState<TrainingRecord[]>([]);
  const [weightRecords, setWeightRecords] = useState<WeightRecord[]>([]);
  const [acwrData, setACWRData] = useState<ACWRData[]>([]);
  const [loading, setLoading] = useState(true);

  // ✅ logEvent の呼び方が揺れても落ちないように吸収
  const safeLogEvent = useCallback(
    async (eventType: string, payload: Record<string, any>) => {
      try {
        // @ts-ignore
        await logEvent(eventType, payload);
        return;
      } catch (e1) {
        try {
          // @ts-ignore
          await logEvent({ userId, eventType, payload });
          return;
        } catch (e2) {
          console.warn('[safeLogEvent] failed:', e1, e2);
        }
      }
    },
    [userId]
  );

  const fetchAll = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    try {
      const [trainingRes, weightRes] = await Promise.all([
        supabase
          .from('training_records')
          .select('*')
          .eq('user_id', userId)
          .order('date', { ascending: true }),
        supabase
          .from('weight_records')
          .select('*')
          .eq('user_id', userId)
          .order('date', { ascending: true }),
      ]);

      if (trainingRes.error) throw trainingRes.error;
      if (weightRes.error) throw weightRes.error;

      setTrainingRecords((trainingRes.data || []) as TrainingRecord[]);
      setWeightRecords((weightRes.data || []) as WeightRecord[]);
    } catch (error) {
      console.error('[useTrainingData] Error fetching data:', error);
      setTrainingRecords([]);
      setWeightRecords([]);
      setACWRData([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    fetchAll();
  }, [userId, fetchAll]);

  // ✅ ACWRは RecordLike[]（date + load）に正規化してから計算する
  useEffect(() => {
    const normalized: RecordLike[] =
      (trainingRecords || [])
        .map((r: any) => {
          const date = toACWRDateKey(r?.date);
          if (!date) return null;

          // DBに load があるなら優先、無ければ rpe*duration_min を算出
          const loadRaw = toNumber(r?.load);
          const rpe = toNumber(r?.rpe);
          const duration = toNumber(r?.duration_min);

          const load =
            loadRaw != null
              ? loadRaw
              : rpe != null && duration != null
                ? rpe * duration
                : null;

          return { date, load };
        })
        .filter(Boolean) as RecordLike[];

    const calculated = calculateACWR(normalized);
    setACWRData(calculated);
  }, [trainingRecords]);

  const checkExistingRecord = useCallback(
    async (date: string): Promise<TrainingRecord | null> => {
      const ymd = toYMD(date);
      if (!ymd) return null;

      if (DATE_MODE === 'date') {
        const { data, error } = await supabase
          .from('training_records')
          .select('*')
          .eq('user_id', userId)
          .eq('date', ymd)
          .maybeSingle();

        if (error) {
          console.error('[checkExistingRecord][date]', error);
          throw error;
        }
        return data as TrainingRecord | null;
      }

      // timestamptz：JSTのその日の範囲で検索
      const { startISO, endISO } = jstDayRangeISO(ymd);

      const { data, error } = await supabase
        .from('training_records')
        .select('*')
        .eq('user_id', userId)
        .gte('date', startISO)
        .lte('date', endISO)
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('[checkExistingRecord][timestamptz]', error);
        throw error;
      }

      return data as TrainingRecord | null;
    },
    [userId]
  );

  const addTrainingRecord = useCallback(
    async (recordData: TrainingUpsertPayload) => {
      try {
        const ymd = toYMD(recordData.date);
        if (!ymd) throw new Error('Invalid date');

        const dbDate = toDbDateValue(recordData.date);

        const { data, error } = await supabase
          .from('training_records')
          .insert([
            {
              user_id: userId,
              date: dbDate,
              rpe: recordData.rpe,
              duration_min: recordData.duration_min,
              arrow_score: recordData.arrow_score,
              signal_score: recordData.signal_score,
            },
          ])
          .select()
          .single();

        if (error) throw error;

        await safeLogEvent('training_completed', {
          date: ymd, // ログはYYYY-MM-DDに統一
          rpe: recordData.rpe,
          duration_min: recordData.duration_min,
          arrow_score: recordData.arrow_score,
          signal_score: recordData.signal_score,
          overwrite: false,
        });

        await fetchAll();
        return data;
      } catch (error) {
        console.error('[useTrainingData] Error adding training record:', error);
        throw error;
      }
    },
    [userId, fetchAll, safeLogEvent]
  );

  const updateTrainingRecord = useCallback(
    async (
      recordId: string,
      recordData: Partial<Omit<TrainingUpsertPayload, 'date'>> & { date?: string }
    ) => {
      try {
        const ymd = recordData.date ? toYMD(recordData.date) : null;
        const dbDate = recordData.date ? toDbDateValue(recordData.date) : null;

        const updatePayload: Record<string, any> = {
          ...(recordData.rpe !== undefined ? { rpe: recordData.rpe } : {}),
          ...(recordData.duration_min !== undefined ? { duration_min: recordData.duration_min } : {}),
          ...(recordData.arrow_score !== undefined ? { arrow_score: recordData.arrow_score } : {}),
          ...(recordData.signal_score !== undefined ? { signal_score: recordData.signal_score } : {}),
          ...(dbDate ? { date: dbDate } : {}),
        };

        const { data, error } = await supabase
          .from('training_records')
          .update(updatePayload)
          .eq('id', recordId)
          .eq('user_id', userId)
          .select()
          .single();

        if (error) throw error;

        const eventYmd =
          ymd ?? toACWRDateKey((data as any)?.date) ?? undefined;

        await safeLogEvent('training_completed', {
          date: eventYmd,
          rpe: recordData.rpe ?? (data as any)?.rpe,
          duration_min: recordData.duration_min ?? (data as any)?.duration_min,
          arrow_score: recordData.arrow_score ?? (data as any)?.arrow_score,
          signal_score: recordData.signal_score ?? (data as any)?.signal_score,
          overwrite: true,
        });

        await fetchAll();
        return data;
      } catch (error) {
        console.error('[useTrainingData] Error updating training record:', error);
        throw error;
      }
    },
    [userId, fetchAll, safeLogEvent]
  );

  const deleteTrainingRecord = useCallback(
    async (recordId: string) => {
      try {
        const { error } = await supabase
          .from('training_records')
          .delete()
          .eq('id', recordId)
          .eq('user_id', userId);

        if (error) throw error;

        await fetchAll();
      } catch (error) {
        console.error('[useTrainingData] Error deleting training record:', error);
        throw error;
      }
    },
    [userId, fetchAll]
  );

  return {
    records: trainingRecords,
    weightRecords,
    acwrData,
    loading,
    checkExistingRecord,
    addTrainingRecord,
    updateTrainingRecord,
    deleteTrainingRecord,
  };
}