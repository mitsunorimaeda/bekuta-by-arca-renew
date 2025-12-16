import { useState, useEffect } from 'react';
import { supabase, TrainingRecord, WeightRecord } from '../lib/supabase';
import { calculateACWR, ACWRData } from '../lib/acwr';
import { logEvent } from '../lib/logEvent'; // ★追加：あなたのlogEventのパスに合わせて調整

export function useTrainingData(userId: string) {
  const [trainingRecords, setTrainingRecords] = useState<TrainingRecord[]>([]);
  const [weightRecords, setWeightRecords] = useState<WeightRecord[]>([]);
  const [acwrData, setACWRData] = useState<ACWRData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    fetchAll();
  }, [userId]);

  useEffect(() => {
    const calculatedACWR = calculateACWR(trainingRecords);
    setACWRData(calculatedACWR);
  }, [trainingRecords]);

  const fetchAll = async () => {
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

      const tData = (trainingRes.data || []) as TrainingRecord[];
      const wData = (weightRes.data || []) as WeightRecord[];

      console.log('[useTrainingData] training_records fetched:', tData.length);
      console.log('[useTrainingData] weight_records fetched:', wData.length);

      setTrainingRecords(tData);
      setWeightRecords(wData);
    } catch (error) {
      console.error('[useTrainingData] Error fetching data:', error);
      setTrainingRecords([]);
      setWeightRecords([]);
      setACWRData([]);
    } finally {
      setLoading(false);
    }
  };

  const checkExistingRecord = async (date: string): Promise<TrainingRecord | null> => {
    try {
      const { data, error } = await supabase
        .from('training_records')
        .select('*')
        .eq('user_id', userId)
        .eq('date', date)
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error checking existing record:', error);
      return null;
    }
  };

  const addTrainingRecord = async (recordData: { rpe: number; duration_min: number; date: string }) => {
    console.log('[useTrainingData] addTrainingRecord called with:', recordData);

    try {
      const { data, error } = await supabase
        .from('training_records')
        .insert([
          {
            user_id: userId,
            date: recordData.date,
            rpe: recordData.rpe,
            duration_min: recordData.duration_min,
          },
        ])
        .select()
        .single();

      if (error) {
        console.error('[useTrainingData] Insert error:', error);
        throw error;
      }

      console.log('[useTrainingData] Insert successful:', data);

      // ✅ event（失敗しても保存は成功なのでthrowしない）
      try {
        await logEvent('training_completed', {
          date: recordData.date,
          rpe: recordData.rpe,
          duration_min: recordData.duration_min,
          overwrite: false,
        });
      } catch (e) {
        console.warn('[logEvent] failed after insert:', e);
      }

      // addTrainingRecord の insert成功後（data が取れた後）に追加
      await logEvent({
        userId,
        eventType: 'training_completed',
        payload: {
          date: recordData.date,
          rpe: recordData.rpe,
          duration_min: recordData.duration_min,
          overwrite: false,
        },
      });

      await fetchAll();
      return data;
    } catch (error) {
      console.error('[useTrainingData] Error adding training record:', error);
      if (error && typeof error === 'object') {
        console.error('[useTrainingData] Error details:', JSON.stringify(error, null, 2));
      }
      throw error;
    }
  };

  const updateTrainingRecord = async (
    recordId: string,
    recordData: { rpe: number; duration_min: number; date?: string }
  ) => {
    try {
      const { data, error } = await supabase
        .from('training_records')
        .update({
          rpe: recordData.rpe,
          duration_min: recordData.duration_min,
          ...(recordData.date && { date: recordData.date }),
        })
        .eq('id', recordId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;

      // ✅ event（updateでも必ず出す）
      // dateが渡ってこないケースに備えて、更新後data.dateを優先
      const eventDate = (recordData.date ?? (data as any)?.date) as string | undefined;

      try {
        await logEvent('training_completed', {
          date: eventDate,
          rpe: recordData.rpe,
          duration_min: recordData.duration_min,
          overwrite: true,
        });
      } catch (e) {
        console.warn('[logEvent] failed after update:', e);
      }

      await logEvent({
        userId,
        eventType: 'training_updated',
        payload: { record_id: recordId, ...recordData },
      });

      await fetchAll();
      return data;
    } catch (error) {
      console.error('Error updating training record:', error);
      throw error;
    }
  };

  const deleteTrainingRecord = async (recordId: string) => {
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
  };

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