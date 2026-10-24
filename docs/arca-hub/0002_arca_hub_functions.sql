-- =====================================================================
-- ARCA 中央DB（②）  取込関数とトリガー
--  ・LookinBody API の生 JSON → arca.inbody_tests / arca.persons
--  ・PHYSICAL LAB の users / inbody_records / inbody_pending から自動で流し込む
--  ・失敗しても元の INSERT/UPDATE は止めず、arca.ingest_log に記録する
-- =====================================================================

-- ---------- 小道具 ----------------------------------------------------
create or replace function arca.num(t text) returns numeric
language plpgsql immutable as $$
begin
  return nullif(trim(t), '')::numeric;
exception when others then
  return null;
end $$;

create or replace function arca.to_date_safe(t text) returns date
language plpgsql immutable as $$
begin
  return nullif(trim(t), '')::date;
exception when others then
  return null;
end $$;

-- '2026-04-13 00:00:00.000' のような日本時間の文字列 → timestamptz
create or replace function arca.to_ts_jst_safe(t text) returns timestamptz
language plpgsql immutable as $$
begin
  return (nullif(trim(t), '')::timestamp) at time zone 'Asia/Tokyo';
exception when others then
  return null;
end $$;

-- 電話番号を数字だけにそろえる（+81 → 0）
create or replace function arca.normalize_phone(p text) returns text
language plpgsql immutable as $$
declare s text;
begin
  if p is null then return null; end if;
  s := regexp_replace(p, '[^0-9]', '', 'g');
  if s = '' then return null; end if;
  if s ~ '^81[1-9]' and length(s) >= 12 then
    return '0' || substr(s, 3);
  end if;
  return s;
end $$;

-- 'YYYYMMDDHHMMSS' / 'YYYYMMDD'（日本時間） → timestamptz
create or replace function arca.parse_test_key(k text) returns timestamptz
language plpgsql immutable as $$
begin
  if k ~ '^[0-9]{14}$' then
    return make_timestamptz(substr(k,1,4)::int, substr(k,5,2)::int, substr(k,7,2)::int,
                            substr(k,9,2)::int, substr(k,11,2)::int, substr(k,13,2)::numeric, 'Asia/Tokyo');
  elsif k ~ '^[0-9]{8}$' then
    return make_timestamptz(substr(k,1,4)::int, substr(k,5,2)::int, substr(k,7,2)::int, 0, 0, 0, 'Asia/Tokyo');
  end if;
  return null;
exception when others then
  return null;
end $$;

create or replace function arca.map_gender(g text) returns text
language sql immutable as $$
  select case lower(coalesce(trim(g), ''))
           when 'm' then 'M' when 'male' then 'M' when '男' then 'M' when '男性' then 'M'
           when 'f' then 'F' when 'female' then 'F' when '女' then 'F' when '女性' then 'F'
           else null end $$;

-- ---------- 人の upsert -----------------------------------------------
-- 探す順番: lookinbody_id → mobile_number → 新規作成
-- 既にある値は消さない（null で上書きしない）。名前はアプリ側（漢字）を優先。
create or replace function arca.upsert_person(
  p_lookinbody_id text,
  p_mobile        text,
  p_name          text,     -- アプリ側の表示名（漢字）
  p_inbody_name   text,     -- InBody 登録名（カナ）
  p_gender        text,
  p_birth         date,
  p_height        numeric,
  p_email         text,
  p_registered    timestamptz
) returns uuid
language plpgsql security definer set search_path = arca, public as $$
declare
  v_id     uuid;
  v_lk     text := nullif(trim(p_lookinbody_id), '');
  v_mobile text := arca.normalize_phone(p_mobile);
  v_gender text := arca.map_gender(p_gender);
  v_name   text := nullif(trim(p_name), '');
  v_iname  text := nullif(trim(p_inbody_name), '');
  v_email  text := nullif(trim(p_email), '');
begin
  if v_lk is not null then
    select id into v_id from arca.persons where lookinbody_id = v_lk and merged_into is null;
  end if;
  if v_id is null and v_mobile is not null then
    select id into v_id from arca.persons
     where mobile_number = v_mobile and merged_into is null
     order by (lookinbody_id is null) desc, created_at
     limit 1;
  end if;

  if v_id is null then
    insert into arca.persons (lookinbody_id, mobile_number, name, inbody_name, gender, birth_date, height_cm, email, inbody_registered_at)
    values (v_lk, v_mobile, coalesce(v_name, v_iname), v_iname, v_gender, p_birth, p_height, v_email, p_registered)
    returning id into v_id;
  else
    update arca.persons set
      lookinbody_id        = coalesce(lookinbody_id, v_lk),
      mobile_number        = coalesce(mobile_number, v_mobile),
      name                 = coalesce(v_name, name, v_iname),
      inbody_name          = coalesce(v_iname, inbody_name),
      gender               = coalesce(gender, v_gender),
      birth_date           = coalesce(birth_date, p_birth),
      height_cm            = coalesce(p_height, height_cm),
      email                = coalesce(email, v_email),
      inbody_registered_at = coalesce(inbody_registered_at, p_registered)
    where id = v_id;
  end if;
  return v_id;
end $$;

-- ---------- アプリユーザーとの対応 -----------------------------------
-- 矛盾（同じユーザーが別人に、同じ人が別ユーザーに既に結ばれている）は
-- 自動で付け替えず、warn として記録する。
create or replace function arca.ensure_app_link(
  p_app text, p_person uuid, p_app_user_id text, p_conf text default 'exact'
) returns uuid
language plpgsql security definer set search_path = arca, public as $$
declare
  v_id uuid; v_person uuid; v_user text;
begin
  if p_person is null or p_app_user_id is null then return null; end if;

  select id, person_id into v_id, v_person
    from arca.app_links where app_key = p_app and app_user_id = p_app_user_id and unlinked_at is null;
  if v_id is not null then
    if v_person = p_person then return v_id; end if;
    insert into arca.ingest_log (level, action, person_id, message, payload)
    values ('warn', 'link_conflict_user', p_person,
            format('%s のユーザー %s は既に別の人 %s に結ばれている', p_app, p_app_user_id, v_person),
            jsonb_build_object('app', p_app, 'app_user_id', p_app_user_id, 'existing_person', v_person, 'new_person', p_person));
    return null;
  end if;

  select id, app_user_id into v_id, v_user
    from arca.app_links where app_key = p_app and person_id = p_person and unlinked_at is null;
  if v_id is not null then
    insert into arca.ingest_log (level, action, person_id, message, payload)
    values ('warn', 'link_conflict_person', p_person,
            format('人 %s は既に %s の別ユーザー %s に結ばれている', p_person, p_app, v_user),
            jsonb_build_object('app', p_app, 'app_user_id', p_app_user_id, 'existing_user', v_user));
    return null;
  end if;

  insert into arca.app_links (person_id, app_key, app_user_id, confidence)
  values (p_person, p_app, p_app_user_id, p_conf)
  returning id into v_id;
  return v_id;
end $$;

-- PHYSICAL LAB の users 行 → 人（無ければ作る）と対応付け
create or replace function arca.person_for_app_user(u public.users) returns uuid
language plpgsql security definer set search_path = arca, public as $$
declare
  v_person uuid;
  v_mobile text := arca.normalize_phone(coalesce(nullif(u.phone, ''), u.inbody_member_id));
begin
  select person_id into v_person
    from arca.app_links where app_key = 'physical_lab' and app_user_id = u.id::text and unlinked_at is null;

  if v_person is null then
    v_person := arca.upsert_person(u.inbody_member_id, v_mobile, u.name, null, u.gender, u.date_of_birth, u.height_cm, u.email, null);
    perform arca.ensure_app_link('physical_lab', v_person, u.id::text, 'exact');
  else
    begin
      update arca.persons set
        name          = coalesce(nullif(trim(u.name), ''), name),
        gender        = coalesce(gender, arca.map_gender(u.gender)),
        birth_date    = coalesce(birth_date, u.date_of_birth),
        height_cm     = coalesce(height_cm, u.height_cm),
        email         = coalesce(email, nullif(trim(u.email), '')),
        lookinbody_id = coalesce(lookinbody_id, nullif(trim(u.inbody_member_id), '')),
        mobile_number = coalesce(mobile_number, v_mobile)
      where id = v_person;
    exception when unique_violation then
      insert into arca.ingest_log (level, action, person_id, message, payload)
      values ('warn', 'person_update_conflict', v_person, sqlerrm, jsonb_build_object('user_id', u.id, 'inbody_member_id', u.inbody_member_id));
    end;
  end if;
  return v_person;
end $$;

-- ---------- LookinBody API の生 JSON を取り込む -----------------------
create or replace function arca.ingest_lookinbody_raw(
  p_raw jsonb, p_source text default 'lookinbody_api', p_origin_table text default null, p_origin_id uuid default null
) returns uuid
language plpgsql security definer set search_path = arca, public as $$
declare
  v_lk      text := nullif(trim(p_raw->>'ID'), '');
  v_mobile  text := arca.normalize_phone(p_raw->>'MobileNumber');
  v_key     text := nullif(trim(p_raw->>'TestDate/Time'), '');
  v_at      timestamptz;
  v_on      date;
  v_person  uuid;
  v_test    uuid;
  v_new     boolean := false;
  v_eval    jsonb;
  v_ranges  jsonb;
  v_h       numeric := arca.num(p_raw->>'Height');
  v_w       numeric := arca.num(p_raw->>'Weight');
  v_ffm     numeric := arca.num(p_raw->>'FFM(FatFreeMass)');
  v_smm     numeric := arca.num(p_raw->>'SMM(SkeletalMuscleMass)');
begin
  if v_key is null or v_key !~ '^[0-9]{14}$' then
    raise exception 'TestDate/Time が不正: %', v_key;
  end if;
  if v_lk is null and v_mobile is null then
    raise exception 'ID も MobileNumber も無い';
  end if;
  v_at := arca.parse_test_key(v_key);
  v_on := (v_at at time zone 'Asia/Tokyo')::date;

  v_person := arca.upsert_person(
    coalesce(v_lk, v_mobile), v_mobile, null, p_raw->>'Name', p_raw->>'Gender',
    arca.to_date_safe(p_raw->>'DateofBirth'), v_h, p_raw->>'E-mail',
    arca.to_ts_jst_safe(p_raw->>'DateofRegistration'));

  -- 判定（Evaluation(...)）
  select jsonb_object_agg(regexp_replace(key, '^Evaluation\((.*)\)$', '\1'), value)
    into v_eval
    from jsonb_each_text(p_raw)
   where key like 'Evaluation(%' and nullif(trim(value), '') is not null;

  -- 標準範囲（LowerLimit(...NormalRange) / UpperLimit(...NormalRange)）
  select jsonb_object_agg(m, jsonb_build_object('low', lo, 'high', hi))
    into v_ranges
    from (
      select m,
             arca.num(max(value) filter (where side = 'Lower')) as lo,
             arca.num(max(value) filter (where side = 'Upper')) as hi
        from (
          select regexp_replace(key, '^(Lower|Upper)Limit\((.*)NormalRange\)$', '\2') as m,
                 regexp_replace(key, '^(Lower|Upper)Limit\(.*$', '\1') as side,
                 value
            from jsonb_each_text(p_raw)
           where key ~ '^(Lower|Upper)Limit\(.*NormalRange\)$'
        ) s
       group by m
    ) r;

  select id into v_test from arca.inbody_tests where person_id = v_person and test_key = v_key;
  if v_test is null then
    -- 同じ日の「時刻不明の旧行」があれば、その行を昇格させて ID を保つ
    select id into v_test from arca.inbody_tests
     where person_id = v_person and tested_on = v_on and time_known = false
     order by created_at limit 1;
  end if;
  if v_test is null then
    insert into arca.inbody_tests (person_id, test_key, tested_at, tested_on, time_known, source, origin_table, origin_id)
    values (v_person, v_key, v_at, v_on, true, p_source, p_origin_table, p_origin_id)
    returning id into v_test;
    v_new := true;
  end if;

  update arca.inbody_tests set
    lookinbody_id        = v_lk,
    test_key             = v_key,
    tested_at            = v_at,
    tested_on            = v_on,
    time_known           = true,
    source               = p_source,
    equip_serial         = nullif(p_raw->>'Serial', ''),
    inbody_type          = nullif(p_raw->>'InBodyType', ''),
    name_at_test         = nullif(trim(p_raw->>'Name'), ''),
    gender               = arca.map_gender(p_raw->>'Gender'),
    age_at_test          = arca.num(p_raw->>'Age'),
    height_cm            = v_h,
    weight_kg            = v_w,
    bmi                  = arca.num(p_raw->>'BMI(BodyMassIndex)'),
    pbf_pct              = arca.num(p_raw->>'PBF(PercentBodyFat)'),
    bfm_kg               = arca.num(p_raw->>'BFM(BodyFatMass)'),
    ffm_kg               = v_ffm,
    smm_kg               = v_smm,
    slm_kg               = arca.num(p_raw->>'SLM(SoftLeanMass)'),
    tbw_kg               = arca.num(p_raw->>'TBW(TotalBodyWater)'),
    protein_kg           = arca.num(p_raw->>'Protein'),
    minerals_kg          = arca.num(p_raw->>'Minerals'),
    bmc_kg               = arca.num(p_raw->>'BMC(BoneMineralContent)'),
    bmr_kcal             = arca.num(p_raw->>'BMR(BasalMetabolicRate)'),
    smi                  = arca.num(p_raw->>'SMI(SkeletalMuscleIndex)'),
    ffmi                 = case when v_ffm is not null and v_h > 0 then round(v_ffm / ((v_h / 100) ^ 2), 2) end,
    skeletal_muscle_rate = case when v_smm is not null and v_w > 0 then round(v_smm / v_w, 3) end,
    inbody_score         = arca.num(p_raw->>'InBodyScore'),
    growth_score         = arca.num(p_raw->>'GrowthScore'),
    obesity_degree       = arca.num(p_raw->>'ObesityDegree'),
    obesity_degree_child = arca.num(p_raw->>'ObesityDegreeofaChild'),
    vfl                  = arca.num(p_raw->>'VFL(VisceralFatLevel)'),
    whr                  = arca.num(p_raw->>'WHR(Waist-HipRatio)'),
    target_weight_kg     = arca.num(p_raw->>'TargetWeight'),
    weight_control_kg    = arca.num(p_raw->>'WeightControl'),
    bfm_control_kg       = arca.num(p_raw->>'BFMControl'),
    ffm_control_kg       = arca.num(p_raw->>'FFMControl'),
    recommended_kcal     = arca.num(p_raw->>'RecommendedCalorieIntake'),
    clothes_weight_kg    = arca.num(p_raw->>'ClothesWeight(PT)'),
    phase_angle          = arca.num(p_raw->>'PhaseAngle'),
    ecw_tbw              = arca.num(coalesce(p_raw->>'ECW/TBW', p_raw->>'ECWRatio')),
    vfa                  = arca.num(p_raw->>'VFA(VisceralFatArea)'),
    lbm_right_arm_kg     = arca.num(p_raw->>'LBMofRightArm'),
    lbm_left_arm_kg      = arca.num(p_raw->>'LBMofLeftArm'),
    lbm_trunk_kg         = arca.num(p_raw->>'LBMofTrunk'),
    lbm_right_leg_kg     = arca.num(p_raw->>'LBMofRightLeg'),
    lbm_left_leg_kg      = arca.num(p_raw->>'LBMofLeftLeg'),
    lbm_right_arm_pct    = arca.num(p_raw->>'LBM%ofRightArm'),
    lbm_left_arm_pct     = arca.num(p_raw->>'LBM%ofLeftArm'),
    lbm_trunk_pct        = arca.num(p_raw->>'LBM%ofTrunk'),
    lbm_right_leg_pct    = arca.num(p_raw->>'LBM%ofRightLeg'),
    lbm_left_leg_pct     = arca.num(p_raw->>'LBM%ofLeftLeg'),
    bfm_right_arm_kg     = arca.num(p_raw->>'BFMofRightArm'),
    bfm_left_arm_kg      = arca.num(p_raw->>'BFMofLeftArm'),
    bfm_trunk_kg         = arca.num(p_raw->>'BFMofTrunk'),
    bfm_right_leg_kg     = arca.num(p_raw->>'BFMofRightLeg'),
    bfm_left_leg_kg      = arca.num(p_raw->>'BFMofLeftLeg'),
    bfm_right_arm_pct    = arca.num(p_raw->>'BFM%ofRightArm'),
    bfm_left_arm_pct     = arca.num(p_raw->>'BFM%ofLeftArm'),
    bfm_trunk_pct        = arca.num(p_raw->>'BFM%ofTrunk'),
    bfm_right_leg_pct    = arca.num(p_raw->>'BFM%ofRightLeg'),
    bfm_left_leg_pct     = arca.num(p_raw->>'BFM%ofLeftLeg'),
    evaluations          = v_eval,
    normal_ranges        = v_ranges,
    raw                  = p_raw,
    origin_table         = coalesce(p_origin_table, origin_table),
    origin_id            = coalesce(p_origin_id, origin_id)
  where id = v_test;

  if v_new then
    insert into arca.ingest_log (action, origin_table, origin_id, person_id, test_id)
    values ('new_test', p_origin_table, p_origin_id, v_person, v_test);
  end if;
  return v_test;
end $$;

-- ---------- PHYSICAL LAB の inbody_records（API 生 JSON 無し）を取り込む ----
create or replace function arca.ingest_app_record(r public.inbody_records) returns uuid
language plpgsql security definer set search_path = arca, public as $$
declare
  u          public.users%rowtype;
  v_person   uuid;
  v_key      text;
  v_at       timestamptz;
  v_on       date;
  v_known    boolean;
  v_src      text;
  v_test     uuid;
  v_cur_src  text;
  v_other    uuid;
  v_new      boolean := false;
  v_pbf      numeric := r.body_fat_percent;
  v_bfm      numeric;
  v_ffm      numeric;
begin
  if r.user_id is null then raise exception 'user_id が無い'; end if;
  select * into u from public.users where id = r.user_id;
  if not found then raise exception 'users に存在しない: %', r.user_id; end if;
  if r.measured_at is null then raise exception 'measured_at が無い'; end if;

  v_person := arca.person_for_app_user(u);
  v_src := case r.source when 'csv' then 'lookinbody_csv'
                         when 'lookinbody_api' then 'legacy_import'
                         else 'app_manual' end;

  if r.inbody_datetime ~ '^[0-9]{14}$' then
    v_key := r.inbody_datetime; v_known := true;
  else
    v_key := to_char(r.measured_at, 'YYYYMMDD') || '000000'; v_known := false;
  end if;
  v_at := arca.parse_test_key(v_key);
  v_on := r.measured_at;

  select id, source into v_test, v_cur_src from arca.inbody_tests where person_id = v_person and test_key = v_key;

  if v_test is null and not v_known then
    -- 同じ日に時刻付きの測定が既にあれば、日付だけの旧行は追加しない
    select id into v_other from arca.inbody_tests
     where person_id = v_person and tested_on = v_on and time_known limit 1;
    if v_other is not null then
      return v_other;
    end if;
  end if;

  if v_test is null then
    insert into arca.inbody_tests (person_id, test_key, tested_at, tested_on, time_known, source, origin_table, origin_id)
    values (v_person, v_key, v_at, v_on, v_known, v_src, 'inbody_records', r.id)
    returning id into v_test;
    v_new := true;
  elsif v_cur_src = 'lookinbody_api' then
    -- API 由来の完全なデータを、簡略データで上書きしない
    return v_test;
  end if;

  v_bfm := coalesce(r.fat_mass_kg, case when r.weight is not null and v_pbf is not null then round(r.weight * v_pbf / 100, 1) end);
  v_ffm := coalesce(r.ffm_kg, case when r.weight is not null and v_bfm is not null then round(r.weight - v_bfm, 1) end);

  update arca.inbody_tests set
    lookinbody_id        = coalesce(lookinbody_id, nullif(trim(u.inbody_member_id), '')),
    source               = v_src,
    name_at_test         = coalesce(nullif(trim(r.raw->>'name'), ''), u.name),
    gender               = coalesce(arca.map_gender(r.raw->>'sex'), arca.map_gender(u.gender)),
    age_at_test          = arca.num(r.raw->>'age'),
    height_cm            = r.height,
    weight_kg            = r.weight,
    bmi                  = coalesce(r.bmi, case when r.weight is not null and r.height > 0 then round(r.weight / ((r.height / 100) ^ 2), 1) end),
    pbf_pct              = v_pbf,
    bfm_kg               = v_bfm,
    ffm_kg               = v_ffm,
    smm_kg               = r.skeletal_muscle_kg,
    slm_kg               = r.slm_kg,
    tbw_kg               = r.tbw_kg,
    protein_kg           = r.protein_kg,
    minerals_kg          = r.minerals_kg,
    bmr_kcal             = r.bmr,
    smi                  = r.smi,
    ffmi                 = coalesce(r.ffmi, case when v_ffm is not null and r.height > 0 then round(v_ffm / ((r.height / 100) ^ 2), 2) end),
    skeletal_muscle_rate = coalesce(r.skeletal_muscle_rate, case when r.skeletal_muscle_kg is not null and r.weight > 0 then round(r.skeletal_muscle_kg / r.weight, 3) end),
    inbody_score         = r.inbody_score,
    vfa                  = r.vfa,
    phase_angle          = r.phase_angle,
    ecw_tbw              = r.ecw_tbw,
    lbm_right_arm_kg     = coalesce(r.lbm_right_arm, arca.num(r.segmental->>'right_arm')),
    lbm_left_arm_kg      = coalesce(r.lbm_left_arm,  arca.num(r.segmental->>'left_arm')),
    lbm_trunk_kg         = coalesce(r.lbm_trunk,     arca.num(r.segmental->>'trunk')),
    lbm_right_leg_kg     = coalesce(r.lbm_right_leg, arca.num(r.segmental->>'right_leg')),
    lbm_left_leg_kg      = coalesce(r.lbm_left_leg,  arca.num(r.segmental->>'left_leg')),
    raw                  = coalesce(r.raw, raw),
    origin_table         = 'inbody_records',
    origin_id            = r.id
  where id = v_test;

  if v_new then
    insert into arca.ingest_log (action, origin_table, origin_id, person_id, test_id)
    values ('new_test', 'inbody_records', r.id, v_person, v_test);
  end if;
  return v_test;
end $$;

-- ---------- トリガー（public 側の INSERT/UPDATE を止めない） -----------
create or replace function arca.trg_pending_ingest() returns trigger
language plpgsql security definer set search_path = arca, public as $$
declare v_test uuid; v_person uuid;
begin
  if new.raw is null or jsonb_typeof(new.raw) <> 'object' then return new; end if;
  begin
    v_test := arca.ingest_lookinbody_raw(new.raw, 'lookinbody_api', 'inbody_pending', new.id);
    if new.assigned_user_id is not null then
      select person_id into v_person from arca.inbody_tests where id = v_test;
      perform arca.ensure_app_link('physical_lab', v_person, new.assigned_user_id::text,
                                   case when new.resolved_by is null then 'exact' else 'manual' end);
    end if;
  exception when others then
    insert into arca.ingest_log (level, action, origin_table, origin_id, message, payload)
    values ('error', 'trg_pending_ingest', 'inbody_pending', new.id, sqlerrm, new.raw);
  end;
  return new;
end $$;

drop trigger if exists arca_pending_ingest on public.inbody_pending;
create trigger arca_pending_ingest
  after insert or update of raw, status, assigned_user_id on public.inbody_pending
  for each row execute function arca.trg_pending_ingest();

create or replace function arca.trg_records_ingest() returns trigger
language plpgsql security definer set search_path = arca, public as $$
declare v_test uuid; v_person uuid;
begin
  begin
    if new.raw is not null and jsonb_typeof(new.raw) = 'object' and new.raw ? 'TestDate/Time' then
      v_test := arca.ingest_lookinbody_raw(new.raw, 'lookinbody_api', 'inbody_records', new.id);
      if new.user_id is not null then
        select person_id into v_person from arca.inbody_tests where id = v_test;
        perform arca.ensure_app_link('physical_lab', v_person, new.user_id::text, 'exact');
      end if;
    else
      perform arca.ingest_app_record(new);
    end if;
  exception when others then
    insert into arca.ingest_log (level, action, origin_table, origin_id, message, payload)
    values ('error', 'trg_records_ingest', 'inbody_records', new.id, sqlerrm, to_jsonb(new) - 'raw');
  end;
  return new;
end $$;

drop trigger if exists arca_records_ingest on public.inbody_records;
create trigger arca_records_ingest
  after insert or update on public.inbody_records
  for each row execute function arca.trg_records_ingest();

create or replace function arca.trg_users_sync() returns trigger
language plpgsql security definer set search_path = arca, public as $$
begin
  begin
    perform arca.person_for_app_user(new);
  exception when others then
    insert into arca.ingest_log (level, action, origin_table, origin_id, message)
    values ('error', 'trg_users_sync', 'users', new.id, sqlerrm);
  end;
  return new;
end $$;

drop trigger if exists arca_users_sync on public.users;
create trigger arca_users_sync
  after insert or update of name, gender, date_of_birth, height_cm, phone, email, inbody_member_id on public.users
  for each row execute function arca.trg_users_sync();

-- ---------- 一括バックフィル（1行ずつ失敗を記録しながら） ---------------
create or replace function arca.backfill_from_physical_lab() returns table (step text, ok bigint, failed bigint)
language plpgsql security definer set search_path = arca, public as $$
declare
  u public.users; p public.inbody_pending; r public.inbody_records;
  v_ok bigint; v_ng bigint; v_test uuid; v_person uuid;
begin
  -- 1) users → persons / app_links
  v_ok := 0; v_ng := 0;
  for u in select * from public.users loop
    begin
      perform arca.person_for_app_user(u);
      v_ok := v_ok + 1;
    exception when others then
      v_ng := v_ng + 1;
      insert into arca.ingest_log (level, action, origin_table, origin_id, message)
      values ('error', 'backfill_users', 'users', u.id, sqlerrm);
    end;
  end loop;
  step := 'users'; ok := v_ok; failed := v_ng; return next;

  -- 2) inbody_pending（API 生 JSON）
  v_ok := 0; v_ng := 0;
  for p in select * from public.inbody_pending where jsonb_typeof(raw) = 'object' order by created_at loop
    begin
      v_test := arca.ingest_lookinbody_raw(p.raw, 'lookinbody_api', 'inbody_pending', p.id);
      if p.assigned_user_id is not null then
        select person_id into v_person from arca.inbody_tests where id = v_test;
        perform arca.ensure_app_link('physical_lab', v_person, p.assigned_user_id::text,
                                     case when p.resolved_by is null then 'exact' else 'manual' end);
      end if;
      v_ok := v_ok + 1;
    exception when others then
      v_ng := v_ng + 1;
      insert into arca.ingest_log (level, action, origin_table, origin_id, message, payload)
      values ('error', 'backfill_pending', 'inbody_pending', p.id, sqlerrm, p.raw);
    end;
  end loop;
  step := 'inbody_pending'; ok := v_ok; failed := v_ng; return next;

  -- 3) inbody_records のうち API 生 JSON を持つ行
  v_ok := 0; v_ng := 0;
  for r in select * from public.inbody_records where jsonb_typeof(raw) = 'object' and raw ? 'TestDate/Time' order by created_at loop
    begin
      v_test := arca.ingest_lookinbody_raw(r.raw, 'lookinbody_api', 'inbody_records', r.id);
      if r.user_id is not null then
        select person_id into v_person from arca.inbody_tests where id = v_test;
        perform arca.ensure_app_link('physical_lab', v_person, r.user_id::text, 'exact');
      end if;
      v_ok := v_ok + 1;
    exception when others then
      v_ng := v_ng + 1;
      insert into arca.ingest_log (level, action, origin_table, origin_id, message)
      values ('error', 'backfill_records_api', 'inbody_records', r.id, sqlerrm);
    end;
  end loop;
  step := 'inbody_records(api)'; ok := v_ok; failed := v_ng; return next;

  -- 4) inbody_records の残り（CSV 由来・旧フェッチャー・手入力）
  v_ok := 0; v_ng := 0;
  for r in select * from public.inbody_records where raw is null or jsonb_typeof(raw) <> 'object' or not (raw ? 'TestDate/Time') order by created_at loop
    begin
      perform arca.ingest_app_record(r);
      v_ok := v_ok + 1;
    exception when others then
      v_ng := v_ng + 1;
      insert into arca.ingest_log (level, action, origin_table, origin_id, message)
      values ('error', 'backfill_records_other', 'inbody_records', r.id, sqlerrm);
    end;
  end loop;
  step := 'inbody_records(other)'; ok := v_ok; failed := v_ng; return next;
end $$;

revoke execute on all functions in schema arca from public, anon, authenticated;
