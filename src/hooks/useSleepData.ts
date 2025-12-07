import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Database } from '../lib/database.types';

type SleepRecord = Database['public']['Tables']['sleep_records']['Row'];
type SleepInsert = Database['public']['Tables']['sleep_records']['Insert'];
type SleepUpdate = Database['public']['Tables']['sleep_records']['Update'];

export function useSleepData(userId: string) {
  const [records, setRecords] = useState<SleepRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRecords = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('sleep_records')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false });

      if (fetchError) throw fetchError;

      setRecords(data || []);
    } catch (err) {
      console.error('Error fetching sleep records:', err);
      setError(err instanceof Error ? err.message : '睡眠記録の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchRecords();
    }
  }, [userId]);

  const checkExistingRecord = async (date: string): Promise<SleepRecord | null> => {
    try {
      const { data, error } = await supabase
        .from('sleep_records')
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

  const addSleepRecord = async (data: {
    sleep_hours: number;
    date: string;
    sleep_quality?: number;
    bedtime?: string;
    waketime?: string;
    notes?: string;
  }) => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        throw new Error('認証が必要です');
      }

      const insertData: SleepInsert = {
        user_id: authData.user.id,
        date: data.date,
        sleep_hours: data.sleep_hours,
        sleep_quality: data.sleep_quality || null,
        bedtime: data.bedtime || null,
        waketime: data.waketime || null,
        notes: data.notes || null
      };

      const { data: newRecord, error: insertError } = await supabase
        .from('sleep_records')
        .insert(insertData)
        .select()
        .single();

      if (insertError) throw insertError;

      setRecords(prev => [newRecord, ...prev].sort((a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
      ));
    } catch (err) {
      console.error('Error adding sleep record:', err);
      throw err;
    }
  };

  const updateSleepRecord = async (
    id: string,
    data: {
      sleep_hours?: number;
      sleep_quality?: number;
      bedtime?: string;
      waketime?: string;
      notes?: string;
    }
  ) => {
    try {
      const updateData: SleepUpdate = {
        sleep_hours: data.sleep_hours,
        sleep_quality: data.sleep_quality !== undefined ? data.sleep_quality : null,
        bedtime: data.bedtime !== undefined ? data.bedtime : null,
        waketime: data.waketime !== undefined ? data.waketime : null,
        notes: data.notes !== undefined ? data.notes : null
      };

      const { data: updatedRecord, error: updateError } = await supabase
        .from('sleep_records')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (updateError) throw updateError;

      setRecords(prev =>
        prev.map(record => (record.id === id ? updatedRecord : record))
      );
    } catch (err) {
      console.error('Error updating sleep record:', err);
      throw err;
    }
  };

  const deleteSleepRecord = async (id: string) => {
    try {
      const { error: deleteError } = await supabase
        .from('sleep_records')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      setRecords(prev => prev.filter(record => record.id !== id));
    } catch (err) {
      console.error('Error deleting sleep record:', err);
      throw err;
    }
  };

  const getAverageSleepHours = (days: number = 7): number | null => {
    if (records.length === 0) return null;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const recentRecords = records.filter(
      record => new Date(record.date) >= cutoffDate
    );

    if (recentRecords.length === 0) return null;

    const totalHours = recentRecords.reduce(
      (sum, record) => sum + Number(record.sleep_hours),
      0
    );

    return totalHours / recentRecords.length;
  };

  const getAverageSleepQuality = (days: number = 7): number | null => {
    if (records.length === 0) return null;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const recentRecords = records.filter(
      record => new Date(record.date) >= cutoffDate && record.sleep_quality !== null
    );

    if (recentRecords.length === 0) return null;

    const totalQuality = recentRecords.reduce(
      (sum, record) => sum + (record.sleep_quality || 0),
      0
    );

    return totalQuality / recentRecords.length;
  };

  const getLatestSleep = (): SleepRecord | null => {
    if (records.length === 0) return null;
    return records[0];
  };

  const getSleepDeficit = (days: number = 7): number | null => {
    const avgHours = getAverageSleepHours(days);
    if (avgHours === null) return null;

    const recommendedHours = 8;
    return recommendedHours - avgHours;
  };

  return {
    records,
    loading,
    error,
    checkExistingRecord,
    addSleepRecord,
    updateSleepRecord,
    deleteSleepRecord,
    getAverageSleepHours,
    getAverageSleepQuality,
    getLatestSleep,
    getSleepDeficit,
    refresh: fetchRecords
  };
}
