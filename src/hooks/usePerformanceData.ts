import { useState, useEffect } from 'react';
import { supabase, PerformanceCategory, PerformanceTestType, PerformanceRecord } from '../lib/supabase';

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

export function usePerformanceData(userId: string, categoryName?: string) {
  const [categories, setCategories] = useState<PerformanceCategory[]>([]);
  const [testTypes, setTestTypes] = useState<PerformanceTestType[]>([]);
  const [records, setRecords] = useState<PerformanceRecordWithTest[]>([]);
  const [personalBests, setPersonalBests] = useState<PersonalBest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const fetchTestTypes = async () => {
    try {
      let query = supabase
        .from('performance_test_types')
        .select(`
          *,
          performance_categories:category_id (
            id,
            name,
            display_name
          )
        `)
        .eq('is_active', true);

      if (categoryName) {
        const { data: categories } = await supabase
          .from('performance_categories')
          .select('id')
          .eq('name', categoryName)
          .single();

        if (categories) {
          query = query.eq('category_id', categories.id);
        }
      }

      const { data, error } = await query.order('sort_order');

      if (error) throw error;
      setTestTypes(data || []);
    } catch (err) {
      console.error('Error fetching test types:', err);
      setError('測定種目の取得に失敗しました');
    }
  };

  const fetchRecords = async () => {
    try {
      setLoading(true);

      let query = supabase
        .from('performance_records')
        .select(`
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
        `)
        .eq('user_id', userId)
        .order('date', { ascending: false });

      if (categoryName) {
        const { data: categories } = await supabase
          .from('performance_categories')
          .select('id')
          .eq('name', categoryName)
          .maybeSingle();

        if (categories) {
          const { data: testTypeIds } = await supabase
            .from('performance_test_types')
            .select('id')
            .eq('category_id', categories.id);

          if (testTypeIds && testTypeIds.length > 0) {
            const ids = testTypeIds.map(t => t.id);
            query = query.in('test_type_id', ids);
          }
        }
      }

      const { data, error } = await query;

      if (error) {
        console.error('Supabase query error:', error);
        throw error;
      }

      console.log('Fetched performance records:', data);

      const recordsWithTest = (data || []).map(record => ({
        ...record,
        test_type: record.performance_test_types as unknown as PerformanceTestType
      }));

      console.log('Records with test types:', recordsWithTest);

      setRecords(recordsWithTest);
      calculatePersonalBests(recordsWithTest);
    } catch (err) {
      console.error('Error fetching records:', err);
      setError('記録の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const calculatePersonalBests = (allRecords: PerformanceRecordWithTest[]) => {
    const bestsByTest = new Map<string, PersonalBest>();

    console.log('Calculating personal bests for records:', allRecords);

    allRecords.forEach(record => {
      if (!record.test_type) {
        console.warn('Record missing test_type:', record);
        return;
      }

      const rawValue = record.values.primary_value;
      const primaryValue = typeof rawValue === 'string' ? parseFloat(rawValue) : rawValue;

      if (primaryValue === undefined || primaryValue === null || isNaN(primaryValue)) {
        console.warn('Record missing or invalid primary_value:', record);
        return;
      }

      const existing = bestsByTest.get(record.test_type_id);
      const isNewBest = !existing ||
        (record.test_type.higher_is_better
          ? primaryValue > existing.value
          : primaryValue < existing.value);

      if (isNewBest) {
        bestsByTest.set(record.test_type_id, {
          test_type_id: record.test_type_id,
          test_name: record.test_type.name,
          test_display_name: record.test_type.display_name,
          value: primaryValue,
          date: record.date,
          record: record
        });
      }
    });

    const bests = Array.from(bestsByTest.values());
    console.log('Calculated personal bests:', bests);
    setPersonalBests(bests);
  };

  const checkExistingRecord = async (
    testTypeId: string,
    date: string
  ): Promise<PerformanceRecordWithTest | null> => {
    try {
      const { data, error } = await supabase
        .from('performance_records')
        .select(`
          *,
          performance_test_types:test_type_id (
            id,
            name,
            display_name,
            unit,
            higher_is_better,
            fields
          )
        `)
        .eq('user_id', userId)
        .eq('test_type_id', testTypeId)
        .eq('date', date)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        return {
          ...data,
          test_type: data.performance_test_types as unknown as PerformanceTestType
        };
      }

      return null;
    } catch (err) {
      console.error('Error checking existing record:', err);
      return null;
    }
  };

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

      await fetchRecords();

      const testType = testTypes.find(t => t.id === recordData.test_type_id);
      if (testType) {
        const isNewPersonalBest = checkIfPersonalBest(
          recordData.test_type_id,
          recordData.values.primary_value,
          testType.higher_is_better
        );
        return { data, isNewPersonalBest };
      }

      return { data, isNewPersonalBest: false };
    } catch (err) {
      console.error('Error adding record:', err);
      throw err;
    }
  };

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

  const checkIfPersonalBest = (
    testTypeId: string,
    newValue: number,
    higherIsBetter: boolean
  ): boolean => {
    const existingBest = personalBests.find(pb => pb.test_type_id === testTypeId);

    if (!existingBest) return true;

    return higherIsBetter
      ? newValue > existingBest.value
      : newValue < existingBest.value;
  };

  const getRecordsByTestType = (testTypeId: string) => {
    return records
      .filter(r => r.test_type_id === testTypeId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const getPersonalBest = (testTypeId: string) => {
    return personalBests.find(pb => pb.test_type_id === testTypeId);
  };

  const getImprovementPercentage = (testTypeId: string, currentValue: number): number | null => {
    const recordsForTest = getRecordsByTestType(testTypeId);
    if (recordsForTest.length < 2) return null;

    const firstRecord = recordsForTest[recordsForTest.length - 1];
    const firstValue = firstRecord.values.primary_value as number;

    if (!firstValue || firstValue === 0) return null;

    return ((currentValue - firstValue) / Math.abs(firstValue)) * 100;
  };

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
    checkExistingRecord,
    getRecordsByTestType,
    getPersonalBest,
    getImprovementPercentage,
    checkIfPersonalBest,
    refresh: fetchRecords
  };
}
