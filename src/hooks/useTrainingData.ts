import { useState, useEffect } from 'react';
import { supabase, TrainingRecord } from '../lib/supabase';
import { calculateACWR, ACWRData } from '../lib/acwr';

// weight_records 用の型（最低限でOK）
export interface WeightRecord {
  id: string;
  user_id: string;
  date: string;
  weight_kg: number | null;
  created_at?: string | null;
}

export function useTrainingData(userId: string) {
  const [records, setRecords] = useState<TrainingRecord[]>([]);
  const [weightRecords, setWeightRecords] = useState<WeightRecord[]>([]);
  const [acwrData, setACWRData] = useState<ACWRData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    fetchAllData();
  }, [userId]);

  useEffect(() => {
    const calculatedACWR = calculateACWR(records);
    setACWRData(calculatedACWR);
  }, [records]);

  /**
   * training_records + weight_records をまとめて取得
   */
  const fetchAllData = async () => {
    try {
      setLoading(true);

      const [{ data: trainingData, error: trainingError }, { data: weightData, error: weightError }] =
        await Promise.all([
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

      if (trainingError) throw trainingError;
      if (weightError) throw weightError;

      setRecords(trainingData || []);
      setWeightRecords((weightData || []) as WeightRecord[]);
    } catch (error) {
      console.error('Error fetching training / weight records:', error);
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

  /**
   * RPE × duration_min から load も計算して入れる
   */
  const addTrainingRecord = async (recordData: { rpe: number; duration_min: number; date: string }) => {
    console.log('[useTrainingData] addTrainingRecord called with:', recordData);
    try {
      const load = recordData.rpe * recordData.duration_min;

      console.log('[useTrainingData] Inserting into training_records table...');
      const { data, error } = await supabase
        .from('training_records')
        .insert([
          {
            user_id: userId,
            date: recordData.date,
            rpe: recordData.rpe,
            duration_min: recordData.duration_min,
            load, // ✅ ここで負荷も保存
          },
        ])
        .select()
        .single();

      if (error) {
        console.error('[useTrainingData] Insert error:', error);
        throw error;
      }

      console.log('[useTrainingData] Insert successful:', data);

      // ACWR 再計算のため両方取り直し
      console.log('[useTrainingData] Refreshing records...');
      await fetchAllData();
      console.log('[useTrainingData] Records refreshed');
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
      const load = recordData.rpe * recordData.duration_min;

      const { data, error } = await supabase
        .from('training_records')
        .update({
          rpe: recordData.rpe,
          duration_min: recordData.duration_min,
          load,
          ...(recordData.date && { date: recordData.date }),
        })
        .eq('id', recordId)
        .eq('user_id', userId) // Security: only allow updating own records
        .select()
        .single();

      if (error) throw error;

      // ACWR 再計算のため両方取り直し
      await fetchAllData();

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

      // ACWR 再計算のため両方取り直し
      await fetchAllData();
    } catch (error) {
      console.error('Error deleting training record:', error);
      throw error;
    }
  };

  return {
    records,
    weightRecords, // ✅ 追加
    acwrData,
    loading,
    checkExistingRecord,
    addTrainingRecord,
    updateTrainingRecord,
    deleteTrainingRecord,
  };
}