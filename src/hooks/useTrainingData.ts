// src/hooks/useTrainingData.ts
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase, TrainingRecord, WeightRecord } from "../lib/supabase";
import { calculateACWR, ACWRData, RecordLike } from "../lib/acwr";
import { logEvent } from "../lib/logEvent";

type TrainingUpsertPayload = {
  rpe: number;
  duration_min: number;
  date: string; // "YYYY-MM-DD" or ISO string
  arrow_score: number;
  signal_score: number;
};

/**
 * DBの training_records.date の型に合わせる
 * - 'date'        : "YYYY-MM-DD"
 * - 'timestamptz' : ISO
 */
const DATE_MODE: "date" | "timestamptz" = "date";

function toNumber(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function toYMD(input: string) {
  if (!input) return null;
  const m = String(input).match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

function jstDayRangeISO(ymd: string) {
  const startJST = new Date(`${ymd}T00:00:00+09:00`);
  const endJST = new Date(`${ymd}T23:59:59.999+09:00`);
  return {
    startISO: startJST.toISOString(),
    endISO: endJST.toISOString(),
  };
}

function toDbDateValue(input: string): string {
  const ymd = toYMD(input);
  if (!ymd) throw new Error("Invalid date");

  if (DATE_MODE === "date") return ymd;

  return jstDayRangeISO(ymd).startISO;
}

function toACWRDateKey(dbDate: any): string | null {
  if (!dbDate) return null;

  if (typeof dbDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dbDate)) return dbDate;

  const ymd = toYMD(String(dbDate));
  return ymd ?? null;
}

function sortByDateAsc(a: any, b: any) {
  const ad = String(a?.date ?? "");
  const bd = String(b?.date ?? "");
  return ad.localeCompare(bd);
}

function upsertLocalTrainingRecord(prev: TrainingRecord[], row: TrainingRecord) {
  const next = [...(prev || [])];
  const idx = next.findIndex((r) => r.id === row.id);
  if (idx >= 0) next[idx] = row;
  else next.push(row);
  next.sort(sortByDateAsc);
  return next;
}

function removeLocalTrainingRecord(prev: TrainingRecord[], recordId: string) {
  const next = (prev || []).filter((r) => r.id !== recordId);
  next.sort(sortByDateAsc);
  return next;
}

export function useTrainingData(userId: string) {
  const [trainingRecords, setTrainingRecords] = useState<TrainingRecord[]>([]);
  const [weightRecords, setWeightRecords] = useState<WeightRecord[]>([]);
  const [acwrData, setACWRData] = useState<ACWRData[]>([]);
  const [loading, setLoading] = useState(true);

  // ✅ DEVの時だけログを出す（本番は黙る）
  const DEBUG_FETCH = import.meta.env.DEV;

  // ✅ 連続fetch/多重fetch防止
  const inFlightRef = useRef(false);
  const lastFetchKeyRef = useRef<string | null>(null);

  // ✅ logEvent の呼び方が揺れても落ちないように吸収
  const safeLogEvent = useCallback(
    async (eventType: string, payload: Record<string, any>) => {
      await logEvent({ userId, eventType, payload });
    },
    [userId]
  );

  const fetchAll = useCallback(async () => {
    if (!userId) return;

    // 同一 userId で、同じマウント中に連打されても弾く（最低限）
    const fetchKey = `user:${userId}`;
    if (inFlightRef.current) return;
    if (lastFetchKeyRef.current === fetchKey && trainingRecords.length > 0) {
      // すでにデータ持ってるなら再取得しない（手動Refreshは別でやる想定）
      return;
    }

    inFlightRef.current = true;
    lastFetchKeyRef.current = fetchKey;

    if (DEBUG_FETCH) {
      console.log("[useTrainingData] fetchAll", { userId, at: new Date().toISOString() });
    }

    setLoading(true);
    try {
      const [trainingRes, weightRes] = await Promise.all([
        supabase
          .from("training_records")
          // 重ければ必要列だけに変えてOK（例: "id,user_id,date,rpe,duration_min,load,arrow_score,signal_score,created_at"）
          .select("*")
          .eq("user_id", userId)
          .order("date", { ascending: true }),

        supabase
          .from("weight_records")
          .select("*")
          .eq("user_id", userId)
          .order("date", { ascending: true }),
      ]);

      if (trainingRes.error) throw trainingRes.error;
      if (weightRes.error) throw weightRes.error;

      setTrainingRecords((trainingRes.data || []) as TrainingRecord[]);
      setWeightRecords((weightRes.data || []) as WeightRecord[]);
    } catch (error) {
      console.error("[useTrainingData] Error fetching data:", error);
      setTrainingRecords([]);
      setWeightRecords([]);
      setACWRData([]);
      // 失敗時は次回 fetchAll を許可
      lastFetchKeyRef.current = null;
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  }, [userId, DEBUG_FETCH, trainingRecords.length]);

  // userIdが決まったら1回
  useEffect(() => {
    if (!userId) return;
    fetchAll();
  }, [userId, fetchAll]);

  // ACWRを計算
  useEffect(() => {
    const normalized: RecordLike[] =
      (trainingRecords || [])
        .map((r: any) => {
          const date = toACWRDateKey(r?.date);
          if (!date) return null;

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

    setACWRData(calculateACWR(normalized));
  }, [trainingRecords]);

  const checkExistingRecord = useCallback(
    async (date: string): Promise<TrainingRecord | null> => {
      const ymd = toYMD(date);
      if (!ymd) return null;

      if (DATE_MODE === "date") {
        const { data, error } = await supabase
          .from("training_records")
          .select("*")
          .eq("user_id", userId)
          .eq("date", ymd)
          .maybeSingle();

        if (error) throw error;
        return data as TrainingRecord | null;
      }

      const { startISO, endISO } = jstDayRangeISO(ymd);

      const { data, error } = await supabase
        .from("training_records")
        .select("*")
        .eq("user_id", userId)
        .gte("date", startISO)
        .lte("date", endISO)
        .order("date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as TrainingRecord | null;
    },
    [userId]
  );

  const addTrainingRecord = useCallback(
    async (recordData: TrainingUpsertPayload) => {
      const ymd = toYMD(recordData.date);
      if (!ymd) throw new Error("Invalid date");

      const dbDate = toDbDateValue(recordData.date);

      const { data, error } = await supabase
        .from("training_records")
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

      setTrainingRecords((prev) => upsertLocalTrainingRecord(prev, data as TrainingRecord));

      await safeLogEvent("training_completed", {
        date: ymd,
        rpe: recordData.rpe,
        duration_min: recordData.duration_min,
        arrow_score: recordData.arrow_score,
        signal_score: recordData.signal_score,
        overwrite: false,
      });

      return data as TrainingRecord;
    },
    [userId, safeLogEvent]
  );

  const updateTrainingRecord = useCallback(
    async (
      recordId: string,
      recordData: Partial<Omit<TrainingUpsertPayload, "date">> & { date?: string }
    ) => {
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
        .from("training_records")
        .update(updatePayload)
        .eq("id", recordId)
        .eq("user_id", userId)
        .select()
        .single();

      if (error) throw error;

      setTrainingRecords((prev) => upsertLocalTrainingRecord(prev, data as TrainingRecord));

      const eventYmd = ymd ?? toACWRDateKey((data as any)?.date) ?? undefined;

      await safeLogEvent("training_completed", {
        date: eventYmd,
        rpe: recordData.rpe ?? (data as any)?.rpe,
        duration_min: recordData.duration_min ?? (data as any)?.duration_min,
        arrow_score: recordData.arrow_score ?? (data as any)?.arrow_score,
        signal_score: recordData.signal_score ?? (data as any)?.signal_score,
        overwrite: true,
      });

      return data as TrainingRecord;
    },
    [userId, safeLogEvent]
  );

  const deleteTrainingRecord = useCallback(
    async (recordId: string) => {
      const { error } = await supabase
        .from("training_records")
        .delete()
        .eq("id", recordId)
        .eq("user_id", userId);

      if (error) throw error;

      setTrainingRecords((prev) => removeLocalTrainingRecord(prev, recordId));
    },
    [userId]
  );

  return {
    records: trainingRecords,
    weightRecords,
    acwrData,
    loading,

    fetchAll,
    checkExistingRecord,
    addTrainingRecord,
    updateTrainingRecord,
    deleteTrainingRecord,
  };
}