-- =====================================================================
-- ② ARCA 中央DB 側： Bekuta 向け配信ビューと読み取り専用ロールの権限
--   実行先: basketball-fitness (snbnycunbvtmcprsylnx) の SQL Editor
-- =====================================================================

-- 1) Bekuta 向け配信ビュー（1行 = 1回の測定。成長を追うための全指標を含む）
create or replace view arca.v_bekuta_feed
with (security_invoker = false) as
select
  t.id                      as bf_record_id,        -- Bekuta 側の bf_record_id に入る
  p.mobile_number           as phone_number,        -- 突合キー（数字のみ）
  p.birth_date              as person_birth_date,   -- 誤紐づけ防止の照合用
  p.gender                  as person_gender,
  t.tested_on               as measured_at,
  t.tested_at               as measured_at_ts,
  t.time_known,
  t.source,
  t.height_cm               as height,
  t.weight_kg               as weight,
  t.pbf_pct                 as body_fat_percent,
  t.bfm_kg                  as fat_mass_kg,
  t.ffm_kg,
  t.smm_kg                  as skeletal_muscle_kg,
  t.slm_kg,
  t.tbw_kg,
  t.protein_kg,
  t.minerals_kg,
  t.bmc_kg,
  t.bmr_kcal                as bmr,
  t.bmi,
  t.smi,
  t.ffmi,
  t.skeletal_muscle_rate,
  t.inbody_score,
  t.vfl,
  t.whr,
  t.obesity_degree,
  t.target_weight_kg,
  t.weight_control_kg,
  t.bfm_control_kg,
  t.ffm_control_kg,
  t.recommended_kcal,
  t.lbm_right_arm_kg,  t.lbm_left_arm_kg,  t.lbm_trunk_kg,  t.lbm_right_leg_kg,  t.lbm_left_leg_kg,
  t.lbm_right_arm_pct, t.lbm_left_arm_pct, t.lbm_trunk_pct, t.lbm_right_leg_pct, t.lbm_left_leg_pct,
  t.bfm_right_arm_kg,  t.bfm_left_arm_kg,  t.bfm_trunk_kg,  t.bfm_right_leg_kg,  t.bfm_left_leg_kg,
  t.bfm_right_arm_pct, t.bfm_left_arm_pct, t.bfm_trunk_pct, t.bfm_right_leg_pct, t.bfm_left_leg_pct,
  t.evaluations,
  t.normal_ranges,
  t.updated_at
from arca.inbody_tests t
join arca.persons p on p.id = t.person_id
where p.mobile_number is not null
  and p.merged_into is null;
comment on view arca.v_bekuta_feed is 'Bekuta（③）が postgres_fdw で読む配信ビュー。acwr_reader はこのビューだけ読める。';

-- 2) 読み取り専用ロール acwr_reader の権限を「このビューだけ」に絞る
--    （これまでは public.v_inbody_export を読んでいた。切替後は不要）
grant usage on schema arca to acwr_reader;
grant select on arca.v_bekuta_feed to acwr_reader;
revoke select on public.v_inbody_export from acwr_reader;

-- 3) 確認
select
  (select count(*) from arca.v_bekuta_feed) as feed_rows,
  has_table_privilege('acwr_reader', 'arca.v_bekuta_feed', 'SELECT') as can_read_feed,
  has_table_privilege('acwr_reader', 'public.v_inbody_export', 'SELECT') as can_still_read_old,
  has_table_privilege('acwr_reader', 'arca.inbody_tests', 'SELECT') as can_read_raw_table;
