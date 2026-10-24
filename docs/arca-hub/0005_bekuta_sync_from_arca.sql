-- =====================================================================
-- ③ Bekuta 側： ② からの同期を全指標対応に作り直す
--   実行先: Bekuta (cymnqmbdwaveccoooics) の SQL Editor
--   前提: 0004_arca_bekuta_feed.sql を ② 側で先に実行しておく
-- =====================================================================

-- 1) inbody_records に成長を追うための列を追加（既存列・既存データは変更しない）
alter table public.inbody_records
  add column if not exists fat_mass_kg           numeric,
  add column if not exists ffm_kg                numeric,
  add column if not exists skeletal_muscle_kg    numeric,
  add column if not exists slm_kg                numeric,
  add column if not exists tbw_kg                numeric,
  add column if not exists protein_kg            numeric,
  add column if not exists minerals_kg           numeric,
  add column if not exists bmc_kg                numeric,
  add column if not exists bmr                   numeric,
  add column if not exists bmi                   numeric,
  add column if not exists smi                   numeric,
  add column if not exists ffmi                  numeric,
  add column if not exists skeletal_muscle_rate  numeric,
  add column if not exists inbody_score          numeric,
  add column if not exists vfl                   numeric,
  add column if not exists whr                   numeric,
  add column if not exists obesity_degree        numeric,
  add column if not exists target_weight_kg      numeric,
  add column if not exists weight_control_kg     numeric,
  add column if not exists bfm_control_kg        numeric,
  add column if not exists ffm_control_kg        numeric,
  add column if not exists recommended_kcal      numeric,
  add column if not exists lbm_right_arm_kg  numeric, add column if not exists lbm_left_arm_kg  numeric,
  add column if not exists lbm_trunk_kg      numeric, add column if not exists lbm_right_leg_kg numeric,
  add column if not exists lbm_left_leg_kg   numeric,
  add column if not exists lbm_right_arm_pct numeric, add column if not exists lbm_left_arm_pct numeric,
  add column if not exists lbm_trunk_pct     numeric, add column if not exists lbm_right_leg_pct numeric,
  add column if not exists lbm_left_leg_pct  numeric,
  add column if not exists bfm_right_arm_kg  numeric, add column if not exists bfm_left_arm_kg  numeric,
  add column if not exists bfm_trunk_kg      numeric, add column if not exists bfm_right_leg_kg numeric,
  add column if not exists bfm_left_leg_kg   numeric,
  add column if not exists bfm_right_arm_pct numeric, add column if not exists bfm_left_arm_pct numeric,
  add column if not exists bfm_trunk_pct     numeric, add column if not exists bfm_right_leg_pct numeric,
  add column if not exists bfm_left_leg_pct  numeric,
  add column if not exists evaluations           jsonb,
  add column if not exists normal_ranges         jsonb,
  add column if not exists arca_source           text;

comment on column public.inbody_records.evaluations   is 'InBody の判定 {"PBF":"Normal","Upper":"Balanced",...}（②由来）';
comment on column public.inbody_records.normal_ranges is 'InBody の標準範囲 {"PBF":{"low":10,"high":20},...}（②由来）';
comment on column public.inbody_records.arca_source   is '②での由来: lookinbody_api / lookinbody_csv / legacy_import / app_manual';

-- 2) 同期の実行記録（毎時の結果を残す。失敗の原因もここに出る）
create table if not exists public.inbody_sync_runs (
  id                     bigint generated always as identity primary key,
  ran_at                 timestamptz not null default now(),
  feed_rows              integer,
  matched_rows           integer,
  upserted_rows          integer,
  skipped_birth_mismatch integer,
  ok                     boolean not null default true,
  error                  text,
  details                jsonb
);
alter table public.inbody_sync_runs enable row level security;
revoke all on public.inbody_sync_runs from anon, authenticated;

-- 3) 外部テーブルを ② の新しい配信ビューに差し替え
drop foreign table if exists bf_remote.v_inbody_export;
drop foreign table if exists bf_remote.v_bekuta_feed;
import foreign schema arca limit to (v_bekuta_feed) from server bf_srv into bf_remote;
revoke all on all tables in schema bf_remote from anon, authenticated;

-- 4) 同期関数を作り直す
--    ・Bekuta に電話番号を登録しているユーザーの分だけ取り込む（他人のデータは保存しない）
--    ・生年月日が両方にあって食い違う場合は取り込まない（電話番号の打ち間違い対策）
--    ・同じ日に複数回測った場合は最後の 1 回を採用（Bekuta は 1 日 1 行）
--    ・衝突は「電話番号 + 日付」で判定し、既存行（CSV 取込など）は上書きして充実させる
--    旧関数は戻り値の型が違う（integer）ため、先に削除してから作り直す
drop function if exists public.sync_inbody_from_bf();
create function public.sync_inbody_from_bf()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_feed     integer := 0;
  v_matched  integer := 0;
  v_upserted integer := 0;
  v_skipped  integer := 0;
  v_details  jsonb := '[]'::jsonb;
begin
  drop table if exists _feed, _cand;
  create temp table _feed on commit drop as
    select * from bf_remote.v_bekuta_feed;
  select count(*) into v_feed from _feed;

  -- Bekuta ユーザーの電話番号に一致する行だけ
  create temp table _cand on commit drop as
    select distinct on (f.phone_number, f.measured_at)
           f.*, u.id as matched_user_id, u.date_of_birth as user_dob
      from _feed f
      join public.users u
        on public.normalize_phone(u.phone_number) = f.phone_number
     order by f.phone_number, f.measured_at, f.measured_at_ts desc nulls last;
  select count(*) into v_matched from _cand;

  -- 生年月日が食い違う行（電話番号の打ち間違いの可能性）は取り込まず記録だけ残す
  select count(*), coalesce(jsonb_agg(distinct jsonb_build_object('phone', phone_number, 'user_id', matched_user_id)), '[]'::jsonb)
    into v_skipped, v_details
    from _cand
   where person_birth_date is not null and user_dob is not null and person_birth_date <> user_dob;

  insert into public.inbody_records as r (
    user_id, bf_record_id, phone_number, phone_number_norm, measured_at, measured_at_ts, source, arca_source,
    height, weight, body_fat_percent,
    fat_mass_kg, ffm_kg, skeletal_muscle_kg, slm_kg, tbw_kg, protein_kg, minerals_kg, bmc_kg,
    bmr, bmi, smi, ffmi, skeletal_muscle_rate, inbody_score, vfl, whr, obesity_degree,
    target_weight_kg, weight_control_kg, bfm_control_kg, ffm_control_kg, recommended_kcal,
    lbm_right_arm_kg, lbm_left_arm_kg, lbm_trunk_kg, lbm_right_leg_kg, lbm_left_leg_kg,
    lbm_right_arm_pct, lbm_left_arm_pct, lbm_trunk_pct, lbm_right_leg_pct, lbm_left_leg_pct,
    bfm_right_arm_kg, bfm_left_arm_kg, bfm_trunk_kg, bfm_right_leg_kg, bfm_left_leg_kg,
    bfm_right_arm_pct, bfm_left_arm_pct, bfm_trunk_pct, bfm_right_leg_pct, bfm_left_leg_pct,
    evaluations, normal_ranges
  )
  select
    c.matched_user_id, c.bf_record_id, c.phone_number, c.phone_number, c.measured_at,
    case when c.time_known then c.measured_at_ts else null end,
    'bf_sync', c.source,
    c.height, c.weight, c.body_fat_percent,
    c.fat_mass_kg, c.ffm_kg, c.skeletal_muscle_kg, c.slm_kg, c.tbw_kg, c.protein_kg, c.minerals_kg, c.bmc_kg,
    c.bmr, c.bmi, c.smi, c.ffmi, c.skeletal_muscle_rate, c.inbody_score, c.vfl, c.whr, c.obesity_degree,
    c.target_weight_kg, c.weight_control_kg, c.bfm_control_kg, c.ffm_control_kg, c.recommended_kcal,
    c.lbm_right_arm_kg, c.lbm_left_arm_kg, c.lbm_trunk_kg, c.lbm_right_leg_kg, c.lbm_left_leg_kg,
    c.lbm_right_arm_pct, c.lbm_left_arm_pct, c.lbm_trunk_pct, c.lbm_right_leg_pct, c.lbm_left_leg_pct,
    c.bfm_right_arm_kg, c.bfm_left_arm_kg, c.bfm_trunk_kg, c.bfm_right_leg_kg, c.bfm_left_leg_kg,
    c.bfm_right_arm_pct, c.bfm_left_arm_pct, c.bfm_trunk_pct, c.bfm_right_leg_pct, c.bfm_left_leg_pct,
    c.evaluations, c.normal_ranges
  from _cand c
  where not (c.person_birth_date is not null and c.user_dob is not null and c.person_birth_date <> c.user_dob)
  on conflict (measured_at, phone_number_norm) do update set
    user_id              = coalesce(r.user_id, excluded.user_id),
    bf_record_id         = excluded.bf_record_id,
    measured_at_ts       = coalesce(excluded.measured_at_ts, r.measured_at_ts),
    source               = 'bf_sync',
    arca_source          = excluded.arca_source,
    height               = coalesce(excluded.height, r.height),
    weight               = coalesce(excluded.weight, r.weight),
    body_fat_percent     = coalesce(excluded.body_fat_percent, r.body_fat_percent),
    fat_mass_kg          = excluded.fat_mass_kg,
    ffm_kg               = excluded.ffm_kg,
    skeletal_muscle_kg   = excluded.skeletal_muscle_kg,
    slm_kg               = excluded.slm_kg,
    tbw_kg               = excluded.tbw_kg,
    protein_kg           = excluded.protein_kg,
    minerals_kg          = excluded.minerals_kg,
    bmc_kg               = excluded.bmc_kg,
    bmr                  = excluded.bmr,
    bmi                  = excluded.bmi,
    smi                  = excluded.smi,
    ffmi                 = excluded.ffmi,
    skeletal_muscle_rate = excluded.skeletal_muscle_rate,
    inbody_score         = excluded.inbody_score,
    vfl                  = excluded.vfl,
    whr                  = excluded.whr,
    obesity_degree       = excluded.obesity_degree,
    target_weight_kg     = excluded.target_weight_kg,
    weight_control_kg    = excluded.weight_control_kg,
    bfm_control_kg       = excluded.bfm_control_kg,
    ffm_control_kg       = excluded.ffm_control_kg,
    recommended_kcal     = excluded.recommended_kcal,
    lbm_right_arm_kg = excluded.lbm_right_arm_kg, lbm_left_arm_kg = excluded.lbm_left_arm_kg, lbm_trunk_kg = excluded.lbm_trunk_kg,
    lbm_right_leg_kg = excluded.lbm_right_leg_kg, lbm_left_leg_kg = excluded.lbm_left_leg_kg,
    lbm_right_arm_pct = excluded.lbm_right_arm_pct, lbm_left_arm_pct = excluded.lbm_left_arm_pct, lbm_trunk_pct = excluded.lbm_trunk_pct,
    lbm_right_leg_pct = excluded.lbm_right_leg_pct, lbm_left_leg_pct = excluded.lbm_left_leg_pct,
    bfm_right_arm_kg = excluded.bfm_right_arm_kg, bfm_left_arm_kg = excluded.bfm_left_arm_kg, bfm_trunk_kg = excluded.bfm_trunk_kg,
    bfm_right_leg_kg = excluded.bfm_right_leg_kg, bfm_left_leg_kg = excluded.bfm_left_leg_kg,
    bfm_right_arm_pct = excluded.bfm_right_arm_pct, bfm_left_arm_pct = excluded.bfm_left_arm_pct, bfm_trunk_pct = excluded.bfm_trunk_pct,
    bfm_right_leg_pct = excluded.bfm_right_leg_pct, bfm_left_leg_pct = excluded.bfm_left_leg_pct,
    evaluations          = excluded.evaluations,
    normal_ranges        = excluded.normal_ranges,
    updated_at           = now()
  where r.bf_record_id is distinct from excluded.bf_record_id
     or r.user_id is null and excluded.user_id is not null
     or r.weight is distinct from excluded.weight
     or r.skeletal_muscle_kg is distinct from excluded.skeletal_muscle_kg
     or r.lbm_trunk_kg is distinct from excluded.lbm_trunk_kg
     or r.inbody_score is distinct from excluded.inbody_score
     or r.evaluations is distinct from excluded.evaluations;
  get diagnostics v_upserted = row_count;

  insert into public.inbody_sync_runs (feed_rows, matched_rows, upserted_rows, skipped_birth_mismatch, details)
  values (v_feed, v_matched, v_upserted, v_skipped, v_details);

  return jsonb_build_object('ok', true, 'feed_rows', v_feed, 'matched_rows', v_matched,
                            'upserted_rows', v_upserted, 'skipped_birth_mismatch', v_skipped);
exception when others then
  insert into public.inbody_sync_runs (feed_rows, matched_rows, upserted_rows, skipped_birth_mismatch, ok, error, details)
  values (v_feed, v_matched, v_upserted, v_skipped, false, sqlerrm, v_details);
  return jsonb_build_object('ok', false, 'error', sqlerrm);
end
$function$;
revoke execute on function public.sync_inbody_from_bf() from public, anon, authenticated;

-- 5) 旧同期で入った「誰にも紐づいていない他人の行」94 件を消す
--    （②に原本があり、該当者が Bekuta に登録すれば次の同期で自動的に戻る）
delete from public.inbody_records where source = 'bf_sync' and user_id is null;

-- 6) 一度実行して結果を見る
select public.sync_inbody_from_bf() as first_run;

-- 7) 毎時の同期を再開
select cron.alter_job(job_id := 12, active := true);

-- 8) 確認
select
  (select count(*) from public.inbody_records where source = 'bf_sync') as bf_sync_rows,
  (select count(*) from public.inbody_records where source = 'bf_sync' and user_id is not null) as bf_sync_linked,
  (select count(*) from public.inbody_records where skeletal_muscle_kg is not null) as rows_with_smm,
  (select count(*) from public.inbody_records where lbm_trunk_kg is not null) as rows_with_segmental,
  (select active from cron.job where jobid = 12) as cron_active,
  (select row_to_json(x) from (select ran_at, feed_rows, matched_rows, upserted_rows, skipped_birth_mismatch, ok, error from public.inbody_sync_runs order by id desc limit 1) x) as last_run;
