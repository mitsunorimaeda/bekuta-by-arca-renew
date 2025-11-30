import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Database } from '../lib/database.types';

type WeightRecord = Database['public']['Tables']['weight_records']['Row'];
type WeightInsert = Database['public']['Tables']['weight_records']['Insert'];
type WeightUpdate = Database['public']['Tables']['weight_records']['Update'];

export function useWeightData(userId: string) {
  const [records, setRecords] = useState<WeightRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRecords = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('weight_records')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false });

      if (fetchError) throw fetchError;

      setRecords(data || []);
    } catch (err) {
      console.error('Error fetching weight records:', err);
      setError(err instanceof Error ? err.message : '体重記録の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchRecords();
    }
  }, [userId]);

  const checkExistingRecord = async (date: string): Promise<WeightRecord | null> => {
    try {
      const { data, error } = await supabase
        .from('weight_records')
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

  const addWeightRecord = async (data: { weight_kg: number; date: string; notes?: string }) => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        throw new Error('認証が必要です');
      }

      const insertData: WeightInsert = {
        user_id: authData.user.id,
        weight_kg: data.weight_kg,
        date: data.date,
        notes: data.notes || null
      };

      const { data: newRecord, error: insertError } = await supabase
        .from('weight_records')
        .insert(insertData)
        .select()
        .single();

      if (insertError) throw insertError;

      setRecords(prev => [newRecord, ...prev].sort((a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
      ));
    } catch (err) {
      console.error('Error adding weight record:', err);
      throw err;
    }
  };

  const updateWeightRecord = async (id: string, data: { weight_kg: number; notes?: string }) => {
    try {
      const updateData: WeightUpdate = {
        weight_kg: data.weight_kg,
        notes: data.notes || null
      };

      const { data: updatedRecord, error: updateError } = await supabase
        .from('weight_records')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (updateError) throw updateError;

      setRecords(prev =>
        prev.map(record => (record.id === id ? updatedRecord : record))
      );
    } catch (err) {
      console.error('Error updating weight record:', err);
      throw err;
    }
  };

  const deleteWeightRecord = async (id: string) => {
    try {
      const { error: deleteError } = await supabase
        .from('weight_records')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      setRecords(prev => prev.filter(record => record.id !== id));
    } catch (err) {
      console.error('Error deleting weight record:', err);
      throw err;
    }
  };

  const getLatestWeight = (): number | null => {
    if (records.length === 0) return null;
    return Number(records[0].weight_kg);
  };

  const getWeightChange = (days: number = 30): number | null => {
    if (records.length < 2) return null;

    const sortedRecords = [...records].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const recentRecords = sortedRecords.filter(
      record => new Date(record.date) >= cutoffDate
    );

    if (recentRecords.length < 2) return null;

    const firstWeight = Number(recentRecords[0].weight_kg);
    const lastWeight = Number(recentRecords[recentRecords.length - 1].weight_kg);

    return lastWeight - firstWeight;
  };

  return {
    records,
    loading,
    error,
    checkExistingRecord,
    addWeightRecord,
    updateWeightRecord,
    deleteWeightRecord,
    getLatestWeight,
    getWeightChange,
    refresh: fetchRecords
  };
}
