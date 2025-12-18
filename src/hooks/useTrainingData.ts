import { useState, useEffect, useCallback } from 'react';
import { supabase, TrainingRecord, WeightRecord } from '../lib/supabase';
import { calculateACWR, ACWRData } from '../lib/acwr';
import { logEvent } from '../lib/logEvent';

type TrainingUpsertPayload = {
  rpe: number;
  duration_min: number;
  date: string;
  arrow_score: number;
  signal_score: number;
};

export function useTrainingData(userId: string) {
  const [trainingRecords, setTrainingRecords] = useState<TrainingRecord[]>([]);
  const [weightRecords, setWeightRecords] = useState<WeightRecord[]>([]);
  const [acwrData, setACWRData] = useState<ACWRData[]>([]);
  const [loading, setLoading] = useState(true);

  // ✅ logEvent の呼び方が揺れても落ちないように吸収
  const safeLogEvent = useCallback(
    async (
      eventType: string,
      payload: Record<string, any>,
      opts?: { overwrite?: boolean }
    ) => {
      try {
        // 1) 文字列 + payload 形式（logEvent(type, payload)）
        // @ts-ignore
        await logEvent(eventType, payload);
        return;
      } catch (e1) {
        // 2) オブジェクト形式（logEvent({ userId, eventType, payload })）
        try {
          // @ts-ignore
          await logEvent({
            userId,
            eventType,
            payload,
          });
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

  useEffect(() => {
    const calculatedACWR = calculateACWR(trainingRecords);
    setACWRData(calculatedACWR);
  }, [trainingRecords]);

  const checkExistingRecord = useCallback(
    async (date: string): Promise<TrainingRecord | null> => {
      try {
        const { data, error } = await supabase
          .from('training_records')
          .select('*')
          .eq('user_id', userId)
          .eq('date', date)
          .maybeSingle();

        if (error) throw error;
        return data as TrainingRecord | null;
      } catch (error) {
        console.error('Error checking existing record:', error);
        return null;
      }
    },
    [userId]
  );

  // ✅ 追加：arrow_score / signal_score を保存
  const addTrainingRecord = useCallback(
    async (recordData: TrainingUpsertPayload) => {
      try {
        const { data, error } = await supabase
          .from('training_records')
          .insert([
            {
              user_id: userId,
              date: recordData.date,
              rpe: recordData.rpe,
              duration_min: recordData.duration_min,
              arrow_score: recordData.arrow_score,
              signal_score: recordData.signal_score,
            },
          ])
          .select()
          .single();

        if (error) throw error;

        // ✅ event（失敗しても保存は成功なので throw しない）
        await safeLogEvent('training_completed', {
          date: recordData.date,
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

  // ✅ updateにも arrow_score / signal_score
  const updateTrainingRecord = useCallback(
    async (
      recordId: string,
      recordData: Omit<TrainingUpsertPayload, 'date'> & { date?: string }
    ) => {
      try {
        const { data, error } = await supabase
          .from('training_records')
          .update({
            rpe: recordData.rpe,
            duration_min: recordData.duration_min,
            arrow_score: recordData.arrow_score,
            signal_score: recordData.signal_score,
            ...(recordData.date && { date: recordData.date }),
          })
          .eq('id', recordId)
          .eq('user_id', userId)
          .select()
          .single();

        if (error) throw error;

        const eventDate = (recordData.date ?? (data as any)?.date) as string | undefined;

        await safeLogEvent('training_completed', {
          date: eventDate,
          rpe: recordData.rpe,
          duration_min: recordData.duration_min,
          arrow_score: recordData.arrow_score,
          signal_score: recordData.signal_score,
          overwrite: true,
        });

        await fetchAll();
        return data;
      } catch (error) {
        console.error('Error updating training record:', error);
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
        console.error('Error deleting training record:', error);
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