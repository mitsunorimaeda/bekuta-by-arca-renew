// src/hooks/useTrainingData.ts
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase, TrainingRecord, WeightRecord } from "../lib/supabase";
import { logEvent } from "../lib/logEvent";

type TrainingUpsertPayload = {
  rpe: number;
  duration_min: number;
  date: string; // "YYYY-MM-DD" or ISO string
  arrow_score: number;
  signal_score: number;
};

type ACWRDailyRow = {
  user_id: string;
  date: string; // YYYY-MM-DD
  daily_load: number | string | null;
  acute_7d: number | string | null;
  chronic_28d: number | string | null;
  chronic_load: number | string | null;
  acwr: number | string | null;
  days_of_data: number | null;
  updated_at?: string | null;
};

/**
 * DBの training_records.date の型に合わせる
 * - 'date'        : "YYYY-MM-DD"
 * - 'timestamptz' : ISO
 */
const DATE_MODE: "date" | "timestamptz" = "date";

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
  const [acwrDaily, setAcwrDaily] = useState<ACWRDailyRow[]>([]);
  const [loading, setLoading] = useState(true);

  const DEBUG_FETCH = import.meta.env.DEV;

  const inFlightRef = useRef(false);
  const lastFetchKeyRef = useRef<string | null>(null);

  const safeLogEvent = useCallback(
    async (eventType: string, payload: Record<string, any>) => {
      await logEvent({ userId, eventType, payload });
    },
    [userId]
  );

// ✅ force 引数を追加
const fetchAll = useCallback(
  async (force = false) => {
    if (!userId) return;

    const fetchKey = `user:${userId}`;
    if (inFlightRef.current) return;

    // ✅ force=true のときはスキップしない
    if (!force && lastFetchKeyRef.current === fetchKey && trainingRecords.length > 0) return;

    inFlightRef.current = true;
    lastFetchKeyRef.current = fetchKey;

    if (DEBUG_FETCH) {
      console.log("[useTrainingData] fetchAll", { userId, at: new Date().toISOString(), force });
    }

    setLoading(true);
    try {
      const [trainingRes, weightRes, acwrRes] = await Promise.all([
        supabase.from("training_records").select("*").eq("user_id", userId).order("date", { ascending: true }),
        supabase.from("weight_records").select("*").eq("user_id", userId).order("date", { ascending: true }),
        supabase
          .from("athlete_acwr_daily")
          .select("user_id,date,daily_load,acute_7d,chronic_28d,chronic_load,acwr,days_of_data,updated_at")
          .eq("user_id", userId)
          .order("date", { ascending: true }),
      ]);

      if (trainingRes.error) throw trainingRes.error;
      if (weightRes.error) throw weightRes.error;
      if (acwrRes.error) throw acwrRes.error;

      setTrainingRecords((trainingRes.data || []) as TrainingRecord[]);
      setWeightRecords((weightRes.data || []) as WeightRecord[]);
      setAcwrDaily((acwrRes.data || []) as ACWRDailyRow[]);

      if (DEBUG_FETCH) {
        console.log("[useTrainingData] fetched counts", {
          training: trainingRes.data?.length ?? 0,
          weight: weightRes.data?.length ?? 0,
          acwrDaily: acwrRes.data?.length ?? 0,
          acwrSample: (acwrRes.data ?? []).slice(-3),
        });
      }
    } catch (error) {
      console.error("[useTrainingData] Error fetching data:", error);
      setTrainingRecords([]);
      setWeightRecords([]);
      setAcwrDaily([]);
      lastFetchKeyRef.current = null;
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  },
  [userId, DEBUG_FETCH, trainingRecords.length]
);

  useEffect(() => {
    if (!userId) return;
    fetchAll();
  }, [userId, fetchAll]);

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

      // ✅ ACWRはDBの refresh 関数で更新される想定。必要ならここで fetchAll() して追従。
      await fetchAll(true);

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

      await safeLogEvent("training_completed", {
        date: ymd ?? undefined,
        rpe: recordData.rpe ?? (data as any)?.rpe,
        duration_min: recordData.duration_min ?? (data as any)?.duration_min,
        arrow_score: recordData.arrow_score ?? (data as any)?.arrow_score,
        signal_score: recordData.signal_score ?? (data as any)?.signal_score,
        overwrite: true,
      });

      await fetchAll(true);

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

      await fetchAll(true);
    },
    [userId]
  );

  const acwrData = (acwrDaily ?? [])
  .map((r: any) => {
    const acwrNum = Number(r?.acwr);
    const acuteNum = Number(r?.acute_7d);
    const chronicNum = Number(r?.chronic_28d);

    return {
      date: String(r?.date ?? ""),
      acwr: Number.isFinite(acwrNum) ? acwrNum : null,
      acuteLoad: Number.isFinite(acuteNum) ? acuteNum : null,
      chronicLoad: Number.isFinite(chronicNum) ? chronicNum : null,
      riskLevel: "unknown", // ← もし数値から判定する関数があるならここで計算
    };
  })
  .filter((x) => !!x.date)
  .sort(sortByDateAsc);

  return {
  records: trainingRecords,
  weightRecords,
  acwrDaily,
  acwrData,   // ✅ 追加
  loading,

  fetchAll,
  checkExistingRecord,
  addTrainingRecord,
  updateTrainingRecord,
  deleteTrainingRecord,
};
}