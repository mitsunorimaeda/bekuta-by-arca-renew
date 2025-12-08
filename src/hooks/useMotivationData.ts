import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Database } from '../lib/database.types';

type MotivationRecord = Database['public']['Tables']['motivation_records']['Row'];
type MotivationInsert = Database['public']['Tables']['motivation_records']['Insert'];
type MotivationUpdate = Database['public']['Tables']['motivation_records']['Update'];

export function useMotivationData(userId: string) {
  const [records, setRecords] = useState<MotivationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRecords = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('motivation_records')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false });

      if (fetchError) throw fetchError;

      setRecords(data || []);
    } catch (err) {
      console.error('Error fetching motivation records:', err);
      setError(err instanceof Error ? err.message : 'モチベーション記録の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchRecords();
    }
  }, [userId]);

  const checkExistingRecord = async (date: string): Promise<MotivationRecord | null> => {
    try {
      const { data, error } = await supabase
        .from('motivation_records')
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

  const addMotivationRecord = async (data: {
    motivation_level: number;
    energy_level: number;
    stress_level: number;
    date: string;
    mood?: string;
    notes?: string;
  }) => {
    try {
      if (!userId) {
        throw new Error('ユーザーIDがありません');
      }

      const insertData: MotivationInsert = {
        user_id: userId,
        date: data.date,
        motivation_level: data.motivation_level,
        energy_level: data.energy_level,
        stress_level: data.stress_level,
        mood: data.mood || null,
        notes: data.notes || null
      };

      // 🔁 INSERT → UPSERT に変更
      //  ユニーク制約 motivation_records_user_id_date_key
      //  = user_id + date に合わせて onConflict を指定
      const { data: newRecord, error: upsertError } = await supabase
        .from('motivation_records')
        .upsert(insertData, {
          onConflict: 'user_id,date'
        })
        .select()
        .single();

      if (upsertError) throw upsertError;

      // ローカル state も「同じ user_id + date のものは置き換え」にする
      setRecords(prev => {
        const filtered = prev.filter(
          r => !(r.user_id === newRecord.user_id && r.date === newRecord.date)
        );
        return [newRecord, ...filtered].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );
      });
    } catch (err) {
      console.error('Error adding motivation record:', err);
      throw err;
    }
  };

  const updateMotivationRecord = async (
    id: string,
    data: {
      motivation_level?: number;
      energy_level?: number;
      stress_level?: number;
      mood?: string;
      notes?: string;
    }
  ) => {
    try {
      const updateData: MotivationUpdate = {
        motivation_level: data.motivation_level,
        energy_level: data.energy_level,
        stress_level: data.stress_level,
        mood: data.mood !== undefined ? data.mood : null,
        notes: data.notes !== undefined ? data.notes : null
      };

      const { data: updatedRecord, error: updateError } = await supabase
        .from('motivation_records')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (updateError) throw updateError;

      setRecords(prev =>
        prev.map(record => (record.id === id ? updatedRecord : record))
      );
    } catch (err) {
      console.error('Error updating motivation record:', err);
      throw err;
    }
  };

  const deleteMotivationRecord = async (id: string) => {
    try {
      const { error: deleteError } = await supabase
        .from('motivation_records')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      setRecords(prev => prev.filter(record => record.id !== id));
    } catch (err) {
      console.error('Error deleting motivation record:', err);
      throw err;
    }
  };

  const getAverageMotivation = (days: number = 7): number | null => {
    if (records.length === 0) return null;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const recentRecords = records.filter(
      record => new Date(record.date) >= cutoffDate
    );

    if (recentRecords.length === 0) return null;

    const totalMotivation = recentRecords.reduce(
      (sum, record) => sum + record.motivation_level,
      0
    );

    return totalMotivation / recentRecords.length;
  };

  const getAverageEnergy = (days: number = 7): number | null => {
    if (records.length === 0) return null;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const recentRecords = records.filter(
      record => new Date(record.date) >= cutoffDate
    );

    if (recentRecords.length === 0) return null;

    const totalEnergy = recentRecords.reduce(
      (sum, record) => sum + record.energy_level,
      0
    );

    return totalEnergy / recentRecords.length;
  };

  const getAverageStress = (days: number = 7): number | null => {
    if (records.length === 0) return null;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const recentRecords = records.filter(
      record => new Date(record.date) >= cutoffDate
    );

    if (recentRecords.length === 0) return null;

    const totalStress = recentRecords.reduce(
      (sum, record) => sum + record.stress_level,
      0
    );

    return totalStress / recentRecords.length;
  };

  const getLatestMotivation = (): MotivationRecord | null => {
    if (records.length === 0) return null;
    return records[0];
  };

  const getMotivationTrend = (days: number = 7): 'improving' | 'declining' | 'stable' | null => {
    if (records.length < 2) return null;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const recentRecords = records
      .filter(record => new Date(record.date) >= cutoffDate)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (recentRecords.length < 2) return null;

    const midPoint = Math.floor(recentRecords.length / 2);
    const firstHalf = recentRecords.slice(0, midPoint);
    const secondHalf = recentRecords.slice(midPoint);

    const firstAvg =
      firstHalf.reduce((sum, r) => sum + r.motivation_level, 0) /
      firstHalf.length;
    const secondAvg =
      secondHalf.reduce((sum, r) => sum + r.motivation_level, 0) /
      secondHalf.length;

    const diff = secondAvg - firstAvg;

    if (diff > 0.5) return 'improving';
    if (diff < -0.5) return 'declining';
    return 'stable';
  };

  return {
    records,
    loading,
    error,
    checkExistingRecord,
    addMotivationRecord,
    updateMotivationRecord,
    deleteMotivationRecord,
    getAverageMotivation,
    getAverageEnergy,
    getAverageStress,
    getLatestMotivation,
    getMotivationTrend,
    refresh: fetchRecords
  };
}