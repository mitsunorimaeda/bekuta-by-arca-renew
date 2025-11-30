import { useState, useEffect } from 'react';
import { supabase, TrainingRecord } from '../lib/supabase';
import { calculateACWR, ACWRData } from '../lib/acwr';

export function useTrainingData(userId: string) {
  const [records, setRecords] = useState<TrainingRecord[]>([]);
  const [acwrData, setACWRData] = useState<ACWRData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTrainingRecords();
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
      setRecords(data || []);
    } catch (error) {
      console.error('Error fetching training records:', error);
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
      console.log('[useTrainingData] Inserting into training_records table...');
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

      // Refresh records
      console.log('[useTrainingData] Refreshing records...');
      await fetchTrainingRecords();
      console.log('[useTrainingData] Records refreshed');
    } catch (error) {
      console.error('[useTrainingData] Error adding training record:', error);
      if (error && typeof error === 'object') {
        console.error('[useTrainingData] Error details:', JSON.stringify(error, null, 2));
      }
      throw error;
    }
  };

  const updateTrainingRecord = async (recordId: string, recordData: { rpe: number; duration_min: number; date?: string }) => {
    try {
      const { data, error } = await supabase
        .from('training_records')
        .update({
          rpe: recordData.rpe,
          duration_min: recordData.duration_min,
          ...(recordData.date && { date: recordData.date })
        })
        .eq('id', recordId)
        .eq('user_id', userId) // Security: only allow updating own records
        .select()
        .single();

      if (error) throw error;

      // Refresh records to recalculate ACWR
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
        .eq('user_id', userId); // Security: only allow deleting own records

      if (error) throw error;

      // Refresh records to recalculate ACWR
      await fetchTrainingRecords();
    } catch (error) {
      console.error('Error deleting training record:', error);
      throw error;
    }
  };
  return {
    records,
    acwrData,
    loading,
    checkExistingRecord,
    addTrainingRecord,
    updateTrainingRecord,
    deleteTrainingRecord,
  };
}