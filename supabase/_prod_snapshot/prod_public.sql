


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."add_strength_record_with_relative_1rm"("p_user_id" "uuid", "p_test_type_id" "uuid", "p_date" "date", "p_1rm" numeric, "p_notes" "text" DEFAULT ''::"text", "p_is_official" boolean DEFAULT true) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
v_latest_weight numeric;
v_relative_1rm numeric;
v_values jsonb;
v_record_id uuid;
BEGIN
v_latest_weight := get_latest_weight(p_user_id);

v_relative_1rm := calculate_relative_1rm(p_1rm, v_latest_weight);

v_values := jsonb_build_object(
'primary_value', p_1rm,
'relative_1rm', v_relative_1rm,
'weight_at_test', v_latest_weight
);

INSERT INTO performance_records (
user_id,
test_type_id,
date,
values,
notes,
is_official
)
VALUES (
p_user_id,
p_test_type_id,
p_date,
v_values,
p_notes,
p_is_official
)
RETURNING id INTO v_record_id;

RETURN v_record_id;
END;
$$;


ALTER FUNCTION "public"."add_strength_record_with_relative_1rm"("p_user_id" "uuid", "p_test_type_id" "uuid", "p_date" "date", "p_1rm" numeric, "p_notes" "text", "p_is_official" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."approve_athlete_transfer"("request_id" "uuid", "reviewer_user_id" "uuid", "notes" "text" DEFAULT ''::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
v_athlete_id uuid;
v_from_team_id uuid;
v_to_team_id uuid;
v_organization_id uuid;
v_request_reason text;
v_status text;
BEGIN
SELECT athlete_id, from_team_id, to_team_id, organization_id, request_reason, status
INTO v_athlete_id, v_from_team_id, v_to_team_id, v_organization_id, v_request_reason, v_status
FROM athlete_transfer_requests
WHERE id = request_id;

IF NOT FOUND THEN
RAISE EXCEPTION 'Transfer request not found';
END IF;

IF v_status != 'pending' THEN
RAISE EXCEPTION 'Transfer request has already been reviewed';
END IF;

UPDATE athlete_transfer_requests
SET 
status = 'approved',
reviewed_by = reviewer_user_id,
reviewed_at = now(),
review_notes = notes,
updated_at = now()
WHERE id = request_id;

UPDATE users
SET team_id = v_to_team_id
WHERE id = v_athlete_id;

INSERT INTO team_transfer_history (
athlete_id,
from_team_id,
to_team_id,
organization_id,
transfer_request_id,
transferred_by,
transfer_reason,
transfer_date
) VALUES (
v_athlete_id,
v_from_team_id,
v_to_team_id,
v_organization_id,
request_id,
reviewer_user_id,
v_request_reason,
now()
);

UPDATE athlete_transfer_requests
SET 
status = 'completed',
completed_at = now(),
updated_at = now()
WHERE id = request_id;
END;
$$;


ALTER FUNCTION "public"."approve_athlete_transfer"("request_id" "uuid", "reviewer_user_id" "uuid", "notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."approve_team_access_request"("request_id" "uuid", "reviewer_user_id" "uuid", "notes" "text" DEFAULT ''::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
v_requester_id uuid;
v_team_id uuid;
v_status text;
BEGIN
SELECT requester_id, team_id, status
INTO v_requester_id, v_team_id, v_status
FROM team_access_requests
WHERE id = request_id;

IF NOT FOUND THEN
RAISE EXCEPTION 'Request not found';
END IF;

IF v_status != 'pending' THEN
RAISE EXCEPTION 'Request has already been reviewed';
END IF;

UPDATE team_access_requests
SET 
status = 'approved',
reviewed_by = reviewer_user_id,
reviewed_at = now(),
review_notes = notes,
updated_at = now()
WHERE id = request_id;

INSERT INTO staff_team_links (staff_user_id, team_id)
VALUES (v_requester_id, v_team_id)
ON CONFLICT (staff_user_id, team_id) DO NOTHING;
END;
$$;


ALTER FUNCTION "public"."approve_team_access_request"("request_id" "uuid", "reviewer_user_id" "uuid", "notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."assign_user_to_team"("p_user_id" "uuid", "p_team_id" "uuid", "p_organization_id" "uuid", "p_assignment_type" "text" DEFAULT 'primary'::"text", "p_notes" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
v_assignment_id uuid;
v_previous_team_id uuid;
BEGIN
SELECT team_id INTO v_previous_team_id
FROM team_member_assignments
WHERE user_id = p_user_id 
AND organization_id = p_organization_id
AND assignment_type = p_assignment_type
LIMIT 1;

IF v_previous_team_id IS NOT NULL AND v_previous_team_id != p_team_id THEN
INSERT INTO team_assignment_history (
user_id,
from_team_id,
to_team_id,
organization_id,
assigned_by,
change_type
) VALUES (
p_user_id,
v_previous_team_id,
p_team_id,
p_organization_id,
auth.uid(),
'transferred'
);

UPDATE team_member_assignments
SET team_id = p_team_id,
assigned_by = auth.uid(),
assigned_at = now(),
notes = p_notes,
updated_at = now()
WHERE user_id = p_user_id 
AND organization_id = p_organization_id
AND assignment_type = p_assignment_type
RETURNING id INTO v_assignment_id;
ELSE
INSERT INTO team_member_assignments (
user_id,
team_id,
organization_id,
assigned_by,
assignment_type,
notes
) VALUES (
p_user_id,
p_team_id,
p_organization_id,
auth.uid(),
p_assignment_type,
p_notes
)
ON CONFLICT (user_id, organization_id, assignment_type, team_id) 
DO UPDATE SET
assigned_by = auth.uid(),
assigned_at = now(),
notes = p_notes,
updated_at = now()
RETURNING id INTO v_assignment_id;

IF v_previous_team_id IS NULL THEN
INSERT INTO team_assignment_history (
user_id,
to_team_id,
organization_id,
assigned_by,
change_type
) VALUES (
p_user_id,
p_team_id,
p_organization_id,
auth.uid(),
'assigned'
);
END IF;
END IF;

RETURN v_assignment_id;
END;
$$;


ALTER FUNCTION "public"."assign_user_to_team"("p_user_id" "uuid", "p_team_id" "uuid", "p_organization_id" "uuid", "p_assignment_type" "text", "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."award_first_step_badge"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_badge_id uuid;
begin
  -- training_record_created の時だけ動く
  if new.event_type <> 'training_record_created' then
    return new;
  end if;

  select id into v_badge_id
  from badges
  where name = 'はじめの一歩'
  limit 1;

  if v_badge_id is null then
    return new;
  end if;

  -- 既に持ってたら何もしない（重複防止）
  insert into user_badges (user_id, badge_id, earned_at, is_new, metadata)
  values (new.user_id, v_badge_id, now(), true, new.payload)
  on conflict do nothing;

  return new;
end;
$$;


ALTER FUNCTION "public"."award_first_step_badge"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."award_first_training_badge"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  FIRST_TRAINING_BADGE_ID uuid := 'df9c3cbc-5dbc-47a9-afa7-dce5058b466b'; -- ←ここ差し替え
begin
  if new.event_type in ('training_record_created', 'training_completed') then
    insert into public.user_badges (user_id, badge_id, earned_at, is_new, metadata)
    values (
      new.user_id,
      FIRST_TRAINING_BADGE_ID,
      now(),
      true,
      jsonb_build_object(
        'source', 'events',
        'event_type', new.event_type,
        'event_id', new.id
      )
    )
    on conflict (user_id, badge_id) do nothing;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."award_first_training_badge"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."award_points"("p_user_id" "uuid", "p_points" integer, "p_reason" "text", "p_category" "text", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_total_points integer;
  v_current_level integer;
  v_new_level integer;
  v_points_for_next integer;

  v_prev_rank_tier text;
  v_rank_tier text;
  v_rank_level text;
  v_rank_title text;

  v_bonus_points integer := 0;
  v_already_bonus boolean := false;

  v_is_rank_bonus_call boolean := false;
BEGIN
  /*
    0) この呼び出しが「ランク到達ボーナス（B案）」自身か？
       - category='bonus' かつ metadata.bonus_type='rank_bonus' を rank_bonus_call とみなす
       - これにより無限ループ・二重処理を防ぐ
  */
  v_is_rank_bonus_call :=
    (p_category = 'bonus' AND COALESCE(p_metadata->>'bonus_type','') = 'rank_bonus');

  /*
    1) 更新前の rank_tier を取得（ここが超重要）
       ※ user_points が無い初回は NULL
  */
  SELECT rank_tier
    INTO v_prev_rank_tier
  FROM user_points
  WHERE user_id = p_user_id;

  /*
    2) ポイント履歴を記録（まずは履歴）
  */
  INSERT INTO point_transactions (user_id, points, reason, category, metadata)
  VALUES (p_user_id, p_points, p_reason, p_category, p_metadata);

  /*
    3) user_points を加算（Upsert）
  */
  INSERT INTO user_points (user_id, total_points)
  VALUES (p_user_id, p_points)
  ON CONFLICT (user_id)
  DO UPDATE SET
    total_points = user_points.total_points + p_points,
    updated_at = now();

  /*
    4) 現在の合計ポイントとレベルを取得
  */
  SELECT total_points, current_level
    INTO v_total_points, v_current_level
  FROM user_points
  WHERE user_id = p_user_id;

  /*
    5) レベル計算
  */
  v_new_level := 1;
  v_points_for_next := 100;

  WHILE v_total_points >= v_points_for_next LOOP
    v_new_level := v_new_level + 1;
    v_points_for_next := v_points_for_next + (v_new_level * 50);
  END LOOP;

  /*
    6) ランク（ティア/段位）計算
    ※ここはノリさんの現行閾値をそのまま移植
  */
  IF v_total_points >= 25000 THEN
    v_rank_tier := 'マスター'; v_rank_level := 'V'; v_rank_title := 'マスター V';
  ELSIF v_total_points >= 23000 THEN
    v_rank_tier := 'マスター'; v_rank_level := 'IV'; v_rank_title := 'マスター IV';
  ELSIF v_total_points >= 21000 THEN
    v_rank_tier := 'マスター'; v_rank_level := 'III'; v_rank_title := 'マスター III';
  ELSIF v_total_points >= 19500 THEN
    v_rank_tier := 'マスター'; v_rank_level := 'II'; v_rank_title := 'マスター II';
  ELSIF v_total_points >= 18000 THEN
    v_rank_tier := 'マスター'; v_rank_level := 'I'; v_rank_title := 'マスター I';
  ELSIF v_total_points >= 16800 THEN
    v_rank_tier := 'ダイヤモンド'; v_rank_level := 'V'; v_rank_title := 'ダイヤモンド V';
  ELSIF v_total_points >= 15600 THEN
    v_rank_tier := 'ダイヤモンド'; v_rank_level := 'IV'; v_rank_title := 'ダイヤモンド IV';
  ELSIF v_total_points >= 14400 THEN
    v_rank_tier := 'ダイヤモンド'; v_rank_level := 'III'; v_rank_title := 'ダイヤモンド III';
  ELSIF v_total_points >= 13200 THEN
    v_rank_tier := 'ダイヤモンド'; v_rank_level := 'II'; v_rank_title := 'ダイヤモンド II';
  ELSIF v_total_points >= 12000 THEN
    v_rank_tier := 'ダイヤモンド'; v_rank_level := 'I'; v_rank_title := 'ダイヤモンド I';
  ELSIF v_total_points >= 11200 THEN
    v_rank_tier := 'プラチナ'; v_rank_level := 'V'; v_rank_title := 'プラチナ V';
  ELSIF v_total_points >= 10400 THEN
    v_rank_tier := 'プラチナ'; v_rank_level := 'IV'; v_rank_title := 'プラチナ IV';
  ELSIF v_total_points >= 9600 THEN
    v_rank_tier := 'プラチナ'; v_rank_level := 'III'; v_rank_title := 'プラチナ III';
  ELSIF v_total_points >= 8800 THEN
    v_rank_tier := 'プラチナ'; v_rank_level := 'II'; v_rank_title := 'プラチナ II';
  ELSIF v_total_points >= 8000 THEN
    v_rank_tier := 'プラチナ'; v_rank_level := 'I'; v_rank_title := 'プラチナ I';
  ELSIF v_total_points >= 7400 THEN
    v_rank_tier := 'ゴールド'; v_rank_level := 'V'; v_rank_title := 'ゴールド V';
  ELSIF v_total_points >= 6800 THEN
    v_rank_tier := 'ゴールド'; v_rank_level := 'IV'; v_rank_title := 'ゴールド IV';
  ELSIF v_total_points >= 6200 THEN
    v_rank_tier := 'ゴールド'; v_rank_level := 'III'; v_rank_title := 'ゴールド III';
  ELSIF v_total_points >= 5600 THEN
    v_rank_tier := 'ゴールド'; v_rank_level := 'II'; v_rank_title := 'ゴールド II';
  ELSIF v_total_points >= 5000 THEN
    v_rank_tier := 'ゴールド'; v_rank_level := 'I'; v_rank_title := 'ゴールド I';
  ELSIF v_total_points >= 4700 THEN
    v_rank_tier := 'シルバー'; v_rank_level := 'V'; v_rank_title := 'シルバー V';
  ELSIF v_total_points >= 4400 THEN
    v_rank_tier := 'シルバー'; v_rank_level := 'IV'; v_rank_title := 'シルバー IV';
  ELSIF v_total_points >= 3800 THEN
    v_rank_tier := 'シルバー'; v_rank_level := 'III'; v_rank_title := 'シルバー III';
  ELSIF v_total_points >= 3400 THEN
    v_rank_tier := 'シルバー'; v_rank_level := 'II'; v_rank_title := 'シルバー II';
  ELSIF v_total_points >= 3000 THEN
    v_rank_tier := 'シルバー'; v_rank_level := 'I'; v_rank_title := 'シルバー I';
  ELSIF v_total_points >= 2600 THEN
    v_rank_tier := 'ブロンズ'; v_rank_level := 'V'; v_rank_title := 'ブロンズ V';
  ELSIF v_total_points >= 2200 THEN
    v_rank_tier := 'ブロンズ'; v_rank_level := 'IV'; v_rank_title := 'ブロンズ IV';
  ELSIF v_total_points >= 1800 THEN
    v_rank_tier := 'ブロンズ'; v_rank_level := 'III'; v_rank_title := 'ブロンズ III';
  ELSIF v_total_points >= 1400 THEN
    v_rank_tier := 'ブロンズ'; v_rank_level := 'II'; v_rank_title := 'ブロンズ II';
  ELSIF v_total_points >= 1000 THEN
    v_rank_tier := 'ブロンズ'; v_rank_level := 'I'; v_rank_title := 'ブロンズ I';
  ELSIF v_total_points >= 800 THEN
    v_rank_tier := 'ビギナー'; v_rank_level := 'V'; v_rank_title := 'ビギナー V';
  ELSIF v_total_points >= 600 THEN
    v_rank_tier := 'ビギナー'; v_rank_level := 'IV'; v_rank_title := 'ビギナー IV';
  ELSIF v_total_points >= 400 THEN
    v_rank_tier := 'ビギナー'; v_rank_level := 'III'; v_rank_title := 'ビギナー III';
  ELSIF v_total_points >= 200 THEN
    v_rank_tier := 'ビギナー'; v_rank_level := 'II'; v_rank_title := 'ビギナー II';
  ELSE
    v_rank_tier := 'ビギナー'; v_rank_level := 'I'; v_rank_title := 'ビギナー I';
  END IF;

  /*
    7) user_points を更新
  */
  UPDATE user_points
  SET
    current_level = v_new_level,
    points_to_next_level = v_points_for_next - v_total_points,
    rank_title = v_rank_title,
    rank_tier = v_rank_tier,
    rank_level = v_rank_level,
    updated_at = now()
  WHERE user_id = p_user_id;

  /*
    8) ティア到達時の処理（バッジ + ボーナス）
       - 今回の呼び出しが rank_bonus 自身ならスキップ（無限ループ防止）
       - 前回ティアと今回ティアが変わった時だけ
  */
  IF NOT v_is_rank_bonus_call
     AND v_prev_rank_tier IS DISTINCT FROM v_rank_tier
  THEN

    -- 到達バッジ（earn_badge 側で points_reward=0 運用ならDBズレが起きにくい）
    IF v_rank_tier IN ('ブロンズ','シルバー','ゴールド','プラチナ','ダイヤモンド','マスター') THEN
      PERFORM public.earn_badge(
        p_user_id, 'ブロンズ到達',
        jsonb_build_object('from', v_prev_rank_tier, 'to', v_rank_tier, 'points', v_total_points)
      );
    END IF;

    IF v_rank_tier IN ('シルバー','ゴールド','プラチナ','ダイヤモンド','マスター') THEN
      PERFORM public.earn_badge(
        p_user_id, 'シルバー到達',
        jsonb_build_object('from', v_prev_rank_tier, 'to', v_rank_tier, 'points', v_total_points)
      );
    END IF;

    IF v_rank_tier IN ('ゴールド','プラチナ','ダイヤモンド','マスター') THEN
      PERFORM public.earn_badge(
        p_user_id, 'ゴールド到達',
        jsonb_build_object('from', v_prev_rank_tier, 'to', v_rank_tier, 'points', v_total_points)
      );
    END IF;

    IF v_rank_tier IN ('プラチナ','ダイヤモンド','マスター') THEN
      PERFORM public.earn_badge(
        p_user_id, 'プラチナ到達',
        jsonb_build_object('from', v_prev_rank_tier, 'to', v_rank_tier, 'points', v_total_points)
      );
    END IF;

    IF v_rank_tier IN ('ダイヤモンド','マスター') THEN
      PERFORM public.earn_badge(
        p_user_id, 'ダイヤモンド到達',
        jsonb_build_object('from', v_prev_rank_tier, 'to', v_rank_tier, 'points', v_total_points)
      );
    END IF;

    IF v_rank_tier = 'マスター' THEN
      PERFORM public.earn_badge(
        p_user_id, 'マスター到達',
        jsonb_build_object('from', v_prev_rank_tier, 'to', v_rank_tier, 'points', v_total_points)
      );
    END IF;

    -- ボーナス配分
    v_bonus_points := CASE v_rank_tier
      WHEN 'ブロンズ' THEN 100
      WHEN 'シルバー' THEN 200
      WHEN 'ゴールド' THEN 300
      WHEN 'プラチナ' THEN 500
      WHEN 'ダイヤモンド' THEN 800
      WHEN 'マスター' THEN 1200
      ELSE 0
    END;

    /*
      既配布チェック（移行対応）
      - B案: category='bonus' かつ metadata.bonus_type='rank_bonus' かつ to_tier一致
      - A案残骸: category='rank_bonus' かつ metadata.to_tier一致 も既配布扱い
    */
    IF v_bonus_points > 0 THEN
      SELECT EXISTS (
        SELECT 1
        FROM point_transactions
        WHERE user_id = p_user_id
          AND (
            (
              category = 'bonus'
              AND (metadata->>'bonus_type') = 'rank_bonus'
              AND (metadata->>'to_tier') = v_rank_tier
            )
            OR
            (
              category = 'rank_bonus'
              AND (metadata->>'to_tier') = v_rank_tier
            )
          )
      ) INTO v_already_bonus;

      IF NOT v_already_bonus THEN
        PERFORM public.award_points(
          p_user_id,
          v_bonus_points,
          'ランク到達ボーナス: ' || v_rank_tier,
          'bonus', -- ✅ CHECK制約に通る
          jsonb_build_object(
            'bonus_type', 'rank_bonus',
            'from_tier', v_prev_rank_tier,
            'to_tier', v_rank_tier,
            'total_points_at_award', v_total_points,
            'bonus', v_bonus_points
          )
        );
      END IF;
    END IF;

  END IF;

END;
$$;


ALTER FUNCTION "public"."award_points"("p_user_id" "uuid", "p_points" integer, "p_reason" "text", "p_category" "text", "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."backfill_inbody_user_id_from_phone"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  -- phone_number が入った / 変更されたら
  -- 未紐づけの inbody_records をまとめて紐づける
  update public.inbody_records r
  set
    user_id = new.id,
    updated_at = now()
  where r.user_id is null
    and normalize_phone(r.phone_number) = normalize_phone(new.phone_number);

  return new;
end;
$$;


ALTER FUNCTION "public"."backfill_inbody_user_id_from_phone"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."backfill_rank_reach_badges"("p_user_id" "uuid" DEFAULT NULL::"uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  r record;
  v_tier text;
  v_points integer;
  v_meta jsonb;
BEGIN
  FOR r IN
    SELECT user_id, rank_tier, total_points
    FROM public.user_points
    WHERE p_user_id IS NULL OR user_id = p_user_id
  LOOP
    v_tier := r.rank_tier;
    v_points := r.total_points;

    v_meta := jsonb_build_object(
      'type', 'rank_reach_backfill',
      'points', v_points,
      'tier', v_tier,
      'at', now()
    );

    -- 到達ティアに応じて「下位を含めて」埋める
    IF v_tier IN ('ブロンズ','シルバー','ゴールド','プラチナ','ダイヤモンド','マスター') THEN
      PERFORM public.grant_badge_no_points(r.user_id, 'ブロンズ到達', v_meta);
    END IF;

    IF v_tier IN ('シルバー','ゴールド','プラチナ','ダイヤモンド','マスター') THEN
      PERFORM public.grant_badge_no_points(r.user_id, 'シルバー到達', v_meta);
    END IF;

    IF v_tier IN ('ゴールド','プラチナ','ダイヤモンド','マスター') THEN
      PERFORM public.grant_badge_no_points(r.user_id, 'ゴールド到達', v_meta);
    END IF;

    IF v_tier IN ('プラチナ','ダイヤモンド','マスター') THEN
      PERFORM public.grant_badge_no_points(r.user_id, 'プラチナ到達', v_meta);
    END IF;

    IF v_tier IN ('ダイヤモンド','マスター') THEN
      PERFORM public.grant_badge_no_points(r.user_id, 'ダイヤモンド到達', v_meta);
    END IF;

    IF v_tier = 'マスター' THEN
      PERFORM public.grant_badge_no_points(r.user_id, 'マスター到達', v_meta);
    END IF;

  END LOOP;
END;
$$;


ALTER FUNCTION "public"."backfill_rank_reach_badges"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."block_team_change_unless_org_or_global"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  target_org uuid;
begin
  -- team_id が変わってなければOK
  if new.team_id is not distinct from old.team_id then
    return new;
  end if;

  -- global admin はOK
  if public.is_global_admin() then
    return new;
  end if;

  -- 変更先チームの organization を取得して org_admin ならOK
  select t.organization_id into target_org
    from public.teams t
   where t.id = new.team_id;

  if target_org is not null and public.is_org_admin(target_org) then
    return new;
  end if;

  raise exception 'team_id change is not allowed (org_admin/global_admin only)';
end;
$$;


ALTER FUNCTION "public"."block_team_change_unless_org_or_global"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_injury_risk"("p_user_id" "uuid", "p_date" "date") RETURNS numeric
    LANGUAGE "plpgsql"
    AS $$
DECLARE
v_acwr_risk decimal := 0;
v_workload_spike_risk decimal := 0;
v_fatigue_risk decimal := 0;
v_recent_injury_risk decimal := 0;
v_total_risk decimal;
v_recent_acwr decimal;
v_recent_injury_count integer;
BEGIN
SELECT 
CASE 
WHEN acwr > 1.5 THEN LEAST(((acwr - 1.5) / 0.5) * 40, 40)
WHEN acwr < 0.8 THEN LEAST(((0.8 - acwr) / 0.2) * 30, 30)
ELSE 0
END INTO v_acwr_risk
FROM (
SELECT 
COALESCE(SUM(CASE WHEN date >= p_date - 6 THEN load ELSE 0 END) / NULLIF(SUM(CASE WHEN date >= p_date - 27 AND date < p_date - 6 THEN load ELSE 0 END) / 3, 0), 0) as acwr
FROM training_records
WHERE user_id = p_user_id AND date <= p_date AND date >= p_date - 27
) acwr_calc;

SELECT 
CASE 
WHEN weekly_increase > 0.3 THEN LEAST(weekly_increase * 60, 30)
ELSE 0
END INTO v_workload_spike_risk
FROM (
SELECT 
COALESCE(
(SUM(CASE WHEN date >= p_date - 6 THEN load ELSE 0 END) - 
SUM(CASE WHEN date >= p_date - 13 AND date < p_date - 6 THEN load ELSE 0 END)) /
NULLIF(SUM(CASE WHEN date >= p_date - 13 AND date < p_date - 6 THEN load ELSE 0 END), 0),
0
) as weekly_increase
FROM training_records
WHERE user_id = p_user_id AND date <= p_date AND date >= p_date - 13
) spike_calc;

SELECT COUNT(*) INTO v_recent_injury_count
FROM injury_records
WHERE user_id = p_user_id 
AND occurred_date >= p_date - 90
AND (recovered_date IS NULL OR recovered_date >= p_date - 30);

v_recent_injury_risk := LEAST(v_recent_injury_count * 15, 30);

v_total_risk := (v_acwr_risk * 0.4) + (v_workload_spike_risk * 0.3) + (v_recent_injury_risk * 0.3);

RETURN LEAST(v_total_risk, 100);
END;
$$;


ALTER FUNCTION "public"."calculate_injury_risk"("p_user_id" "uuid", "p_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_next_run"("p_schedule_type" "text", "p_schedule_config" "jsonb", "p_from_date" timestamp with time zone DEFAULT "now"()) RETURNS timestamp with time zone
    LANGUAGE "plpgsql"
    AS $$
DECLARE
v_next_run timestamptz;
v_day_of_week integer;
v_day_of_month integer;
v_time time;
BEGIN
v_time := COALESCE((p_schedule_config->>'time')::time, '09:00:00'::time);

CASE p_schedule_type
WHEN 'daily' THEN
v_next_run := (p_from_date::date + interval '1 day' + v_time::interval)::timestamptz;

WHEN 'weekly' THEN
v_day_of_week := COALESCE((p_schedule_config->>'day_of_week')::integer, 1);
v_next_run := (p_from_date::date + ((7 + v_day_of_week - EXTRACT(DOW FROM p_from_date)::integer) % 7)::integer * interval '1 day' + v_time::interval)::timestamptz;
IF v_next_run <= p_from_date THEN
v_next_run := v_next_run + interval '7 days';
END IF;

WHEN 'monthly' THEN
v_day_of_month := COALESCE((p_schedule_config->>'day_of_month')::integer, 1);
v_next_run := (date_trunc('month', p_from_date) + (v_day_of_month - 1)::integer * interval '1 day' + v_time::interval)::timestamptz;
IF v_next_run <= p_from_date THEN
v_next_run := (date_trunc('month', p_from_date + interval '1 month') + (v_day_of_month - 1)::integer * interval '1 day' + v_time::interval)::timestamptz;
END IF;

ELSE
v_next_run := NULL;
END CASE;

RETURN v_next_run;
END;
$$;


ALTER FUNCTION "public"."calculate_next_run"("p_schedule_type" "text", "p_schedule_config" "jsonb", "p_from_date" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_relative_1rm"("p_1rm" numeric, "p_weight" numeric) RETURNS numeric
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
BEGIN
IF p_weight IS NULL OR p_weight = 0 THEN
RETURN NULL;
END IF;

RETURN ROUND(p_1rm / p_weight, 2);
END;
$$;


ALTER FUNCTION "public"."calculate_relative_1rm"("p_1rm" numeric, "p_weight" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."call_alert_daily_summary"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_url text := 'https://cymnqmbdwaveccoooics.supabase.co/functions/v1/alert-daily-summary';
begin
  -- 認証チェックは verify_jwt = false にしているので、
  -- ヘッダー無し・シンプルな 3 引数バージョンでOK
  perform extensions.http_post(
    v_url,
    'application/json',
    '{}'::text
  );
end;
$$;


ALTER FUNCTION "public"."call_alert_daily_summary"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_read_user"("target_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    target_user_id = auth.uid()
    or public.current_user_role() = 'admin'
    or (
      public.current_user_role() = 'staff'
      and exists (
        select 1
        from public.users tu
        where tu.id = target_user_id
          and tu.team_id in (
            select team_id
            from public.staff_team_links
            where staff_user_id = auth.uid()
          )
      )
    );
$$;


ALTER FUNCTION "public"."can_read_user"("target_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_empty_threads"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
deleted_count integer;
BEGIN
DELETE FROM message_threads mt
WHERE mt.created_at < now() - interval '90 days'
AND NOT EXISTS (
SELECT 1 FROM messages m
WHERE m.thread_id = mt.id
);

GET DIAGNOSTICS deleted_count = ROW_COUNT;

RAISE NOTICE 'Cleaned up % empty threads', deleted_count;

RETURN deleted_count;
END;
$$;


ALTER FUNCTION "public"."cleanup_empty_threads"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_messaging_data"() RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
messages_deleted integer;
threads_deleted integer;
BEGIN
SELECT cleanup_old_messages() INTO messages_deleted;

SELECT cleanup_empty_threads() INTO threads_deleted;

RETURN json_build_object(
'messages_deleted', messages_deleted,
'threads_deleted', threads_deleted,
'cleaned_at', now()
);
END;
$$;


ALTER FUNCTION "public"."cleanup_messaging_data"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_old_messages"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
deleted_count integer;
BEGIN
DELETE FROM messages
WHERE created_at < now() - interval '90 days';

GET DIAGNOSTICS deleted_count = ROW_COUNT;

RAISE NOTICE 'Cleaned up % old messages', deleted_count;

RETURN deleted_count;
END;
$$;


ALTER FUNCTION "public"."cleanup_old_messages"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."consume_invitation_token"("p_token_hash" "text") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with updated as (
    update public.invitation_tokens it
       set used = true,
           used_at = now()
     where it.token = p_token_hash
       and it.used = false
       and it.expires_at > now()
     returning 1
  )
  select exists (select 1 from updated);
$$;


ALTER FUNCTION "public"."consume_invitation_token"("p_token_hash" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_app_role"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
  select u.role
  from public.users u
  where u.id = auth.uid()
  limit 1
$$;


ALTER FUNCTION "public"."current_app_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_app_user_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE
    AS $$
  select auth.uid()
$$;


ALTER FUNCTION "public"."current_app_user_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_user_role"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select u.role
  from public.users u
  where u.id = auth.uid();
$$;


ALTER FUNCTION "public"."current_user_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."earn_badge"("p_user_id" "uuid", "p_badge_name" "text", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_badge_id uuid;
  v_inserted boolean := false;
BEGIN
  -- バッジID取得
  SELECT id
    INTO v_badge_id
  FROM badges
  WHERE name = p_badge_name;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- 付与（重複はユニーク制約で防止）
  INSERT INTO user_badges (user_id, badge_id, metadata)
  VALUES (p_user_id, v_badge_id, p_metadata)
  ON CONFLICT (user_id, badge_id) DO NOTHING;

  -- 今回INSERTできたか判定
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  RETURN v_inserted;
END;
$$;


ALTER FUNCTION "public"."earn_badge"("p_user_id" "uuid", "p_badge_name" "text", "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_athlete_transfer_history"("athlete_user_id" "uuid") RETURNS TABLE("id" "uuid", "from_team_name" "text", "to_team_name" "text", "transfer_date" timestamp with time zone, "transferred_by_name" "text", "transfer_reason" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
RETURN QUERY
SELECT 
tth.id,
t_from.name as from_team_name,
t_to.name as to_team_name,
tth.transfer_date,
u.name as transferred_by_name,
tth.transfer_reason
FROM team_transfer_history tth
LEFT JOIN teams t_from ON tth.from_team_id = t_from.id
JOIN teams t_to ON tth.to_team_id = t_to.id
JOIN users u ON tth.transferred_by = u.id
WHERE tth.athlete_id = athlete_user_id
ORDER BY tth.transfer_date DESC;
END;
$$;


ALTER FUNCTION "public"."get_athlete_transfer_history"("athlete_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_coach_week_athlete_cards"("p_team_id" "uuid", "p_start_date" "date", "p_end_date" "date") RETURNS TABLE("team_id" "uuid", "athlete_user_id" "uuid", "athlete_name" "text", "athlete_email" "text", "week_duration_min" integer, "week_rpe_avg" numeric, "week_load_sum" numeric, "sleep_hours_avg" numeric, "sleep_quality_avg" numeric, "motivation_avg" numeric, "energy_avg" numeric, "stress_avg" numeric, "is_sharing_active" boolean, "allow_condition" boolean, "allow_training" boolean, "allow_body" boolean, "allow_reflection" boolean, "allow_free_note" boolean, "action_total" integer, "action_done" integer, "action_done_rate" integer)
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
with team_athletes as (
  select
    u.id as athlete_user_id,
    u.team_id,
    u.name as athlete_name,
    u.email as athlete_email
  from public.users u
  where u.role = 'athlete'
    and u.team_id = p_team_id
),

training_agg as (
  select
    tr.user_id as athlete_user_id,
    sum(coalesce(tr.duration_min, 0))::int as week_duration_min,
    avg(nullif(tr.rpe, 0))::numeric as week_rpe_avg,
    sum(coalesce(tr.rpe, 0) * coalesce(tr.duration_min, 0))::numeric as week_load_sum
  from public.training_records tr
  where tr.date >= p_start_date
    and tr.date <  p_end_date
  group by tr.user_id
),

sleep_agg as (
  select
    sr.user_id as athlete_user_id,

    -- ✅ sleep_hours が numeric 型でも落ちない（先に text 化）
    avg(
      case
        when btrim(coalesce(sr.sleep_hours::text, '')) = '' then null
        else
          case
            when translate(btrim(sr.sleep_hours::text), '0123456789.', '') = ''
              then btrim(sr.sleep_hours::text)::numeric
            else null
          end
      end
    ) as sleep_hours_avg,

    -- ✅ sleep_quality も念のため text→numeric（空白/空文字を許容）
    avg(
      nullif(btrim(coalesce(sr.sleep_quality::text, '')), '')::numeric
    ) as sleep_quality_avg

  from public.sleep_records sr
  where sr.date >= p_start_date
    and sr.date <  p_end_date
  group by sr.user_id
),

motivation_agg as (
  select
    mr.user_id as athlete_user_id,
    avg(mr.motivation_level::numeric) as motivation_avg,
    avg(mr.energy_level::numeric) as energy_avg,
    avg(mr.stress_level::numeric) as stress_avg
  from public.motivation_records mr
  where mr.date >= p_start_date
    and mr.date <  p_end_date
  group by mr.user_id
),

reflection_actions as (
  select
    r.user_id as athlete_user_id,
    sum(
      case
        when r.next_action_items is null then 0
        when jsonb_typeof(r.next_action_items) <> 'array' then 0
        else jsonb_array_length(r.next_action_items)
      end
    )::int as action_total,
    sum(
      case
        when r.next_action_items is null then 0
        when jsonb_typeof(r.next_action_items) <> 'array' then 0
        else (
          select count(*)
          from jsonb_array_elements(r.next_action_items) e
          where coalesce((e->>'done')::boolean, false) = true
        )
      end
    )::int as action_done
  from public.reflections r
  where r.reflection_date >= p_start_date
    and r.reflection_date <  p_end_date
  group by r.user_id
)

select
  ta.team_id,
  ta.athlete_user_id,
  ta.athlete_name,
  ta.athlete_email,

  coalesce(tg.week_duration_min, 0) as week_duration_min,
  tg.week_rpe_avg,
  coalesce(tg.week_load_sum, 0) as week_load_sum,

  sa.sleep_hours_avg,
  sa.sleep_quality_avg,

  ma.motivation_avg,
  ma.energy_avg,
  ma.stress_avg,

  true as is_sharing_active,
  true as allow_condition,
  true as allow_training,
  true as allow_body,
  true as allow_reflection,
  true as allow_free_note,

  coalesce(ra.action_total, 0) as action_total,
  coalesce(ra.action_done, 0) as action_done,
  case
    when coalesce(ra.action_total, 0) = 0 then 0
    else round((coalesce(ra.action_done, 0)::numeric / ra.action_total::numeric) * 100)
  end::int as action_done_rate

from team_athletes ta
left join training_agg tg on tg.athlete_user_id = ta.athlete_user_id
left join sleep_agg sa on sa.athlete_user_id = ta.athlete_user_id
left join motivation_agg ma on ma.athlete_user_id = ta.athlete_user_id
left join reflection_actions ra on ra.athlete_user_id = ta.athlete_user_id;
$$;


ALTER FUNCTION "public"."get_coach_week_athlete_cards"("p_team_id" "uuid", "p_start_date" "date", "p_end_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_coach_week_cause_tags"("p_team_id" "uuid", "p_start_date" "date", "p_end_date" "date") RETURNS TABLE("team_id" "uuid", "tag" "text", "cnt" bigint)
    LANGUAGE "sql" STABLE
    AS $$
  with team_athletes as (
    select utm.user_id
    from public.user_team_memberships utm
    where utm.team_id = p_team_id
  ),
  src as (
    select
      p_team_id as team_id,
      unnest(coalesce(r.cause_tags, '{}'::text[])) as tag
    from public.reflections r
    join team_athletes ta on ta.user_id = r.user_id
    where r.reflection_date between p_start_date and p_end_date
  )
  select
    team_id,
    tag,
    count(*) as cnt
  from src
  where btrim(coalesce(tag, '')) <> ''
  group by team_id, tag
  order by cnt desc, tag asc;
$$;


ALTER FUNCTION "public"."get_coach_week_cause_tags"("p_team_id" "uuid", "p_start_date" "date", "p_end_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_latest_weight"("p_user_id" "uuid") RETURNS numeric
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
DECLARE
latest_weight numeric;
BEGIN
SELECT weight_kg
INTO latest_weight
FROM weight_records
WHERE user_id = p_user_id
ORDER BY date DESC, created_at DESC
LIMIT 1;

RETURN latest_weight;
END;
$$;


ALTER FUNCTION "public"."get_latest_weight"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_staff_team_ids"() RETURNS "uuid"[]
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select coalesce(array_agg(stl.team_id), '{}'::uuid[])
  from public.staff_team_links stl
  where stl.staff_user_id = auth.uid();
$$;


ALTER FUNCTION "public"."get_staff_team_ids"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_team_cause_tags"("p_team_id" "uuid", "p_start_date" "date", "p_end_date" "date") RETURNS TABLE("team_id" "uuid", "tag" "text", "cnt" bigint)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    p_team_id as team_id,
    t.tag as tag,
    count(*) as cnt
  from public.reflections r
  join public.staff_team_athletes_with_activity a
    on a.team_id = p_team_id
   and a.id = r.user_id
  cross join lateral (
    select unnest(coalesce(r.cause_tags, array[]::text[])) as tag
  ) t
  where r.reflection_date between p_start_date and p_end_date
  group by t.tag
  order by cnt desc, tag asc;
$$;


ALTER FUNCTION "public"."get_team_cause_tags"("p_team_id" "uuid", "p_start_date" "date", "p_end_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_team_members_with_assignments"("p_team_id" "uuid") RETURNS TABLE("user_id" "uuid", "user_name" "text", "user_email" "text", "user_role" "text", "assignment_type" "text", "assigned_at" timestamp with time zone, "assigned_by_name" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
RETURN QUERY
SELECT
u.id,
u.name,
u.email,
u.role,
tma.assignment_type,
tma.assigned_at,
assigner.name as assigned_by_name
FROM users u
INNER JOIN team_member_assignments tma ON u.id = tma.user_id
LEFT JOIN users assigner ON tma.assigned_by = assigner.id
WHERE tma.team_id = p_team_id
ORDER BY tma.assignment_type, u.name;
END;
$$;


ALTER FUNCTION "public"."get_team_members_with_assignments"("p_team_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_unassigned_organization_members"("p_organization_id" "uuid") RETURNS TABLE("user_id" "uuid", "user_name" "text", "user_email" "text", "user_role" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
RETURN QUERY
SELECT
u.id,
u.name,
u.email,
u.role
FROM users u
INNER JOIN organization_members om ON u.id = om.user_id
WHERE om.organization_id = p_organization_id
AND NOT EXISTS (
SELECT 1 FROM team_member_assignments tma
WHERE tma.user_id = u.id 
AND tma.organization_id = p_organization_id
AND tma.assignment_type = 'primary'
)
ORDER BY u.name;
END;
$$;


ALTER FUNCTION "public"."get_unassigned_organization_members"("p_organization_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."grant_badge_no_points"("p_user_id" "uuid", "p_badge_name" "text", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_badge_id uuid;
BEGIN
  -- バッジID取得
  SELECT id INTO v_badge_id
  FROM public.badges
  WHERE name = p_badge_name;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- 既に獲得済みなら何もしない
  IF EXISTS (
    SELECT 1
    FROM public.user_badges
    WHERE user_id = p_user_id AND badge_id = v_badge_id
  ) THEN
    RETURN false;
  END IF;

  -- 付与（ポイントは付与しない）
  INSERT INTO public.user_badges (user_id, badge_id, metadata)
  VALUES (p_user_id, v_badge_id, p_metadata);

  RETURN true;
END;
$$;


ALTER FUNCTION "public"."grant_badge_no_points"("p_user_id" "uuid", "p_badge_name" "text", "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
user_name text;
user_role text;
user_team_id uuid;
BEGIN
user_name := COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));
user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'athlete');
user_team_id := (NEW.raw_user_meta_data->>'team_id')::uuid;

INSERT INTO public.users (id, name, email, role, team_id)
VALUES (
NEW.id,
user_name,
NEW.email,
user_role,
user_team_id
)
ON CONFLICT (id) DO UPDATE SET
name = EXCLUDED.name,
email = EXCLUDED.email,
role = EXCLUDED.role,
team_id = EXCLUDED.team_id;

RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_report_view_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
IF NEW.viewed_at IS NOT NULL AND (OLD.viewed_at IS NULL OR NEW.viewed_at <> OLD.viewed_at) THEN
NEW.view_count = OLD.view_count + 1;
END IF;
RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."increment_report_view_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.users
    where id = auth.uid()
      and role = 'admin'
  );
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_global_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  select exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'global_admin'
  );
$$;


ALTER FUNCTION "public"."is_global_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_org_admin"("org_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
      from public.organization_members om
     where om.organization_id = org_id
       and om.user_id = auth.uid()
       and om.role = 'organization_admin'
  );
$$;


ALTER FUNCTION "public"."is_org_admin"("org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_org_member"("org_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = org_id
      and om.user_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."is_org_member"("org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_organization_admin"("org_id" "uuid", "check_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
BEGIN
RETURN EXISTS (
SELECT 1 FROM organization_members
WHERE organization_id = org_id
AND user_id = check_user_id
AND role = 'organization_admin'
);
END;
$$;


ALTER FUNCTION "public"."is_organization_admin"("org_id" "uuid", "check_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_staff"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.users
    where id = auth.uid()
      and role = 'staff'
  );
$$;


ALTER FUNCTION "public"."is_staff"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_staff_or_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  select exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role in ('staff','admin')
  );
$$;


ALTER FUNCTION "public"."is_staff_or_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_team_admin"("team_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
      from public.staff_team_links stl
     where stl.team_id = team_id
       and stl.staff_user_id = auth.uid()
       and stl.role = 'team_admin'
  );
$$;


ALTER FUNCTION "public"."is_team_admin"("team_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."link_inbody_by_phone"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  -- phone_number が未設定 → 設定された瞬間のみ
  if old.phone_number is null
     and new.phone_number is not null
     and new.user_id is not null then

    update public.inbody_records
    set user_id = new.user_id
    where user_id is null
      and phone_number_norm = normalize_phone(new.phone_number);
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."link_inbody_by_phone"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."link_inbody_by_user_phone"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_norm text;
begin
  -- phone_number が空なら何もしない
  if new.phone_number is null or length(trim(new.phone_number)) = 0 then
    return new;
  end if;

  -- UPDATEで電話番号が変わってないなら何もしない（無駄撃ち防止）
  if tg_op = 'UPDATE' and (new.phone_number is not distinct from old.phone_number) then
    return new;
  end if;

  -- 正規化（users側にphone_number_norm列は不要）
  v_norm := normalize_phone(new.phone_number);

  if v_norm is null or length(trim(v_norm)) = 0 then
    return new;
  end if;

  -- まだ紐づいてないinbody_recordsだけを、そのユーザーに紐づける
  update public.inbody_records r
  set user_id = new.id,
      updated_at = now()
  where
    r.user_id is null
    and r.phone_number_norm = v_norm;

  return new;
end;
$$;


ALTER FUNCTION "public"."link_inbody_by_user_phone"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."link_inbody_records_by_phone"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  updated_count integer;
begin
  update public.inbody_records ir
  set user_id = u.id
  from public.users u
  where
    ir.user_id is null
    and normalize_phone(ir.phone_number) = normalize_phone(u.phone_number);

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;


ALTER FUNCTION "public"."link_inbody_records_by_phone"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."link_inbody_records_by_phone"("p_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_phone text;
  v_norm  text;
  v_count int := 0;
begin
  -- 対象ユーザーの電話番号を取得（app_users）
  select phone_number
    into v_phone
  from public.users
  where user_id = p_user_id;

  if v_phone is null or length(trim(v_phone)) = 0 then
    return json_build_object('ok', false, 'reason', 'no phone_number on users');
  end if;

  v_norm := public.normalize_phone(v_phone);

  if v_norm is null or length(trim(v_norm)) = 0 then
    return json_build_object('ok', false, 'reason', 'normalize_phone failed');
  end if;

  -- inbody_records 側の user_id を埋める（未紐付けのみ）
  update public.inbody_records
     set user_id = p_user_id,
         updated_at = now()
   where user_id is null
     and phone_number_norm = v_norm;

  get diagnostics v_count = row_count;

  return json_build_object('ok', true, 'linked', v_count, 'phone_norm', v_norm);
end;
$$;


ALTER FUNCTION "public"."link_inbody_records_by_phone"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."link_inbody_records_by_phone"("p_user_id" "uuid", "p_phone" "text") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_norm text;
  v_updated int;
begin
  if p_user_id is null or p_phone is null or length(trim(p_phone)) = 0 then
    return 0;
  end if;

  v_norm := normalize_phone(p_phone);
  if v_norm is null or length(v_norm) = 0 then
    return 0;
  end if;

  update public.inbody_records r
     set user_id = p_user_id,
         updated_at = now()
   where r.user_id is null
     and r.phone_number_norm = v_norm;

  get diagnostics v_updated = row_count;
  return v_updated;
end $$;


ALTER FUNCTION "public"."link_inbody_records_by_phone"("p_user_id" "uuid", "p_phone" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."link_inbody_records_for_user"("p_user_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_phone text;
  v_norm text;
  v_count integer;
begin
  select phone_number into v_phone
  from public.users
  where id = p_user_id;

  if v_phone is null or trim(v_phone) = '' then
    return 0;
  end if;

  v_norm := normalize_phone(v_phone);

  update public.inbody_records
  set user_id = p_user_id, updated_at = now()
  where user_id is null
    and phone_number_norm = v_norm;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;


ALTER FUNCTION "public"."link_inbody_records_for_user"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_team_achievement_celebrated"("p_achievement_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
UPDATE team_achievements
SET celebrated = true
WHERE id = p_achievement_id;
END;
$$;


ALTER FUNCTION "public"."mark_team_achievement_celebrated"("p_achievement_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_team_notification_read"("p_notification_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
UPDATE team_achievement_notifications
SET is_read = true
WHERE id = p_notification_id
AND user_id = auth.uid();
END;
$$;


ALTER FUNCTION "public"."mark_team_notification_read"("p_notification_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."my_organization_ids"() RETURNS "uuid"[]
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
  select coalesce(array_agg(distinct organization_id), '{}'::uuid[])
  from public.organization_members
  where user_id = auth.uid();
$$;


ALTER FUNCTION "public"."my_organization_ids"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_phone"("p" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select nullif(regexp_replace(
    translate(coalesce(p,''), '０１２３４５６７８９', '0123456789'),
    '\D', '', 'g'
  ), '');
$$;


ALTER FUNCTION "public"."normalize_phone"("p" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_motivation_record_gamification"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
v_base_points integer := 5;
v_total_records integer;
v_current_streak integer;
BEGIN
PERFORM update_user_streak(NEW.user_id, 'motivation', NEW.date::date);
PERFORM update_user_streak(NEW.user_id, 'all', NEW.date::date);

PERFORM award_points(
NEW.user_id,
v_base_points,
'モチベーション記録',
'record',
jsonb_build_object('record_id', NEW.id, 'record_type', 'motivation')
);

SELECT COUNT(*) INTO v_total_records
FROM motivation_records
WHERE user_id = NEW.user_id;

IF v_total_records = 1 THEN
SELECT COUNT(*) INTO v_total_records
FROM training_records
WHERE user_id = NEW.user_id;

IF v_total_records = 0 THEN
PERFORM earn_badge(NEW.user_id, 'はじめの一歩');
END IF;
END IF;

SELECT current_streak INTO v_current_streak
FROM user_streaks
WHERE user_id = NEW.user_id AND streak_type = 'motivation';

IF v_current_streak = 7 THEN
PERFORM earn_badge(NEW.user_id, '7日連続');
ELSIF v_current_streak = 30 THEN
PERFORM earn_badge(NEW.user_id, '30日連続');
ELSIF v_current_streak = 100 THEN
PERFORM earn_badge(NEW.user_id, '100日連続');
END IF;

RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."process_motivation_record_gamification"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_performance_record_gamification"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
v_base_points integer := 15;
v_total_records integer;
v_is_personal_best boolean := false;
v_test_type_higher_is_better boolean;
v_best_value numeric;
BEGIN
SELECT higher_is_better INTO v_test_type_higher_is_better
FROM performance_test_types
WHERE id = NEW.test_type_id;

IF v_test_type_higher_is_better THEN
SELECT MAX((pr.values->>'primary_value')::numeric) INTO v_best_value
FROM performance_records pr
WHERE pr.user_id = NEW.user_id
AND pr.test_type_id = NEW.test_type_id
AND pr.id != NEW.id;

IF v_best_value IS NULL OR (NEW.values->>'primary_value')::numeric > v_best_value THEN
v_is_personal_best := true;
END IF;
ELSE
SELECT MIN((pr.values->>'primary_value')::numeric) INTO v_best_value
FROM performance_records pr
WHERE pr.user_id = NEW.user_id
AND pr.test_type_id = NEW.test_type_id
AND pr.id != NEW.id;

IF v_best_value IS NULL OR (NEW.values->>'primary_value')::numeric < v_best_value THEN
v_is_personal_best := true;
END IF;
END IF;

PERFORM update_user_streak(NEW.user_id, 'all', NEW.date);

PERFORM award_points(
NEW.user_id,
v_base_points,
'パフォーマンス記録',
'record',
jsonb_build_object('record_id', NEW.id, 'record_type', 'performance', 'is_pb', v_is_personal_best)
);

IF v_is_personal_best THEN
PERFORM earn_badge(NEW.user_id, 'パーソナルベスト');
END IF;

SELECT COUNT(*) INTO v_total_records
FROM performance_records
WHERE user_id = NEW.user_id;

IF v_total_records = 1 THEN
SELECT COUNT(*) INTO v_total_records
FROM training_records
WHERE user_id = NEW.user_id;

IF v_total_records = 0 THEN
PERFORM earn_badge(NEW.user_id, 'はじめの一歩');
END IF;
END IF;

RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."process_performance_record_gamification"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_sleep_record_gamification"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
v_base_points integer := 5;
v_total_records integer;
v_current_streak integer;
BEGIN
PERFORM update_user_streak(NEW.user_id, 'sleep', NEW.date::date);
PERFORM update_user_streak(NEW.user_id, 'all', NEW.date::date);

PERFORM award_points(
NEW.user_id,
v_base_points,
'睡眠記録',
'record',
jsonb_build_object('record_id', NEW.id, 'record_type', 'sleep')
);

SELECT COUNT(*) INTO v_total_records
FROM sleep_records
WHERE user_id = NEW.user_id;

IF v_total_records = 1 THEN
SELECT COUNT(*) INTO v_total_records
FROM training_records
WHERE user_id = NEW.user_id;

IF v_total_records = 0 THEN
PERFORM earn_badge(NEW.user_id, 'はじめの一歩');
END IF;
END IF;

SELECT current_streak INTO v_current_streak
FROM user_streaks
WHERE user_id = NEW.user_id AND streak_type = 'sleep';

IF v_current_streak = 7 THEN
PERFORM earn_badge(NEW.user_id, '7日連続');
ELSIF v_current_streak = 30 THEN
PERFORM earn_badge(NEW.user_id, '30日連続');
ELSIF v_current_streak = 100 THEN
PERFORM earn_badge(NEW.user_id, '100日連続');
END IF;

RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."process_sleep_record_gamification"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_training_record_gamification"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
v_base_points integer := 10;
v_bonus_points integer := 0;
v_hour integer;
v_is_first_record boolean;
v_total_records integer;
v_current_streak integer;
BEGIN
v_hour := EXTRACT(HOUR FROM now());
IF v_hour >= 5 AND v_hour < 6 THEN
v_bonus_points := 10;
END IF;

PERFORM update_user_streak(NEW.user_id, 'training', NEW.date::date);
PERFORM update_user_streak(NEW.user_id, 'all', NEW.date::date);

PERFORM award_points(
NEW.user_id,
v_base_points + v_bonus_points,
CASE 
WHEN v_bonus_points > 0 THEN '練習記録（早朝ボーナス）'
ELSE '練習記録'
END,
'record',
jsonb_build_object('record_id', NEW.id, 'record_type', 'training')
);

SELECT COUNT(*) INTO v_total_records
FROM training_records
WHERE user_id = NEW.user_id;

IF v_total_records = 1 THEN
PERFORM earn_badge(NEW.user_id, 'はじめの一歩');
END IF;

SELECT current_streak INTO v_current_streak
FROM user_streaks
WHERE user_id = NEW.user_id AND streak_type = 'training';

IF v_current_streak = 7 THEN
PERFORM earn_badge(NEW.user_id, '7日連続');
ELSIF v_current_streak = 30 THEN
PERFORM earn_badge(NEW.user_id, '30日連続');
ELSIF v_current_streak = 100 THEN
PERFORM earn_badge(NEW.user_id, '100日連続');
END IF;

SELECT total_records INTO v_total_records
FROM user_streaks
WHERE user_id = NEW.user_id AND streak_type = 'all';

IF v_total_records = 100 THEN
PERFORM earn_badge(NEW.user_id, '記録マニア');
END IF;

RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."process_training_record_gamification"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_weight_record_gamification"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
v_base_points integer := 5;
v_total_records integer;
v_current_streak integer;
BEGIN
PERFORM update_user_streak(NEW.user_id, 'weight', NEW.date::date);
PERFORM update_user_streak(NEW.user_id, 'all', NEW.date::date);

PERFORM award_points(
NEW.user_id,
v_base_points,
'体重記録',
'record',
jsonb_build_object('record_id', NEW.id, 'record_type', 'weight')
);

SELECT COUNT(*) INTO v_total_records
FROM weight_records
WHERE user_id = NEW.user_id;

IF v_total_records = 1 THEN
SELECT COUNT(*) INTO v_total_records
FROM training_records
WHERE user_id = NEW.user_id;

IF v_total_records = 0 THEN
PERFORM earn_badge(NEW.user_id, 'はじめの一歩');
END IF;
END IF;

SELECT current_streak INTO v_current_streak
FROM user_streaks
WHERE user_id = NEW.user_id AND streak_type = 'weight';

IF v_current_streak = 7 THEN
PERFORM earn_badge(NEW.user_id, '7日連続');
ELSIF v_current_streak = 30 THEN
PERFORM earn_badge(NEW.user_id, '30日連続');
ELSIF v_current_streak = 100 THEN
PERFORM earn_badge(NEW.user_id, '100日連続');
END IF;

RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."process_weight_record_gamification"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rebuild_all_user_streaks_jst"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
begin
  -- 既存を全消しして作り直す（事故りたくなければ先にバックアップ推奨）
  truncate table public.user_streaks;

  -- 5タイプを一気に作る
  insert into public.user_streaks (
    user_id,
    streak_type,
    current_streak,
    longest_streak,
    last_recorded_date,
    streak_freeze_count,
    total_records,
    updated_at
  )
  with flags as (
    select * from public.user_daily_flags_jst
  ),
  -- タイプ別に “その日にtrueだった日” だけを縦持ちにする
  active_days as (
    select user_id, 'training'::text as streak_type, jst_day
    from flags where has_training

    union all
    select user_id, 'weight'::text, jst_day
    from flags where has_weight

    union all
    select user_id, 'sleep'::text, jst_day
    from flags where has_sleep

    union all
    select user_id, 'motivation'::text, jst_day
    from flags where has_motivation

    union all
    select user_id, 'all'::text, jst_day
    from flags where has_all
  ),
  numbered as (
    select
      user_id,
      streak_type,
      jst_day,
      row_number() over (partition by user_id, streak_type order by jst_day) as rn,
      max(jst_day) over (partition by user_id, streak_type) as last_day
    from active_days
  ),
  grouped as (
    select
      user_id,
      streak_type,
      jst_day,
      last_day,
      (jst_day - rn) as grp_key
    from numbered
  ),
  group_sizes as (
    select
      user_id,
      streak_type,
      grp_key,
      min(jst_day) as start_day,
      max(jst_day) as end_day,
      count(*)::int as streak_len
    from grouped
    group by user_id, streak_type, grp_key
  ),
  agg as (
    select
      gs.user_id,
      gs.streak_type,
      max(gs.streak_len) as longest_streak,
      -- “最後に記録がある日” で終わるグループの長さ＝current_streak
      max(case when gs.end_day = ad.last_day then gs.streak_len else null end) as current_streak,
      ad.last_day as last_recorded_date,
      tr.total_records
    from group_sizes gs
    join (
      select user_id, streak_type, max(jst_day) as last_day
      from active_days
      group by user_id, streak_type
    ) ad
      on ad.user_id = gs.user_id and ad.streak_type = gs.streak_type
    join (
      select user_id, streak_type, count(*)::int as total_records
      from active_days
      group by user_id, streak_type
    ) tr
      on tr.user_id = gs.user_id and tr.streak_type = gs.streak_type
    group by gs.user_id, gs.streak_type, ad.last_day, tr.total_records
  )
  select
    user_id,
    streak_type,
    coalesce(current_streak, 0)::int,
    coalesce(longest_streak, 0)::int,
    last_recorded_date,
    0 as streak_freeze_count,
    total_records,
    now()
  from agg;

end;
$$;


ALTER FUNCTION "public"."rebuild_all_user_streaks_jst"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recalculate_user_points"("p_user_id" "uuid" DEFAULT NULL::"uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  r record;

  v_total_points integer := 0;
  v_new_level integer := 1;
  v_points_for_next integer := 100;

  v_rank_tier text;
  v_rank_level text;
  v_rank_title text;

BEGIN
  -- 対象ユーザー一覧（transactions と user_points の両方から拾う）
  FOR r IN
    SELECT user_id FROM public.user_points
    WHERE p_user_id IS NULL OR user_id = p_user_id
    UNION
    SELECT DISTINCT user_id FROM public.point_transactions
    WHERE p_user_id IS NULL OR user_id = p_user_id
  LOOP
    -- total_points を履歴から再集計（ここが唯一の真実）
    SELECT COALESCE(SUM(points), 0)
      INTO v_total_points
    FROM public.point_transactions
    WHERE user_id = r.user_id;

    -- レベル計算（award_points と同じ）
    v_new_level := 1;
    v_points_for_next := 100;

    WHILE v_total_points >= v_points_for_next LOOP
      v_new_level := v_new_level + 1;
      v_points_for_next := v_points_for_next + (v_new_level * 50);
    END LOOP;

    -- ランク計算（award_points と同じ 35段階）
    IF v_total_points >= 25000 THEN
      v_rank_tier := 'マスター'; v_rank_level := 'V'; v_rank_title := 'マスター V';
    ELSIF v_total_points >= 23000 THEN
      v_rank_tier := 'マスター'; v_rank_level := 'IV'; v_rank_title := 'マスター IV';
    ELSIF v_total_points >= 21000 THEN
      v_rank_tier := 'マスター'; v_rank_level := 'III'; v_rank_title := 'マスター III';
    ELSIF v_total_points >= 19500 THEN
      v_rank_tier := 'マスター'; v_rank_level := 'II'; v_rank_title := 'マスター II';
    ELSIF v_total_points >= 18000 THEN
      v_rank_tier := 'マスター'; v_rank_level := 'I'; v_rank_title := 'マスター I';
    ELSIF v_total_points >= 16800 THEN
      v_rank_tier := 'ダイヤモンド'; v_rank_level := 'V'; v_rank_title := 'ダイヤモンド V';
    ELSIF v_total_points >= 15600 THEN
      v_rank_tier := 'ダイヤモンド'; v_rank_level := 'IV'; v_rank_title := 'ダイヤモンド IV';
    ELSIF v_total_points >= 14400 THEN
      v_rank_tier := 'ダイヤモンド'; v_rank_level := 'III'; v_rank_title := 'ダイヤモンド III';
    ELSIF v_total_points >= 13200 THEN
      v_rank_tier := 'ダイヤモンド'; v_rank_level := 'II'; v_rank_title := 'ダイヤモンド II';
    ELSIF v_total_points >= 12000 THEN
      v_rank_tier := 'ダイヤモンド'; v_rank_level := 'I'; v_rank_title := 'ダイヤモンド I';
    ELSIF v_total_points >= 11200 THEN
      v_rank_tier := 'プラチナ'; v_rank_level := 'V'; v_rank_title := 'プラチナ V';
    ELSIF v_total_points >= 10400 THEN
      v_rank_tier := 'プラチナ'; v_rank_level := 'IV'; v_rank_title := 'プラチナ IV';
    ELSIF v_total_points >= 9600 THEN
      v_rank_tier := 'プラチナ'; v_rank_level := 'III'; v_rank_title := 'プラチナ III';
    ELSIF v_total_points >= 8800 THEN
      v_rank_tier := 'プラチナ'; v_rank_level := 'II'; v_rank_title := 'プラチナ II';
    ELSIF v_total_points >= 8000 THEN
      v_rank_tier := 'プラチナ'; v_rank_level := 'I'; v_rank_title := 'プラチナ I';
    ELSIF v_total_points >= 7400 THEN
      v_rank_tier := 'ゴールド'; v_rank_level := 'V'; v_rank_title := 'ゴールド V';
    ELSIF v_total_points >= 6800 THEN
      v_rank_tier := 'ゴールド'; v_rank_level := 'IV'; v_rank_title := 'ゴールド IV';
    ELSIF v_total_points >= 6200 THEN
      v_rank_tier := 'ゴールド'; v_rank_level := 'III'; v_rank_title := 'ゴールド III';
    ELSIF v_total_points >= 5600 THEN
      v_rank_tier := 'ゴールド'; v_rank_level := 'II'; v_rank_title := 'ゴールド II';
    ELSIF v_total_points >= 5000 THEN
      v_rank_tier := 'ゴールド'; v_rank_level := 'I'; v_rank_title := 'ゴールド I';
    ELSIF v_total_points >= 4700 THEN
      v_rank_tier := 'シルバー'; v_rank_level := 'V'; v_rank_title := 'シルバー V';
    ELSIF v_total_points >= 4400 THEN
      v_rank_tier := 'シルバー'; v_rank_level := 'IV'; v_rank_title := 'シルバー IV';
    ELSIF v_total_points >= 3800 THEN
      v_rank_tier := 'シルバー'; v_rank_level := 'III'; v_rank_title := 'シルバー III';
    ELSIF v_total_points >= 3400 THEN
      v_rank_tier := 'シルバー'; v_rank_level := 'II'; v_rank_title := 'シルバー II';
    ELSIF v_total_points >= 3000 THEN
      v_rank_tier := 'シルバー'; v_rank_level := 'I'; v_rank_title := 'シルバー I';
    ELSIF v_total_points >= 2600 THEN
      v_rank_tier := 'ブロンズ'; v_rank_level := 'V'; v_rank_title := 'ブロンズ V';
    ELSIF v_total_points >= 2200 THEN
      v_rank_tier := 'ブロンズ'; v_rank_level := 'IV'; v_rank_title := 'ブロンズ IV';
    ELSIF v_total_points >= 1800 THEN
      v_rank_tier := 'ブロンズ'; v_rank_level := 'III'; v_rank_title := 'ブロンズ III';
    ELSIF v_total_points >= 1400 THEN
      v_rank_tier := 'ブロンズ'; v_rank_level := 'II'; v_rank_title := 'ブロンズ II';
    ELSIF v_total_points >= 1000 THEN
      v_rank_tier := 'ブロンズ'; v_rank_level := 'I'; v_rank_title := 'ブロンズ I';
    ELSIF v_total_points >= 800 THEN
      v_rank_tier := 'ビギナー'; v_rank_level := 'V'; v_rank_title := 'ビギナー V';
    ELSIF v_total_points >= 600 THEN
      v_rank_tier := 'ビギナー'; v_rank_level := 'IV'; v_rank_title := 'ビギナー IV';
    ELSIF v_total_points >= 400 THEN
      v_rank_tier := 'ビギナー'; v_rank_level := 'III'; v_rank_title := 'ビギナー III';
    ELSIF v_total_points >= 200 THEN
      v_rank_tier := 'ビギナー'; v_rank_level := 'II'; v_rank_title := 'ビギナー II';
    ELSE
      v_rank_tier := 'ビギナー'; v_rank_level := 'I'; v_rank_title := 'ビギナー I';
    END IF;

    -- user_points を更新（存在しない場合は作る）
    INSERT INTO public.user_points (
      user_id,
      total_points,
      current_level,
      points_to_next_level,
      rank_tier,
      rank_level,
      rank_title,
      updated_at
    )
    VALUES (
      r.user_id,
      v_total_points,
      v_new_level,
      (v_points_for_next - v_total_points),
      v_rank_tier,
      v_rank_level,
      v_rank_title,
      now()
    )
    ON CONFLICT (user_id)
    DO UPDATE SET
      total_points = EXCLUDED.total_points,
      current_level = EXCLUDED.current_level,
      points_to_next_level = EXCLUDED.points_to_next_level,
      rank_tier = EXCLUDED.rank_tier,
      rank_level = EXCLUDED.rank_level,
      rank_title = EXCLUDED.rank_title,
      updated_at = now();

  END LOOP;
END;
$$;


ALTER FUNCTION "public"."recalculate_user_points"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recompute_all_user_points"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
begin
  update public.user_points up
  set total_points = sub.sum_points,
      updated_at = now()
  from (
    select user_id, coalesce(sum(points), 0)::int as sum_points
    from public.point_transactions
    group by user_id
  ) sub
  where up.user_id = sub.user_id;
end;
$$;


ALTER FUNCTION "public"."recompute_all_user_points"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recompute_user_points"("p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_total int;
begin
  select coalesce(sum(points), 0)::int
    into v_total
  from public.point_transactions
  where user_id = p_user_id;

  update public.user_points
  set total_points = v_total,
      updated_at = now()
  where user_id = p_user_id;
end;
$$;


ALTER FUNCTION "public"."recompute_user_points"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_team_achievement"("p_team_id" "uuid", "p_achievement_type" "text", "p_title" "text", "p_description" "text", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
v_achievement_id uuid;
v_user_record RECORD;
BEGIN
INSERT INTO team_achievements (team_id, achievement_type, title, description, metadata)
VALUES (p_team_id, p_achievement_type, p_title, p_description, p_metadata)
RETURNING id INTO v_achievement_id;

FOR v_user_record IN 
SELECT id FROM users 
WHERE team_id = p_team_id 
AND role = 'athlete'
LOOP
INSERT INTO team_achievement_notifications (team_id, user_id, achievement_id)
VALUES (p_team_id, v_user_record.id, v_achievement_id);
END LOOP;

RETURN v_achievement_id;
END;
$$;


ALTER FUNCTION "public"."record_team_achievement"("p_team_id" "uuid", "p_achievement_type" "text", "p_title" "text", "p_description" "text", "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_acwr_daily_all_teams"("p_days_back" integer) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Determine the date range: today and N days back
  WITH params AS (
    SELECT
      current_date AS end_date,
      (current_date - (p_days_back::int))::date AS start_date
  ),
  -- Take all athletes with a team assignment; each athlete will have a record for each day
  target_users AS (
    SELECT u.id AS user_id, u.team_id
    FROM public.users u
    WHERE u.role = 'athlete' AND u.team_id IS NOT NULL
  ),
  -- Build a calendar for each user across the date range
  calendar AS (
    SELECT
      tu.user_id,
      tu.team_id,
      gs::date AS date
    FROM target_users tu
    CROSS JOIN params p
    CROSS JOIN generate_series(p.start_date, p.end_date, interval '1 day') gs
  ),
  -- Aggregate daily training load; fill with 0 if no training record exists
  daily AS (
    SELECT
      c.user_id,
      c.team_id,
      c.date,
      COALESCE(SUM(tr.load), 0)::numeric AS daily_load
    FROM calendar c
    LEFT JOIN public.training_records tr
      ON tr.user_id = c.user_id
     AND tr.date = c.date
    GROUP BY c.user_id, c.team_id, c.date
  ),
  -- Compute acute 7-day load, chronic 28-day load, and valid_days_28d (days with a load > 0)
  rolls AS (
    SELECT
      user_id,
      team_id,
      date,
      daily_load,
      SUM(daily_load) OVER (
        PARTITION BY user_id
        ORDER BY date
        ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
      ) AS acute_7d,
      SUM(daily_load) OVER (
        PARTITION BY user_id
        ORDER BY date
        ROWS BETWEEN 27 PRECEDING AND CURRENT ROW
      ) / 4.0 AS chronic_28d,
      SUM(CASE WHEN daily_load > 0 THEN 1 ELSE 0 END) OVER (
        PARTITION BY user_id
        ORDER BY date
        ROWS BETWEEN 27 PRECEDING AND CURRENT ROW
      ) AS valid_days_28d
    FROM daily
  )
  -- Upsert into athlete_acwr_daily
  INSERT INTO public.athlete_acwr_daily
    (user_id, team_id, date, daily_load, acute_7d, chronic_28d, acwr,
     valid_days_28d, is_valid, updated_at)
  SELECT
    user_id,
    team_id,
    date,
    daily_load,
    acute_7d,
    chronic_28d,
    CASE WHEN chronic_28d > 0 THEN (acute_7d / chronic_28d) ELSE NULL END AS acwr,
    valid_days_28d,
    (valid_days_28d > 0)::boolean AS is_valid,
    now()
  FROM rolls
  ON CONFLICT (user_id, date) DO UPDATE SET
    team_id      = excluded.team_id,
    daily_load   = excluded.daily_load,
    acute_7d     = excluded.acute_7d,
    chronic_28d  = excluded.chronic_28d,
    acwr         = excluded.acwr,
    valid_days_28d = excluded.valid_days_28d,
    is_valid     = excluded.is_valid,
    updated_at   = now();
END;
$$;


ALTER FUNCTION "public"."refresh_acwr_daily_all_teams"("p_days_back" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_acwr_daily_all_teams"("p_as_of" "date" DEFAULT CURRENT_DATE, "p_min_days" integer DEFAULT 7) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
declare
  r record;
begin
  for r in (
    select distinct team_id
    from public.team_users_union
    where team_id is not null
  ) loop
    perform public.refresh_acwr_daily_for_team(r.team_id, p_as_of, p_min_days);
  end loop;
end;
$$;


ALTER FUNCTION "public"."refresh_acwr_daily_all_teams"("p_as_of" "date", "p_min_days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_acwr_daily_for_team"("p_team_id" "uuid", "p_as_of" "date" DEFAULT CURRENT_DATE, "p_min_days" integer DEFAULT 7) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
begin
  with athletes as (
    select distinct user_id
    from public.team_users_union
    where team_id = p_team_id
  ),
  dates as (
    select generate_series(p_as_of - interval '27 day', p_as_of, interval '1 day')::date as d
  ),
  grid as (
    select a.user_id, p_team_id as team_id, dt.d as date
    from athletes a
    cross join dates dt
  ),
  daily as (
    -- training_recordsは user_id,date ユニークなので sum不要でもOKだが保険でsum
    select
      tr.user_id,
      tr.date::date as date,
      sum(coalesce(tr.load, 0))::numeric as daily_load
    from public.training_records tr
    join athletes a on a.user_id = tr.user_id
    where tr.date between (p_as_of - 27) and p_as_of
    group by tr.user_id, tr.date
  ),
  base as (
    select
      g.user_id,
      g.team_id,
      g.date,
      coalesce(d.daily_load, 0)::numeric as daily_load
    from grid g
    left join daily d
      on d.user_id = g.user_id and d.date = g.date
  ),
  calc as (
    select
      user_id,
      team_id,
      date,
      daily_load,

      -- acute: 直近7日合計（当日含む）
      sum(daily_load) over (
        partition by user_id
        order by date
        rows between 6 preceding and current row
      ) as acute_7d,

      -- chronic: 直近28日合計 / 4（当日含む）
      (sum(daily_load) over (
        partition by user_id
        order by date
        rows between 27 preceding and current row
      ) / 4.0) as chronic_28d,

      -- 直近28日で load>0 の日数（当日含む）
      sum(case when daily_load > 0 then 1 else 0 end) over (
        partition by user_id
        order by date
        rows between 27 preceding and current row
      )::int as valid_days_28d
    from base
  ),
  final as (
    select
      user_id,
      team_id,
      date,
      daily_load,
      acute_7d,
      chronic_28d,
      case when chronic_28d > 0 then (acute_7d / chronic_28d) else null end as acwr,
      valid_days_28d,
      (valid_days_28d >= p_min_days) as is_valid
    from calc
  )
  insert into public.athlete_acwr_daily (
    user_id, team_id, date,
    daily_load, acute_7d, chronic_28d, acwr,
    valid_days_28d, is_valid,
    updated_at
  )
  select
    user_id, team_id, date,
    daily_load, acute_7d, chronic_28d, acwr,
    valid_days_28d, is_valid,
    now()
  from final
  on conflict (user_id, date)
  do update set
    team_id = excluded.team_id,
    daily_load = excluded.daily_load,
    acute_7d = excluded.acute_7d,
    chronic_28d = excluded.chronic_28d,
    acwr = excluded.acwr,
    valid_days_28d = excluded.valid_days_28d,
    is_valid = excluded.is_valid,
    updated_at = now();
end;
$$;


ALTER FUNCTION "public"."refresh_acwr_daily_for_team"("p_team_id" "uuid", "p_as_of" "date", "p_min_days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_metabolism_snapshot_from_inbody"("p_user_id" "uuid", "p_record_date" "date", "p_activity_level" "text" DEFAULT 'medium'::"text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_weight numeric;
  v_pbf numeric;
  v_lean numeric;
  v_bmr int;
  v_factor numeric;
  v_tdee int;
  v_level text;
begin
  -- 対象日の inbody（同日複数があり得るので measured_at_ts 降順で最新を採用）
  select weight, body_fat_percent
    into v_weight, v_pbf
  from public.inbody_records
  where user_id = p_user_id
    and measured_at = p_record_date
  order by measured_at_ts desc nulls last, updated_at desc
  limit 1;

  if v_weight is null then
    return json_build_object('ok', false, 'reason', 'no inbody for date', 'record_date', p_record_date);
  end if;

  -- 除脂肪量
  if v_pbf is not null then
    v_lean := round((v_weight * (1 - v_pbf / 100.0))::numeric, 1);
  else
    v_lean := null;
  end if;

  -- BMR
  if v_lean is not null then
    v_bmr := (370 + 21.6 * v_lean)::int;
  else
    v_bmr := (22 * v_weight)::int;
  end if;

  -- 活動係数
  v_level := coalesce(nullif(trim(p_activity_level), ''), 'medium');
  v_factor :=
    case v_level
      when 'low' then 1.2
      when 'medium' then 1.55
      when 'high' then 1.725
      when 'elite' then 1.9
      else 1.55
    end;

  v_tdee := round(v_bmr * v_factor)::int;

  insert into public.nutrition_metabolism_snapshots (
    user_id, record_date, weight, body_fat_percent, lean_mass, bmr, tdee, activity_level, calculated_at
  )
  values (
    p_user_id, p_record_date, v_weight, v_pbf, v_lean, v_bmr, v_tdee, v_level, now()
  )
  on conflict (user_id, record_date) do update
    set weight = excluded.weight,
        body_fat_percent = excluded.body_fat_percent,
        lean_mass = excluded.lean_mass,
        bmr = excluded.bmr,
        tdee = excluded.tdee,
        activity_level = excluded.activity_level,
        calculated_at = excluded.calculated_at;

  return json_build_object(
    'ok', true,
    'user_id', p_user_id,
    'record_date', p_record_date,
    'weight', v_weight,
    'body_fat_percent', v_pbf,
    'lean_mass', v_lean,
    'bmr', v_bmr,
    'tdee', v_tdee,
    'activity_level', v_level
  );
end;
$$;


ALTER FUNCTION "public"."refresh_metabolism_snapshot_from_inbody"("p_user_id" "uuid", "p_record_date" "date", "p_activity_level" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reject_athlete_transfer"("request_id" "uuid", "reviewer_user_id" "uuid", "notes" "text" DEFAULT ''::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
v_status text;
BEGIN
SELECT status INTO v_status
FROM athlete_transfer_requests
WHERE id = request_id;

IF NOT FOUND THEN
RAISE EXCEPTION 'Transfer request not found';
END IF;

IF v_status != 'pending' THEN
RAISE EXCEPTION 'Transfer request has already been reviewed';
END IF;

UPDATE athlete_transfer_requests
SET 
status = 'rejected',
reviewed_by = reviewer_user_id,
reviewed_at = now(),
review_notes = notes,
updated_at = now()
WHERE id = request_id;
END;
$$;


ALTER FUNCTION "public"."reject_athlete_transfer"("request_id" "uuid", "reviewer_user_id" "uuid", "notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reject_team_access_request"("request_id" "uuid", "reviewer_user_id" "uuid", "notes" "text" DEFAULT ''::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
v_status text;
BEGIN
SELECT status INTO v_status
FROM team_access_requests
WHERE id = request_id;

IF NOT FOUND THEN
RAISE EXCEPTION 'Request not found';
END IF;

IF v_status != 'pending' THEN
RAISE EXCEPTION 'Request has already been reviewed';
END IF;

UPDATE team_access_requests
SET 
status = 'rejected',
reviewed_by = reviewer_user_id,
reviewed_at = now(),  -- Fixed: was "reviewed_at = reviewed_at"
review_notes = notes,
updated_at = now()
WHERE id = request_id;
END;
$$;


ALTER FUNCTION "public"."reject_team_access_request"("request_id" "uuid", "reviewer_user_id" "uuid", "notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."remove_user_from_team"("p_user_id" "uuid", "p_team_id" "uuid", "p_organization_id" "uuid", "p_assignment_type" "text" DEFAULT 'primary'::"text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
INSERT INTO team_assignment_history (
user_id,
from_team_id,
organization_id,
assigned_by,
change_type
) VALUES (
p_user_id,
p_team_id,
p_organization_id,
auth.uid(),
'removed'
);

DELETE FROM team_member_assignments
WHERE user_id = p_user_id 
AND team_id = p_team_id
AND organization_id = p_organization_id
AND assignment_type = p_assignment_type;

RETURN true;
END;
$$;


ALTER FUNCTION "public"."remove_user_from_team"("p_user_id" "uuid", "p_team_id" "uuid", "p_organization_id" "uuid", "p_assignment_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end; $$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."staff_team_links_set_org_id"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  select organization_id
    into new.organization_id
  from public.teams
  where id = new.team_id;

  return new;
end;
$$;


ALTER FUNCTION "public"."staff_team_links_set_org_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_acwr_columns"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  -- acute_7d/chronic_28d が入ってきたら acute_load/chronic_load にも入れる
  if new.acute_7d is not null then
    new.acute_load := new.acute_7d;
  end if;

  if new.chronic_28d is not null then
    new.chronic_load := new.chronic_28d;
  end if;

  -- acute_load/chronic_load が入ってきたら acute_7d/chronic_28d にも入れる
  if new.acute_load is not null then
    new.acute_7d := new.acute_load;
  end if;

  if new.chronic_load is not null then
    new.chronic_28d := new.chronic_load;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."sync_acwr_columns"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_inbody_autolink_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid;
begin
  if new.user_id is not null then
    return new;
  end if;

  if new.phone_number_norm is null and new.phone_number is not null then
    new.phone_number_norm := normalize_phone(new.phone_number);
  end if;

  if new.phone_number_norm is null then
    return new;
  end if;

  -- ユーザーテーブルを自動判定して検索
  if to_regclass('public.users') is not null then
    select u.id into v_user_id
      from public.users u
     where normalize_phone(u.phone_number) = new.phone_number_norm
     limit 1;
  else
    select u.id into v_user_id
      from public.app_users u
     where normalize_phone(u.phone_number) = new.phone_number_norm
     limit 1;
  end if;

  if v_user_id is not null then
    new.user_id := v_user_id;
  end if;

  return new;
end $$;


ALTER FUNCTION "public"."trg_inbody_autolink_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_link_inbody_on_phone_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  -- phone_number が null→値、または変更されたときだけ実行
  if (new.phone_number is not null)
     and (coalesce(new.phone_number,'') <> coalesce(old.phone_number,'')) then
    perform public.link_inbody_records_by_phone(new.user_id);
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."trg_link_inbody_on_phone_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_refresh_metabolism_on_inbody_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if new.user_id is null or new.weight is null or new.measured_at is null then
    return new;
  end if;

  -- INSERTは常に作成
  if tg_op = 'INSERT' then
    perform public.refresh_metabolism_snapshot_from_inbody(new.user_id, new.measured_at, 'medium');
    return new;
  end if;

  -- UPDATE: 重要カラムが変わったときだけ更新
  if tg_op = 'UPDATE' then
    if (new.user_id is distinct from old.user_id)
       or (new.measured_at is distinct from old.measured_at)
       or (new.weight is distinct from old.weight)
       or (new.body_fat_percent is distinct from old.body_fat_percent)
       or (new.measured_at_ts is distinct from old.measured_at_ts) then
      perform public.refresh_metabolism_snapshot_from_inbody(new.user_id, new.measured_at, 'medium');
    end if;

    return new;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."trg_refresh_metabolism_on_inbody_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_users_link_inbody_by_phone"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  -- phone_number が新規セット or 変更されたときだけ
  if (tg_op = 'INSERT' and new.phone_number is not null)
     or (tg_op = 'UPDATE' and new.phone_number is distinct from old.phone_number and new.phone_number is not null) then
    perform public.link_inbody_records_for_user(new.id);
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."trg_users_link_inbody_by_phone"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_users_phone_link_inbody"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  -- phone_number が null→値 になった、または値が変わった時だけ実行
  if (tg_op = 'INSERT') or (new.phone_number is distinct from old.phone_number) then
    perform public.link_inbody_records_by_phone(new.id, new.phone_number);
  end if;
  return new;
end $$;


ALTER FUNCTION "public"."trg_users_phone_link_inbody"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_athlete_team"("athlete_id" "uuid", "new_team_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
v_organization_id uuid;
v_old_team_id uuid;
BEGIN
SELECT team_id INTO v_old_team_id
FROM users
WHERE id = athlete_id AND role = 'athlete';

IF NOT FOUND THEN
RAISE EXCEPTION 'Athlete not found or user is not an athlete';
END IF;

IF new_team_id IS NOT NULL THEN
SELECT organization_id INTO v_organization_id
FROM teams
WHERE id = new_team_id;

IF NOT FOUND THEN
RAISE EXCEPTION 'Team not found';
END IF;

INSERT INTO organization_members (user_id, organization_id, role)
VALUES (athlete_id, v_organization_id, 'member')
ON CONFLICT (user_id, organization_id) 
DO NOTHING; -- Already a member, no action needed
END IF;

UPDATE users
SET team_id = new_team_id
WHERE id = athlete_id;


RETURN true;
END;
$$;


ALTER FUNCTION "public"."update_athlete_team"("athlete_id" "uuid", "new_team_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_athlete_transfer_requests_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_athlete_transfer_requests_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_bbt_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_bbt_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_engine_state_on_event"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  st public.engine_states%rowtype;
  is_first_event_of_day boolean;
  new_streak int;
  xp_gain int := 0;
begin
  -- state行が無ければ作る
  insert into public.engine_states (user_id)
  values (new.user_id)
  on conflict (user_id) do nothing;

  select * into st
  from public.engine_states
  where user_id = new.user_id;

  -- その日初のイベントならXP付与（このinsert後に数える）
  select (count(*) = 1) into is_first_event_of_day
  from public.engine_events
  where user_id = new.user_id
    and event_date = new.event_date;

  if is_first_event_of_day then
    xp_gain := 10;
  end if;

  -- streak更新（過去日入力はstreakを壊さないため、new.event_date が last_active_date 以上の時だけ）
  if st.last_active_date is null then
    new_streak := 1;
    update public.engine_states
      set streak_current = new_streak,
          streak_best = greatest(streak_best, new_streak),
          last_active_date = new.event_date,
          xp = xp + xp_gain,
          updated_at = now()
    where user_id = new.user_id;

    return new;
  end if;

  if new.event_date < st.last_active_date then
    -- 過去日はstreakに影響させずXPだけ
    update public.engine_states
      set xp = xp + xp_gain,
          updated_at = now()
    where user_id = new.user_id;

    return new;
  end if;

  if new.event_date = st.last_active_date then
    -- 同日ならstreak維持、XPだけ
    update public.engine_states
      set xp = xp + xp_gain,
          updated_at = now()
    where user_id = new.user_id;

    return new;
  end if;

  if new.event_date = (st.last_active_date + interval '1 day')::date then
    new_streak := st.streak_current + 1;
  else
    new_streak := 1;
  end if;

  update public.engine_states
    set streak_current = new_streak,
        streak_best = greatest(streak_best, new_streak),
        last_active_date = new.event_date,
        xp = xp + xp_gain,
        updated_at = now()
  where user_id = new.user_id;

  return new;
end;
$$;


ALTER FUNCTION "public"."update_engine_state_on_event"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_goal_progress_from_performance"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $_$
DECLARE
  data jsonb;
  primary_val numeric;
  fallback_val numeric;
  key text;
BEGIN
  data := NEW.values;

  -- ① primary_value があるなら最優先
  IF data ? 'primary_value' THEN
    primary_val := (data->>'primary_value')::numeric;

  ELSE
    -- ② fallback: JSON内の数値フィールドを自動抽出
    fallback_val := NULL;

    FOR key IN SELECT jsonb_object_keys(data)
    LOOP
      BEGIN
        IF (data->>key) ~ '^[0-9]*\.?[0-9]+$' THEN
          fallback_val := (data->>key)::numeric;
          EXIT;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        CONTINUE;
      END;
    END LOOP;

    primary_val := fallback_val;
  END IF;

  -- 値が取れなければ更新しない
  IF primary_val IS NULL THEN
    RETURN NEW;
  END IF;

  -- ③ test_type_id が一致する目標だけ更新
  UPDATE user_goals
  SET current_value = primary_val,
      updated_at = NOW()
  WHERE user_id = NEW.user_id
    AND test_type_id = NEW.test_type_id
    AND status = 'active';

  RETURN NEW;
END;
$_$;


ALTER FUNCTION "public"."update_goal_progress_from_performance"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_injury_records_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_injury_records_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_menstrual_cycles_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_menstrual_cycles_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_messages_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_messages_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_performance_records_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_performance_records_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_report_templates_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_report_templates_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_scheduled_reports_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_scheduled_reports_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_team_access_requests_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_team_access_requests_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_team_member_assignment_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_team_member_assignment_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_thread_last_message"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
UPDATE message_threads
SET last_message_at = NEW.created_at
WHERE id = NEW.thread_id;
RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_thread_last_message"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_tutorial_progress_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
NEW.last_updated = now();
RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_tutorial_progress_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_streak"("p_user_id" "uuid", "p_streak_type" "text", "p_record_date" "date") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_last_date date;
  v_current_streak integer;
  v_longest_streak integer;
begin
  -- まず行を確実に作る（無ければINSERT）
  insert into public.user_streaks (
    user_id, streak_type, current_streak, longest_streak, last_recorded_date,
    total_records, updated_at
  )
  values (
    p_user_id, p_streak_type, 0, 0, null,
    0, now()
  )
  on conflict (user_id, streak_type) do nothing;

  -- 既存行をロックして取得
  select last_recorded_date, current_streak, longest_streak
    into v_last_date, v_current_streak, v_longest_streak
  from public.user_streaks
  where user_id = p_user_id
    and streak_type = p_streak_type
  for update;

  -- 同日 or 過去日の入力は無視（重複/時系列ズレ対策）
  if v_last_date is not null and p_record_date <= v_last_date then
    return;
  end if;

  -- 初回
  if v_last_date is null then
    v_current_streak := 1;

  -- 連続（date + 1 の判定に統一）
  elsif p_record_date = v_last_date + 1 then
    v_current_streak := v_current_streak + 1;

  -- 途切れ
  else
    v_current_streak := 1;
  end if;

  v_longest_streak := greatest(coalesce(v_longest_streak, 0), v_current_streak);

  update public.user_streaks
  set current_streak = v_current_streak,
      longest_streak = v_longest_streak,
      last_recorded_date = p_record_date,
      total_records = coalesce(total_records, 0) + 1,
      updated_at = now()
  where user_id = p_user_id
    and streak_type = p_streak_type;
end;
$$;


ALTER FUNCTION "public"."update_user_streak"("p_user_id" "uuid", "p_streak_type" "text", "p_record_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_reflection"("p_reflection_date" "date", "p_did" "text" DEFAULT NULL::"text", "p_didnt" "text" DEFAULT NULL::"text", "p_cause_tags" "text"[] DEFAULT '{}'::"text"[], "p_next_action" "text" DEFAULT NULL::"text", "p_free_note" "text" DEFAULT NULL::"text", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb", "p_award" boolean DEFAULT true, "p_award_points" integer DEFAULT 5) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid;
  v_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.reflections (
    user_id, reflection_date, did, didnt, cause_tags, next_action, free_note, metadata
  )
  values (
    v_user_id, p_reflection_date, p_did, p_didnt, coalesce(p_cause_tags,'{}'::text[]),
    p_next_action, p_free_note, coalesce(p_metadata,'{}'::jsonb)
  )
  on conflict (user_id, reflection_date)
  do update set
    did = excluded.did,
    didnt = excluded.didnt,
    cause_tags = excluded.cause_tags,
    next_action = excluded.next_action,
    free_note = excluded.free_note,
    metadata = excluded.metadata,
    updated_at = now()
  returning id into v_id;

  -- ポイント付与（1日1回にしたい場合は、別途「初回のみ」判定を入れる）
  if p_award and coalesce(p_award_points,0) > 0 then
    perform public.award_points(
      v_user_id,
      p_award_points,
      '振り返り入力',
      'bonus',
      jsonb_build_object('reflection_date', p_reflection_date)
    );
  end if;

  return v_id;
end;
$$;


ALTER FUNCTION "public"."upsert_reflection"("p_reflection_date" "date", "p_did" "text", "p_didnt" "text", "p_cause_tags" "text"[], "p_next_action" "text", "p_free_note" "text", "p_metadata" "jsonb", "p_award" boolean, "p_award_points" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."verify_invitation_token"("p_token_hash" "text") RETURNS TABLE("is_valid" boolean, "invited_role" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    (
      it.used = false
      and it.expires_at > now()
    ) as is_valid,
    it.role as invited_role
  from public.invitation_tokens it
  where it.token = p_token_hash
  limit 1;
$$;


ALTER FUNCTION "public"."verify_invitation_token"("p_token_hash" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."achievement_milestones" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "milestone_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "achieved_value" numeric,
    "celebrated" boolean DEFAULT false NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."achievement_milestones" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_summaries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "period_type" "text" NOT NULL,
    "period_start" "date" NOT NULL,
    "source" "text" DEFAULT 'reflection_only'::"text" NOT NULL,
    "summary_short" "text",
    "summary" "text",
    "themes" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "wins" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "next_action" "text",
    "model" "text",
    "prompt_version" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ai_summaries_period_type_check" CHECK (("period_type" = ANY (ARRAY['daily'::"text", 'weekly'::"text"])))
);


ALTER TABLE "public"."ai_summaries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."alerts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "team_id" "uuid",
    "priority" "text" DEFAULT 'low'::"text" NOT NULL,
    "message" "text",
    "created_at" "date" DEFAULT (("now"() AT TIME ZONE 'Asia/Tokyo'::"text"))::"date" NOT NULL
);


ALTER TABLE "public"."alerts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."athlete_activity_level_daily" (
    "user_id" "uuid" NOT NULL,
    "team_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "avg_load_14d" numeric NOT NULL,
    "team_p25" numeric NOT NULL,
    "team_p50" numeric NOT NULL,
    "team_p75" numeric NOT NULL,
    "activity_level_system" "text" NOT NULL,
    "activity_level_effective" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "activity_level_override" "text",
    CONSTRAINT "athlete_activity_level_effective_check" CHECK (("activity_level_effective" = ANY (ARRAY['low'::"text", 'moderate'::"text", 'high'::"text", 'very_high'::"text"]))),
    CONSTRAINT "athlete_activity_level_nonnegative_check" CHECK ((("avg_load_14d" >= (0)::numeric) AND ("team_p25" >= (0)::numeric) AND ("team_p50" >= (0)::numeric) AND ("team_p75" >= (0)::numeric))),
    CONSTRAINT "athlete_activity_level_override_check" CHECK ((("activity_level_override" IS NULL) OR ("activity_level_override" = ANY (ARRAY['low'::"text", 'moderate'::"text", 'high'::"text", 'very_high'::"text"])))),
    CONSTRAINT "athlete_activity_level_percentiles_order_check" CHECK ((("team_p25" <= "team_p50") AND ("team_p50" <= "team_p75"))),
    CONSTRAINT "athlete_activity_level_system_check" CHECK (("activity_level_system" = ANY (ARRAY['low'::"text", 'moderate'::"text", 'high'::"text", 'very_high'::"text"])))
);


ALTER TABLE "public"."athlete_activity_level_daily" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."athlete_acwr_daily" (
    "user_id" "uuid" NOT NULL,
    "team_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "daily_load" numeric DEFAULT 0 NOT NULL,
    "acute_7d" numeric,
    "chronic_28d" numeric,
    "acwr" numeric,
    "valid_days_28d" integer DEFAULT 0 NOT NULL,
    "is_valid" boolean DEFAULT false NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "days_of_data" integer DEFAULT 0 NOT NULL,
    "acute_load" numeric,
    "chronic_load" numeric
);


ALTER TABLE "public"."athlete_acwr_daily" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."athlete_transfer_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "athlete_id" "uuid" NOT NULL,
    "from_team_id" "uuid" NOT NULL,
    "to_team_id" "uuid" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "requested_by" "uuid" NOT NULL,
    "status" "text" NOT NULL,
    "request_reason" "text" DEFAULT ''::"text",
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "review_notes" "text" DEFAULT ''::"text",
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "athlete_transfer_requests_check" CHECK (("from_team_id" <> "to_team_id")),
    CONSTRAINT "athlete_transfer_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text", 'completed'::"text"])))
);


ALTER TABLE "public"."athlete_transfer_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."badges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text" NOT NULL,
    "icon" "text" NOT NULL,
    "category" "text" NOT NULL,
    "rarity" "text" DEFAULT 'common'::"text" NOT NULL,
    "criteria" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "points_reward" integer DEFAULT 0 NOT NULL,
    "sort_order" integer DEFAULT 0,
    "is_hidden" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "code" "text",
    "criteria_json" "jsonb",
    CONSTRAINT "badges_category_check" CHECK (("category" = ANY (ARRAY['streak'::"text", 'performance'::"text", 'consistency'::"text", 'milestone'::"text", 'special'::"text", 'team'::"text"]))),
    CONSTRAINT "badges_rarity_check" CHECK (("rarity" = ANY (ARRAY['common'::"text", 'rare'::"text", 'epic'::"text", 'legendary'::"text"])))
);


ALTER TABLE "public"."badges" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."basal_body_temperature" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "measurement_date" "date" NOT NULL,
    "temperature_celsius" numeric(4,2) NOT NULL,
    "measurement_time" time without time zone,
    "sleep_quality" integer,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "basal_body_temperature_sleep_quality_check" CHECK ((("sleep_quality" >= 1) AND ("sleep_quality" <= 5))),
    CONSTRAINT "basal_body_temperature_temperature_celsius_check" CHECK ((("temperature_celsius" >= 35.0) AND ("temperature_celsius" <= 42.0)))
);


ALTER TABLE "public"."basal_body_temperature" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."coach_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "athlete_id" "uuid" NOT NULL,
    "coach_id" "uuid" NOT NULL,
    "related_record_type" "text",
    "related_record_id" "uuid",
    "comment" "text" NOT NULL,
    "is_read" boolean DEFAULT false NOT NULL,
    "sentiment" "text" DEFAULT 'neutral'::"text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "coach_comments_related_record_type_check" CHECK (("related_record_type" = ANY (ARRAY['training'::"text", 'performance'::"text", 'weight'::"text", 'sleep'::"text", 'motivation'::"text", 'general'::"text"]))),
    CONSTRAINT "coach_comments_sentiment_check" CHECK (("sentiment" = ANY (ARRAY['positive'::"text", 'neutral'::"text", 'constructive'::"text"])))
);


ALTER TABLE "public"."coach_comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."daily_energy_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "bmr" integer NOT NULL,
    "srpe" integer DEFAULT 0 NOT NULL,
    "activity_factor" numeric(4,2) DEFAULT 1.4 NOT NULL,
    "tdee" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."daily_energy_snapshots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."daily_reflections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "reflection_date" "date" NOT NULL,
    "text" "text" NOT NULL,
    "visibility" "text" DEFAULT 'private'::"text" NOT NULL,
    "word_count" integer GENERATED ALWAYS AS (COALESCE("array_length"("regexp_split_to_array"(TRIM(BOTH FROM "text"), '\s+'::"text"), 1), 0)) STORED,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "daily_reflections_visibility_check" CHECK (("visibility" = ANY (ARRAY['private'::"text", 'team'::"text", 'staff'::"text"])))
);


ALTER TABLE "public"."daily_reflections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."data_sharing_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "athlete_user_id" "uuid" NOT NULL,
    "staff_user_id" "uuid",
    "team_id" "uuid" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "allow_condition" boolean DEFAULT false NOT NULL,
    "allow_training" boolean DEFAULT false NOT NULL,
    "allow_body" boolean DEFAULT false NOT NULL,
    "allow_reflection" boolean DEFAULT false NOT NULL,
    "allow_free_note" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "data_sharing_settings_date_check" CHECK (("start_date" <= "end_date"))
);


ALTER TABLE "public"."data_sharing_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."department_managers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "department_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."department_managers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."departments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."departments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."email_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "email" "text",
    "email_type" "text" NOT NULL,
    "alert_category" "text",
    "status" "text" NOT NULL,
    "error_message" "text",
    "subject" "text",
    "body" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."email_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."engine_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "event_date" "date" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."engine_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."engine_states" (
    "user_id" "uuid" NOT NULL,
    "streak_current" integer DEFAULT 0 NOT NULL,
    "streak_best" integer DEFAULT 0 NOT NULL,
    "last_active_date" "date",
    "level" integer DEFAULT 1 NOT NULL,
    "xp" integer DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."engine_states" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "event_type" "text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "processed_at" timestamp with time zone,
    "processed_by" "text",
    "process_error" "text"
);


ALTER TABLE "public"."events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ftt_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "measured_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "did_save" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "session_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "local_date" "date" GENERATED ALWAYS AS ((("measured_at" AT TIME ZONE 'Asia/Tokyo'::"text"))::"date") STORED,
    "meta" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."ftt_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ftt_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "measured_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "duration_sec" integer NOT NULL,
    "total_count" integer NOT NULL,
    "interval_sd_ms" double precision NOT NULL,
    "raw_intervals_ms" "jsonb" NOT NULL,
    "condition_result" "text" NOT NULL,
    "meta" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ftt_records_condition_result_check" CHECK (("condition_result" = ANY (ARRAY['good'::"text", 'fatigue'::"text", 'danger'::"text", 'stop'::"text", 'calibrating'::"text"]))),
    CONSTRAINT "ftt_records_duration_sec_check" CHECK (("duration_sec" > 0)),
    CONSTRAINT "ftt_records_interval_sd_ms_check" CHECK (("interval_sd_ms" >= (0)::double precision)),
    CONSTRAINT "ftt_records_total_count_check" CHECK (("total_count" >= 0))
);


ALTER TABLE "public"."ftt_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."generated_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "config_id" "uuid",
    "schedule_id" "uuid",
    "report_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "period_start" "date" NOT NULL,
    "period_end" "date" NOT NULL,
    "organization_id" "uuid",
    "team_id" "uuid",
    "athlete_ids" "uuid"[] DEFAULT ARRAY[]::"uuid"[],
    "summary_data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "detailed_data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "insights" "jsonb" DEFAULT '[]'::"jsonb",
    "recommendations" "jsonb" DEFAULT '[]'::"jsonb",
    "pdf_url" "text",
    "generation_status" "text" DEFAULT 'completed'::"text",
    "error_message" "text",
    "generated_by" "uuid",
    "generated_at" timestamp with time zone DEFAULT "now"(),
    "viewed_at" timestamp with time zone,
    "view_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "generated_reports_generation_status_check" CHECK (("generation_status" = ANY (ARRAY['pending'::"text", 'generating'::"text", 'completed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."generated_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inbody_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "phone_number" "text",
    "measured_at" "date" NOT NULL,
    "height" numeric(5,2),
    "weight" numeric(5,2),
    "body_fat_percent" numeric(4,1),
    "source" "text" DEFAULT 'csv'::"text",
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "phone_number_norm" "text",
    "measured_at_ts" timestamp with time zone,
    CONSTRAINT "inbody_bfp_range" CHECK ((("body_fat_percent" IS NULL) OR (("body_fat_percent" >= (0)::numeric) AND ("body_fat_percent" <= (80)::numeric)))),
    CONSTRAINT "inbody_height_positive" CHECK ((("height" IS NULL) OR ("height" > (0)::numeric))),
    CONSTRAINT "inbody_weight_positive" CHECK ((("weight" IS NULL) OR ("weight" > (0)::numeric)))
);


ALTER TABLE "public"."inbody_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."injury_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "injury_type" "text" NOT NULL,
    "body_part" "text" NOT NULL,
    "severity" "text" NOT NULL,
    "occurred_date" "date" NOT NULL,
    "recovered_date" "date",
    "days_out" integer,
    "cause" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "injury_records_body_part_check" CHECK (("body_part" = ANY (ARRAY['ankle'::"text", 'knee'::"text", 'hip'::"text", 'hamstring'::"text", 'quadriceps'::"text", 'calf'::"text", 'shoulder'::"text", 'elbow'::"text", 'wrist'::"text", 'back'::"text", 'neck'::"text", 'head'::"text", 'other'::"text"]))),
    CONSTRAINT "injury_records_cause_check" CHECK (("cause" = ANY (ARRAY['overtraining'::"text", 'accident'::"text", 'fatigue'::"text", 'technique'::"text", 'equipment'::"text", 'other'::"text"]))),
    CONSTRAINT "injury_records_days_out_check" CHECK (("days_out" >= 0)),
    CONSTRAINT "injury_records_injury_type_check" CHECK (("injury_type" = ANY (ARRAY['muscle_strain'::"text", 'joint_pain'::"text", 'fracture'::"text", 'concussion'::"text", 'ligament_tear'::"text", 'tendon_injury'::"text", 'stress_fracture'::"text", 'other'::"text"]))),
    CONSTRAINT "injury_records_severity_check" CHECK (("severity" = ANY (ARRAY['minor'::"text", 'moderate'::"text", 'severe'::"text"]))),
    CONSTRAINT "valid_recovery_date" CHECK ((("recovered_date" IS NULL) OR ("recovered_date" >= "occurred_date")))
);


ALTER TABLE "public"."injury_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."injury_risk_assessments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "assessment_date" "date" NOT NULL,
    "risk_score" numeric(5,2) NOT NULL,
    "acwr_based_risk" numeric(5,2),
    "workload_spike_risk" numeric(5,2),
    "fatigue_risk" numeric(5,2),
    "recent_injury_risk" numeric(5,2),
    "recommendations" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "injury_risk_assessments_acwr_based_risk_check" CHECK ((("acwr_based_risk" >= (0)::numeric) AND ("acwr_based_risk" <= (100)::numeric))),
    CONSTRAINT "injury_risk_assessments_fatigue_risk_check" CHECK ((("fatigue_risk" >= (0)::numeric) AND ("fatigue_risk" <= (100)::numeric))),
    CONSTRAINT "injury_risk_assessments_recent_injury_risk_check" CHECK ((("recent_injury_risk" >= (0)::numeric) AND ("recent_injury_risk" <= (100)::numeric))),
    CONSTRAINT "injury_risk_assessments_risk_score_check" CHECK ((("risk_score" >= (0)::numeric) AND ("risk_score" <= (100)::numeric))),
    CONSTRAINT "injury_risk_assessments_workload_spike_risk_check" CHECK ((("workload_spike_risk" >= (0)::numeric) AND ("workload_spike_risk" <= (100)::numeric)))
);


ALTER TABLE "public"."injury_risk_assessments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invitation_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "token" "text" NOT NULL,
    "email" "text" NOT NULL,
    "name" "text" NOT NULL,
    "role" "text" NOT NULL,
    "team_id" "uuid",
    "invited_by" "uuid",
    "temporary_password" "text" NOT NULL,
    "used" boolean DEFAULT false,
    "expires_at" timestamp with time zone NOT NULL,
    "used_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "organization_id" "uuid",
    CONSTRAINT "invitation_tokens_role_check" CHECK (("role" = ANY (ARRAY['athlete'::"text", 'staff'::"text", 'parent'::"text", 'global_admin'::"text"])))
);


ALTER TABLE "public"."invitation_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."menstrual_cycles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "organization_id" "uuid",
    "cycle_start_date" "date" NOT NULL,
    "cycle_end_date" "date",
    "period_duration_days" integer,
    "cycle_length_days" integer,
    "flow_intensity" "text",
    "symptoms" "jsonb" DEFAULT '[]'::"jsonb",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "menstrual_cycles_cycle_length_days_check" CHECK ((("cycle_length_days" > 0) AND ("cycle_length_days" <= 60))),
    CONSTRAINT "menstrual_cycles_flow_intensity_check" CHECK (("flow_intensity" = ANY (ARRAY['light'::"text", 'moderate'::"text", 'heavy'::"text"]))),
    CONSTRAINT "menstrual_cycles_period_duration_days_check" CHECK ((("period_duration_days" > 0) AND ("period_duration_days" <= 14))),
    CONSTRAINT "valid_cycle_dates" CHECK ((("cycle_end_date" IS NULL) OR ("cycle_end_date" >= "cycle_start_date")))
);


ALTER TABLE "public"."menstrual_cycles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."message_threads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "participant1_id" "uuid" NOT NULL,
    "participant2_id" "uuid" NOT NULL,
    "last_message_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "different_participants" CHECK (("participant1_id" <> "participant2_id")),
    CONSTRAINT "participant_order" CHECK (("participant1_id" < "participant2_id"))
);


ALTER TABLE "public"."message_threads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "thread_id" "uuid" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "receiver_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "is_read" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "different_users" CHECK (("sender_id" <> "receiver_id")),
    CONSTRAINT "messages_content_check" CHECK ((("length"("content") > 0) AND ("length"("content") <= 2000)))
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."motivation_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "motivation_level" integer NOT NULL,
    "energy_level" integer NOT NULL,
    "stress_level" integer NOT NULL,
    "mood" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "motivation_records_energy_level_check" CHECK ((("energy_level" >= 1) AND ("energy_level" <= 10))),
    CONSTRAINT "motivation_records_motivation_level_check" CHECK ((("motivation_level" >= 1) AND ("motivation_level" <= 10))),
    CONSTRAINT "motivation_records_stress_level_check" CHECK ((("stress_level" >= 1) AND ("stress_level" <= 10)))
);


ALTER TABLE "public"."motivation_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."nutrition_daily" (
    "user_id" "uuid" NOT NULL,
    "team_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "weight" numeric NOT NULL,
    "height_cm" numeric NOT NULL,
    "body_fat_percent" numeric,
    "bmr" numeric NOT NULL,
    "tdee" numeric NOT NULL,
    "activity_level" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."nutrition_daily" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."nutrition_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "recorded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "record_date" "date" DEFAULT (("now"() AT TIME ZONE 'Asia/Tokyo'::"text"))::"date" NOT NULL,
    "meal_type" "text" NOT NULL,
    "total_calories" integer DEFAULT 0 NOT NULL,
    "p" numeric(6,1) DEFAULT 0 NOT NULL,
    "f" numeric(6,1) DEFAULT 0 NOT NULL,
    "c" numeric(6,1) DEFAULT 0 NOT NULL,
    "menu_items" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "advice_markdown" "text",
    "image_path" "text",
    "image_url" "text",
    "image_meta" "jsonb",
    "is_edited" boolean DEFAULT false NOT NULL,
    "edit_meta" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "meal_slot" integer DEFAULT 1 NOT NULL,
    "analysis_status" "text" DEFAULT 'success'::"text" NOT NULL,
    "analysis_error" "text",
    "analysis_meta" "jsonb" DEFAULT '{}'::"jsonb",
    "analysis_model" "text",
    "analysis_reason" "text",
    CONSTRAINT "nutrition_logs_analysis_status_check" CHECK (("analysis_status" = ANY (ARRAY['pending'::"text", 'success'::"text", 'failed'::"text"]))),
    CONSTRAINT "nutrition_logs_meal_slot_check" CHECK (("meal_slot" >= 1)),
    CONSTRAINT "nutrition_logs_meal_slot_rule_check" CHECK (((("meal_type" = ANY (ARRAY['朝食'::"text", '昼食'::"text", '夕食'::"text"])) AND ("meal_slot" = 1)) OR (("meal_type" = '補食'::"text") AND ("meal_slot" = ANY (ARRAY[1, 2]))))),
    CONSTRAINT "nutrition_logs_meal_type_check" CHECK (("meal_type" = ANY (ARRAY['朝食'::"text", '昼食'::"text", '夕食'::"text", '補食'::"text"])))
);


ALTER TABLE "public"."nutrition_logs" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."nutrition_daily_intakes_v" AS
 SELECT "user_id",
    "record_date" AS "date",
    ("sum"("total_calories"))::integer AS "intake_calories"
   FROM "public"."nutrition_logs"
  GROUP BY "user_id", "record_date";


ALTER VIEW "public"."nutrition_daily_intakes_v" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."nutrition_daily_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "report_date" "date" NOT NULL,
    "total_calories" integer DEFAULT 0 NOT NULL,
    "p" numeric(6,1) DEFAULT 0 NOT NULL,
    "f" numeric(6,1) DEFAULT 0 NOT NULL,
    "c" numeric(6,1) DEFAULT 0 NOT NULL,
    "score" integer,
    "summary" "text",
    "action_for_tomorrow" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "model" "text",
    "summary_json" "jsonb",
    CONSTRAINT "nutrition_daily_reports_score_check" CHECK ((("score" >= 0) AND ("score" <= 100)))
);


ALTER TABLE "public"."nutrition_daily_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."nutrition_metabolism_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "weight" numeric,
    "body_fat_percent" numeric,
    "lean_mass" numeric,
    "bmr" integer NOT NULL,
    "tdee" integer NOT NULL,
    "activity_level" "text",
    "calculated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "record_date" "date" DEFAULT (("now"() AT TIME ZONE 'Asia/Tokyo'::"text"))::"date" NOT NULL
);


ALTER TABLE "public"."nutrition_metabolism_snapshots" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."nutrition_metabolism_7d_avg" AS
 WITH "base" AS (
         SELECT "nutrition_metabolism_snapshots"."user_id",
            "nutrition_metabolism_snapshots"."record_date",
            "nutrition_metabolism_snapshots"."weight",
            "nutrition_metabolism_snapshots"."body_fat_percent",
            "nutrition_metabolism_snapshots"."lean_mass",
            "nutrition_metabolism_snapshots"."bmr",
            "nutrition_metabolism_snapshots"."tdee",
            "nutrition_metabolism_snapshots"."activity_level",
            "nutrition_metabolism_snapshots"."calculated_at"
           FROM "public"."nutrition_metabolism_snapshots"
        ), "last7" AS (
         SELECT "base"."user_id",
            "base"."record_date",
            "base"."weight",
            "base"."body_fat_percent",
            "base"."lean_mass",
            "base"."bmr",
            "base"."tdee"
           FROM "base"
          WHERE ("base"."record_date" >= ((("now"() AT TIME ZONE 'Asia/Tokyo'::"text"))::"date" - 6))
        )
 SELECT "user_id",
    "min"("record_date") AS "from_date",
    "max"("record_date") AS "to_date",
    ("count"(*))::integer AS "days_count",
    "round"("avg"("weight"), 1) AS "avg_weight",
    "round"("avg"("body_fat_percent"), 1) AS "avg_body_fat_percent",
    "round"("avg"("lean_mass"), 1) AS "avg_lean_mass",
    ("round"("avg"("bmr"), 0))::integer AS "avg_bmr",
    ("round"("avg"("tdee"), 0))::integer AS "avg_tdee"
   FROM "last7"
  GROUP BY "user_id";


ALTER VIEW "public"."nutrition_metabolism_7d_avg" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."nutrition_plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "goal_type" "text",
    "activity_level" "text",
    "target_weight" numeric(5,2),
    "target_date" "date",
    "target_calories" integer,
    "target_p" numeric(6,1),
    "target_f" numeric(6,1),
    "target_c" numeric(6,1),
    "bmr" integer,
    "tdee" integer,
    "feasibility" "text",
    "action_goals" "jsonb" DEFAULT '[]'::"jsonb",
    "ai_advice" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "nutrition_plans_feasibility_check" CHECK (("feasibility" = ANY (ARRAY['safe'::"text", 'challenging'::"text", 'risky'::"text"])))
);


ALTER TABLE "public"."nutrition_plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."nutrition_targets_daily" (
    "user_id" "uuid" NOT NULL,
    "team_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "tdee" numeric NOT NULL,
    "goal" "text" DEFAULT 'maintain'::"text" NOT NULL,
    "protein_g" numeric NOT NULL,
    "fat_g" numeric NOT NULL,
    "carbs_g" numeric NOT NULL,
    "protein_kcal" numeric NOT NULL,
    "fat_kcal" numeric NOT NULL,
    "carbs_kcal" numeric NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "nutrition_targets_goal_check" CHECK (("goal" = ANY (ARRAY['maintain'::"text", 'cut'::"text", 'bulk'::"text"])))
);


ALTER TABLE "public"."nutrition_targets_daily" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organization_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "organization_members_role_check" CHECK (("role" = ANY (ARRAY['organization_admin'::"text", 'member'::"text"])))
);


ALTER TABLE "public"."organization_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organizations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text",
    "settings" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."organizations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."performance_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text",
    "icon" "text" DEFAULT 'activity'::"text",
    "sort_order" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."performance_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."performance_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "test_type_id" "uuid" NOT NULL,
    "date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "values" "jsonb" NOT NULL,
    "notes" "text" DEFAULT ''::"text",
    "is_official" boolean DEFAULT true,
    "weather_conditions" "text" DEFAULT ''::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."performance_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."performance_test_types" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "category_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text",
    "unit" "text" NOT NULL,
    "higher_is_better" boolean DEFAULT true,
    "fields" "jsonb" DEFAULT '[]'::"jsonb",
    "sort_order" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "user_can_input" boolean DEFAULT true
);


ALTER TABLE "public"."performance_test_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."performance_test_types_backup" (
    "id" "uuid" NOT NULL,
    "category_id" "uuid",
    "name" "text",
    "display_name" "text",
    "description" "text",
    "unit" "text",
    "higher_is_better" boolean,
    "fields" "jsonb",
    "sort_order" integer,
    "is_active" boolean,
    "created_at" timestamp with time zone,
    "user_can_input" boolean
);


ALTER TABLE "public"."performance_test_types_backup" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."personal_bests" AS
 SELECT DISTINCT ON ("pr"."user_id", "pr"."test_type_id") "pr"."id",
    "pr"."user_id",
    "pr"."test_type_id",
    "ptt"."name" AS "test_name",
    "ptt"."display_name" AS "test_display_name",
    "ptt"."unit",
    "ptt"."higher_is_better",
    "pr"."date",
    "pr"."values",
    (("pr"."values" ->> 'primary_value'::"text"))::numeric AS "primary_value",
    (("pr"."values" ->> 'relative_1rm'::"text"))::numeric AS "relative_1rm",
    (("pr"."values" ->> 'weight_at_test'::"text"))::numeric AS "weight_at_test",
    "pr"."created_at"
   FROM ("public"."performance_records" "pr"
     JOIN "public"."performance_test_types" "ptt" ON (("pr"."test_type_id" = "ptt"."id")))
  ORDER BY "pr"."user_id", "pr"."test_type_id",
        CASE
            WHEN "ptt"."higher_is_better" THEN (("pr"."values" ->> 'primary_value'::"text"))::numeric
            ELSE (- (("pr"."values" ->> 'primary_value'::"text"))::numeric)
        END DESC NULLS LAST;


ALTER VIEW "public"."personal_bests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."point_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "points" integer NOT NULL,
    "reason" "text" NOT NULL,
    "category" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "point_transactions_category_check" CHECK (("category" = ANY (ARRAY['record'::"text", 'streak'::"text", 'achievement'::"text", 'goal'::"text", 'social'::"text", 'bonus'::"text", 'rank_bonus'::"text"])))
);


ALTER TABLE "public"."point_transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."push_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "endpoint" "text" NOT NULL,
    "p256dh" "text" NOT NULL,
    "auth" "text" NOT NULL,
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."push_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reflections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "reflection_date" "date" DEFAULT (("now"() AT TIME ZONE 'utc'::"text"))::"date" NOT NULL,
    "did" "text",
    "didnt" "text",
    "cause_tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "next_action" "text",
    "free_note" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "next_action_items" "jsonb" DEFAULT '[]'::"jsonb"
);


ALTER TABLE "public"."reflections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."report_configs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text",
    "organization_id" "uuid",
    "team_id" "uuid",
    "created_by" "uuid",
    "period_type" "text" NOT NULL,
    "include_training_load" boolean DEFAULT true,
    "include_acwr" boolean DEFAULT true,
    "include_weight" boolean DEFAULT true,
    "include_sleep" boolean DEFAULT true,
    "include_motivation" boolean DEFAULT true,
    "include_performance" boolean DEFAULT true,
    "include_alerts" boolean DEFAULT true,
    "compare_with_previous" boolean DEFAULT true,
    "include_team_average" boolean DEFAULT true,
    "highlight_high_risk" boolean DEFAULT true,
    "settings" "jsonb" DEFAULT '{}'::"jsonb",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "report_configs_period_type_check" CHECK (("period_type" = ANY (ARRAY['weekly'::"text", 'monthly'::"text", 'quarterly'::"text", 'semi_annual'::"text", 'annual'::"text", 'custom'::"text"])))
);


ALTER TABLE "public"."report_configs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."report_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "template_id" "uuid",
    "scheduled_report_id" "uuid",
    "report_type" "text" NOT NULL,
    "generated_by" "uuid" NOT NULL,
    "parameters" "jsonb" DEFAULT '{}'::"jsonb",
    "file_path" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "report_url" "text",
    CONSTRAINT "report_history_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'running'::"text", 'completed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."report_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."report_schedules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "config_id" "uuid" NOT NULL,
    "frequency" "text" NOT NULL,
    "day_of_week" integer,
    "day_of_month" integer,
    "time_of_day" time without time zone DEFAULT '06:00:00'::time without time zone,
    "send_email" boolean DEFAULT true,
    "save_to_history" boolean DEFAULT true,
    "next_run_at" timestamp with time zone,
    "last_run_at" timestamp with time zone,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "report_schedules_day_of_month_check" CHECK ((("day_of_month" >= 1) AND ("day_of_month" <= 31))),
    CONSTRAINT "report_schedules_day_of_week_check" CHECK ((("day_of_week" >= 0) AND ("day_of_week" <= 6))),
    CONSTRAINT "report_schedules_frequency_check" CHECK (("frequency" = ANY (ARRAY['daily'::"text", 'weekly'::"text", 'monthly'::"text", 'quarterly'::"text", 'semi_annual'::"text", 'annual'::"text"])))
);


ALTER TABLE "public"."report_schedules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."report_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "config_id" "uuid" NOT NULL,
    "receive_email" boolean DEFAULT true,
    "email_address" "text",
    "notify_on_generation" boolean DEFAULT true,
    "notify_on_high_risk" boolean DEFAULT true,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."report_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."report_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "report_type" "text" NOT NULL,
    "sections" "jsonb" DEFAULT '[]'::"jsonb",
    "metrics" "jsonb" DEFAULT '[]'::"jsonb",
    "filters" "jsonb" DEFAULT '{}'::"jsonb",
    "is_default" boolean DEFAULT false,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "report_templates_report_type_check" CHECK (("report_type" = ANY (ARRAY['individual'::"text", 'team'::"text", 'organization'::"text"])))
);


ALTER TABLE "public"."report_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."scheduled_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "template_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "schedule_type" "text" NOT NULL,
    "schedule_config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "recipients" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "filters" "jsonb" DEFAULT '{}'::"jsonb",
    "is_active" boolean DEFAULT true,
    "last_run" timestamp with time zone,
    "next_run" timestamp with time zone,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "scheduled_reports_schedule_type_check" CHECK (("schedule_type" = ANY (ARRAY['daily'::"text", 'weekly'::"text", 'monthly'::"text"])))
);


ALTER TABLE "public"."scheduled_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shared_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."shared_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sleep_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "sleep_hours" numeric(4,2) NOT NULL,
    "sleep_quality" integer,
    "bedtime" time without time zone,
    "waketime" time without time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "sleep_records_sleep_hours_check" CHECK ((("sleep_hours" >= (0)::numeric) AND ("sleep_hours" <= (24)::numeric))),
    CONSTRAINT "sleep_records_sleep_quality_check" CHECK ((("sleep_quality" >= 1) AND ("sleep_quality" <= 10)))
);


ALTER TABLE "public"."sleep_records" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."staff_team_athletes_with_activity" AS
SELECT
    NULL::"uuid" AS "id",
    NULL::"text" AS "name",
    NULL::"text" AS "email",
    NULL::"text" AS "role",
    NULL::"uuid" AS "team_id",
    NULL::timestamp with time zone AS "created_at",
    NULL::"text" AS "user_id",
    NULL::"jsonb" AS "email_notifications",
    NULL::timestamp with time zone AS "last_alert_email_sent",
    NULL::"text" AS "gender",
    NULL::numeric(5,1) AS "height_cm",
    NULL::"date" AS "date_of_birth",
    NULL::timestamp with time zone AS "terms_accepted_at",
    NULL::boolean AS "terms_accepted",
    NULL::bigint AS "training_days_28d",
    NULL::bigint AS "training_sessions_28d",
    NULL::"date" AS "last_training_date";


ALTER VIEW "public"."staff_team_athletes_with_activity" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staff_team_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "staff_user_id" "uuid" NOT NULL,
    "team_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "role" "text" DEFAULT 'staff'::"text" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    CONSTRAINT "staff_team_links_role_check" CHECK (("role" = ANY (ARRAY['staff'::"text", 'team_admin'::"text"])))
);


ALTER TABLE "public"."staff_team_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."team_access_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "requester_id" "uuid" NOT NULL,
    "team_id" "uuid" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "status" "text" NOT NULL,
    "request_message" "text" DEFAULT ''::"text",
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "review_notes" "text" DEFAULT ''::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "team_access_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."team_access_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."team_achievement_notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "team_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "achievement_id" "uuid" NOT NULL,
    "is_read" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."team_achievement_notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."team_achievements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "team_id" "uuid" NOT NULL,
    "achievement_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text",
    "achieved_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "celebrated" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."team_achievements" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."team_acwr_daily" AS
 SELECT "team_id",
    "date",
    "avg"("acwr") FILTER (WHERE ("is_valid" AND ("acwr" IS NOT NULL))) AS "average_acwr",
    "count"(*) FILTER (WHERE ("is_valid" AND ("acwr" IS NOT NULL))) AS "athlete_count"
   FROM "public"."athlete_acwr_daily"
  GROUP BY "team_id", "date";


ALTER VIEW "public"."team_acwr_daily" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."team_assignment_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "from_team_id" "uuid",
    "to_team_id" "uuid",
    "organization_id" "uuid" NOT NULL,
    "assigned_by" "uuid",
    "assignment_reason" "text",
    "changed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "change_type" "text" NOT NULL,
    CONSTRAINT "check_team_ids" CHECK ((("from_team_id" IS NOT NULL) OR ("to_team_id" IS NOT NULL))),
    CONSTRAINT "team_assignment_history_change_type_check" CHECK (("change_type" = ANY (ARRAY['assigned'::"text", 'transferred'::"text", 'removed'::"text"])))
);


ALTER TABLE "public"."team_assignment_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."team_member_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "team_id" "uuid" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "assigned_by" "uuid",
    "assigned_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "assignment_type" "text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "team_member_assignments_assignment_type_check" CHECK (("assignment_type" = ANY (ARRAY['primary'::"text", 'secondary'::"text"])))
);


ALTER TABLE "public"."team_member_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_points" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "total_points" integer DEFAULT 0 NOT NULL,
    "current_level" integer DEFAULT 1 NOT NULL,
    "points_to_next_level" integer DEFAULT 100 NOT NULL,
    "rank_title" "text" DEFAULT 'ビギナー'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "rank_tier" "text" DEFAULT 'ビギナー'::"text",
    "rank_level" "text" DEFAULT 'I'::"text"
);


ALTER TABLE "public"."user_points" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."users_user_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."users_user_id_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "role" "text" NOT NULL,
    "team_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "user_id" "text" DEFAULT ('USER'::"text" || "lpad"(("nextval"('"public"."users_user_id_seq"'::"regclass"))::"text", 4, '0'::"text")) NOT NULL,
    "email_notifications" "jsonb" DEFAULT '{"alerts": true, "invitations": true, "password_reset": true, "weekly_summary": false}'::"jsonb",
    "last_alert_email_sent" timestamp with time zone,
    "gender" "text",
    "height_cm" numeric(5,1),
    "date_of_birth" "date",
    "terms_accepted_at" timestamp with time zone,
    "terms_accepted" boolean DEFAULT false NOT NULL,
    "phone_number" "text",
    "nutrition_enabled" boolean DEFAULT false NOT NULL,
    "organization_id" "uuid",
    "ftt_enabled" boolean DEFAULT false NOT NULL,
    CONSTRAINT "users_date_of_birth_check" CHECK ((("date_of_birth" IS NULL) OR (("date_of_birth" <= (CURRENT_DATE - '10 years'::interval)) AND ("date_of_birth" >= (CURRENT_DATE - '150 years'::interval))))),
    CONSTRAINT "users_gender_check" CHECK ((("gender" IS NULL) OR ("gender" = ANY (ARRAY['male'::"text", 'female'::"text", 'other'::"text", 'prefer_not_to_say'::"text"])))),
    CONSTRAINT "users_height_check" CHECK ((("height_cm" IS NULL) OR (("height_cm" >= (100)::numeric) AND ("height_cm" <= (250)::numeric)))),
    CONSTRAINT "users_role_check" CHECK (("role" = ANY (ARRAY['athlete'::"text", 'staff'::"text", 'parent'::"text", 'global_admin'::"text"])))
);


ALTER TABLE "public"."users" OWNER TO "postgres";


COMMENT ON COLUMN "public"."users"."gender" IS '性別: male, female, other, prefer_not_to_say';



COMMENT ON COLUMN "public"."users"."height_cm" IS '身長（cm）: 100-250の範囲、小数点第1位まで記録可能';



COMMENT ON COLUMN "public"."users"."date_of_birth" IS '生年月日: BMI基準値や年齢別パフォーマンス評価に使用';



COMMENT ON COLUMN "public"."users"."nutrition_enabled" IS '栄養機能の表示ON/OFFフラグ。初期false。完成までテストアカウントのみtrueにして隠し公開する。';



COMMENT ON COLUMN "public"."users"."ftt_enabled" IS 'FTT (Finger Tapping Test) feature flag. true のユーザーのみUI表示';



CREATE OR REPLACE VIEW "public"."team_points_rankings" AS
 SELECT "u"."id" AS "user_id",
    "u"."name" AS "user_name",
    "u"."team_id",
    COALESCE("up"."total_points", 0) AS "total_points",
    COALESCE("up"."current_level", 1) AS "current_level",
    "rank"() OVER (PARTITION BY "u"."team_id" ORDER BY COALESCE("up"."total_points", 0) DESC) AS "rank"
   FROM ("public"."users" "u"
     LEFT JOIN "public"."user_points" "up" ON (("up"."user_id" = "u"."id")))
  WHERE ("u"."role" = 'athlete'::"text")
  GROUP BY "u"."id", "u"."name", "u"."team_id", "up"."total_points", "up"."current_level";


ALTER VIEW "public"."team_points_rankings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."training_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "rpe" integer NOT NULL,
    "duration_min" integer NOT NULL,
    "load" numeric GENERATED ALWAYS AS (("rpe" * "duration_min")) STORED,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "growth_vector" smallint,
    "intent_signal" smallint,
    "arrow_score" integer DEFAULT 50 NOT NULL,
    "signal_score" integer DEFAULT 50 NOT NULL,
    CONSTRAINT "training_records_arrow_score_range" CHECK ((("arrow_score" >= 0) AND ("arrow_score" <= 100))),
    CONSTRAINT "training_records_duration_min_check" CHECK (("duration_min" >= 0)),
    CONSTRAINT "training_records_growth_vector_range" CHECK ((("growth_vector" IS NULL) OR (("growth_vector" >= 0) AND ("growth_vector" <= 100)))),
    CONSTRAINT "training_records_intent_signal_range" CHECK ((("intent_signal" IS NULL) OR (("intent_signal" >= 0) AND ("intent_signal" <= 100)))),
    CONSTRAINT "training_records_load_check" CHECK (("load" >= (0)::numeric)),
    CONSTRAINT "training_records_rpe_check" CHECK ((("rpe" >= 0) AND ("rpe" <= 10))),
    CONSTRAINT "training_records_signal_score_range" CHECK ((("signal_score" >= 0) AND ("signal_score" <= 100)))
);


ALTER TABLE "public"."training_records" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."team_training_daily" AS
 SELECT "u"."team_id",
    "tr"."date",
    "round"("avg"("tr"."rpe"), 2) AS "average_rpe",
    "round"("avg"("tr"."load"), 2) AS "average_load",
    ("count"(*))::integer AS "athlete_count"
   FROM ("public"."training_records" "tr"
     JOIN "public"."users" "u" ON (("u"."id" = "tr"."user_id")))
  WHERE (("u"."role" = 'athlete'::"text") AND ("u"."team_id" IS NOT NULL))
  GROUP BY "u"."team_id", "tr"."date";


ALTER VIEW "public"."team_training_daily" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."team_transfer_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "athlete_id" "uuid" NOT NULL,
    "from_team_id" "uuid",
    "to_team_id" "uuid" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "transfer_request_id" "uuid",
    "transferred_by" "uuid" NOT NULL,
    "transfer_reason" "text" DEFAULT ''::"text",
    "transfer_date" timestamp with time zone DEFAULT "now"(),
    "metadata" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."team_transfer_history" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."team_users_union" AS
 SELECT "u"."id" AS "user_id",
    "u"."team_id"
   FROM "public"."users" "u"
  WHERE ("u"."team_id" IS NOT NULL)
UNION
 SELECT "tma"."user_id",
    "tma"."team_id"
   FROM "public"."team_member_assignments" "tma";


ALTER VIEW "public"."team_users_union" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."team_weekly_rankings" AS
 SELECT "u"."id" AS "user_id",
    "u"."name" AS "user_name",
    "u"."team_id",
    "count"("tr"."id") AS "weekly_records",
    "rank"() OVER (PARTITION BY "u"."team_id" ORDER BY ("count"("tr"."id")) DESC) AS "rank"
   FROM ("public"."users" "u"
     LEFT JOIN "public"."training_records" "tr" ON ((("tr"."user_id" = "u"."id") AND ("tr"."date" >= (CURRENT_DATE - '7 days'::interval)))))
  WHERE ("u"."role" = 'athlete'::"text")
  GROUP BY "u"."id", "u"."name", "u"."team_id";


ALTER VIEW "public"."team_weekly_rankings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."teams" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "organization_id" "uuid",
    "department_id" "uuid"
);


ALTER TABLE "public"."teams" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tutorial_progress" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "completed_steps" "jsonb" DEFAULT '[]'::"jsonb",
    "current_step" "text",
    "is_completed" boolean DEFAULT false,
    "skipped" boolean DEFAULT false,
    "last_updated" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "tutorial_progress_role_check" CHECK (("role" = ANY (ARRAY['athlete'::"text", 'staff'::"text", 'parent'::"text", 'global_admin'::"text"])))
);


ALTER TABLE "public"."tutorial_progress" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_badges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "badge_id" "uuid" NOT NULL,
    "earned_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_new" boolean DEFAULT true NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."user_badges" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."weight_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "weight_kg" numeric(5,2) NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "weight_records_weight_kg_check" CHECK ((("weight_kg" > (0)::numeric) AND ("weight_kg" < (500)::numeric)))
);


ALTER TABLE "public"."weight_records" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."user_daily_flags_jst" AS
 WITH "all_days" AS (
         SELECT "tr"."user_id",
            (("tr"."created_at" AT TIME ZONE 'Asia/Tokyo'::"text"))::"date" AS "jst_day",
            true AS "has_training",
            false AS "has_weight",
            false AS "has_sleep",
            false AS "has_motivation"
           FROM "public"."training_records" "tr"
        UNION ALL
         SELECT "wr"."user_id",
            (("wr"."created_at" AT TIME ZONE 'Asia/Tokyo'::"text"))::"date" AS "jst_day",
            false,
            true,
            false,
            false
           FROM "public"."weight_records" "wr"
        )
 SELECT "user_id",
    "jst_day",
    "bool_or"("has_training") AS "has_training",
    "bool_or"("has_weight") AS "has_weight",
    ("bool_or"("has_training") OR "bool_or"("has_weight") OR "bool_or"("has_sleep") OR "bool_or"("has_motivation")) AS "has_all"
   FROM "all_days"
  GROUP BY "user_id", "jst_day";


ALTER VIEW "public"."user_daily_flags_jst" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_goals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "goal_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "target_value" numeric,
    "current_value" numeric DEFAULT 0,
    "unit" "text",
    "deadline" "date",
    "status" "text" DEFAULT 'active'::"text",
    "completed_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "test_type_id" "uuid",
    CONSTRAINT "user_goals_goal_type_check" CHECK (("goal_type" = ANY (ARRAY['performance'::"text", 'weight'::"text", 'streak'::"text", 'habit'::"text", 'custom'::"text"]))),
    CONSTRAINT "user_goals_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'completed'::"text", 'failed'::"text", 'abandoned'::"text"])))
);


ALTER TABLE "public"."user_goals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_phone_links" (
    "user_id" "uuid" NOT NULL,
    "phone_number" "text" NOT NULL,
    "phone_normalized" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_phone_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_streaks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "streak_type" "text" NOT NULL,
    "current_streak" integer DEFAULT 0 NOT NULL,
    "longest_streak" integer DEFAULT 0 NOT NULL,
    "last_recorded_date" "date",
    "streak_freeze_count" integer DEFAULT 1 NOT NULL,
    "total_records" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_streaks_streak_type_check" CHECK (("streak_type" = ANY (ARRAY['training'::"text", 'weight'::"text", 'sleep'::"text", 'motivation'::"text", 'all'::"text"])))
);


ALTER TABLE "public"."user_streaks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_team_memberships" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "team_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'athlete'::"text" NOT NULL,
    "start_date" "date",
    "end_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_team_memberships_date_check" CHECK ((("start_date" IS NULL) OR ("end_date" IS NULL) OR ("start_date" <= "end_date")))
);


ALTER TABLE "public"."user_team_memberships" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_ftt_save_rate_daily" AS
 SELECT "user_id",
    "local_date",
    "count"(*) AS "attempts",
    "count"(*) FILTER (WHERE "did_save") AS "saves",
    (("count"(*) FILTER (WHERE "did_save"))::double precision / (NULLIF("count"(*), 0))::double precision) AS "save_rate"
   FROM "public"."ftt_events"
  GROUP BY "user_id", "local_date";


ALTER VIEW "public"."v_ftt_save_rate_daily" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_inbody_link_candidates" AS
 SELECT "r"."id" AS "inbody_id",
    "r"."phone_number" AS "inbody_phone",
    "public"."normalize_phone"("r"."phone_number") AS "inbody_norm",
    "u"."id" AS "user_id",
    "u"."phone_number" AS "user_phone",
    "public"."normalize_phone"("u"."phone_number") AS "user_norm",
    "r"."measured_at"
   FROM ("public"."inbody_records" "r"
     JOIN "public"."users" "u" ON (("public"."normalize_phone"("r"."phone_number") = "public"."normalize_phone"("u"."phone_number"))))
  WHERE (("r"."user_id" IS NULL) AND ("r"."phone_number" IS NOT NULL));


ALTER VIEW "public"."v_inbody_link_candidates" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_staff_team_athletes" AS
 SELECT "stl"."staff_user_id",
    "stl"."team_id",
    "u"."id" AS "athlete_user_id"
   FROM ("public"."staff_team_links" "stl"
     JOIN "public"."users" "u" ON (("u"."team_id" = "stl"."team_id")));


ALTER VIEW "public"."v_staff_team_athletes" OWNER TO "postgres";


ALTER TABLE ONLY "public"."achievement_milestones"
    ADD CONSTRAINT "achievement_milestones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_summaries"
    ADD CONSTRAINT "ai_summaries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_summaries"
    ADD CONSTRAINT "ai_summaries_user_id_period_type_period_start_key" UNIQUE ("user_id", "period_type", "period_start");



ALTER TABLE ONLY "public"."alerts"
    ADD CONSTRAINT "alerts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."athlete_activity_level_daily"
    ADD CONSTRAINT "athlete_activity_level_daily_pkey" PRIMARY KEY ("user_id", "date");



ALTER TABLE ONLY "public"."athlete_acwr_daily"
    ADD CONSTRAINT "athlete_acwr_daily_pkey" PRIMARY KEY ("user_id", "date");



ALTER TABLE ONLY "public"."athlete_transfer_requests"
    ADD CONSTRAINT "athlete_transfer_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."badges"
    ADD CONSTRAINT "badges_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."badges"
    ADD CONSTRAINT "badges_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."badges"
    ADD CONSTRAINT "badges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."basal_body_temperature"
    ADD CONSTRAINT "basal_body_temperature_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."basal_body_temperature"
    ADD CONSTRAINT "basal_body_temperature_user_id_measurement_date_key" UNIQUE ("user_id", "measurement_date");



ALTER TABLE ONLY "public"."coach_comments"
    ADD CONSTRAINT "coach_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_energy_snapshots"
    ADD CONSTRAINT "daily_energy_snapshots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_energy_snapshots"
    ADD CONSTRAINT "daily_energy_snapshots_user_id_date_key" UNIQUE ("user_id", "date");



ALTER TABLE ONLY "public"."daily_reflections"
    ADD CONSTRAINT "daily_reflections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_reflections"
    ADD CONSTRAINT "daily_reflections_user_id_reflection_date_key" UNIQUE ("user_id", "reflection_date");



ALTER TABLE ONLY "public"."data_sharing_settings"
    ADD CONSTRAINT "data_sharing_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."department_managers"
    ADD CONSTRAINT "department_managers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."department_managers"
    ADD CONSTRAINT "department_managers_user_id_department_id_key" UNIQUE ("user_id", "department_id");



ALTER TABLE ONLY "public"."departments"
    ADD CONSTRAINT "departments_organization_id_name_key" UNIQUE ("organization_id", "name");



ALTER TABLE ONLY "public"."departments"
    ADD CONSTRAINT "departments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_logs"
    ADD CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."engine_events"
    ADD CONSTRAINT "engine_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."engine_states"
    ADD CONSTRAINT "engine_states_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ftt_events"
    ADD CONSTRAINT "ftt_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ftt_records"
    ADD CONSTRAINT "ftt_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ftt_records"
    ADD CONSTRAINT "ftt_records_unique_per_day" UNIQUE ("user_id", "date");



ALTER TABLE ONLY "public"."generated_reports"
    ADD CONSTRAINT "generated_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inbody_records"
    ADD CONSTRAINT "inbody_phone_date_uniq" UNIQUE ("measured_at", "phone_number_norm");



ALTER TABLE ONLY "public"."inbody_records"
    ADD CONSTRAINT "inbody_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."injury_records"
    ADD CONSTRAINT "injury_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."injury_risk_assessments"
    ADD CONSTRAINT "injury_risk_assessments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."injury_risk_assessments"
    ADD CONSTRAINT "injury_risk_assessments_user_id_assessment_date_key" UNIQUE ("user_id", "assessment_date");



ALTER TABLE ONLY "public"."invitation_tokens"
    ADD CONSTRAINT "invitation_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invitation_tokens"
    ADD CONSTRAINT "invitation_tokens_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."menstrual_cycles"
    ADD CONSTRAINT "menstrual_cycles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."message_threads"
    ADD CONSTRAINT "message_threads_participant1_id_participant2_id_key" UNIQUE ("participant1_id", "participant2_id");



ALTER TABLE ONLY "public"."message_threads"
    ADD CONSTRAINT "message_threads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."motivation_records"
    ADD CONSTRAINT "motivation_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."motivation_records"
    ADD CONSTRAINT "motivation_records_user_id_date_key" UNIQUE ("user_id", "date");



ALTER TABLE ONLY "public"."nutrition_daily"
    ADD CONSTRAINT "nutrition_daily_pkey" PRIMARY KEY ("user_id", "date");



ALTER TABLE ONLY "public"."nutrition_daily_reports"
    ADD CONSTRAINT "nutrition_daily_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."nutrition_daily_reports"
    ADD CONSTRAINT "nutrition_daily_reports_user_id_report_date_key" UNIQUE ("user_id", "report_date");



ALTER TABLE ONLY "public"."nutrition_logs"
    ADD CONSTRAINT "nutrition_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."nutrition_metabolism_snapshots"
    ADD CONSTRAINT "nutrition_metabolism_snapshots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."nutrition_metabolism_snapshots"
    ADD CONSTRAINT "nutrition_metabolism_user_day_unique" UNIQUE ("user_id", "record_date");



ALTER TABLE ONLY "public"."nutrition_plans"
    ADD CONSTRAINT "nutrition_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."nutrition_targets_daily"
    ADD CONSTRAINT "nutrition_targets_daily_pkey" PRIMARY KEY ("user_id", "date");



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_user_id_organization_id_key" UNIQUE ("user_id", "organization_id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."performance_categories"
    ADD CONSTRAINT "performance_categories_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."performance_categories"
    ADD CONSTRAINT "performance_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."performance_records"
    ADD CONSTRAINT "performance_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."performance_test_types_backup"
    ADD CONSTRAINT "performance_test_types_backup_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."performance_test_types"
    ADD CONSTRAINT "performance_test_types_category_id_name_key" UNIQUE ("category_id", "name");



ALTER TABLE ONLY "public"."performance_test_types"
    ADD CONSTRAINT "performance_test_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."point_transactions"
    ADD CONSTRAINT "point_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_user_id_endpoint_key" UNIQUE ("user_id", "endpoint");



ALTER TABLE ONLY "public"."reflections"
    ADD CONSTRAINT "reflections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reflections"
    ADD CONSTRAINT "reflections_user_date_unique" UNIQUE ("user_id", "reflection_date");



ALTER TABLE ONLY "public"."report_configs"
    ADD CONSTRAINT "report_configs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."report_history"
    ADD CONSTRAINT "report_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."report_schedules"
    ADD CONSTRAINT "report_schedules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."report_subscriptions"
    ADD CONSTRAINT "report_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."report_subscriptions"
    ADD CONSTRAINT "report_subscriptions_user_id_config_id_key" UNIQUE ("user_id", "config_id");



ALTER TABLE ONLY "public"."report_templates"
    ADD CONSTRAINT "report_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."scheduled_reports"
    ADD CONSTRAINT "scheduled_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shared_reports"
    ADD CONSTRAINT "shared_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sleep_records"
    ADD CONSTRAINT "sleep_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sleep_records"
    ADD CONSTRAINT "sleep_records_user_id_date_key" UNIQUE ("user_id", "date");



ALTER TABLE ONLY "public"."staff_team_links"
    ADD CONSTRAINT "staff_team_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_team_links"
    ADD CONSTRAINT "staff_team_links_staff_user_id_team_id_key" UNIQUE ("staff_user_id", "team_id");



ALTER TABLE ONLY "public"."team_access_requests"
    ADD CONSTRAINT "team_access_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."team_access_requests"
    ADD CONSTRAINT "team_access_requests_requester_id_team_id_key" UNIQUE ("requester_id", "team_id");



ALTER TABLE ONLY "public"."team_achievement_notifications"
    ADD CONSTRAINT "team_achievement_notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."team_achievements"
    ADD CONSTRAINT "team_achievements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."team_assignment_history"
    ADD CONSTRAINT "team_assignment_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."team_member_assignments"
    ADD CONSTRAINT "team_member_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."team_member_assignments"
    ADD CONSTRAINT "team_member_assignments_user_id_organization_id_assignment__key" UNIQUE ("user_id", "organization_id", "assignment_type", "team_id");



ALTER TABLE ONLY "public"."team_transfer_history"
    ADD CONSTRAINT "team_transfer_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."training_records"
    ADD CONSTRAINT "training_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."training_records"
    ADD CONSTRAINT "training_records_user_id_date_key" UNIQUE ("user_id", "date");



ALTER TABLE ONLY "public"."tutorial_progress"
    ADD CONSTRAINT "tutorial_progress_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tutorial_progress"
    ADD CONSTRAINT "tutorial_progress_user_id_role_key" UNIQUE ("user_id", "role");



ALTER TABLE ONLY "public"."tutorial_progress"
    ADD CONSTRAINT "tutorial_progress_user_role_unique" UNIQUE ("user_id", "role");



ALTER TABLE ONLY "public"."daily_energy_snapshots"
    ADD CONSTRAINT "unique_user_date" UNIQUE ("user_id", "date");



ALTER TABLE ONLY "public"."user_badges"
    ADD CONSTRAINT "user_badges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_badges"
    ADD CONSTRAINT "user_badges_user_id_badge_id_key" UNIQUE ("user_id", "badge_id");



ALTER TABLE ONLY "public"."user_goals"
    ADD CONSTRAINT "user_goals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_phone_links"
    ADD CONSTRAINT "user_phone_links_phone_normalized_key" UNIQUE ("phone_normalized");



ALTER TABLE ONLY "public"."user_phone_links"
    ADD CONSTRAINT "user_phone_links_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."user_points"
    ADD CONSTRAINT "user_points_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_points"
    ADD CONSTRAINT "user_points_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."user_streaks"
    ADD CONSTRAINT "user_streaks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_streaks"
    ADD CONSTRAINT "user_streaks_user_id_streak_type_key" UNIQUE ("user_id", "streak_type");



ALTER TABLE ONLY "public"."user_team_memberships"
    ADD CONSTRAINT "user_team_memberships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_team_memberships"
    ADD CONSTRAINT "user_team_memberships_unique" UNIQUE ("user_id", "team_id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."weight_records"
    ADD CONSTRAINT "weight_records_pkey" PRIMARY KEY ("id");



CREATE INDEX "athlete_acwr_daily_date_idx" ON "public"."athlete_acwr_daily" USING "btree" ("date");



CREATE INDEX "athlete_acwr_daily_team_date_idx" ON "public"."athlete_acwr_daily" USING "btree" ("team_id", "date");



CREATE INDEX "athlete_acwr_daily_user_date_idx" ON "public"."athlete_acwr_daily" USING "btree" ("user_id", "date");



CREATE UNIQUE INDEX "badges_code_unique" ON "public"."badges" USING "btree" ("code");



CREATE INDEX "daily_energy_snapshots_user_date_idx" ON "public"."daily_energy_snapshots" USING "btree" ("user_id", "date");



CREATE INDEX "engine_events_user_date_idx" ON "public"."engine_events" USING "btree" ("user_id", "event_date" DESC);



CREATE INDEX "engine_events_user_type_idx" ON "public"."engine_events" USING "btree" ("user_id", "event_type");



CREATE INDEX "events_unprocessed_idx" ON "public"."events" USING "btree" ("processed_at") WHERE ("processed_at" IS NULL);



CREATE INDEX "events_user_id_event_type_idx" ON "public"."events" USING "btree" ("user_id", "event_type");



CREATE INDEX "ftt_events_user_local_date_idx" ON "public"."ftt_events" USING "btree" ("user_id", "local_date" DESC);



CREATE INDEX "ftt_events_user_measured_at_idx" ON "public"."ftt_events" USING "btree" ("user_id", "measured_at" DESC);



CREATE INDEX "ftt_events_user_session_did_save_idx" ON "public"."ftt_events" USING "btree" ("user_id", "session_id", "did_save");



CREATE INDEX "ftt_events_user_session_idx" ON "public"."ftt_events" USING "btree" ("user_id", "session_id");



CREATE INDEX "ftt_records_user_date_idx" ON "public"."ftt_records" USING "btree" ("user_id", "date" DESC);



CREATE INDEX "ftt_records_user_measured_at_idx" ON "public"."ftt_records" USING "btree" ("user_id", "measured_at" DESC);



CREATE INDEX "idx_achievement_milestones_user_id" ON "public"."achievement_milestones" USING "btree" ("user_id");



CREATE INDEX "idx_activity_level_team_date" ON "public"."athlete_activity_level_daily" USING "btree" ("team_id", "date");



CREATE INDEX "idx_activity_level_user_date" ON "public"."athlete_activity_level_daily" USING "btree" ("user_id", "date" DESC);



CREATE INDEX "idx_ai_summaries_user_period" ON "public"."ai_summaries" USING "btree" ("user_id", "period_type", "period_start" DESC);



CREATE INDEX "idx_athlete_acwr_daily_team_updated_at_desc" ON "public"."athlete_acwr_daily" USING "btree" ("team_id", "updated_at" DESC);



CREATE INDEX "idx_athlete_acwr_daily_updated_at_desc" ON "public"."athlete_acwr_daily" USING "btree" ("updated_at" DESC);



CREATE INDEX "idx_athlete_acwr_daily_user_date" ON "public"."athlete_acwr_daily" USING "btree" ("user_id", "date");



CREATE INDEX "idx_athlete_transfer_requests_athlete" ON "public"."athlete_transfer_requests" USING "btree" ("athlete_id");



CREATE INDEX "idx_athlete_transfer_requests_from_team" ON "public"."athlete_transfer_requests" USING "btree" ("from_team_id");



CREATE INDEX "idx_athlete_transfer_requests_organization" ON "public"."athlete_transfer_requests" USING "btree" ("organization_id");



CREATE INDEX "idx_athlete_transfer_requests_status" ON "public"."athlete_transfer_requests" USING "btree" ("status") WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_athlete_transfer_requests_to_team" ON "public"."athlete_transfer_requests" USING "btree" ("to_team_id");



CREATE INDEX "idx_bbt_org" ON "public"."basal_body_temperature" USING "btree" ("organization_id");



CREATE INDEX "idx_bbt_user_date" ON "public"."basal_body_temperature" USING "btree" ("user_id", "measurement_date" DESC);



CREATE INDEX "idx_coach_comments_athlete" ON "public"."coach_comments" USING "btree" ("athlete_id");



CREATE INDEX "idx_coach_comments_unread" ON "public"."coach_comments" USING "btree" ("athlete_id", "is_read");



CREATE INDEX "idx_daily_reflections_created" ON "public"."daily_reflections" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_daily_reflections_user_date" ON "public"."daily_reflections" USING "btree" ("user_id", "reflection_date" DESC);



CREATE INDEX "idx_department_managers_department_id" ON "public"."department_managers" USING "btree" ("department_id");



CREATE INDEX "idx_department_managers_user_id" ON "public"."department_managers" USING "btree" ("user_id");



CREATE INDEX "idx_departments_organization_id" ON "public"."departments" USING "btree" ("organization_id");



CREATE INDEX "idx_dss_athlete_dates" ON "public"."data_sharing_settings" USING "btree" ("athlete_user_id", "start_date", "end_date");



CREATE INDEX "idx_dss_staff_dates" ON "public"."data_sharing_settings" USING "btree" ("staff_user_id", "start_date", "end_date");



CREATE INDEX "idx_dss_team_dates" ON "public"."data_sharing_settings" USING "btree" ("team_id", "start_date", "end_date");



CREATE INDEX "idx_generated_reports_created" ON "public"."generated_reports" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_generated_reports_org" ON "public"."generated_reports" USING "btree" ("organization_id") WHERE ("organization_id" IS NOT NULL);



CREATE INDEX "idx_generated_reports_period" ON "public"."generated_reports" USING "btree" ("period_start", "period_end");



CREATE INDEX "idx_generated_reports_team" ON "public"."generated_reports" USING "btree" ("team_id") WHERE ("team_id" IS NOT NULL);



CREATE INDEX "idx_injury_records_active" ON "public"."injury_records" USING "btree" ("user_id", "occurred_date") WHERE ("recovered_date" IS NULL);



CREATE INDEX "idx_injury_records_org" ON "public"."injury_records" USING "btree" ("organization_id");



CREATE INDEX "idx_injury_records_user" ON "public"."injury_records" USING "btree" ("user_id", "occurred_date" DESC);



CREATE INDEX "idx_injury_risk_user" ON "public"."injury_risk_assessments" USING "btree" ("user_id", "assessment_date" DESC);



CREATE INDEX "idx_invitation_tokens_email" ON "public"."invitation_tokens" USING "btree" ("email");



CREATE INDEX "idx_invitation_tokens_expires_at" ON "public"."invitation_tokens" USING "btree" ("expires_at");



CREATE INDEX "idx_invitation_tokens_organization_id" ON "public"."invitation_tokens" USING "btree" ("organization_id");



CREATE INDEX "idx_invitation_tokens_token" ON "public"."invitation_tokens" USING "btree" ("token");



CREATE INDEX "idx_menstrual_cycles_org" ON "public"."menstrual_cycles" USING "btree" ("organization_id");



CREATE INDEX "idx_menstrual_cycles_user_date" ON "public"."menstrual_cycles" USING "btree" ("user_id", "cycle_start_date" DESC);



CREATE INDEX "idx_message_threads_participant1" ON "public"."message_threads" USING "btree" ("participant1_id", "last_message_at" DESC);



CREATE INDEX "idx_message_threads_participant2" ON "public"."message_threads" USING "btree" ("participant2_id", "last_message_at" DESC);



CREATE INDEX "idx_messages_receiver_unread" ON "public"."messages" USING "btree" ("receiver_id", "is_read", "created_at" DESC) WHERE ("is_read" = false);



CREATE INDEX "idx_messages_sender" ON "public"."messages" USING "btree" ("sender_id", "created_at" DESC);



CREATE INDEX "idx_messages_thread_created" ON "public"."messages" USING "btree" ("thread_id", "created_at" DESC);



CREATE INDEX "idx_motivation_records_date" ON "public"."motivation_records" USING "btree" ("date");



CREATE INDEX "idx_motivation_records_user_date" ON "public"."motivation_records" USING "btree" ("user_id", "date");



CREATE INDEX "idx_motivation_records_user_id" ON "public"."motivation_records" USING "btree" ("user_id");



CREATE INDEX "idx_nutrition_daily_team_date" ON "public"."nutrition_daily" USING "btree" ("team_id", "date");



CREATE INDEX "idx_nutrition_targets_team_date" ON "public"."nutrition_targets_daily" USING "btree" ("team_id", "date");



CREATE INDEX "idx_organization_members_organization_id" ON "public"."organization_members" USING "btree" ("organization_id");



CREATE INDEX "idx_organization_members_user_id" ON "public"."organization_members" USING "btree" ("user_id");



CREATE INDEX "idx_performance_records_date" ON "public"."performance_records" USING "btree" ("date" DESC);



CREATE INDEX "idx_performance_records_test_type_id" ON "public"."performance_records" USING "btree" ("test_type_id");



CREATE INDEX "idx_performance_records_user_id" ON "public"."performance_records" USING "btree" ("user_id");



CREATE INDEX "idx_performance_records_user_test" ON "public"."performance_records" USING "btree" ("user_id", "test_type_id");



CREATE INDEX "idx_performance_records_values" ON "public"."performance_records" USING "gin" ("values");



CREATE INDEX "idx_point_transactions_created" ON "public"."point_transactions" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_point_transactions_user_id" ON "public"."point_transactions" USING "btree" ("user_id");



CREATE INDEX "idx_reflections_cause_tags" ON "public"."reflections" USING "gin" ("cause_tags");



CREATE INDEX "idx_reflections_user_date" ON "public"."reflections" USING "btree" ("user_id", "reflection_date" DESC);



CREATE INDEX "idx_report_configs_active" ON "public"."report_configs" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_report_configs_org" ON "public"."report_configs" USING "btree" ("organization_id") WHERE ("organization_id" IS NOT NULL);



CREATE INDEX "idx_report_configs_team" ON "public"."report_configs" USING "btree" ("team_id") WHERE ("team_id" IS NOT NULL);



CREATE INDEX "idx_report_history_org" ON "public"."report_history" USING "btree" ("organization_id", "created_at" DESC);



CREATE INDEX "idx_report_history_user" ON "public"."report_history" USING "btree" ("generated_by", "created_at" DESC);



CREATE INDEX "idx_report_schedules_config" ON "public"."report_schedules" USING "btree" ("config_id");



CREATE INDEX "idx_report_schedules_next_run" ON "public"."report_schedules" USING "btree" ("next_run_at") WHERE ("is_active" = true);



CREATE INDEX "idx_report_subscriptions_config" ON "public"."report_subscriptions" USING "btree" ("config_id");



CREATE INDEX "idx_report_subscriptions_user" ON "public"."report_subscriptions" USING "btree" ("user_id");



CREATE INDEX "idx_report_templates_org" ON "public"."report_templates" USING "btree" ("organization_id");



CREATE INDEX "idx_report_templates_type" ON "public"."report_templates" USING "btree" ("report_type");



CREATE INDEX "idx_scheduled_reports_next_run" ON "public"."scheduled_reports" USING "btree" ("next_run") WHERE ("is_active" = true);



CREATE INDEX "idx_scheduled_reports_org" ON "public"."scheduled_reports" USING "btree" ("organization_id");



CREATE INDEX "idx_sleep_records_date" ON "public"."sleep_records" USING "btree" ("date");



CREATE INDEX "idx_sleep_records_user_date" ON "public"."sleep_records" USING "btree" ("user_id", "date");



CREATE INDEX "idx_sleep_records_user_id" ON "public"."sleep_records" USING "btree" ("user_id");



CREATE INDEX "idx_staff_team_links_staff" ON "public"."staff_team_links" USING "btree" ("staff_user_id");



CREATE INDEX "idx_staff_team_links_team" ON "public"."staff_team_links" USING "btree" ("team_id");



CREATE INDEX "idx_team_access_requests_organization" ON "public"."team_access_requests" USING "btree" ("organization_id");



CREATE INDEX "idx_team_access_requests_requester" ON "public"."team_access_requests" USING "btree" ("requester_id");



CREATE INDEX "idx_team_access_requests_status" ON "public"."team_access_requests" USING "btree" ("status") WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_team_access_requests_team" ON "public"."team_access_requests" USING "btree" ("team_id");



CREATE INDEX "idx_team_achievement_notifications_unread" ON "public"."team_achievement_notifications" USING "btree" ("user_id", "is_read");



CREATE INDEX "idx_team_achievement_notifications_user_id" ON "public"."team_achievement_notifications" USING "btree" ("user_id");



CREATE INDEX "idx_team_achievements_achieved_at" ON "public"."team_achievements" USING "btree" ("achieved_at" DESC);



CREATE INDEX "idx_team_achievements_team_id" ON "public"."team_achievements" USING "btree" ("team_id");



CREATE INDEX "idx_team_assignment_history_changed_at" ON "public"."team_assignment_history" USING "btree" ("changed_at" DESC);



CREATE INDEX "idx_team_assignment_history_organization_id" ON "public"."team_assignment_history" USING "btree" ("organization_id");



CREATE INDEX "idx_team_assignment_history_user_id" ON "public"."team_assignment_history" USING "btree" ("user_id");



CREATE INDEX "idx_team_member_assignments_organization_id" ON "public"."team_member_assignments" USING "btree" ("organization_id");



CREATE INDEX "idx_team_member_assignments_team_id" ON "public"."team_member_assignments" USING "btree" ("team_id");



CREATE INDEX "idx_team_member_assignments_type" ON "public"."team_member_assignments" USING "btree" ("assignment_type");



CREATE INDEX "idx_team_member_assignments_user_id" ON "public"."team_member_assignments" USING "btree" ("user_id");



CREATE INDEX "idx_team_transfer_history_athlete" ON "public"."team_transfer_history" USING "btree" ("athlete_id");



CREATE INDEX "idx_team_transfer_history_date" ON "public"."team_transfer_history" USING "btree" ("transfer_date" DESC);



CREATE INDEX "idx_team_transfer_history_from_team" ON "public"."team_transfer_history" USING "btree" ("from_team_id");



CREATE INDEX "idx_team_transfer_history_to_team" ON "public"."team_transfer_history" USING "btree" ("to_team_id");



CREATE INDEX "idx_teams_department_id" ON "public"."teams" USING "btree" ("department_id");



CREATE INDEX "idx_teams_organization_id" ON "public"."teams" USING "btree" ("organization_id");



CREATE INDEX "idx_training_records_user_date" ON "public"."training_records" USING "btree" ("user_id", "date");



CREATE INDEX "idx_training_records_user_date_desc" ON "public"."training_records" USING "btree" ("user_id", "date" DESC);



CREATE INDEX "idx_tutorial_progress_completed" ON "public"."tutorial_progress" USING "btree" ("is_completed");



CREATE INDEX "idx_tutorial_progress_role" ON "public"."tutorial_progress" USING "btree" ("role");



CREATE INDEX "idx_tutorial_progress_user_id" ON "public"."tutorial_progress" USING "btree" ("user_id");



CREATE INDEX "idx_user_badges_earned" ON "public"."user_badges" USING "btree" ("earned_at" DESC);



CREATE INDEX "idx_user_badges_user_id" ON "public"."user_badges" USING "btree" ("user_id");



CREATE INDEX "idx_user_goals_status" ON "public"."user_goals" USING "btree" ("status");



CREATE INDEX "idx_user_goals_user_id" ON "public"."user_goals" USING "btree" ("user_id");



CREATE INDEX "idx_user_points_level" ON "public"."user_points" USING "btree" ("current_level" DESC);



CREATE INDEX "idx_user_points_tier_level" ON "public"."user_points" USING "btree" ("rank_tier", "rank_level");



CREATE INDEX "idx_user_points_user_id" ON "public"."user_points" USING "btree" ("user_id");



CREATE INDEX "idx_user_streaks_type" ON "public"."user_streaks" USING "btree" ("user_id", "streak_type");



CREATE INDEX "idx_user_streaks_user_id" ON "public"."user_streaks" USING "btree" ("user_id");



CREATE INDEX "idx_users_team_id" ON "public"."users" USING "btree" ("team_id");



CREATE INDEX "idx_utm_team" ON "public"."user_team_memberships" USING "btree" ("team_id");



CREATE INDEX "idx_utm_user" ON "public"."user_team_memberships" USING "btree" ("user_id");



CREATE INDEX "idx_weight_records_user_date" ON "public"."weight_records" USING "btree" ("user_id", "date" DESC);



CREATE UNIQUE INDEX "inbody_phone_ts_unique" ON "public"."inbody_records" USING "btree" ("phone_number_norm", "measured_at_ts") WHERE (("phone_number_norm" IS NOT NULL) AND ("measured_at_ts" IS NOT NULL));



CREATE INDEX "inbody_records_phone_idx" ON "public"."inbody_records" USING "btree" ("phone_number");



CREATE INDEX "inbody_user_measured_ts_idx" ON "public"."inbody_records" USING "btree" ("user_id", "measured_at_ts" DESC);



CREATE INDEX "nutrition_daily_reports_user_date_idx" ON "public"."nutrition_daily_reports" USING "btree" ("user_id", "report_date");



CREATE INDEX "nutrition_logs_recorded_at_idx" ON "public"."nutrition_logs" USING "btree" ("recorded_at");



CREATE INDEX "nutrition_logs_user_date_idx" ON "public"."nutrition_logs" USING "btree" ("user_id", "record_date");



CREATE UNIQUE INDEX "nutrition_logs_user_date_meal_slot_unique" ON "public"."nutrition_logs" USING "btree" ("user_id", "record_date", "meal_type", "meal_slot");



CREATE UNIQUE INDEX "nutrition_metabolism_user_date_uniq" ON "public"."nutrition_metabolism_snapshots" USING "btree" ("user_id", "record_date");



CREATE INDEX "nutrition_metabolism_user_day_idx" ON "public"."nutrition_metabolism_snapshots" USING "btree" ("user_id", "record_date");



CREATE INDEX "nutrition_plans_user_active_idx" ON "public"."nutrition_plans" USING "btree" ("user_id", "is_active");



CREATE INDEX "nutrition_plans_user_id_idx" ON "public"."nutrition_plans" USING "btree" ("user_id");



CREATE INDEX "shared_reports_user_id_created_at_idx" ON "public"."shared_reports" USING "btree" ("user_id", "created_at" DESC);



CREATE UNIQUE INDEX "user_badges_user_badge_unique" ON "public"."user_badges" USING "btree" ("user_id", "badge_id");



CREATE INDEX "users_phone_norm_idx" ON "public"."users" USING "btree" ("public"."normalize_phone"("phone_number"));



CREATE UNIQUE INDEX "users_phone_norm_unique" ON "public"."users" USING "btree" ("public"."normalize_phone"("phone_number")) WHERE ("phone_number" IS NOT NULL);



CREATE INDEX "users_phone_number_idx" ON "public"."users" USING "btree" ("phone_number");



CREATE UNIQUE INDEX "users_phone_number_unique" ON "public"."users" USING "btree" ("phone_number") WHERE ("phone_number" IS NOT NULL);



CREATE INDEX "weight_records_date_idx" ON "public"."weight_records" USING "btree" ("date");



CREATE UNIQUE INDEX "weight_records_user_date_unique" ON "public"."weight_records" USING "btree" ("user_id", "date");



CREATE INDEX "weight_records_user_id_idx" ON "public"."weight_records" USING "btree" ("user_id");



CREATE OR REPLACE VIEW "public"."staff_team_athletes_with_activity" AS
 SELECT "u"."id",
    "u"."name",
    "u"."email",
    "u"."role",
    "u"."team_id",
    "u"."created_at",
    "u"."user_id",
    "u"."email_notifications",
    "u"."last_alert_email_sent",
    "u"."gender",
    "u"."height_cm",
    "u"."date_of_birth",
    "u"."terms_accepted_at",
    "u"."terms_accepted",
    "count"(DISTINCT "fr"."date") FILTER (WHERE ("fr"."date" >= (CURRENT_DATE - '27 days'::interval))) AS "training_days_28d",
    "count"("fr"."id") FILTER (WHERE ("fr"."date" >= (CURRENT_DATE - '27 days'::interval))) AS "training_sessions_28d",
    "max"("fr"."date") AS "last_training_date"
   FROM ("public"."users" "u"
     LEFT JOIN "public"."training_records" "fr" ON (("fr"."user_id" = "u"."id")))
  WHERE ("u"."role" = 'athlete'::"text")
  GROUP BY "u"."id";



CREATE OR REPLACE TRIGGER "inbody_autolink_user" BEFORE INSERT OR UPDATE OF "phone_number", "phone_number_norm", "user_id" ON "public"."inbody_records" FOR EACH ROW EXECUTE FUNCTION "public"."trg_inbody_autolink_user"();



CREATE OR REPLACE TRIGGER "increment_generated_reports_view_count" BEFORE UPDATE ON "public"."generated_reports" FOR EACH ROW EXECUTE FUNCTION "public"."increment_report_view_count"();



CREATE OR REPLACE TRIGGER "link_inbody_on_phone_change" AFTER INSERT OR UPDATE OF "phone_number" ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."trg_link_inbody_on_phone_change"();



CREATE OR REPLACE TRIGGER "performance_records_updated_at" BEFORE UPDATE ON "public"."performance_records" FOR EACH ROW EXECUTE FUNCTION "public"."update_performance_records_updated_at"();



CREATE OR REPLACE TRIGGER "refresh_metabolism_on_inbody_change" AFTER INSERT OR UPDATE OF "user_id", "measured_at", "measured_at_ts", "weight", "body_fat_percent" ON "public"."inbody_records" FOR EACH ROW EXECUTE FUNCTION "public"."trg_refresh_metabolism_on_inbody_change"();



CREATE OR REPLACE TRIGGER "trg_ai_summaries_updated_at" BEFORE UPDATE ON "public"."ai_summaries" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_award_first_step_badge" AFTER INSERT ON "public"."events" FOR EACH ROW EXECUTE FUNCTION "public"."award_first_step_badge"();



CREATE OR REPLACE TRIGGER "trg_award_first_training_badge" AFTER INSERT ON "public"."events" FOR EACH ROW EXECUTE FUNCTION "public"."award_first_training_badge"();



CREATE OR REPLACE TRIGGER "trg_backfill_inbody_user_id_from_phone" AFTER INSERT OR UPDATE OF "phone_number" ON "public"."users" FOR EACH ROW WHEN (("new"."phone_number" IS NOT NULL)) EXECUTE FUNCTION "public"."backfill_inbody_user_id_from_phone"();



CREATE OR REPLACE TRIGGER "trg_block_team_change" BEFORE UPDATE OF "team_id" ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."block_team_change_unless_org_or_global"();



CREATE OR REPLACE TRIGGER "trg_daily_energy_snapshots_updated_at" BEFORE UPDATE ON "public"."daily_energy_snapshots" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_daily_reflections_updated_at" BEFORE UPDATE ON "public"."daily_reflections" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_dss_set_updated_at" BEFORE UPDATE ON "public"."data_sharing_settings" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_engine_events_state" AFTER INSERT ON "public"."engine_events" FOR EACH ROW EXECUTE FUNCTION "public"."update_engine_state_on_event"();



CREATE OR REPLACE TRIGGER "trg_inbody_records_set_updated_at" BEFORE UPDATE ON "public"."inbody_records" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_link_inbody_by_phone" AFTER UPDATE OF "phone_number" ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."link_inbody_by_phone"();



CREATE OR REPLACE TRIGGER "trg_link_inbody_by_user_phone" AFTER INSERT OR UPDATE OF "phone_number" ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."link_inbody_by_user_phone"();



CREATE OR REPLACE TRIGGER "trg_nutrition_daily_reports_updated_at" BEFORE UPDATE ON "public"."nutrition_daily_reports" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_nutrition_logs_updated_at" BEFORE UPDATE ON "public"."nutrition_logs" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_nutrition_plans_updated_at" BEFORE UPDATE ON "public"."nutrition_plans" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_push_subscriptions_updated_at" BEFORE UPDATE ON "public"."push_subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_reflections_set_updated_at" BEFORE UPDATE ON "public"."reflections" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_staff_team_links_set_org_id" BEFORE INSERT OR UPDATE OF "team_id" ON "public"."staff_team_links" FOR EACH ROW EXECUTE FUNCTION "public"."staff_team_links_set_org_id"();



CREATE OR REPLACE TRIGGER "trg_sync_acwr_columns" BEFORE INSERT OR UPDATE ON "public"."athlete_acwr_daily" FOR EACH ROW EXECUTE FUNCTION "public"."sync_acwr_columns"();



CREATE OR REPLACE TRIGGER "trg_update_goal_progress" AFTER INSERT OR UPDATE ON "public"."performance_records" FOR EACH ROW EXECUTE FUNCTION "public"."update_goal_progress_from_performance"();



CREATE OR REPLACE TRIGGER "trg_user_phone_links_updated_at" BEFORE UPDATE ON "public"."user_phone_links" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_messages_updated_at" BEFORE UPDATE ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."update_messages_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_motivation_record_gamification" AFTER INSERT ON "public"."motivation_records" FOR EACH ROW EXECUTE FUNCTION "public"."process_motivation_record_gamification"();



CREATE OR REPLACE TRIGGER "trigger_performance_record_gamification" AFTER INSERT ON "public"."performance_records" FOR EACH ROW EXECUTE FUNCTION "public"."process_performance_record_gamification"();



CREATE OR REPLACE TRIGGER "trigger_sleep_record_gamification" AFTER INSERT ON "public"."sleep_records" FOR EACH ROW EXECUTE FUNCTION "public"."process_sleep_record_gamification"();



CREATE OR REPLACE TRIGGER "trigger_training_record_gamification" AFTER INSERT ON "public"."training_records" FOR EACH ROW EXECUTE FUNCTION "public"."process_training_record_gamification"();

ALTER TABLE "public"."training_records" DISABLE TRIGGER "trigger_training_record_gamification";



CREATE OR REPLACE TRIGGER "trigger_update_athlete_transfer_requests_updated_at" BEFORE UPDATE ON "public"."athlete_transfer_requests" FOR EACH ROW EXECUTE FUNCTION "public"."update_athlete_transfer_requests_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_team_access_requests_updated_at" BEFORE UPDATE ON "public"."team_access_requests" FOR EACH ROW EXECUTE FUNCTION "public"."update_team_access_requests_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_team_member_assignment_timestamp" BEFORE UPDATE ON "public"."team_member_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."update_team_member_assignment_timestamp"();



CREATE OR REPLACE TRIGGER "trigger_update_thread_last_message" AFTER INSERT ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."update_thread_last_message"();



CREATE OR REPLACE TRIGGER "trigger_update_tutorial_progress_timestamp" BEFORE UPDATE ON "public"."tutorial_progress" FOR EACH ROW EXECUTE FUNCTION "public"."update_tutorial_progress_timestamp"();



CREATE OR REPLACE TRIGGER "trigger_users_link_inbody_by_phone" AFTER INSERT OR UPDATE OF "phone_number" ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."trg_users_link_inbody_by_phone"();



CREATE OR REPLACE TRIGGER "trigger_weight_record_gamification" AFTER INSERT ON "public"."weight_records" FOR EACH ROW EXECUTE FUNCTION "public"."process_weight_record_gamification"();



CREATE OR REPLACE TRIGGER "update_bbt_timestamp" BEFORE UPDATE ON "public"."basal_body_temperature" FOR EACH ROW EXECUTE FUNCTION "public"."update_bbt_updated_at"();



CREATE OR REPLACE TRIGGER "update_injury_records_timestamp" BEFORE UPDATE ON "public"."injury_records" FOR EACH ROW EXECUTE FUNCTION "public"."update_injury_records_updated_at"();



CREATE OR REPLACE TRIGGER "update_menstrual_cycles_timestamp" BEFORE UPDATE ON "public"."menstrual_cycles" FOR EACH ROW EXECUTE FUNCTION "public"."update_menstrual_cycles_updated_at"();



CREATE OR REPLACE TRIGGER "update_motivation_records_updated_at" BEFORE UPDATE ON "public"."motivation_records" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_report_configs_updated_at" BEFORE UPDATE ON "public"."report_configs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_report_schedules_updated_at" BEFORE UPDATE ON "public"."report_schedules" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_report_subscriptions_updated_at" BEFORE UPDATE ON "public"."report_subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_report_templates_timestamp" BEFORE UPDATE ON "public"."report_templates" FOR EACH ROW EXECUTE FUNCTION "public"."update_report_templates_updated_at"();



CREATE OR REPLACE TRIGGER "update_scheduled_reports_timestamp" BEFORE UPDATE ON "public"."scheduled_reports" FOR EACH ROW EXECUTE FUNCTION "public"."update_scheduled_reports_updated_at"();



CREATE OR REPLACE TRIGGER "update_sleep_records_updated_at" BEFORE UPDATE ON "public"."sleep_records" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "users_phone_link_inbody" AFTER INSERT OR UPDATE OF "phone_number" ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."trg_users_phone_link_inbody"();



ALTER TABLE ONLY "public"."achievement_milestones"
    ADD CONSTRAINT "achievement_milestones_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_summaries"
    ADD CONSTRAINT "ai_summaries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."athlete_activity_level_daily"
    ADD CONSTRAINT "athlete_activity_level_daily_user_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."athlete_transfer_requests"
    ADD CONSTRAINT "athlete_transfer_requests_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."athlete_transfer_requests"
    ADD CONSTRAINT "athlete_transfer_requests_from_team_id_fkey" FOREIGN KEY ("from_team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."athlete_transfer_requests"
    ADD CONSTRAINT "athlete_transfer_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."athlete_transfer_requests"
    ADD CONSTRAINT "athlete_transfer_requests_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."athlete_transfer_requests"
    ADD CONSTRAINT "athlete_transfer_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."athlete_transfer_requests"
    ADD CONSTRAINT "athlete_transfer_requests_to_team_id_fkey" FOREIGN KEY ("to_team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."basal_body_temperature"
    ADD CONSTRAINT "basal_body_temperature_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."basal_body_temperature"
    ADD CONSTRAINT "basal_body_temperature_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coach_comments"
    ADD CONSTRAINT "coach_comments_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coach_comments"
    ADD CONSTRAINT "coach_comments_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."daily_energy_snapshots"
    ADD CONSTRAINT "daily_energy_snapshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."daily_reflections"
    ADD CONSTRAINT "daily_reflections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."data_sharing_settings"
    ADD CONSTRAINT "data_sharing_settings_athlete_user_id_fkey" FOREIGN KEY ("athlete_user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."data_sharing_settings"
    ADD CONSTRAINT "data_sharing_settings_staff_user_id_fkey" FOREIGN KEY ("staff_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."data_sharing_settings"
    ADD CONSTRAINT "data_sharing_settings_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."department_managers"
    ADD CONSTRAINT "department_managers_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."department_managers"
    ADD CONSTRAINT "department_managers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."departments"
    ADD CONSTRAINT "departments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."email_logs"
    ADD CONSTRAINT "email_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ftt_events"
    ADD CONSTRAINT "ftt_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ftt_records"
    ADD CONSTRAINT "ftt_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."generated_reports"
    ADD CONSTRAINT "generated_reports_config_id_fkey" FOREIGN KEY ("config_id") REFERENCES "public"."report_configs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."generated_reports"
    ADD CONSTRAINT "generated_reports_generated_by_fkey" FOREIGN KEY ("generated_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."generated_reports"
    ADD CONSTRAINT "generated_reports_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."generated_reports"
    ADD CONSTRAINT "generated_reports_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "public"."report_schedules"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."generated_reports"
    ADD CONSTRAINT "generated_reports_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inbody_records"
    ADD CONSTRAINT "inbody_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."injury_records"
    ADD CONSTRAINT "injury_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."injury_records"
    ADD CONSTRAINT "injury_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."injury_risk_assessments"
    ADD CONSTRAINT "injury_risk_assessments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invitation_tokens"
    ADD CONSTRAINT "invitation_tokens_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."invitation_tokens"
    ADD CONSTRAINT "invitation_tokens_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."invitation_tokens"
    ADD CONSTRAINT "invitation_tokens_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."menstrual_cycles"
    ADD CONSTRAINT "menstrual_cycles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."menstrual_cycles"
    ADD CONSTRAINT "menstrual_cycles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."message_threads"
    ADD CONSTRAINT "message_threads_participant1_id_fkey" FOREIGN KEY ("participant1_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."message_threads"
    ADD CONSTRAINT "message_threads_participant2_id_fkey" FOREIGN KEY ("participant2_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."message_threads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."motivation_records"
    ADD CONSTRAINT "motivation_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."nutrition_daily_reports"
    ADD CONSTRAINT "nutrition_daily_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."nutrition_daily"
    ADD CONSTRAINT "nutrition_daily_user_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."nutrition_logs"
    ADD CONSTRAINT "nutrition_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."nutrition_metabolism_snapshots"
    ADD CONSTRAINT "nutrition_metabolism_snapshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."nutrition_plans"
    ADD CONSTRAINT "nutrition_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."nutrition_targets_daily"
    ADD CONSTRAINT "nutrition_targets_user_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."performance_records"
    ADD CONSTRAINT "performance_records_test_type_id_fkey" FOREIGN KEY ("test_type_id") REFERENCES "public"."performance_test_types"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."performance_records"
    ADD CONSTRAINT "performance_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."performance_test_types"
    ADD CONSTRAINT "performance_test_types_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."performance_categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."point_transactions"
    ADD CONSTRAINT "point_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reflections"
    ADD CONSTRAINT "reflections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."report_configs"
    ADD CONSTRAINT "report_configs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."report_configs"
    ADD CONSTRAINT "report_configs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."report_configs"
    ADD CONSTRAINT "report_configs_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."report_history"
    ADD CONSTRAINT "report_history_generated_by_fkey" FOREIGN KEY ("generated_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."report_history"
    ADD CONSTRAINT "report_history_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."report_history"
    ADD CONSTRAINT "report_history_scheduled_report_id_fkey" FOREIGN KEY ("scheduled_report_id") REFERENCES "public"."scheduled_reports"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."report_history"
    ADD CONSTRAINT "report_history_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."report_templates"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."report_schedules"
    ADD CONSTRAINT "report_schedules_config_id_fkey" FOREIGN KEY ("config_id") REFERENCES "public"."report_configs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."report_subscriptions"
    ADD CONSTRAINT "report_subscriptions_config_id_fkey" FOREIGN KEY ("config_id") REFERENCES "public"."report_configs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."report_subscriptions"
    ADD CONSTRAINT "report_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."report_templates"
    ADD CONSTRAINT "report_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."report_templates"
    ADD CONSTRAINT "report_templates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."scheduled_reports"
    ADD CONSTRAINT "scheduled_reports_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."scheduled_reports"
    ADD CONSTRAINT "scheduled_reports_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."scheduled_reports"
    ADD CONSTRAINT "scheduled_reports_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."report_templates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shared_reports"
    ADD CONSTRAINT "shared_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sleep_records"
    ADD CONSTRAINT "sleep_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff_team_links"
    ADD CONSTRAINT "staff_team_links_staff_user_id_fkey" FOREIGN KEY ("staff_user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff_team_links"
    ADD CONSTRAINT "staff_team_links_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_access_requests"
    ADD CONSTRAINT "team_access_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_access_requests"
    ADD CONSTRAINT "team_access_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_access_requests"
    ADD CONSTRAINT "team_access_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."team_access_requests"
    ADD CONSTRAINT "team_access_requests_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_achievement_notifications"
    ADD CONSTRAINT "team_achievement_notifications_achievement_id_fkey" FOREIGN KEY ("achievement_id") REFERENCES "public"."team_achievements"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_achievement_notifications"
    ADD CONSTRAINT "team_achievement_notifications_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_achievement_notifications"
    ADD CONSTRAINT "team_achievement_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_achievements"
    ADD CONSTRAINT "team_achievements_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_assignment_history"
    ADD CONSTRAINT "team_assignment_history_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."team_assignment_history"
    ADD CONSTRAINT "team_assignment_history_from_team_id_fkey" FOREIGN KEY ("from_team_id") REFERENCES "public"."teams"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."team_assignment_history"
    ADD CONSTRAINT "team_assignment_history_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_assignment_history"
    ADD CONSTRAINT "team_assignment_history_to_team_id_fkey" FOREIGN KEY ("to_team_id") REFERENCES "public"."teams"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."team_assignment_history"
    ADD CONSTRAINT "team_assignment_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_member_assignments"
    ADD CONSTRAINT "team_member_assignments_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."team_member_assignments"
    ADD CONSTRAINT "team_member_assignments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_member_assignments"
    ADD CONSTRAINT "team_member_assignments_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_member_assignments"
    ADD CONSTRAINT "team_member_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_transfer_history"
    ADD CONSTRAINT "team_transfer_history_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_transfer_history"
    ADD CONSTRAINT "team_transfer_history_from_team_id_fkey" FOREIGN KEY ("from_team_id") REFERENCES "public"."teams"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."team_transfer_history"
    ADD CONSTRAINT "team_transfer_history_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_transfer_history"
    ADD CONSTRAINT "team_transfer_history_to_team_id_fkey" FOREIGN KEY ("to_team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_transfer_history"
    ADD CONSTRAINT "team_transfer_history_transfer_request_id_fkey" FOREIGN KEY ("transfer_request_id") REFERENCES "public"."athlete_transfer_requests"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."team_transfer_history"
    ADD CONSTRAINT "team_transfer_history_transferred_by_fkey" FOREIGN KEY ("transferred_by") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."training_records"
    ADD CONSTRAINT "training_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tutorial_progress"
    ADD CONSTRAINT "tutorial_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_badges"
    ADD CONSTRAINT "user_badges_badge_id_fkey" FOREIGN KEY ("badge_id") REFERENCES "public"."badges"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_badges"
    ADD CONSTRAINT "user_badges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_goals"
    ADD CONSTRAINT "user_goals_test_type_id_fkey" FOREIGN KEY ("test_type_id") REFERENCES "public"."performance_test_types"("id");



ALTER TABLE ONLY "public"."user_goals"
    ADD CONSTRAINT "user_goals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_phone_links"
    ADD CONSTRAINT "user_phone_links_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_points"
    ADD CONSTRAINT "user_points_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_streaks"
    ADD CONSTRAINT "user_streaks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_team_memberships"
    ADD CONSTRAINT "user_team_memberships_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_team_memberships"
    ADD CONSTRAINT "user_team_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id");



ALTER TABLE ONLY "public"."weight_records"
    ADD CONSTRAINT "weight_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Admin and staff can view invitation tokens" ON "public"."invitation_tokens" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND ("u"."role" = ANY (ARRAY['global_admin'::"text", 'staff'::"text"]))))));



CREATE POLICY "Admins can delete all performance records" ON "public"."performance_records" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can insert all performance records" ON "public"."performance_records" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can update all performance records" ON "public"."performance_records" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can view all performance records" ON "public"."performance_records" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can view all team achievements" ON "public"."team_achievements" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"text")))));



CREATE POLICY "Anyone can view active performance categories" ON "public"."performance_categories" FOR SELECT TO "authenticated" USING (("is_active" = true));



CREATE POLICY "Anyone can view active performance test types" ON "public"."performance_test_types" FOR SELECT TO "authenticated" USING (("is_active" = true));



CREATE POLICY "Athletes can delete own basal body temperature" ON "public"."basal_body_temperature" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Athletes can delete own injury records" ON "public"."injury_records" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Athletes can delete own menstrual cycles" ON "public"."menstrual_cycles" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Athletes can delete own performance records" ON "public"."performance_records" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Athletes can insert own basal body temperature" ON "public"."basal_body_temperature" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Athletes can insert own injury records" ON "public"."injury_records" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Athletes can insert own menstrual cycles" ON "public"."menstrual_cycles" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Athletes can insert own performance records" ON "public"."performance_records" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Athletes can update own basal body temperature" ON "public"."basal_body_temperature" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Athletes can update own injury records" ON "public"."injury_records" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Athletes can update own menstrual cycles" ON "public"."menstrual_cycles" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Athletes can update own performance records" ON "public"."performance_records" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Athletes can update read status" ON "public"."coach_comments" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "athlete_id")) WITH CHECK (("auth"."uid"() = "athlete_id"));



CREATE POLICY "Athletes can view own basal body temperature" ON "public"."basal_body_temperature" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Athletes can view own comments" ON "public"."coach_comments" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "athlete_id"));



CREATE POLICY "Athletes can view own injury records" ON "public"."injury_records" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Athletes can view own menstrual cycles" ON "public"."menstrual_cycles" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Athletes can view own performance records" ON "public"."performance_records" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Athletes can view own risk assessments" ON "public"."injury_risk_assessments" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Athletes can view their own transfer history" ON "public"."team_transfer_history" FOR SELECT TO "authenticated" USING (("athlete_id" = "auth"."uid"()));



CREATE POLICY "Athletes can view their own transfer requests" ON "public"."athlete_transfer_requests" FOR SELECT TO "authenticated" USING (("athlete_id" = "auth"."uid"()));



CREATE POLICY "Coaches and admins can create report templates" ON "public"."report_templates" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."user_id" = "auth"."uid"()) AND ("organization_members"."organization_id" = "report_templates"."organization_id") AND ("organization_members"."role" = ANY (ARRAY['coach'::"text", 'admin'::"text"]))))));



CREATE POLICY "Coaches and admins can create scheduled reports" ON "public"."scheduled_reports" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."user_id" = "auth"."uid"()) AND ("organization_members"."organization_id" = "scheduled_reports"."organization_id") AND ("organization_members"."role" = ANY (ARRAY['coach'::"text", 'admin'::"text"]))))));



CREATE POLICY "Coaches and admins can delete report templates" ON "public"."report_templates" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."user_id" = "auth"."uid"()) AND ("organization_members"."organization_id" = "report_templates"."organization_id") AND ("organization_members"."role" = ANY (ARRAY['coach'::"text", 'admin'::"text"]))))));



CREATE POLICY "Coaches and admins can delete scheduled reports" ON "public"."scheduled_reports" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."user_id" = "auth"."uid"()) AND ("organization_members"."organization_id" = "scheduled_reports"."organization_id") AND ("organization_members"."role" = ANY (ARRAY['coach'::"text", 'admin'::"text"]))))));



CREATE POLICY "Coaches and admins can update report templates" ON "public"."report_templates" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."user_id" = "auth"."uid"()) AND ("organization_members"."organization_id" = "report_templates"."organization_id") AND ("organization_members"."role" = ANY (ARRAY['coach'::"text", 'admin'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."user_id" = "auth"."uid"()) AND ("organization_members"."organization_id" = "report_templates"."organization_id") AND ("organization_members"."role" = ANY (ARRAY['coach'::"text", 'admin'::"text"]))))));



CREATE POLICY "Coaches and admins can update scheduled reports" ON "public"."scheduled_reports" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."user_id" = "auth"."uid"()) AND ("organization_members"."organization_id" = "scheduled_reports"."organization_id") AND ("organization_members"."role" = ANY (ARRAY['coach'::"text", 'admin'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."user_id" = "auth"."uid"()) AND ("organization_members"."organization_id" = "scheduled_reports"."organization_id") AND ("organization_members"."role" = ANY (ARRAY['coach'::"text", 'admin'::"text"]))))));



CREATE POLICY "Coaches can create requests in their organization" ON "public"."team_access_requests" FOR INSERT TO "authenticated" WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['staff'::"text", 'admin'::"text"]))))) AND (EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."user_id" = "auth"."uid"()) AND ("om"."organization_id" = "team_access_requests"."organization_id")))) AND (EXISTS ( SELECT 1
   FROM "public"."teams"
  WHERE (("teams"."id" = "team_access_requests"."team_id") AND ("teams"."organization_id" = "team_access_requests"."organization_id")))) AND (NOT (EXISTS ( SELECT 1
   FROM "public"."staff_team_links"
  WHERE (("staff_team_links"."staff_user_id" = "auth"."uid"()) AND ("staff_team_links"."team_id" = "team_access_requests"."team_id")))))));



CREATE POLICY "Coaches can create transfer requests for their athletes" ON "public"."athlete_transfer_requests" FOR INSERT TO "authenticated" WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['staff'::"text", 'admin'::"text"]))))) AND (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "athlete_transfer_requests"."athlete_id") AND ("users"."team_id" = "athlete_transfer_requests"."from_team_id")))) AND (("from_team_id" IN ( SELECT "staff_team_links"."team_id"
   FROM "public"."staff_team_links"
  WHERE ("staff_team_links"."staff_user_id" = "auth"."uid"()))) OR ("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE (("organization_members"."user_id" = "auth"."uid"()) AND ("organization_members"."role" = 'organization_admin'::"text"))))) AND (EXISTS ( SELECT 1
   FROM ("public"."teams" "t1"
     JOIN "public"."teams" "t2" ON (("t1"."organization_id" = "t2"."organization_id")))
  WHERE (("t1"."id" = "athlete_transfer_requests"."from_team_id") AND ("t2"."id" = "athlete_transfer_requests"."to_team_id") AND ("t1"."organization_id" = "athlete_transfer_requests"."organization_id")))) AND (NOT (EXISTS ( SELECT 1
   FROM "public"."athlete_transfer_requests" "atr"
  WHERE (("atr"."athlete_id" = "athlete_transfer_requests"."athlete_id") AND ("atr"."status" = 'pending'::"text")))))));



CREATE POLICY "Coaches can insert team injury records" ON "public"."injury_records" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM (("public"."team_member_assignments" "tma"
     JOIN "public"."teams" "t" ON (("t"."id" = "tma"."team_id")))
     JOIN "public"."organization_members" "om" ON ((("om"."user_id" = "auth"."uid"()) AND ("om"."organization_id" = "t"."organization_id"))))
  WHERE (("tma"."user_id" = "injury_records"."user_id") AND ("om"."role" = ANY (ARRAY['coach'::"text", 'admin'::"text"]))))));



CREATE POLICY "Coaches can manage comments for their athletes" ON "public"."coach_comments" TO "authenticated" USING ((("auth"."uid"() = "coach_id") AND (EXISTS ( SELECT 1
   FROM ("public"."users" "u"
     JOIN "public"."staff_team_links" "stl" ON (("stl"."team_id" = "u"."team_id")))
  WHERE (("u"."id" = "coach_comments"."athlete_id") AND ("stl"."staff_user_id" = "auth"."uid"())))))) WITH CHECK ((("auth"."uid"() = "coach_id") AND (EXISTS ( SELECT 1
   FROM ("public"."users" "u"
     JOIN "public"."staff_team_links" "stl" ON (("stl"."team_id" = "u"."team_id")))
  WHERE (("u"."id" = "coach_comments"."athlete_id") AND ("stl"."staff_user_id" = "auth"."uid"()))))));



CREATE POLICY "Coaches can update team injury records" ON "public"."injury_records" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (("public"."team_member_assignments" "tma"
     JOIN "public"."teams" "t" ON (("t"."id" = "tma"."team_id")))
     JOIN "public"."organization_members" "om" ON ((("om"."user_id" = "auth"."uid"()) AND ("om"."organization_id" = "t"."organization_id"))))
  WHERE (("tma"."user_id" = "injury_records"."user_id") AND ("om"."role" = ANY (ARRAY['coach'::"text", 'admin'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (("public"."team_member_assignments" "tma"
     JOIN "public"."teams" "t" ON (("t"."id" = "tma"."team_id")))
     JOIN "public"."organization_members" "om" ON ((("om"."user_id" = "auth"."uid"()) AND ("om"."organization_id" = "t"."organization_id"))))
  WHERE (("tma"."user_id" = "injury_records"."user_id") AND ("om"."role" = ANY (ARRAY['coach'::"text", 'admin'::"text"]))))));



CREATE POLICY "Coaches can view athlete goals" ON "public"."user_goals" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."users" "u"
     JOIN "public"."staff_team_links" "stl" ON (("stl"."team_id" = "u"."team_id")))
  WHERE (("u"."id" = "user_goals"."user_id") AND ("stl"."staff_user_id" = "auth"."uid"())))));



CREATE POLICY "Coaches can view team basal body temperature" ON "public"."basal_body_temperature" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (("public"."team_member_assignments" "tma"
     JOIN "public"."teams" "t" ON (("t"."id" = "tma"."team_id")))
     JOIN "public"."organization_members" "om" ON ((("om"."user_id" = "auth"."uid"()) AND ("om"."organization_id" = "t"."organization_id"))))
  WHERE (("tma"."user_id" = "basal_body_temperature"."user_id") AND ("om"."role" = ANY (ARRAY['coach'::"text", 'admin'::"text"]))))));



CREATE POLICY "Coaches can view team injury records" ON "public"."injury_records" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (("public"."team_member_assignments" "tma"
     JOIN "public"."teams" "t" ON (("t"."id" = "tma"."team_id")))
     JOIN "public"."organization_members" "om" ON ((("om"."user_id" = "auth"."uid"()) AND ("om"."organization_id" = "t"."organization_id"))))
  WHERE (("tma"."user_id" = "injury_records"."user_id") AND ("om"."role" = ANY (ARRAY['coach'::"text", 'admin'::"text"]))))));



CREATE POLICY "Coaches can view team menstrual cycles" ON "public"."menstrual_cycles" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (("public"."team_member_assignments" "tma"
     JOIN "public"."teams" "t" ON (("t"."id" = "tma"."team_id")))
     JOIN "public"."organization_members" "om" ON ((("om"."user_id" = "auth"."uid"()) AND ("om"."organization_id" = "t"."organization_id"))))
  WHERE (("tma"."user_id" = "menstrual_cycles"."user_id") AND ("om"."role" = ANY (ARRAY['coach'::"text", 'admin'::"text"]))))));



CREATE POLICY "Coaches can view team risk assessments" ON "public"."injury_risk_assessments" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (("public"."team_member_assignments" "tma"
     JOIN "public"."teams" "t" ON (("t"."id" = "tma"."team_id")))
     JOIN "public"."organization_members" "om" ON ((("om"."user_id" = "auth"."uid"()) AND ("om"."organization_id" = "t"."organization_id"))))
  WHERE (("tma"."user_id" = "injury_risk_assessments"."user_id") AND ("om"."role" = ANY (ARRAY['coach'::"text", 'admin'::"text"]))))));



CREATE POLICY "Coaches can view their own requests" ON "public"."team_access_requests" FOR SELECT TO "authenticated" USING (("requester_id" = "auth"."uid"()));



CREATE POLICY "Coaches can view transfer history for their teams" ON "public"."team_transfer_history" FOR SELECT TO "authenticated" USING ((("from_team_id" IN ( SELECT "staff_team_links"."team_id"
   FROM "public"."staff_team_links"
  WHERE ("staff_team_links"."staff_user_id" = "auth"."uid"()))) OR ("to_team_id" IN ( SELECT "staff_team_links"."team_id"
   FROM "public"."staff_team_links"
  WHERE ("staff_team_links"."staff_user_id" = "auth"."uid"())))));



CREATE POLICY "Coaches can view transfer requests for their teams" ON "public"."athlete_transfer_requests" FOR SELECT TO "authenticated" USING ((("from_team_id" IN ( SELECT "staff_team_links"."team_id"
   FROM "public"."staff_team_links"
  WHERE ("staff_team_links"."staff_user_id" = "auth"."uid"()))) OR ("to_team_id" IN ( SELECT "staff_team_links"."team_id"
   FROM "public"."staff_team_links"
  WHERE ("staff_team_links"."staff_user_id" = "auth"."uid"())))));



CREATE POLICY "Everyone can view badges" ON "public"."badges" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Org admins can view all basal body temperature" ON "public"."basal_body_temperature" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."user_id" = "auth"."uid"()) AND ("organization_members"."organization_id" = "basal_body_temperature"."organization_id") AND ("organization_members"."role" = 'admin'::"text")))));



CREATE POLICY "Org admins can view all injury records" ON "public"."injury_records" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."user_id" = "auth"."uid"()) AND ("organization_members"."organization_id" = "injury_records"."organization_id") AND ("organization_members"."role" = 'admin'::"text")))));



CREATE POLICY "Org admins can view all menstrual cycles" ON "public"."menstrual_cycles" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."user_id" = "auth"."uid"()) AND ("organization_members"."organization_id" = "menstrual_cycles"."organization_id") AND ("organization_members"."role" = 'admin'::"text")))));



CREATE POLICY "Org members can view report history" ON "public"."report_history" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."user_id" = "auth"."uid"()) AND ("organization_members"."organization_id" = "report_history"."organization_id")))));



CREATE POLICY "Org members can view report templates" ON "public"."report_templates" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."user_id" = "auth"."uid"()) AND ("organization_members"."organization_id" = "report_templates"."organization_id")))));



CREATE POLICY "Org members can view scheduled reports" ON "public"."scheduled_reports" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."user_id" = "auth"."uid"()) AND ("organization_members"."organization_id" = "scheduled_reports"."organization_id")))));



CREATE POLICY "Organization admins can create team assignments" ON "public"."team_member_assignments" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_organization_admin"("organization_id", "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"text"))))));



CREATE POLICY "Organization admins can delete department managers" ON "public"."department_managers" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."departments" "d"
  WHERE (("d"."id" = "department_managers"."department_id") AND ("public"."is_organization_admin"("d"."organization_id", "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."users"
          WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"text")))))))));



CREATE POLICY "Organization admins can delete departments" ON "public"."departments" FOR DELETE TO "authenticated" USING (("public"."is_organization_admin"("organization_id", "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"text"))))));



CREATE POLICY "Organization admins can delete team assignments" ON "public"."team_member_assignments" FOR DELETE TO "authenticated" USING (("public"."is_organization_admin"("organization_id", "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"text"))))));



CREATE POLICY "Organization admins can insert department managers" ON "public"."department_managers" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."departments" "d"
  WHERE (("d"."id" = "department_managers"."department_id") AND ("public"."is_organization_admin"("d"."organization_id", "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."users"
          WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"text")))))))));



CREATE POLICY "Organization admins can insert departments" ON "public"."departments" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_organization_admin"("organization_id", "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"text"))))));



CREATE POLICY "Organization admins can manage requests in their organization" ON "public"."team_access_requests" FOR UPDATE TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE (("organization_members"."user_id" = "auth"."uid"()) AND ("organization_members"."role" = 'organization_admin'::"text"))))) WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE (("organization_members"."user_id" = "auth"."uid"()) AND ("organization_members"."role" = 'organization_admin'::"text")))));



CREATE POLICY "Organization admins can manage transfer requests" ON "public"."athlete_transfer_requests" FOR UPDATE TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE (("organization_members"."user_id" = "auth"."uid"()) AND ("organization_members"."role" = 'organization_admin'::"text"))))) WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE (("organization_members"."user_id" = "auth"."uid"()) AND ("organization_members"."role" = 'organization_admin'::"text")))));



CREATE POLICY "Organization admins can update department managers" ON "public"."department_managers" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."departments" "d"
  WHERE (("d"."id" = "department_managers"."department_id") AND ("public"."is_organization_admin"("d"."organization_id", "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."users"
          WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"text"))))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."departments" "d"
  WHERE (("d"."id" = "department_managers"."department_id") AND ("public"."is_organization_admin"("d"."organization_id", "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."users"
          WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"text")))))))));



CREATE POLICY "Organization admins can update departments" ON "public"."departments" FOR UPDATE TO "authenticated" USING (("public"."is_organization_admin"("organization_id", "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"text")))))) WITH CHECK (("public"."is_organization_admin"("organization_id", "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"text"))))));



CREATE POLICY "Organization admins can update team assignments" ON "public"."team_member_assignments" FOR UPDATE TO "authenticated" USING (("public"."is_organization_admin"("organization_id", "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"text")))))) WITH CHECK (("public"."is_organization_admin"("organization_id", "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"text"))))));



CREATE POLICY "Organization admins can view requests in their organization" ON "public"."team_access_requests" FOR SELECT TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE (("organization_members"."user_id" = "auth"."uid"()) AND ("organization_members"."role" = 'organization_admin'::"text")))));



CREATE POLICY "Organization admins can view team assignment history" ON "public"."team_assignment_history" FOR SELECT TO "authenticated" USING (("public"."is_organization_admin"("organization_id", "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"text"))))));



CREATE POLICY "Organization admins can view team assignments in their org" ON "public"."team_member_assignments" FOR SELECT TO "authenticated" USING (("public"."is_organization_admin"("organization_id", "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"text"))))));



CREATE POLICY "Organization admins can view transfer history" ON "public"."team_transfer_history" FOR SELECT TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE (("organization_members"."user_id" = "auth"."uid"()) AND ("organization_members"."role" = 'organization_admin'::"text")))));



CREATE POLICY "Organization admins can view transfer requests" ON "public"."athlete_transfer_requests" FOR SELECT TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE (("organization_members"."user_id" = "auth"."uid"()) AND ("organization_members"."role" = 'organization_admin'::"text")))));



CREATE POLICY "Organization members can view their organizations" ON "public"."organizations" FOR SELECT TO "authenticated" USING (("public"."is_global_admin"() OR ("id" = ANY ("public"."my_organization_ids"()))));



CREATE POLICY "Source team coaches can update transfer requests" ON "public"."athlete_transfer_requests" FOR UPDATE TO "authenticated" USING (("from_team_id" IN ( SELECT "staff_team_links"."team_id"
   FROM "public"."staff_team_links"
  WHERE ("staff_team_links"."staff_user_id" = "auth"."uid"())))) WITH CHECK (("from_team_id" IN ( SELECT "staff_team_links"."team_id"
   FROM "public"."staff_team_links"
  WHERE ("staff_team_links"."staff_user_id" = "auth"."uid"()))));



CREATE POLICY "Staff can insert team member performance records" ON "public"."performance_records" FOR INSERT TO "authenticated" WITH CHECK (("user_id" IN ( SELECT "u"."id"
   FROM ("public"."users" "u"
     JOIN "public"."staff_team_links" "stl" ON (("u"."team_id" = "stl"."team_id")))
  WHERE ("stl"."staff_user_id" = "auth"."uid"()))));



CREATE POLICY "Staff can update team member performance records" ON "public"."performance_records" FOR UPDATE TO "authenticated" USING (("user_id" IN ( SELECT "u"."id"
   FROM ("public"."users" "u"
     JOIN "public"."staff_team_links" "stl" ON (("u"."team_id" = "stl"."team_id")))
  WHERE ("stl"."staff_user_id" = "auth"."uid"())))) WITH CHECK (("user_id" IN ( SELECT "u"."id"
   FROM ("public"."users" "u"
     JOIN "public"."staff_team_links" "stl" ON (("u"."team_id" = "stl"."team_id")))
  WHERE ("stl"."staff_user_id" = "auth"."uid"()))));



CREATE POLICY "Staff can view assignments for their teams" ON "public"."team_member_assignments" FOR SELECT TO "authenticated" USING (("team_id" IN ( SELECT "staff_team_links"."team_id"
   FROM "public"."staff_team_links"
  WHERE ("staff_team_links"."staff_user_id" = "auth"."uid"()))));



CREATE POLICY "Staff can view team member performance records" ON "public"."performance_records" FOR SELECT TO "authenticated" USING (("user_id" IN ( SELECT "u"."id"
   FROM ("public"."users" "u"
     JOIN "public"."staff_team_links" "stl" ON (("u"."team_id" = "stl"."team_id")))
  WHERE ("stl"."staff_user_id" = "auth"."uid"()))));



CREATE POLICY "Staff can view team members motivation records" ON "public"."motivation_records" FOR SELECT TO "authenticated" USING (("user_id" IN ( SELECT "u"."id"
   FROM ("public"."users" "u"
     JOIN "public"."staff_team_links" "stl" ON (("u"."team_id" = "stl"."team_id")))
  WHERE ("stl"."staff_user_id" = "auth"."uid"()))));



CREATE POLICY "Staff can view team members sleep records" ON "public"."sleep_records" FOR SELECT TO "authenticated" USING (("user_id" IN ( SELECT "u"."id"
   FROM ("public"."users" "u"
     JOIN "public"."staff_team_links" "stl" ON (("u"."team_id" = "stl"."team_id")))
  WHERE ("stl"."staff_user_id" = "auth"."uid"()))));



CREATE POLICY "Staff can view weight records of their team members" ON "public"."weight_records" FOR SELECT TO "authenticated" USING (("user_id" IN ( SELECT "u"."id"
   FROM ("public"."users" "u"
     JOIN "public"."staff_team_links" "stl" ON (("u"."team_id" = "stl"."team_id")))
  WHERE ("stl"."staff_user_id" = "auth"."uid"()))));



CREATE POLICY "System admins can manage all requests" ON "public"."team_access_requests" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"text")))));



CREATE POLICY "System admins can manage all transfer requests" ON "public"."athlete_transfer_requests" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"text")))));



CREATE POLICY "System admins can view all requests" ON "public"."team_access_requests" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"text")))));



CREATE POLICY "System admins can view all transfer history" ON "public"."team_transfer_history" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"text")))));



CREATE POLICY "System can insert notifications" ON "public"."team_achievement_notifications" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "System can insert risk assessments" ON "public"."injury_risk_assessments" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "System can insert team achievements" ON "public"."team_achievements" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "System can insert team assignment history" ON "public"."team_assignment_history" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "System can insert transfer history" ON "public"."team_transfer_history" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "System can update team achievements" ON "public"."team_achievements" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Team coaches can review requests for their team" ON "public"."team_access_requests" FOR SELECT TO "authenticated" USING (("team_id" IN ( SELECT "staff_team_links"."team_id"
   FROM "public"."staff_team_links"
  WHERE ("staff_team_links"."staff_user_id" = "auth"."uid"()))));



CREATE POLICY "Team coaches can update requests for their team" ON "public"."team_access_requests" FOR UPDATE TO "authenticated" USING (("team_id" IN ( SELECT "staff_team_links"."team_id"
   FROM "public"."staff_team_links"
  WHERE ("staff_team_links"."staff_user_id" = "auth"."uid"())))) WITH CHECK (("team_id" IN ( SELECT "staff_team_links"."team_id"
   FROM "public"."staff_team_links"
  WHERE ("staff_team_links"."staff_user_id" = "auth"."uid"()))));



CREATE POLICY "Team members can view team achievements" ON "public"."team_achievements" FOR SELECT TO "authenticated" USING (("team_id" IN ( SELECT "users"."team_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Team members can view team badges" ON "public"."user_badges" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "user_badges"."user_id") AND ("u"."team_id" IN ( SELECT "users"."team_id"
           FROM "public"."users"
          WHERE ("users"."id" = "auth"."uid"())))))));



CREATE POLICY "Team members can view team points" ON "public"."user_points" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "user_points"."user_id") AND ("u"."team_id" IN ( SELECT "users"."team_id"
           FROM "public"."users"
          WHERE ("users"."id" = "auth"."uid"())))))));



CREATE POLICY "Users can create own tutorial progress" ON "public"."tutorial_progress" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create report history entries" ON "public"."report_history" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."user_id" = "auth"."uid"()) AND ("organization_members"."organization_id" = "report_history"."organization_id")))));



CREATE POLICY "Users can create threads with organization members" ON "public"."message_threads" FOR INSERT TO "authenticated" WITH CHECK (((("auth"."uid"() = "participant1_id") OR ("auth"."uid"() = "participant2_id")) AND (EXISTS ( SELECT 1
   FROM ("public"."organization_members" "om1"
     JOIN "public"."organization_members" "om2" ON (("om1"."organization_id" = "om2"."organization_id")))
  WHERE (("om1"."user_id" = "message_threads"."participant1_id") AND ("om2"."user_id" = "message_threads"."participant2_id"))))));



CREATE POLICY "Users can delete own motivation records" ON "public"."motivation_records" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can delete own sleep records" ON "public"."sleep_records" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can delete own weight records" ON "public"."weight_records" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own badges" ON "public"."user_badges" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own motivation records" ON "public"."motivation_records" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can insert own points" ON "public"."user_points" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own sleep records" ON "public"."sleep_records" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can insert own streaks" ON "public"."user_streaks" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own transactions" ON "public"."point_transactions" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own weight records" ON "public"."weight_records" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own goals" ON "public"."user_goals" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own milestones" ON "public"."achievement_milestones" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can mark messages as read" ON "public"."messages" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "receiver_id")) WITH CHECK (("auth"."uid"() = "receiver_id"));



CREATE POLICY "Users can send messages" ON "public"."messages" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "sender_id") AND (EXISTS ( SELECT 1
   FROM "public"."message_threads" "mt"
  WHERE (("mt"."id" = "messages"."thread_id") AND (("mt"."participant1_id" = "auth"."uid"()) OR ("mt"."participant2_id" = "auth"."uid"())) AND (("mt"."participant1_id" = "messages"."receiver_id") OR ("mt"."participant2_id" = "messages"."receiver_id")))))));



CREATE POLICY "Users can update own badges" ON "public"."user_badges" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own motivation records" ON "public"."motivation_records" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update own notifications" ON "public"."team_achievement_notifications" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update own points" ON "public"."user_points" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own sleep records" ON "public"."sleep_records" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update own streaks" ON "public"."user_streaks" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own threads" ON "public"."message_threads" FOR UPDATE TO "authenticated" USING ((("auth"."uid"() = "participant1_id") OR ("auth"."uid"() = "participant2_id"))) WITH CHECK ((("auth"."uid"() = "participant1_id") OR ("auth"."uid"() = "participant2_id")));



CREATE POLICY "Users can update own tutorial progress" ON "public"."tutorial_progress" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own weight records" ON "public"."weight_records" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view departments in their organizations" ON "public"."departments" FOR SELECT TO "authenticated" USING (("public"."is_organization_admin"("organization_id", "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"text"))))));



CREATE POLICY "Users can view own badges" ON "public"."user_badges" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own messages" ON "public"."messages" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "sender_id") OR ("auth"."uid"() = "receiver_id")));



CREATE POLICY "Users can view own motivation records" ON "public"."motivation_records" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own points" ON "public"."user_points" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own sleep records" ON "public"."sleep_records" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own streaks" ON "public"."user_streaks" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own team notifications" ON "public"."team_achievement_notifications" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own threads" ON "public"."message_threads" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "participant1_id") OR ("auth"."uid"() = "participant2_id")));



CREATE POLICY "Users can view own transactions" ON "public"."point_transactions" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own tutorial progress" ON "public"."tutorial_progress" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own weight records" ON "public"."weight_records" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their department manager assignments" ON "public"."department_managers" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."departments" "d"
  WHERE (("d"."id" = "department_managers"."department_id") AND "public"."is_organization_admin"("d"."organization_id", "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"text"))))));



CREATE POLICY "Users can view their own team assignment history" ON "public"."team_assignment_history" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own team assignments" ON "public"."team_member_assignments" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."achievement_milestones" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_summaries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_summaries_select_own" ON "public"."ai_summaries" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "athlete can insert own shared_reports" ON "public"."shared_reports" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND ("u"."role" = 'athlete'::"text"))))));



CREATE POLICY "athlete can manage own sharing settings" ON "public"."data_sharing_settings" TO "authenticated" USING (("athlete_user_id" = "auth"."uid"())) WITH CHECK (("athlete_user_id" = "auth"."uid"()));



CREATE POLICY "athlete can read own shared_reports" ON "public"."shared_reports" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."athlete_acwr_daily" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "athlete_own_select_acwr_daily" ON "public"."athlete_acwr_daily" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."is_admin"()));



ALTER TABLE "public"."athlete_transfer_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."badges" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."basal_body_temperature" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."coach_comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."daily_energy_snapshots" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."daily_reflections" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "daily_reflections_delete_own" ON "public"."daily_reflections" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "daily_reflections_insert_own" ON "public"."daily_reflections" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "daily_reflections_select_own" ON "public"."daily_reflections" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "daily_reflections_update_own" ON "public"."daily_reflections" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."data_sharing_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."department_managers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."departments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."engine_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "engine_events_insert_own" ON "public"."engine_events" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "engine_events_select_own" ON "public"."engine_events" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."engine_states" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "engine_states_insert_own" ON "public"."engine_states" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "engine_states_select_own" ON "public"."engine_states" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."ftt_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ftt_events_insert_own" ON "public"."ftt_events" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "ftt_events_select_own_or_admin" ON "public"."ftt_events" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND ("u"."role" = 'global_admin'::"text"))))));



CREATE POLICY "ftt_events_update_own_or_admin" ON "public"."ftt_events" FOR UPDATE TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND ("u"."role" = 'global_admin'::"text")))))) WITH CHECK ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND ("u"."role" = 'global_admin'::"text"))))));



ALTER TABLE "public"."ftt_records" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ftt_records_delete_own" ON "public"."ftt_records" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "ftt_records_insert_own" ON "public"."ftt_records" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "ftt_records_select_own" ON "public"."ftt_records" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "ftt_records_select_own_or_admin" ON "public"."ftt_records" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND ("u"."role" = 'global_admin'::"text"))))));



CREATE POLICY "ftt_records_update_own" ON "public"."ftt_records" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "ftt_records_update_own_or_admin" ON "public"."ftt_records" FOR UPDATE TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND ("u"."role" = 'global_admin'::"text")))))) WITH CHECK ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND ("u"."role" = 'global_admin'::"text"))))));



CREATE POLICY "ga_all_invitation_tokens" ON "public"."invitation_tokens" USING ("public"."is_global_admin"()) WITH CHECK ("public"."is_global_admin"());



CREATE POLICY "ga_all_organization_members" ON "public"."organization_members" USING ("public"."is_global_admin"()) WITH CHECK ("public"."is_global_admin"());



CREATE POLICY "ga_all_organizations" ON "public"."organizations" USING ("public"."is_global_admin"()) WITH CHECK ("public"."is_global_admin"());



CREATE POLICY "ga_all_teams" ON "public"."teams" USING ("public"."is_global_admin"()) WITH CHECK ("public"."is_global_admin"());



CREATE POLICY "ga_all_tutorial_progress" ON "public"."tutorial_progress" USING ("public"."is_global_admin"()) WITH CHECK ("public"."is_global_admin"());



ALTER TABLE "public"."generated_reports" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "global_admin can delete organizations" ON "public"."organizations" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'global_admin'::"text")))));



CREATE POLICY "global_admin can insert organizations" ON "public"."organizations" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'global_admin'::"text")))));



CREATE POLICY "global_admin can update organizations" ON "public"."organizations" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'global_admin'::"text")))));



CREATE POLICY "global_admin can view organizations" ON "public"."organizations" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'global_admin'::"text")))));



CREATE POLICY "global_admin_can_view_all_tutorial_progress" ON "public"."tutorial_progress" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND ("u"."role" = 'global_admin'::"text")))));



CREATE POLICY "global_admin_manage_all" ON "public"."organizations" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND ("u"."role" = 'global_admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND ("u"."role" = 'global_admin'::"text")))));



CREATE POLICY "inbody_delete_own" ON "public"."inbody_records" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "inbody_insert_admin_csv" ON "public"."inbody_records" FOR INSERT TO "authenticated" WITH CHECK ((("public"."current_user_role"() = 'admin'::"text") AND ("user_id" IS NULL) AND ("phone_number" IS NOT NULL)));



CREATE POLICY "inbody_insert_own" ON "public"."inbody_records" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."inbody_records" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "inbody_records_select" ON "public"."inbody_records" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "inbody_update_admin_attach" ON "public"."inbody_records" FOR UPDATE TO "authenticated" USING (("public"."current_user_role"() = 'admin'::"text")) WITH CHECK (("public"."current_user_role"() = 'admin'::"text"));



CREATE POLICY "inbody_update_own" ON "public"."inbody_records" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "inbody_v2_delete_own_or_admin" ON "public"."inbody_records" FOR DELETE TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."is_global_admin"()));



CREATE POLICY "inbody_v2_insert_admin_csv" ON "public"."inbody_records" FOR INSERT TO "authenticated" WITH CHECK ((("public"."current_user_role"() = 'admin'::"text") AND ("user_id" IS NULL) AND ("phone_number" IS NOT NULL)));



CREATE POLICY "inbody_v2_insert_own" ON "public"."inbody_records" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "inbody_v2_select" ON "public"."inbody_records" FOR SELECT TO "authenticated" USING ((("user_id" IS NOT NULL) AND "public"."can_read_user"("user_id")));



CREATE POLICY "inbody_v2_update_own" ON "public"."inbody_records" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."injury_records" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."injury_risk_assessments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invitation_tokens" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "invitation_tokens_insert_by_admin_or_staff" ON "public"."invitation_tokens" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_global_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND ("u"."role" = 'staff'::"text"))))));



ALTER TABLE "public"."menstrual_cycles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."message_threads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."motivation_records" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."nutrition_daily_reports" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "nutrition_daily_reports_delete_own" ON "public"."nutrition_daily_reports" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "nutrition_daily_reports_insert_own" ON "public"."nutrition_daily_reports" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "nutrition_daily_reports_select_own" ON "public"."nutrition_daily_reports" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "nutrition_daily_reports_update_own" ON "public"."nutrition_daily_reports" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."nutrition_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "nutrition_logs_delete_own" ON "public"."nutrition_logs" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "nutrition_logs_insert_own" ON "public"."nutrition_logs" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "nutrition_logs_select_own" ON "public"."nutrition_logs" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "nutrition_logs_select_team" ON "public"."nutrition_logs" FOR SELECT TO "authenticated" USING ("public"."can_read_user"("user_id"));



CREATE POLICY "nutrition_logs_update_own" ON "public"."nutrition_logs" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."nutrition_plans" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "nutrition_plans_delete_own" ON "public"."nutrition_plans" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "nutrition_plans_insert_own" ON "public"."nutrition_plans" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "nutrition_plans_select_team" ON "public"."nutrition_plans" FOR SELECT TO "authenticated" USING ("public"."can_read_user"("user_id"));



CREATE POLICY "nutrition_plans_update_own" ON "public"."nutrition_plans" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "org_members_delete_by_admin_or_org_admin" ON "public"."organization_members" FOR DELETE TO "authenticated" USING (("public"."is_global_admin"() OR "public"."is_org_admin"("organization_id")));



CREATE POLICY "org_members_insert_by_admin_or_org_admin" ON "public"."organization_members" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_global_admin"() OR "public"."is_org_admin"("organization_id")));



CREATE POLICY "org_members_select_in_my_orgs" ON "public"."organization_members" FOR SELECT TO "authenticated" USING (("public"."is_global_admin"() OR ("user_id" = "auth"."uid"()) OR ("organization_id" = ANY ("public"."my_organization_ids"()))));



CREATE POLICY "org_members_update_by_admin_or_org_admin" ON "public"."organization_members" FOR UPDATE TO "authenticated" USING (("public"."is_global_admin"() OR "public"."is_org_admin"("organization_id"))) WITH CHECK (("public"."is_global_admin"() OR "public"."is_org_admin"("organization_id")));



ALTER TABLE "public"."organization_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."performance_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."performance_records" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."performance_test_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."point_transactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "push_subs_insert_own" ON "public"."push_subscriptions" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "push_subs_select_own" ON "public"."push_subscriptions" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "push_subs_update_own" ON "public"."push_subscriptions" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."push_subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reflections" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "reflections_delete_own_or_admin" ON "public"."reflections" FOR DELETE TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."is_global_admin"()));



CREATE POLICY "reflections_insert_own_or_admin" ON "public"."reflections" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) OR "public"."is_global_admin"()));



CREATE POLICY "reflections_select_own_or_admin" ON "public"."reflections" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."is_global_admin"()));



CREATE POLICY "reflections_update_own_or_admin" ON "public"."reflections" FOR UPDATE TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."is_global_admin"())) WITH CHECK ((("user_id" = "auth"."uid"()) OR "public"."is_global_admin"()));



ALTER TABLE "public"."report_configs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."report_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."report_schedules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."report_subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."report_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."scheduled_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shared_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sleep_records" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "snapshots read own" ON "public"."daily_energy_snapshots" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "snapshots update own" ON "public"."daily_energy_snapshots" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "snapshots upsert own" ON "public"."daily_energy_snapshots" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "staff can read sharing settings for linked teams within date ra" ON "public"."data_sharing_settings" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND ("u"."role" = 'staff'::"text")))) AND (EXISTS ( SELECT 1
   FROM "public"."staff_team_links" "stl"
  WHERE (("stl"."staff_user_id" = "auth"."uid"()) AND ("stl"."team_id" = "data_sharing_settings"."team_id")))) AND ((CURRENT_DATE >= "start_date") AND (CURRENT_DATE <= "end_date"))));



CREATE POLICY "staff or admin can read shared_reports" ON "public"."shared_reports" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users" "me"
  WHERE (("me"."id" = "auth"."uid"()) AND (("me"."role" = 'admin'::"text") OR (("me"."role" = 'staff'::"text") AND (EXISTS ( SELECT 1
           FROM ("public"."staff_team_links" "stl"
             JOIN "public"."users" "athlete" ON (("athlete"."team_id" = "stl"."team_id")))
          WHERE (("stl"."staff_user_id" = "auth"."uid"()) AND ("athlete"."id" = "shared_reports"."user_id"))))))))));



CREATE POLICY "staff_can_read_team_acwr_daily" ON "public"."athlete_acwr_daily" FOR SELECT TO "authenticated" USING (("public"."is_admin"() OR ("public"."is_staff"() AND (EXISTS ( SELECT 1
   FROM ("public"."users" "u"
     JOIN "public"."staff_team_links" "stl" ON (("stl"."team_id" = "u"."team_id")))
  WHERE (("u"."id" = "athlete_acwr_daily"."user_id") AND ("stl"."staff_user_id" = "auth"."uid"())))))));



ALTER TABLE "public"."staff_team_links" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "staff_team_links_delete" ON "public"."staff_team_links" FOR DELETE TO "authenticated" USING (("public"."is_global_admin"() OR "public"."is_org_admin"("organization_id")));



CREATE POLICY "staff_team_links_insert" ON "public"."staff_team_links" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_global_admin"() OR "public"."is_org_admin"("organization_id")));



CREATE POLICY "staff_team_links_select" ON "public"."staff_team_links" FOR SELECT TO "authenticated" USING (("public"."is_global_admin"() OR ("staff_user_id" = "auth"."uid"()) OR "public"."is_org_admin"("organization_id")));



CREATE POLICY "staff_team_links_update" ON "public"."staff_team_links" FOR UPDATE TO "authenticated" USING (("public"."is_global_admin"() OR "public"."is_org_admin"("organization_id"))) WITH CHECK (("public"."is_global_admin"() OR "public"."is_org_admin"("organization_id")));



ALTER TABLE "public"."team_access_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."team_achievement_notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."team_achievements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."team_assignment_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."team_member_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."team_transfer_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."teams" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "teams_manage_org_admin" ON "public"."teams" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_global_admin"() OR "public"."is_org_admin"("organization_id")));



CREATE POLICY "teams_manage_org_admin_delete" ON "public"."teams" FOR DELETE TO "authenticated" USING (("public"."is_global_admin"() OR "public"."is_org_admin"("organization_id")));



CREATE POLICY "teams_manage_org_admin_update" ON "public"."teams" FOR UPDATE TO "authenticated" USING (("public"."is_global_admin"() OR "public"."is_org_admin"("organization_id"))) WITH CHECK (("public"."is_global_admin"() OR "public"."is_org_admin"("organization_id")));



CREATE POLICY "teams_select" ON "public"."teams" FOR SELECT TO "authenticated" USING (("public"."is_global_admin"() OR "public"."is_org_admin"("organization_id") OR (EXISTS ( SELECT 1
   FROM "public"."staff_team_links" "stl"
  WHERE (("stl"."team_id" = "teams"."id") AND ("stl"."staff_user_id" = "auth"."uid"()))))));



ALTER TABLE "public"."training_records" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "training_records_delete" ON "public"."training_records" FOR DELETE TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."is_global_admin"()));



CREATE POLICY "training_records_insert" ON "public"."training_records" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) OR "public"."is_global_admin"()));



CREATE POLICY "training_records_select" ON "public"."training_records" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."is_global_admin"() OR (EXISTS ( SELECT 1
   FROM ("public"."users" "u"
     JOIN "public"."teams" "t" ON (("t"."id" = "u"."team_id")))
  WHERE (("u"."id" = "training_records"."user_id") AND "public"."is_org_admin"("t"."organization_id")))) OR (EXISTS ( SELECT 1
   FROM ("public"."users" "u"
     JOIN "public"."staff_team_links" "stl" ON (("stl"."team_id" = "u"."team_id")))
  WHERE (("u"."id" = "training_records"."user_id") AND ("stl"."staff_user_id" = "auth"."uid"()))))));



CREATE POLICY "training_records_update" ON "public"."training_records" FOR UPDATE TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."is_global_admin"())) WITH CHECK ((("user_id" = "auth"."uid"()) OR "public"."is_global_admin"()));



ALTER TABLE "public"."tutorial_progress" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tutorial_progress_select_own" ON "public"."tutorial_progress" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "tutorial_progress_update_own" ON "public"."tutorial_progress" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "tutorial_progress_upsert_own" ON "public"."tutorial_progress" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "user can manage own push_subscriptions" ON "public"."push_subscriptions" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."user_badges" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_goals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_phone_links" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_phone_links_delete_own" ON "public"."user_phone_links" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "user_phone_links_insert_own" ON "public"."user_phone_links" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "user_phone_links_select_own" ON "public"."user_phone_links" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "user_phone_links_update_own" ON "public"."user_phone_links" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "user_phone_links_upsert_own" ON "public"."user_phone_links" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."user_points" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_streaks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users_admin_all" ON "public"."users" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "users_insert" ON "public"."users" FOR INSERT TO "authenticated" WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "users_select" ON "public"."users" FOR SELECT TO "authenticated" USING ((("id" = "auth"."uid"()) OR "public"."is_global_admin"() OR (("team_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."teams" "t"
  WHERE (("t"."id" = "users"."team_id") AND "public"."is_org_admin"("t"."organization_id"))))) OR (("team_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."staff_team_links" "stl"
  WHERE (("stl"."team_id" = "users"."team_id") AND ("stl"."staff_user_id" = "auth"."uid"())))))));



CREATE POLICY "users_update" ON "public"."users" FOR UPDATE TO "authenticated" USING ((("id" = "auth"."uid"()) OR "public"."is_global_admin"() OR (("team_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."teams" "t"
  WHERE (("t"."id" = "users"."team_id") AND "public"."is_org_admin"("t"."organization_id"))))) OR (("team_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."staff_team_links" "stl"
  WHERE (("stl"."team_id" = "users"."team_id") AND ("stl"."staff_user_id" = "auth"."uid"()) AND ("stl"."role" = 'team_admin'::"text"))))))) WITH CHECK ((("id" = "auth"."uid"()) OR "public"."is_global_admin"() OR (("team_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."teams" "t"
  WHERE (("t"."id" = "users"."team_id") AND "public"."is_org_admin"("t"."organization_id"))))) OR (("team_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."staff_team_links" "stl"
  WHERE (("stl"."team_id" = "users"."team_id") AND ("stl"."staff_user_id" = "auth"."uid"()) AND ("stl"."role" = 'team_admin'::"text")))))));



ALTER TABLE "public"."weight_records" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "コーチは担当のレポートスケジュールを閲覧可" ON "public"."report_schedules" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."report_configs"
  WHERE (("report_configs"."id" = "report_schedules"."config_id") AND (EXISTS ( SELECT 1
           FROM "public"."users"
          WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'staff'::"text") AND ((("report_configs"."organization_id" IS NOT NULL) AND (EXISTS ( SELECT 1
                   FROM "public"."organization_members"
                  WHERE (("organization_members"."user_id" = "auth"."uid"()) AND ("organization_members"."organization_id" = "report_configs"."organization_id"))))) OR (("report_configs"."team_id" IS NOT NULL) AND (EXISTS ( SELECT 1
                   FROM "public"."staff_team_links"
                  WHERE (("staff_team_links"."staff_user_id" = "auth"."uid"()) AND ("staff_team_links"."team_id" = "report_configs"."team_id")))))))))))));



CREATE POLICY "コーチは担当チームのレポートを閲覧可能" ON "public"."generated_reports" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'staff'::"text") AND ((("generated_reports"."organization_id" IS NOT NULL) AND (EXISTS ( SELECT 1
           FROM "public"."organization_members"
          WHERE (("organization_members"."user_id" = "auth"."uid"()) AND ("organization_members"."organization_id" = "generated_reports"."organization_id"))))) OR (("generated_reports"."team_id" IS NOT NULL) AND (EXISTS ( SELECT 1
           FROM "public"."staff_team_links"
          WHERE (("staff_team_links"."staff_user_id" = "auth"."uid"()) AND ("staff_team_links"."team_id" = "generated_reports"."team_id"))))))))));



CREATE POLICY "コーチは担当組織・チームのレポート設定を閲" ON "public"."report_configs" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'staff'::"text") AND ((("report_configs"."organization_id" IS NOT NULL) AND (EXISTS ( SELECT 1
           FROM "public"."organization_members"
          WHERE (("organization_members"."user_id" = "auth"."uid"()) AND ("organization_members"."organization_id" = "report_configs"."organization_id"))))) OR (("report_configs"."team_id" IS NOT NULL) AND (EXISTS ( SELECT 1
           FROM "public"."staff_team_links"
          WHERE (("staff_team_links"."staff_user_id" = "auth"."uid"()) AND ("staff_team_links"."team_id" = "report_configs"."team_id"))))))))));



CREATE POLICY "システムとコーチはレポートを作成可能" ON "public"."generated_reports" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['admin'::"text", 'staff'::"text"]))))));



CREATE POLICY "システムはレポートを更新可能" ON "public"."generated_reports" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['admin'::"text", 'staff'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['admin'::"text", 'staff'::"text"]))))));



CREATE POLICY "ユーザーは自分の配信設定を作成・更新可能" ON "public"."report_subscriptions" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "ユーザーは自分の配信設定を閲覧可能" ON "public"."report_subscriptions" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "管理者とコーチはレポートスケジュールを作成" ON "public"."report_schedules" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['admin'::"text", 'staff'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['admin'::"text", 'staff'::"text"]))))));



CREATE POLICY "管理者とコーチはレポート設定を作成可能" ON "public"."report_configs" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['admin'::"text", 'staff'::"text"]))))));



CREATE POLICY "管理者とコーチはレポート設定を更新可能" ON "public"."report_configs" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['admin'::"text", 'staff'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['admin'::"text", 'staff'::"text"]))))));



CREATE POLICY "管理者は全レポートを閲覧可能" ON "public"."generated_reports" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"text")))));



CREATE POLICY "管理者は全レポートスケジュールを閲覧可能" ON "public"."report_schedules" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"text")))));



CREATE POLICY "管理者は全レポート設定を閲覧可能" ON "public"."report_configs" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"text")))));



CREATE POLICY "管理者は全配信設定を閲覧可能" ON "public"."report_subscriptions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"text")))));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."add_strength_record_with_relative_1rm"("p_user_id" "uuid", "p_test_type_id" "uuid", "p_date" "date", "p_1rm" numeric, "p_notes" "text", "p_is_official" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."add_strength_record_with_relative_1rm"("p_user_id" "uuid", "p_test_type_id" "uuid", "p_date" "date", "p_1rm" numeric, "p_notes" "text", "p_is_official" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_strength_record_with_relative_1rm"("p_user_id" "uuid", "p_test_type_id" "uuid", "p_date" "date", "p_1rm" numeric, "p_notes" "text", "p_is_official" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."approve_athlete_transfer"("request_id" "uuid", "reviewer_user_id" "uuid", "notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."approve_athlete_transfer"("request_id" "uuid", "reviewer_user_id" "uuid", "notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."approve_athlete_transfer"("request_id" "uuid", "reviewer_user_id" "uuid", "notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."approve_team_access_request"("request_id" "uuid", "reviewer_user_id" "uuid", "notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."approve_team_access_request"("request_id" "uuid", "reviewer_user_id" "uuid", "notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."approve_team_access_request"("request_id" "uuid", "reviewer_user_id" "uuid", "notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."assign_user_to_team"("p_user_id" "uuid", "p_team_id" "uuid", "p_organization_id" "uuid", "p_assignment_type" "text", "p_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."assign_user_to_team"("p_user_id" "uuid", "p_team_id" "uuid", "p_organization_id" "uuid", "p_assignment_type" "text", "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."assign_user_to_team"("p_user_id" "uuid", "p_team_id" "uuid", "p_organization_id" "uuid", "p_assignment_type" "text", "p_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."award_first_step_badge"() TO "anon";
GRANT ALL ON FUNCTION "public"."award_first_step_badge"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."award_first_step_badge"() TO "service_role";



GRANT ALL ON FUNCTION "public"."award_first_training_badge"() TO "anon";
GRANT ALL ON FUNCTION "public"."award_first_training_badge"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."award_first_training_badge"() TO "service_role";



GRANT ALL ON FUNCTION "public"."award_points"("p_user_id" "uuid", "p_points" integer, "p_reason" "text", "p_category" "text", "p_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."award_points"("p_user_id" "uuid", "p_points" integer, "p_reason" "text", "p_category" "text", "p_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."award_points"("p_user_id" "uuid", "p_points" integer, "p_reason" "text", "p_category" "text", "p_metadata" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."backfill_inbody_user_id_from_phone"() TO "anon";
GRANT ALL ON FUNCTION "public"."backfill_inbody_user_id_from_phone"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."backfill_inbody_user_id_from_phone"() TO "service_role";



GRANT ALL ON FUNCTION "public"."backfill_rank_reach_badges"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."backfill_rank_reach_badges"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."backfill_rank_reach_badges"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."block_team_change_unless_org_or_global"() TO "anon";
GRANT ALL ON FUNCTION "public"."block_team_change_unless_org_or_global"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."block_team_change_unless_org_or_global"() TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_injury_risk"("p_user_id" "uuid", "p_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_injury_risk"("p_user_id" "uuid", "p_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_injury_risk"("p_user_id" "uuid", "p_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_next_run"("p_schedule_type" "text", "p_schedule_config" "jsonb", "p_from_date" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_next_run"("p_schedule_type" "text", "p_schedule_config" "jsonb", "p_from_date" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_next_run"("p_schedule_type" "text", "p_schedule_config" "jsonb", "p_from_date" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_relative_1rm"("p_1rm" numeric, "p_weight" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_relative_1rm"("p_1rm" numeric, "p_weight" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_relative_1rm"("p_1rm" numeric, "p_weight" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."call_alert_daily_summary"() TO "anon";
GRANT ALL ON FUNCTION "public"."call_alert_daily_summary"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."call_alert_daily_summary"() TO "service_role";



GRANT ALL ON FUNCTION "public"."can_read_user"("target_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_read_user"("target_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_read_user"("target_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_empty_threads"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_empty_threads"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_empty_threads"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_messaging_data"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_messaging_data"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_messaging_data"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_old_messages"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_old_messages"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_old_messages"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."consume_invitation_token"("p_token_hash" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."consume_invitation_token"("p_token_hash" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."consume_invitation_token"("p_token_hash" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."current_app_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_app_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_app_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."current_app_user_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_app_user_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_app_user_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."current_user_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_user_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_user_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."earn_badge"("p_user_id" "uuid", "p_badge_name" "text", "p_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."earn_badge"("p_user_id" "uuid", "p_badge_name" "text", "p_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."earn_badge"("p_user_id" "uuid", "p_badge_name" "text", "p_metadata" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_athlete_transfer_history"("athlete_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_athlete_transfer_history"("athlete_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_athlete_transfer_history"("athlete_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_coach_week_athlete_cards"("p_team_id" "uuid", "p_start_date" "date", "p_end_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_coach_week_athlete_cards"("p_team_id" "uuid", "p_start_date" "date", "p_end_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_coach_week_athlete_cards"("p_team_id" "uuid", "p_start_date" "date", "p_end_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_coach_week_cause_tags"("p_team_id" "uuid", "p_start_date" "date", "p_end_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_coach_week_cause_tags"("p_team_id" "uuid", "p_start_date" "date", "p_end_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_coach_week_cause_tags"("p_team_id" "uuid", "p_start_date" "date", "p_end_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_latest_weight"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_latest_weight"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_latest_weight"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_staff_team_ids"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_staff_team_ids"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_staff_team_ids"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_team_cause_tags"("p_team_id" "uuid", "p_start_date" "date", "p_end_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_team_cause_tags"("p_team_id" "uuid", "p_start_date" "date", "p_end_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_team_cause_tags"("p_team_id" "uuid", "p_start_date" "date", "p_end_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_team_members_with_assignments"("p_team_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_team_members_with_assignments"("p_team_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_team_members_with_assignments"("p_team_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_unassigned_organization_members"("p_organization_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_unassigned_organization_members"("p_organization_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_unassigned_organization_members"("p_organization_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."grant_badge_no_points"("p_user_id" "uuid", "p_badge_name" "text", "p_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."grant_badge_no_points"("p_user_id" "uuid", "p_badge_name" "text", "p_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."grant_badge_no_points"("p_user_id" "uuid", "p_badge_name" "text", "p_metadata" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_report_view_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."increment_report_view_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_report_view_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_global_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_global_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_global_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_org_admin"("org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_org_admin"("org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_org_admin"("org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_org_member"("org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_org_member"("org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_org_member"("org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_organization_admin"("org_id" "uuid", "check_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_organization_admin"("org_id" "uuid", "check_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_organization_admin"("org_id" "uuid", "check_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_staff"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_staff"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_staff"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_staff_or_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_staff_or_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_staff_or_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_team_admin"("team_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_team_admin"("team_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_team_admin"("team_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."link_inbody_by_phone"() TO "anon";
GRANT ALL ON FUNCTION "public"."link_inbody_by_phone"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."link_inbody_by_phone"() TO "service_role";



GRANT ALL ON FUNCTION "public"."link_inbody_by_user_phone"() TO "anon";
GRANT ALL ON FUNCTION "public"."link_inbody_by_user_phone"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."link_inbody_by_user_phone"() TO "service_role";



GRANT ALL ON FUNCTION "public"."link_inbody_records_by_phone"() TO "anon";
GRANT ALL ON FUNCTION "public"."link_inbody_records_by_phone"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."link_inbody_records_by_phone"() TO "service_role";



GRANT ALL ON FUNCTION "public"."link_inbody_records_by_phone"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."link_inbody_records_by_phone"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."link_inbody_records_by_phone"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."link_inbody_records_by_phone"("p_user_id" "uuid", "p_phone" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."link_inbody_records_by_phone"("p_user_id" "uuid", "p_phone" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."link_inbody_records_by_phone"("p_user_id" "uuid", "p_phone" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."link_inbody_records_for_user"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."link_inbody_records_for_user"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."link_inbody_records_for_user"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_team_achievement_celebrated"("p_achievement_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_team_achievement_celebrated"("p_achievement_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_team_achievement_celebrated"("p_achievement_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_team_notification_read"("p_notification_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_team_notification_read"("p_notification_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_team_notification_read"("p_notification_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."my_organization_ids"() TO "anon";
GRANT ALL ON FUNCTION "public"."my_organization_ids"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."my_organization_ids"() TO "service_role";



GRANT ALL ON FUNCTION "public"."normalize_phone"("p" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_phone"("p" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_phone"("p" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."process_motivation_record_gamification"() TO "anon";
GRANT ALL ON FUNCTION "public"."process_motivation_record_gamification"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_motivation_record_gamification"() TO "service_role";



GRANT ALL ON FUNCTION "public"."process_performance_record_gamification"() TO "anon";
GRANT ALL ON FUNCTION "public"."process_performance_record_gamification"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_performance_record_gamification"() TO "service_role";



GRANT ALL ON FUNCTION "public"."process_sleep_record_gamification"() TO "anon";
GRANT ALL ON FUNCTION "public"."process_sleep_record_gamification"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_sleep_record_gamification"() TO "service_role";



GRANT ALL ON FUNCTION "public"."process_training_record_gamification"() TO "anon";
GRANT ALL ON FUNCTION "public"."process_training_record_gamification"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_training_record_gamification"() TO "service_role";



GRANT ALL ON FUNCTION "public"."process_weight_record_gamification"() TO "anon";
GRANT ALL ON FUNCTION "public"."process_weight_record_gamification"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_weight_record_gamification"() TO "service_role";



GRANT ALL ON FUNCTION "public"."rebuild_all_user_streaks_jst"() TO "anon";
GRANT ALL ON FUNCTION "public"."rebuild_all_user_streaks_jst"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rebuild_all_user_streaks_jst"() TO "service_role";



GRANT ALL ON FUNCTION "public"."recalculate_user_points"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."recalculate_user_points"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."recalculate_user_points"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."recompute_all_user_points"() TO "anon";
GRANT ALL ON FUNCTION "public"."recompute_all_user_points"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."recompute_all_user_points"() TO "service_role";



GRANT ALL ON FUNCTION "public"."recompute_user_points"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."recompute_user_points"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."recompute_user_points"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."record_team_achievement"("p_team_id" "uuid", "p_achievement_type" "text", "p_title" "text", "p_description" "text", "p_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."record_team_achievement"("p_team_id" "uuid", "p_achievement_type" "text", "p_title" "text", "p_description" "text", "p_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_team_achievement"("p_team_id" "uuid", "p_achievement_type" "text", "p_title" "text", "p_description" "text", "p_metadata" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_acwr_daily_all_teams"("p_days_back" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_acwr_daily_all_teams"("p_days_back" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_acwr_daily_all_teams"("p_days_back" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_acwr_daily_all_teams"("p_as_of" "date", "p_min_days" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_acwr_daily_all_teams"("p_as_of" "date", "p_min_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_acwr_daily_all_teams"("p_as_of" "date", "p_min_days" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_acwr_daily_for_team"("p_team_id" "uuid", "p_as_of" "date", "p_min_days" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_acwr_daily_for_team"("p_team_id" "uuid", "p_as_of" "date", "p_min_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_acwr_daily_for_team"("p_team_id" "uuid", "p_as_of" "date", "p_min_days" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_metabolism_snapshot_from_inbody"("p_user_id" "uuid", "p_record_date" "date", "p_activity_level" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_metabolism_snapshot_from_inbody"("p_user_id" "uuid", "p_record_date" "date", "p_activity_level" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_metabolism_snapshot_from_inbody"("p_user_id" "uuid", "p_record_date" "date", "p_activity_level" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."reject_athlete_transfer"("request_id" "uuid", "reviewer_user_id" "uuid", "notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."reject_athlete_transfer"("request_id" "uuid", "reviewer_user_id" "uuid", "notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reject_athlete_transfer"("request_id" "uuid", "reviewer_user_id" "uuid", "notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."reject_team_access_request"("request_id" "uuid", "reviewer_user_id" "uuid", "notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."reject_team_access_request"("request_id" "uuid", "reviewer_user_id" "uuid", "notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reject_team_access_request"("request_id" "uuid", "reviewer_user_id" "uuid", "notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."remove_user_from_team"("p_user_id" "uuid", "p_team_id" "uuid", "p_organization_id" "uuid", "p_assignment_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."remove_user_from_team"("p_user_id" "uuid", "p_team_id" "uuid", "p_organization_id" "uuid", "p_assignment_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."remove_user_from_team"("p_user_id" "uuid", "p_team_id" "uuid", "p_organization_id" "uuid", "p_assignment_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."staff_team_links_set_org_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."staff_team_links_set_org_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."staff_team_links_set_org_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_acwr_columns"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_acwr_columns"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_acwr_columns"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_inbody_autolink_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_inbody_autolink_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_inbody_autolink_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_link_inbody_on_phone_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_link_inbody_on_phone_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_link_inbody_on_phone_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_refresh_metabolism_on_inbody_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_refresh_metabolism_on_inbody_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_refresh_metabolism_on_inbody_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_users_link_inbody_by_phone"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_users_link_inbody_by_phone"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_users_link_inbody_by_phone"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_users_phone_link_inbody"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_users_phone_link_inbody"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_users_phone_link_inbody"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_athlete_team"("athlete_id" "uuid", "new_team_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."update_athlete_team"("athlete_id" "uuid", "new_team_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_athlete_team"("athlete_id" "uuid", "new_team_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_athlete_transfer_requests_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_athlete_transfer_requests_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_athlete_transfer_requests_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_bbt_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_bbt_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_bbt_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_engine_state_on_event"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_engine_state_on_event"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_engine_state_on_event"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_goal_progress_from_performance"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_goal_progress_from_performance"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_goal_progress_from_performance"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_injury_records_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_injury_records_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_injury_records_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_menstrual_cycles_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_menstrual_cycles_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_menstrual_cycles_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_messages_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_messages_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_messages_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_performance_records_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_performance_records_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_performance_records_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_report_templates_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_report_templates_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_report_templates_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_scheduled_reports_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_scheduled_reports_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_scheduled_reports_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_team_access_requests_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_team_access_requests_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_team_access_requests_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_team_member_assignment_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_team_member_assignment_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_team_member_assignment_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_thread_last_message"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_thread_last_message"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_thread_last_message"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_tutorial_progress_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_tutorial_progress_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_tutorial_progress_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_streak"("p_user_id" "uuid", "p_streak_type" "text", "p_record_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_streak"("p_user_id" "uuid", "p_streak_type" "text", "p_record_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_streak"("p_user_id" "uuid", "p_streak_type" "text", "p_record_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_reflection"("p_reflection_date" "date", "p_did" "text", "p_didnt" "text", "p_cause_tags" "text"[], "p_next_action" "text", "p_free_note" "text", "p_metadata" "jsonb", "p_award" boolean, "p_award_points" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_reflection"("p_reflection_date" "date", "p_did" "text", "p_didnt" "text", "p_cause_tags" "text"[], "p_next_action" "text", "p_free_note" "text", "p_metadata" "jsonb", "p_award" boolean, "p_award_points" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_reflection"("p_reflection_date" "date", "p_did" "text", "p_didnt" "text", "p_cause_tags" "text"[], "p_next_action" "text", "p_free_note" "text", "p_metadata" "jsonb", "p_award" boolean, "p_award_points" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."verify_invitation_token"("p_token_hash" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."verify_invitation_token"("p_token_hash" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."verify_invitation_token"("p_token_hash" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."verify_invitation_token"("p_token_hash" "text") TO "authenticated";



GRANT ALL ON TABLE "public"."achievement_milestones" TO "anon";
GRANT ALL ON TABLE "public"."achievement_milestones" TO "authenticated";
GRANT ALL ON TABLE "public"."achievement_milestones" TO "service_role";



GRANT ALL ON TABLE "public"."ai_summaries" TO "anon";
GRANT ALL ON TABLE "public"."ai_summaries" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_summaries" TO "service_role";



GRANT ALL ON TABLE "public"."alerts" TO "anon";
GRANT ALL ON TABLE "public"."alerts" TO "authenticated";
GRANT ALL ON TABLE "public"."alerts" TO "service_role";



GRANT ALL ON TABLE "public"."athlete_activity_level_daily" TO "anon";
GRANT ALL ON TABLE "public"."athlete_activity_level_daily" TO "authenticated";
GRANT ALL ON TABLE "public"."athlete_activity_level_daily" TO "service_role";



GRANT ALL ON TABLE "public"."athlete_acwr_daily" TO "anon";
GRANT ALL ON TABLE "public"."athlete_acwr_daily" TO "authenticated";
GRANT ALL ON TABLE "public"."athlete_acwr_daily" TO "service_role";



GRANT ALL ON TABLE "public"."athlete_transfer_requests" TO "anon";
GRANT ALL ON TABLE "public"."athlete_transfer_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."athlete_transfer_requests" TO "service_role";



GRANT ALL ON TABLE "public"."badges" TO "anon";
GRANT ALL ON TABLE "public"."badges" TO "authenticated";
GRANT ALL ON TABLE "public"."badges" TO "service_role";



GRANT ALL ON TABLE "public"."basal_body_temperature" TO "anon";
GRANT ALL ON TABLE "public"."basal_body_temperature" TO "authenticated";
GRANT ALL ON TABLE "public"."basal_body_temperature" TO "service_role";



GRANT ALL ON TABLE "public"."coach_comments" TO "anon";
GRANT ALL ON TABLE "public"."coach_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."coach_comments" TO "service_role";



GRANT ALL ON TABLE "public"."daily_energy_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."daily_energy_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_energy_snapshots" TO "service_role";



GRANT ALL ON TABLE "public"."daily_reflections" TO "anon";
GRANT ALL ON TABLE "public"."daily_reflections" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_reflections" TO "service_role";



GRANT ALL ON TABLE "public"."data_sharing_settings" TO "anon";
GRANT ALL ON TABLE "public"."data_sharing_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."data_sharing_settings" TO "service_role";



GRANT ALL ON TABLE "public"."department_managers" TO "anon";
GRANT ALL ON TABLE "public"."department_managers" TO "authenticated";
GRANT ALL ON TABLE "public"."department_managers" TO "service_role";



GRANT ALL ON TABLE "public"."departments" TO "anon";
GRANT ALL ON TABLE "public"."departments" TO "authenticated";
GRANT ALL ON TABLE "public"."departments" TO "service_role";



GRANT ALL ON TABLE "public"."email_logs" TO "anon";
GRANT ALL ON TABLE "public"."email_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."email_logs" TO "service_role";



GRANT ALL ON TABLE "public"."engine_events" TO "anon";
GRANT ALL ON TABLE "public"."engine_events" TO "authenticated";
GRANT ALL ON TABLE "public"."engine_events" TO "service_role";



GRANT ALL ON TABLE "public"."engine_states" TO "anon";
GRANT ALL ON TABLE "public"."engine_states" TO "authenticated";
GRANT ALL ON TABLE "public"."engine_states" TO "service_role";



GRANT ALL ON TABLE "public"."events" TO "anon";
GRANT ALL ON TABLE "public"."events" TO "authenticated";
GRANT ALL ON TABLE "public"."events" TO "service_role";



GRANT ALL ON TABLE "public"."ftt_events" TO "anon";
GRANT ALL ON TABLE "public"."ftt_events" TO "authenticated";
GRANT ALL ON TABLE "public"."ftt_events" TO "service_role";



GRANT ALL ON TABLE "public"."ftt_records" TO "anon";
GRANT ALL ON TABLE "public"."ftt_records" TO "authenticated";
GRANT ALL ON TABLE "public"."ftt_records" TO "service_role";



GRANT ALL ON TABLE "public"."generated_reports" TO "anon";
GRANT ALL ON TABLE "public"."generated_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."generated_reports" TO "service_role";



GRANT ALL ON TABLE "public"."inbody_records" TO "anon";
GRANT ALL ON TABLE "public"."inbody_records" TO "authenticated";
GRANT ALL ON TABLE "public"."inbody_records" TO "service_role";



GRANT ALL ON TABLE "public"."injury_records" TO "anon";
GRANT ALL ON TABLE "public"."injury_records" TO "authenticated";
GRANT ALL ON TABLE "public"."injury_records" TO "service_role";



GRANT ALL ON TABLE "public"."injury_risk_assessments" TO "anon";
GRANT ALL ON TABLE "public"."injury_risk_assessments" TO "authenticated";
GRANT ALL ON TABLE "public"."injury_risk_assessments" TO "service_role";



GRANT ALL ON TABLE "public"."invitation_tokens" TO "anon";
GRANT ALL ON TABLE "public"."invitation_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."invitation_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."menstrual_cycles" TO "anon";
GRANT ALL ON TABLE "public"."menstrual_cycles" TO "authenticated";
GRANT ALL ON TABLE "public"."menstrual_cycles" TO "service_role";



GRANT ALL ON TABLE "public"."message_threads" TO "anon";
GRANT ALL ON TABLE "public"."message_threads" TO "authenticated";
GRANT ALL ON TABLE "public"."message_threads" TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON TABLE "public"."motivation_records" TO "anon";
GRANT ALL ON TABLE "public"."motivation_records" TO "authenticated";
GRANT ALL ON TABLE "public"."motivation_records" TO "service_role";



GRANT ALL ON TABLE "public"."nutrition_daily" TO "anon";
GRANT ALL ON TABLE "public"."nutrition_daily" TO "authenticated";
GRANT ALL ON TABLE "public"."nutrition_daily" TO "service_role";



GRANT ALL ON TABLE "public"."nutrition_logs" TO "anon";
GRANT ALL ON TABLE "public"."nutrition_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."nutrition_logs" TO "service_role";



GRANT ALL ON TABLE "public"."nutrition_daily_intakes_v" TO "anon";
GRANT ALL ON TABLE "public"."nutrition_daily_intakes_v" TO "authenticated";
GRANT ALL ON TABLE "public"."nutrition_daily_intakes_v" TO "service_role";



GRANT ALL ON TABLE "public"."nutrition_daily_reports" TO "anon";
GRANT ALL ON TABLE "public"."nutrition_daily_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."nutrition_daily_reports" TO "service_role";



GRANT ALL ON TABLE "public"."nutrition_metabolism_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."nutrition_metabolism_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."nutrition_metabolism_snapshots" TO "service_role";



GRANT ALL ON TABLE "public"."nutrition_metabolism_7d_avg" TO "anon";
GRANT ALL ON TABLE "public"."nutrition_metabolism_7d_avg" TO "authenticated";
GRANT ALL ON TABLE "public"."nutrition_metabolism_7d_avg" TO "service_role";



GRANT ALL ON TABLE "public"."nutrition_plans" TO "anon";
GRANT ALL ON TABLE "public"."nutrition_plans" TO "authenticated";
GRANT ALL ON TABLE "public"."nutrition_plans" TO "service_role";



GRANT ALL ON TABLE "public"."nutrition_targets_daily" TO "anon";
GRANT ALL ON TABLE "public"."nutrition_targets_daily" TO "authenticated";
GRANT ALL ON TABLE "public"."nutrition_targets_daily" TO "service_role";



GRANT ALL ON TABLE "public"."organization_members" TO "anon";
GRANT ALL ON TABLE "public"."organization_members" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_members" TO "service_role";



GRANT ALL ON TABLE "public"."organizations" TO "anon";
GRANT ALL ON TABLE "public"."organizations" TO "authenticated";
GRANT ALL ON TABLE "public"."organizations" TO "service_role";



GRANT ALL ON TABLE "public"."performance_categories" TO "anon";
GRANT ALL ON TABLE "public"."performance_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."performance_categories" TO "service_role";



GRANT ALL ON TABLE "public"."performance_records" TO "anon";
GRANT ALL ON TABLE "public"."performance_records" TO "authenticated";
GRANT ALL ON TABLE "public"."performance_records" TO "service_role";



GRANT ALL ON TABLE "public"."performance_test_types" TO "anon";
GRANT ALL ON TABLE "public"."performance_test_types" TO "authenticated";
GRANT ALL ON TABLE "public"."performance_test_types" TO "service_role";



GRANT ALL ON TABLE "public"."performance_test_types_backup" TO "anon";
GRANT ALL ON TABLE "public"."performance_test_types_backup" TO "authenticated";
GRANT ALL ON TABLE "public"."performance_test_types_backup" TO "service_role";



GRANT ALL ON TABLE "public"."personal_bests" TO "anon";
GRANT ALL ON TABLE "public"."personal_bests" TO "authenticated";
GRANT ALL ON TABLE "public"."personal_bests" TO "service_role";



GRANT ALL ON TABLE "public"."point_transactions" TO "anon";
GRANT ALL ON TABLE "public"."point_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."point_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."push_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."reflections" TO "anon";
GRANT ALL ON TABLE "public"."reflections" TO "authenticated";
GRANT ALL ON TABLE "public"."reflections" TO "service_role";



GRANT ALL ON TABLE "public"."report_configs" TO "anon";
GRANT ALL ON TABLE "public"."report_configs" TO "authenticated";
GRANT ALL ON TABLE "public"."report_configs" TO "service_role";



GRANT ALL ON TABLE "public"."report_history" TO "anon";
GRANT ALL ON TABLE "public"."report_history" TO "authenticated";
GRANT ALL ON TABLE "public"."report_history" TO "service_role";



GRANT ALL ON TABLE "public"."report_schedules" TO "anon";
GRANT ALL ON TABLE "public"."report_schedules" TO "authenticated";
GRANT ALL ON TABLE "public"."report_schedules" TO "service_role";



GRANT ALL ON TABLE "public"."report_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."report_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."report_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."report_templates" TO "anon";
GRANT ALL ON TABLE "public"."report_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."report_templates" TO "service_role";



GRANT ALL ON TABLE "public"."scheduled_reports" TO "anon";
GRANT ALL ON TABLE "public"."scheduled_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."scheduled_reports" TO "service_role";



GRANT ALL ON TABLE "public"."shared_reports" TO "anon";
GRANT ALL ON TABLE "public"."shared_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."shared_reports" TO "service_role";



GRANT ALL ON TABLE "public"."sleep_records" TO "anon";
GRANT ALL ON TABLE "public"."sleep_records" TO "authenticated";
GRANT ALL ON TABLE "public"."sleep_records" TO "service_role";



GRANT ALL ON TABLE "public"."staff_team_athletes_with_activity" TO "anon";
GRANT ALL ON TABLE "public"."staff_team_athletes_with_activity" TO "authenticated";
GRANT ALL ON TABLE "public"."staff_team_athletes_with_activity" TO "service_role";



GRANT ALL ON TABLE "public"."staff_team_links" TO "anon";
GRANT ALL ON TABLE "public"."staff_team_links" TO "authenticated";
GRANT ALL ON TABLE "public"."staff_team_links" TO "service_role";



GRANT ALL ON TABLE "public"."team_access_requests" TO "anon";
GRANT ALL ON TABLE "public"."team_access_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."team_access_requests" TO "service_role";



GRANT ALL ON TABLE "public"."team_achievement_notifications" TO "anon";
GRANT ALL ON TABLE "public"."team_achievement_notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."team_achievement_notifications" TO "service_role";



GRANT ALL ON TABLE "public"."team_achievements" TO "anon";
GRANT ALL ON TABLE "public"."team_achievements" TO "authenticated";
GRANT ALL ON TABLE "public"."team_achievements" TO "service_role";



GRANT ALL ON TABLE "public"."team_acwr_daily" TO "anon";
GRANT ALL ON TABLE "public"."team_acwr_daily" TO "authenticated";
GRANT ALL ON TABLE "public"."team_acwr_daily" TO "service_role";



GRANT ALL ON TABLE "public"."team_assignment_history" TO "anon";
GRANT ALL ON TABLE "public"."team_assignment_history" TO "authenticated";
GRANT ALL ON TABLE "public"."team_assignment_history" TO "service_role";



GRANT ALL ON TABLE "public"."team_member_assignments" TO "anon";
GRANT ALL ON TABLE "public"."team_member_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."team_member_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."user_points" TO "anon";
GRANT ALL ON TABLE "public"."user_points" TO "authenticated";
GRANT ALL ON TABLE "public"."user_points" TO "service_role";



GRANT ALL ON SEQUENCE "public"."users_user_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."users_user_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."users_user_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON TABLE "public"."team_points_rankings" TO "anon";
GRANT ALL ON TABLE "public"."team_points_rankings" TO "authenticated";
GRANT ALL ON TABLE "public"."team_points_rankings" TO "service_role";



GRANT ALL ON TABLE "public"."training_records" TO "anon";
GRANT ALL ON TABLE "public"."training_records" TO "authenticated";
GRANT ALL ON TABLE "public"."training_records" TO "service_role";



GRANT ALL ON TABLE "public"."team_training_daily" TO "anon";
GRANT ALL ON TABLE "public"."team_training_daily" TO "authenticated";
GRANT ALL ON TABLE "public"."team_training_daily" TO "service_role";



GRANT ALL ON TABLE "public"."team_transfer_history" TO "anon";
GRANT ALL ON TABLE "public"."team_transfer_history" TO "authenticated";
GRANT ALL ON TABLE "public"."team_transfer_history" TO "service_role";



GRANT ALL ON TABLE "public"."team_users_union" TO "anon";
GRANT ALL ON TABLE "public"."team_users_union" TO "authenticated";
GRANT ALL ON TABLE "public"."team_users_union" TO "service_role";



GRANT ALL ON TABLE "public"."team_weekly_rankings" TO "anon";
GRANT ALL ON TABLE "public"."team_weekly_rankings" TO "authenticated";
GRANT ALL ON TABLE "public"."team_weekly_rankings" TO "service_role";



GRANT ALL ON TABLE "public"."teams" TO "anon";
GRANT ALL ON TABLE "public"."teams" TO "authenticated";
GRANT ALL ON TABLE "public"."teams" TO "service_role";



GRANT ALL ON TABLE "public"."tutorial_progress" TO "anon";
GRANT ALL ON TABLE "public"."tutorial_progress" TO "authenticated";
GRANT ALL ON TABLE "public"."tutorial_progress" TO "service_role";



GRANT ALL ON TABLE "public"."user_badges" TO "anon";
GRANT ALL ON TABLE "public"."user_badges" TO "authenticated";
GRANT ALL ON TABLE "public"."user_badges" TO "service_role";



GRANT ALL ON TABLE "public"."weight_records" TO "anon";
GRANT ALL ON TABLE "public"."weight_records" TO "authenticated";
GRANT ALL ON TABLE "public"."weight_records" TO "service_role";



GRANT ALL ON TABLE "public"."user_daily_flags_jst" TO "anon";
GRANT ALL ON TABLE "public"."user_daily_flags_jst" TO "authenticated";
GRANT ALL ON TABLE "public"."user_daily_flags_jst" TO "service_role";



GRANT ALL ON TABLE "public"."user_goals" TO "anon";
GRANT ALL ON TABLE "public"."user_goals" TO "authenticated";
GRANT ALL ON TABLE "public"."user_goals" TO "service_role";



GRANT ALL ON TABLE "public"."user_phone_links" TO "anon";
GRANT ALL ON TABLE "public"."user_phone_links" TO "authenticated";
GRANT ALL ON TABLE "public"."user_phone_links" TO "service_role";



GRANT ALL ON TABLE "public"."user_streaks" TO "anon";
GRANT ALL ON TABLE "public"."user_streaks" TO "authenticated";
GRANT ALL ON TABLE "public"."user_streaks" TO "service_role";



GRANT ALL ON TABLE "public"."user_team_memberships" TO "anon";
GRANT ALL ON TABLE "public"."user_team_memberships" TO "authenticated";
GRANT ALL ON TABLE "public"."user_team_memberships" TO "service_role";



GRANT ALL ON TABLE "public"."v_ftt_save_rate_daily" TO "anon";
GRANT ALL ON TABLE "public"."v_ftt_save_rate_daily" TO "authenticated";
GRANT ALL ON TABLE "public"."v_ftt_save_rate_daily" TO "service_role";



GRANT ALL ON TABLE "public"."v_inbody_link_candidates" TO "anon";
GRANT ALL ON TABLE "public"."v_inbody_link_candidates" TO "authenticated";
GRANT ALL ON TABLE "public"."v_inbody_link_candidates" TO "service_role";



GRANT ALL ON TABLE "public"."v_staff_team_athletes" TO "anon";
GRANT ALL ON TABLE "public"."v_staff_team_athletes" TO "authenticated";
GRANT ALL ON TABLE "public"."v_staff_team_athletes" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







