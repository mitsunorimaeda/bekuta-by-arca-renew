import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';

// --- Types ---

interface PercentileRow {
  category_name: string;
  category_display_name: string;
  test_type_id: string;
  test_display_name: string;
  unit: string;
  athlete_value: number;
  percentile: number;
  total_athletes: number;
  higher_is_better: boolean;
}

interface TrendRow {
  test_type_id: string;
  test_name: string;
  test_display_name: string;
  category_name: string;
  category_display_name: string;
  unit: string;
  higher_is_better: boolean;
  date: string;
  primary_value: number;
}

export interface CategoryPercentile {
  categoryName: string;
  categoryDisplayName: string;
  percentile: number;
  totalAthletes: number;
  hasSufficientData: boolean; // n >= 5
  tests: TestPercentile[];
}

export interface TestPercentile {
  testTypeId: string;
  testDisplayName: string;
  unit: string;
  athleteValue: number;
  percentile: number;
  totalAthletes: number;
  higherIsBetter: boolean;
  hasSufficientData: boolean;
}

export interface CategoryTrend {
  categoryName: string;
  categoryDisplayName: string;
  tests: TestTrend[];
}

export interface TestTrend {
  testTypeId: string;
  testName: string;
  testDisplayName: string;
  unit: string;
  higherIsBetter: boolean;
  data: { date: string; value: number }[];
}

export interface RadarDataPoint {
  category: string;
  percentile: number;
  fullMark: 100;
}

export interface UserInfo {
  name: string;
  teamName: string;
  gender: string | null;
  heightCm: number | null;
  dateOfBirth: string | null;
  age: number | null;
}

export function useAthleteProfile(userId: string | null) {
  const [percentileRows, setPercentileRows] = useState<PercentileRow[]>([]);
  const [trendRows, setTrendRows] = useState<TrendRow[]>([]);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);

      try {
        const [percRes, trendRes, userRes] = await Promise.all([
          supabase.rpc('get_cross_org_percentiles', { p_user_id: userId }),
          supabase.rpc('get_athlete_category_trend', { p_user_id: userId, p_months: 6 }),
          supabase
            .from('users')
            .select('name, gender, height_cm, date_of_birth, teams:team_id(name)')
            .eq('id', userId)
            .single(),
        ]);

        if (cancelled) return;

        if (percRes.error) throw percRes.error;
        if (trendRes.error) throw trendRes.error;
        if (userRes.error) throw userRes.error;

        setPercentileRows((percRes.data ?? []) as PercentileRow[]);
        setTrendRows((trendRes.data ?? []) as TrendRow[]);

        const u = userRes.data as any;
        const dob = u?.date_of_birth;
        let age: number | null = null;
        if (dob) {
          const birth = new Date(dob);
          const today = new Date();
          age = today.getFullYear() - birth.getFullYear();
          const m = today.getMonth() - birth.getMonth();
          if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
        }

        setUserInfo({
          name: u?.name ?? '',
          teamName: (u?.teams as any)?.name ?? '',
          gender: u?.gender ?? null,
          heightCm: u?.height_cm ?? null,
          dateOfBirth: dob ?? null,
          age,
        });
      } catch (e: any) {
        console.error('[useAthleteProfile error]', e);
        if (!cancelled) setError(e.message || 'データの取得に失敗しました');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [userId]);

  // --- Derived: category percentiles ---
  const categoryPercentiles = useMemo<CategoryPercentile[]>(() => {
    const catMap = new Map<string, TestPercentile[]>();
    const catDisplayMap = new Map<string, string>();

    for (const row of percentileRows) {
      if (!catMap.has(row.category_name)) {
        catMap.set(row.category_name, []);
        catDisplayMap.set(row.category_name, row.category_display_name);
      }
      catMap.get(row.category_name)!.push({
        testTypeId: row.test_type_id,
        testDisplayName: row.test_display_name,
        unit: row.unit,
        athleteValue: row.athlete_value,
        percentile: row.percentile,
        totalAthletes: row.total_athletes,
        higherIsBetter: row.higher_is_better,
        hasSufficientData: row.total_athletes >= 5,
      });
    }

    const result: CategoryPercentile[] = [];
    for (const [catName, tests] of catMap) {
      const sufficientTests = tests.filter((t) => t.hasSufficientData);
      const avgPercentile =
        sufficientTests.length > 0
          ? Math.round(sufficientTests.reduce((s, t) => s + t.percentile, 0) / sufficientTests.length)
          : tests.length > 0
          ? Math.round(tests.reduce((s, t) => s + t.percentile, 0) / tests.length)
          : 0;
      const maxN = Math.max(...tests.map((t) => t.totalAthletes), 0);

      result.push({
        categoryName: catName,
        categoryDisplayName: catDisplayMap.get(catName) ?? catName,
        percentile: avgPercentile,
        totalAthletes: maxN,
        hasSufficientData: maxN >= 5,
        tests,
      });
    }

    return result;
  }, [percentileRows]);

  // --- Derived: radar data ---
  const radarData = useMemo<RadarDataPoint[]>(() => {
    return categoryPercentiles.map((c) => ({
      category: c.categoryDisplayName,
      percentile: c.percentile,
      fullMark: 100 as const,
    }));
  }, [categoryPercentiles]);

  // --- Derived: overall score ---
  const overallScore = useMemo(() => {
    if (categoryPercentiles.length === 0) return null;
    const sum = categoryPercentiles.reduce((s, c) => s + c.percentile, 0);
    return Math.round(sum / categoryPercentiles.length);
  }, [categoryPercentiles]);

  // --- Derived: category trends ---
  const categoryTrends = useMemo<CategoryTrend[]>(() => {
    const catMap = new Map<string, { displayName: string; tests: Map<string, TestTrend> }>();

    for (const row of trendRows) {
      if (!catMap.has(row.category_name)) {
        catMap.set(row.category_name, {
          displayName: row.category_display_name,
          tests: new Map(),
        });
      }
      const cat = catMap.get(row.category_name)!;
      if (!cat.tests.has(row.test_type_id)) {
        cat.tests.set(row.test_type_id, {
          testTypeId: row.test_type_id,
          testName: row.test_name,
          testDisplayName: row.test_display_name,
          unit: row.unit,
          higherIsBetter: row.higher_is_better,
          data: [],
        });
      }
      cat.tests.get(row.test_type_id)!.data.push({
        date: row.date,
        value: row.primary_value,
      });
    }

    const result: CategoryTrend[] = [];
    for (const [catName, cat] of catMap) {
      result.push({
        categoryName: catName,
        categoryDisplayName: cat.displayName,
        tests: Array.from(cat.tests.values()),
      });
    }
    return result;
  }, [trendRows]);

  // --- Derived: PB count (tests where percentile >= 90) ---
  const pbCount = useMemo(() => {
    return percentileRows.filter((r) => r.percentile >= 90).length;
  }, [percentileRows]);

  return {
    userInfo,
    categoryPercentiles,
    categoryTrends,
    radarData,
    overallScore,
    pbCount,
    loading,
    error,
  };
}
