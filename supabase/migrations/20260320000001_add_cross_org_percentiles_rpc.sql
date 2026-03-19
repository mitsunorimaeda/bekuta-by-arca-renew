-- =============================================================
-- RPC: get_cross_org_percentiles
-- 全組織横断で選手のパーセンタイルを算出する
-- 性別フィルタ: 対象ユーザーの性別が設定されている場合は同性のみで比較
-- =============================================================
CREATE OR REPLACE FUNCTION public.get_cross_org_percentiles(p_user_id uuid)
RETURNS TABLE (
  category_name text,
  category_display_name text,
  test_type_id uuid,
  test_display_name text,
  unit text,
  athlete_value numeric,
  percentile numeric,
  total_athletes int,
  higher_is_better boolean
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  WITH target_gender AS (
    SELECT gender FROM public.users WHERE id = p_user_id
  ),
  best_per_user_test AS (
    -- 各(user, test_type)のベスト記録を取得
    SELECT DISTINCT ON (pr.user_id, pr.test_type_id)
      pr.user_id,
      pr.test_type_id,
      (pr.values->>'primary_value')::numeric AS primary_value,
      ptt.category_id,
      ptt.higher_is_better
    FROM public.performance_records pr
    JOIN public.performance_test_types ptt ON ptt.id = pr.test_type_id
    JOIN public.users u ON u.id = pr.user_id
    WHERE ptt.is_active = true
      AND (pr.values->>'primary_value') IS NOT NULL
      AND (pr.values->>'primary_value')::numeric IS NOT NULL
      -- 性別フィルタ: 対象ユーザーの性別が設定されている場合のみ同性で比較
      AND (
        (SELECT gender FROM target_gender) IS NULL
        OR u.gender IS NULL
        OR u.gender = (SELECT gender FROM target_gender)
      )
    ORDER BY pr.user_id, pr.test_type_id,
      CASE WHEN ptt.higher_is_better
           THEN (pr.values->>'primary_value')::numeric END DESC NULLS LAST,
      CASE WHEN NOT ptt.higher_is_better
           THEN (pr.values->>'primary_value')::numeric END ASC NULLS LAST
  ),
  ranked AS (
    SELECT
      b.*,
      pc.name        AS cat_name,
      pc.display_name AS cat_display_name,
      ptt.display_name AS test_display,
      ptt.unit        AS test_unit,
      COUNT(*) OVER (PARTITION BY b.test_type_id)::int AS total,
      CASE
        WHEN b.higher_is_better THEN
          PERCENT_RANK() OVER (
            PARTITION BY b.test_type_id ORDER BY b.primary_value ASC
          )
        ELSE
          PERCENT_RANK() OVER (
            PARTITION BY b.test_type_id ORDER BY b.primary_value DESC
          )
      END AS pct_rank
    FROM best_per_user_test b
    JOIN public.performance_categories pc ON pc.id = b.category_id
    JOIN public.performance_test_types ptt ON ptt.id = b.test_type_id
  )
  SELECT
    r.cat_name,
    r.cat_display_name,
    r.test_type_id,
    r.test_display,
    r.test_unit,
    r.primary_value,
    ROUND((r.pct_rank * 100)::numeric, 1),
    r.total,
    r.higher_is_better
  FROM ranked r
  WHERE r.user_id = p_user_id
  ORDER BY r.cat_name, r.test_display;
$$;

-- 全認証ユーザーが自分のパーセンタイルを取得可能
GRANT EXECUTE ON FUNCTION public.get_cross_org_percentiles(uuid) TO authenticated;

-- =============================================================
-- RPC: get_athlete_category_trend
-- 選手の各テスト推移データを取得
-- =============================================================
CREATE OR REPLACE FUNCTION public.get_athlete_category_trend(
  p_user_id uuid,
  p_months int DEFAULT 6
)
RETURNS TABLE (
  test_type_id uuid,
  test_name text,
  test_display_name text,
  category_name text,
  category_display_name text,
  unit text,
  higher_is_better boolean,
  date date,
  primary_value numeric
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    pr.test_type_id,
    ptt.name,
    ptt.display_name,
    pc.name,
    pc.display_name,
    ptt.unit,
    ptt.higher_is_better,
    pr.date::date,
    (pr.values->>'primary_value')::numeric
  FROM public.performance_records pr
  JOIN public.performance_test_types ptt ON ptt.id = pr.test_type_id
  JOIN public.performance_categories pc  ON pc.id = ptt.category_id
  WHERE pr.user_id = p_user_id
    AND pr.date >= (CURRENT_DATE - (p_months || ' months')::interval)
    AND (pr.values->>'primary_value') IS NOT NULL
  ORDER BY pc.sort_order, ptt.sort_order, pr.date;
$$;

GRANT EXECUTE ON FUNCTION public.get_athlete_category_trend(uuid, int) TO authenticated;
