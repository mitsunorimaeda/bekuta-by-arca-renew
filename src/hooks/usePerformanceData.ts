import { useState, useEffect } from 'react';
import {
  supabase,
  PerformanceCategory,
  PerformanceTestType,
  PerformanceRecord
} from '../lib/supabase';

export interface PerformanceRecordWithTest extends PerformanceRecord {
  test_type?: PerformanceTestType;
}

export interface PersonalBest {
  test_type_id: string;
  test_name: string;
  test_display_name: string;
  value: number;
  date: string;
  record: PerformanceRecord;
}

/**
 * usePerformanceData
 * @param userId string
 * @param categoryName string | undefined
 * @param updateGoalFromLatestTest optional callback (testTypeId: string) => Promise<void>
 */
export function usePerformanceData(
  userId: string,
  categoryName?: string,
  updateGoalFromLatestTest?: (testTypeId: string) => Promise<void>
) {
  const [categories, setCategories] = useState<PerformanceCategory[]>([]);
  const [testTypes, setTestTypes] = useState<PerformanceTestType[]>([]);
  const [records, setRecords] = useState<PerformanceRecordWithTest[]>([]);
  const [personalBests, setPersonalBests] = useState<PersonalBest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* --------------------------
   * Initial fetch
   * -------------------------- */
  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchTestTypes();
  }, [categoryName]);

  useEffect(() => {
    if (userId) {
      fetchRecords();
    }
  }, [userId, categoryName]);

  /* --------------------------
   * Fetch: Categories
   * -------------------------- */
  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('performance_categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      if (error) throw error;
      setCategories(data || []);
    } catch (err) {
      console.error('Error fetching categories:', err);
      setError('カテゴリーの取得に失敗しました');
    }
  };

  /* --------------------------
   * Fetch: Test Types
   * -------------------------- */
  const fetchTestTypes = async () => {
    try {
      let query = supabase
        .from('performance_test_types')
        .select(
          `
          *,
          performance_categories:category_id (
            id,
            name,
            display_name
          )
        `
        )
        .eq('is_active', true);

      if (categoryName) {
        const { data: cat } = await supabase
          .from('performance_categories')
          .select('id')
          .eq('name', categoryName)
          .single();

        if (cat) query = query.eq('category_id', cat.id);
      }

      const { data, error } = await query.order('sort_order');
      if (error) throw error;

      setTestTypes(data || []);
    } catch (err) {
      console.error('Error fetching test types:', err);
      setError('測定種目の取得に失敗しました');
    }
  };

  /* --------------------------
   * Fetch: Records
   * -------------------------- */
  const fetchRecords = async () => {
    try {
      setLoading(true);

      let query = supabase
        .from('performance_records')
        .select(
          `
          *,
          performance_test_types:test_type_id (
            id,
            category_id,
            name,
            display_name,
            description,
            unit,
            higher_is_better,
            fields,
            sort_order,
            is_active,
            created_at
          )
      `
        )
        .eq('user_id', userId)
        .order('date', { ascending: false });

      if (categoryName) {
        const { data: cat } = await supabase
          .from('performance_categories')
          .select('id')
          .eq('name', categoryName)
          .maybeSingle();

        if (cat) {
          const { data: testList } = await supabase
            .from('performance_test_types')
            .select('id')
            .eq('category_id', cat.id);

          if (testList && testList.length > 0) {
            query = query.in(
              'test_type_id',
              testList.map(t => t.id)
            );
          }
        }
      }

      const { data, error } = await query;
      if (error) throw error;

      const mapped = (data || []).map(r => ({
        ...r,
        test_type: r.performance_test_types as PerformanceTestType
      }));

      setRecords(mapped);
      calculatePersonalBests(mapped);
    } catch (err) {
      console.error('Error fetching records:', err);
      setError('記録の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  /* --------------------------
   * Calculate PB
   * -------------------------- */
  const calculatePersonalBests = (allRecords: PerformanceRecordWithTest[]) => {
    const bestByTest = new Map<string, PersonalBest>();

    allRecords.forEach(record => {
      if (!record.test_type) return;

      const raw = record.values.primary_value;
      const value = typeof raw === 'string' ? parseFloat(raw) : raw;
      if (value === null || value === undefined || isNaN(value)) return;

      const existing = bestByTest.get(record.test_type_id);
      const better =
        !existing ||
        (record.test_type.higher_is_better
          ? value > existing.value
          : value < existing.value);

      if (better) {
        bestByTest.set(record.test_type_id, {
          test_type_id: record.test_type_id,
          test_name: record.test_type.name,
          test_display_name: record.test_type.display_name,
          value,
          date: record.date,
          record
        });
      }
    });

    setPersonalBests(Array.from(bestByTest.values()));
  };

  const checkExistingRecord = async (
    testTypeId: string,
    date: string
  ): Promise<PerformanceRecordWithTest | null> => {
    try {
      const { data, error } = await supabase
        .from('performance_records')
        .select(
          `
          *,
          performance_test_types:test_type_id (
            id,
            name,
            display_name,
            unit,
            higher_is_better,
            fields
          )
        `
        )
        .eq('user_id', userId)
        .eq('test_type_id', testTypeId)
        .eq('date', date)
        .maybeSingle();
  
      if (error) throw error;
  
      if (data) {
        return {
          ...data,
          test_type: data.performance_test_types as PerformanceTestType
        };
      }
  
      return null;
    } catch (err) {
      console.error('Error checking existing record:', err);
      return null;
    }
  };

  /* --------------------------
   * Add Record（ゴール自動更新つき）
   * -------------------------- */
  const addRecord = async (recordData: {
    test_type_id: string;
    date: string;
    values: Record<string, any>;
    notes?: string;
    is_official?: boolean;
    weather_conditions?: string;
  }) => {
    try {
      const { data, error } = await supabase
        .from('performance_records')
        .insert([
          {
            user_id: userId,
            ...recordData
          }
        ])
        .select()
        .single();

      if (error) throw error;

      // 1) 記録を再取得
      await fetchRecords();

      // 2) ゴール更新（注入されたコールバックを実行）
      if (updateGoalFromLatestTest) {
        await updateGoalFromLatestTest(recordData.test_type_id);
      }

      // 3) PB 判定
      const tt = testTypes.find(t => t.id === recordData.test_type_id);
      const newValue = recordData.values.primary_value;

      const isNewPB =
        tt && checkIfPersonalBest(recordData.test_type_id, newValue, tt.higher_is_better);

      return { data, isNewPersonalBest: isNewPB ?? false };
    } catch (err) {
      console.error('Error adding record:', err);
      throw err;
    }
  };

  /* --------------------------
   * Update Record
   * -------------------------- */
  const updateRecord = async (
    recordId: string,
    updates: {
      date?: string;
      values?: Record<string, any>;
      notes?: string;
      is_official?: boolean;
      weather_conditions?: string;
    }
  ) => {
    try {
      const { data, error } = await supabase
        .from('performance_records')
        .update(updates)
        .eq('id', recordId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;

      await fetchRecords();
      return data;
    } catch (err) {
      console.error('Error updating record:', err);
      throw err;
    }
  };

  /* --------------------------
   * Delete Record
   * -------------------------- */
  const deleteRecord = async (recordId: string) => {
    try {
      const { error } = await supabase
        .from('performance_records')
        .delete()
        .eq('id', recordId)
        .eq('user_id', userId);

      if (error) throw error;

      await fetchRecords();
    } catch (err) {
      console.error('Error deleting record:', err);
      throw err;
    }
  };

  /* --------------------------
   * Utils
   * -------------------------- */
  const checkIfPersonalBest = (
    testTypeId: string,
    newValue: number,
    higherIsBetter: boolean
  ): boolean => {
    const pb = personalBests.find(p => p.test_type_id === testTypeId);
    if (!pb) return true;
    return higherIsBetter ? newValue > pb.value : newValue < pb.value;
  };

  const getRecordsByTestType = (testTypeId: string) => {
    return records
      .filter(r => r.test_type_id === testTypeId)
      .sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
  };

  const getPersonalBest = (testTypeId: string) =>
    personalBests.find(pb => pb.test_type_id === testTypeId);

  const getImprovementPercentage = (
    testTypeId: string,
    currentValue: number
  ): number | null => {
    const rec = getRecordsByTestType(testTypeId);
    if (rec.length < 2) return null;

    const first = rec[rec.length - 1];
    const base = first.values.primary_value as number;

    if (!base || base === 0) return null;

    return ((currentValue - base) / Math.abs(base)) * 100;
  };

  /* --------------------------
   * Return API
   * -------------------------- */
  return {
    categories,
    testTypes,
    records,
    personalBests,
    loading,
    error,

    addRecord,
    updateRecord,
    deleteRecord,

    checkIfPersonalBest,
    checkExistingRecord,
    getRecordsByTestType,
    getPersonalBest,
    getImprovementPercentage,

    refresh: fetchRecords
  };
}