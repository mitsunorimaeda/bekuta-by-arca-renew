// src/hooks/useTrainingData.ts
import { useState, useEffect } from 'react';
import { supabase, TrainingRecord } from '../lib/supabase';
import { calculateACWR, ACWRData } from '../lib/acwr';

// 体重レコード用の型（シンプルでOK）
export interface WeightRecord {
  id: string;
  user_id: string;
  date: string;
  weight_kg: number | null;
}

export function useTrainingData(userId: string) {
  const [records, setRecords] = useState<TrainingRecord[]>([]);
  const [weightRecords, setWeightRecords] = useState<WeightRecord[]>([]);
  const [acwrData, setACWRData] = useState<ACWRData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    setLoading(true);
    // training_records と weight_records を両方読む
    Promise.all([fetchTrainingRecords(), fetchWeightRecords()]).finally(() => {
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    const calculatedACWR = calculateACWR(records);
    setACWRData(calculatedACWR);
  }, [records]);

  const fetchTrainingRecords = async () => {
    try {
      const { data, error } = await supabase
        .from('training_records')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: true });

      if (error) throw error;
      console.log('[useTrainingData] training_records fetched:', data?.length ?? 0);
      setRecords(data || []);
    } catch (error) {
      console.error('Error fetching training records:', error);
    }
  };

  const fetchWeightRecords = async () => {
    try {
      const { data, error } = await supabase
        .from('weight_records')
        .select('id, user_id, date, weight_kg')
        .eq('user_id', userId)
        .order('date', { ascending: true });

      if (error) throw error;
      console.log('[useTrainingData] weight_records fetched:', data?.length ?? 0);
      setWeightRecords((data || []) as WeightRecord[]);
    } catch (error) {
      console.error('Error fetching weight records:', error);
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

  const addTrainingRecord = async (recordData: {
    rpe: number;
    duration_min: number;
    date: string;
  }) => {
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

      await fetchTrainingRecords();
    } catch (error) {
      console.error('[useTrainingData] Error adding training record:', error);
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

      await fetchTrainingRecords();
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

      await fetchTrainingRecords();
    } catch (error) {
      console.error('Error deleting training record:', error);
      throw error;
    }
  };

  return {
    records,
    weightRecords,
    acwrData,
    loading,
    checkExistingRecord,
    addTrainingRecord,
    updateTrainingRecord,
    deleteTrainingRecord,
  };
}