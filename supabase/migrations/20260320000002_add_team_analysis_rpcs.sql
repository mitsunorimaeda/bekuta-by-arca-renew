-- =============================================================
-- RPC: get_team_radar_percentiles
-- チーム全選手の全組織横断パーセンタイルをカテゴリ別に平均化
-- =============================================================
CREATE OR REPLACE FUNCTION public.get_team_radar_percentiles(p_team_id uuid)
RETURNS TABLE (
  category_name text,
  category_display_name text,
  avg_percentile numeric,
  athlete_count int,
  test_count int
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  WITH team_athletes AS (
    SELECT id FROM public.users WHERE team_id = p_team_id AND role = 'athlete'
  ),
  best_per_user_test AS (
    SELECT DISTINCT ON (pr.user_id, pr.test_type_id)
      pr.user_id,
      pr.test_type_id,
      (pr.values->>'primary_value')::numeric AS primary_value,
      ptt.category_id,
      ptt.higher_is_better
    FROM public.performance_records pr
    JOIN public.performance_test_types ptt ON ptt.id = pr.test_type_id
    WHERE ptt.is_active = true
      AND (pr.values->>'primary_value') IS NOT NULL
      AND (pr.values->>'primary_value')::numeric IS NOT NULL
    ORDER BY pr.user_id, pr.test_type_id,
      CASE WHEN ptt.higher_is_better
           THEN (pr.values->>'primary_value')::numeric END DESC NULLS LAST,
      CASE WHEN NOT ptt.higher_is_better
           THEN (pr.values->>'primary_value')::numeric END ASC NULLS LAST
  ),
  ranked AS (
    SELECT
      b.user_id,
      b.test_type_id,
      b.category_id,
      CASE
        WHEN b.higher_is_better THEN
          PERCENT_RANK() OVER (PARTITION BY b.test_type_id ORDER BY b.primary_value ASC)
        ELSE
          PERCENT_RANK() OVER (PARTITION BY b.test_type_id ORDER BY b.primary_value DESC)
      END AS pct_rank
    FROM best_per_user_test b
  ),
  team_test_percentiles AS (
    SELECT
      r.user_id,
      r.test_type_id,
      r.category_id,
      ROUND((r.pct_rank * 100)::numeric, 1) AS percentile
    FROM ranked r
    WHERE r.user_id IN (SELECT id FROM team_athletes)
  )
  SELECT
    pc.name,
    pc.display_name,
    ROUND(AVG(ttp.percentile)::numeric, 1),
    COUNT(DISTINCT ttp.user_id)::int,
    COUNT(DISTINCT ttp.test_type_id)::int
  FROM team_test_percentiles ttp
  JOIN public.performance_categories pc ON pc.id = ttp.category_id
  GROUP BY pc.name, pc.display_name, pc.sort_order
  ORDER BY pc.sort_order;
$$;

GRANT EXECUTE ON FUNCTION public.get_team_radar_percentiles(uuid) TO authenticated;

-- =============================================================
-- RPC: get_team_percentile_matrix
-- 各選手×各カテゴリのパーセンタイルを返す（マトリクス表示用）
-- =============================================================
CREATE OR REPLACE FUNCTION public.get_team_percentile_matrix(p_team_id uuid)
RETURNS TABLE (
  user_id uuid,
  user_name text,
  category_name text,
  category_display_name text,
  avg_percentile numeric,
  test_count int
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  WITH team_athletes AS (
    SELECT id, name FROM public.users WHERE team_id = p_team_id AND role = 'athlete'
  ),
  best_per_user_test AS (
    SELECT DISTINCT ON (pr.user_id, pr.test_type_id)
      pr.user_id,
      pr.test_type_id,
      (pr.values->>'primary_value')::numeric AS primary_value,
      ptt.category_id,
      ptt.higher_is_better
    FROM public.performance_records pr
    JOIN public.performance_test_types ptt ON ptt.id = pr.test_type_id
    WHERE ptt.is_active = true
      AND (pr.values->>'primary_value') IS NOT NULL
      AND (pr.values->>'primary_value')::numeric IS NOT NULL
    ORDER BY pr.user_id, pr.test_type_id,
      CASE WHEN ptt.higher_is_better
           THEN (pr.values->>'primary_value')::numeric END DESC NULLS LAST,
      CASE WHEN NOT ptt.higher_is_better
           THEN (pr.values->>'primary_value')::numeric END ASC NULLS LAST
  ),
  ranked AS (
    SELECT
      b.user_id,
      b.test_type_id,
      b.category_id,
      CASE
        WHEN b.higher_is_better THEN
          PERCENT_RANK() OVER (PARTITION BY b.test_type_id ORDER BY b.primary_value ASC)
        ELSE
          PERCENT_RANK() OVER (PARTITION BY b.test_type_id ORDER BY b.primary_value DESC)
      END AS pct_rank
    FROM best_per_user_test b
  ),
  team_test_percentiles AS (
    SELECT
      r.user_id,
      r.test_type_id,
      r.category_id,
      ROUND((r.pct_rank * 100)::numeric, 1) AS percentile
    FROM ranked r
    WHERE r.user_id IN (SELECT id FROM team_athletes)
  )
  SELECT
    ttp.user_id,
    ta.name,
    pc.name,
    pc.display_name,
    ROUND(AVG(ttp.percentile)::numeric, 1),
    COUNT(ttp.test_type_id)::int
  FROM team_test_percentiles ttp
  JOIN team_athletes ta ON ta.id = ttp.user_id
  JOIN public.performance_categories pc ON pc.id = ttp.category_id
  GROUP BY ttp.user_id, ta.name, pc.name, pc.display_name, pc.sort_order
  ORDER BY ta.name, pc.sort_order;
$$;

GRANT EXECUTE ON FUNCTION public.get_team_percentile_matrix(uuid) TO authenticated;

-- =============================================================
-- RPC: get_team_test_ranking
-- チーム内の種目別ランキング
-- =============================================================
DROP FUNCTION IF EXISTS public.get_team_test_ranking(uuid, uuid, text, integer, integer, integer);
CREATE OR REPLACE FUNCTION public.get_team_test_ranking(
  p_team_id uuid,
  p_test_type_id uuid,
  p_metric text DEFAULT 'primary_value',
  p_days int DEFAULT 365,
  p_limit int DEFAULT 50,
  p_min_n int DEFAULT 5
)
RETURNS TABLE (
  user_id uuid,
  name text,
  latest_date date,
  latest_value numeric,
  best_date date,
  best_value numeric,
  team_rank bigint,
  top_percent numeric,
  team_n bigint,
  benchmark_scope text,
  benchmark_n bigint,
  min_n int
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  WITH team_athletes AS (
    SELECT u.id, u.name
    FROM public.users u
    WHERE u.team_id = p_team_id AND u.role = 'athlete'
  ),
  test_meta AS (
    SELECT higher_is_better FROM public.performance_test_types WHERE id = p_test_type_id
  ),
  records_in_range AS (
    SELECT
      pr.user_id,
      pr.date::date AS rec_date,
      CASE
        WHEN p_metric = 'relative_1rm' AND (pr.values->>'relative_1rm') IS NOT NULL
          THEN (pr.values->>'relative_1rm')::numeric
        ELSE (pr.values->>'primary_value')::numeric
      END AS val
    FROM public.performance_records pr
    WHERE pr.test_type_id = p_test_type_id
      AND pr.user_id IN (SELECT id FROM team_athletes)
      AND pr.date >= (CURRENT_DATE - (p_days || ' days')::interval)
      AND (pr.values->>'primary_value') IS NOT NULL
  ),
  latest AS (
    SELECT DISTINCT ON (user_id)
      user_id, rec_date AS latest_date, val AS latest_value
    FROM records_in_range
    ORDER BY user_id, rec_date DESC
  ),
  best AS (
    SELECT DISTINCT ON (user_id)
      user_id, rec_date AS best_date, val AS best_value
    FROM records_in_range
    ORDER BY user_id,
      CASE WHEN (SELECT higher_is_better FROM test_meta) THEN val END DESC NULLS LAST,
      CASE WHEN NOT (SELECT higher_is_better FROM test_meta) THEN val END ASC NULLS LAST
  ),
  combined AS (
    SELECT
      ta.id AS user_id,
      ta.name,
      l.latest_date,
      l.latest_value,
      b.best_date,
      b.best_value
    FROM team_athletes ta
    LEFT JOIN latest l ON l.user_id = ta.id
    LEFT JOIN best b ON b.user_id = ta.id
    WHERE l.latest_value IS NOT NULL
  ),
  with_rank AS (
    SELECT
      c.*,
      COUNT(*) OVER ()::bigint AS team_n,
      RANK() OVER (
        ORDER BY
          CASE WHEN (SELECT higher_is_better FROM test_meta) THEN c.latest_value END DESC NULLS LAST,
          CASE WHEN NOT (SELECT higher_is_better FROM test_meta) THEN c.latest_value END ASC NULLS LAST
      )::bigint AS team_rank
    FROM combined c
  )
  SELECT
    w.user_id,
    w.name,
    w.latest_date,
    w.latest_value,
    w.best_date,
    w.best_value,
    w.team_rank,
    ROUND(((w.team_rank - 1)::numeric / NULLIF(w.team_n - 1, 0)) * 100, 1) AS top_percent,
    w.team_n,
    'team'::text AS benchmark_scope,
    w.team_n AS benchmark_n,
    p_min_n AS min_n
  FROM with_rank w
  ORDER BY w.team_rank
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_team_test_ranking(uuid, uuid, text, int, int, int) TO authenticated;
