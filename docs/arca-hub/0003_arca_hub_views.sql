-- =====================================================================
-- ARCA 中央DB（②）  ③ 各アプリ向けの公開ビュー
--  security_invoker = true : 呼び出し側の権限で RLS が効く
-- =====================================================================

-- 測定 + 人 + 各アプリのユーザー ID（横持ち）
create or replace view arca.v_inbody_tests
with (security_invoker = true) as
select
  p.name            as person_name,
  p.inbody_name     as person_inbody_name,
  p.gender          as person_gender,
  p.birth_date      as person_birth_date,
  p.mobile_number   as person_mobile_number,
  p.lookinbody_id   as person_lookinbody_id,
  pl.app_user_id    as physical_lab_user_id,
  bk.app_user_id    as bekuta_user_id,
  t.*
from arca.inbody_tests t
join arca.persons p on p.id = t.person_id
left join arca.app_links pl on pl.person_id = p.id and pl.app_key = 'physical_lab' and pl.unlinked_at is null
left join arca.app_links bk on bk.person_id = p.id and bk.app_key = 'bekuta'       and bk.unlinked_at is null;
comment on view arca.v_inbody_tests is '測定 1 行に人とアプリ側ユーザー ID を付けた横持ちビュー。③ はまずこれを読む。';

-- 人ごとの最新測定
create or replace view arca.v_person_latest_test
with (security_invoker = true) as
select distinct on (t.person_id) t.*
from arca.inbody_tests t
order by t.person_id, t.tested_at desc;

-- 人ごとの集計（件数・初回・最新）
create or replace view arca.v_persons_summary
with (security_invoker = true) as
select p.id as person_id, p.name, p.inbody_name, p.gender, p.birth_date, p.mobile_number, p.lookinbody_id,
       count(t.id)       as test_count,
       min(t.tested_at)  as first_tested_at,
       max(t.tested_at)  as last_tested_at,
       (select string_agg(l.app_key || ':' || l.app_user_id, ', ' order by l.app_key)
          from arca.app_links l where l.person_id = p.id and l.unlinked_at is null) as linked_apps
from arca.persons p
left join arca.inbody_tests t on t.person_id = p.id
where p.merged_into is null
group by p.id;

-- Bekuta 向け：現行 public.v_inbody_export と同じ列名 + 追加列
create or replace view arca.v_inbody_export_v2
with (security_invoker = true) as
select
  t.id             as bf_record_id,
  p.mobile_number  as phone_number,
  t.tested_on      as measured_at,
  t.tested_at      as measured_at_ts,
  t.height_cm      as height,
  t.weight_kg      as weight,
  t.pbf_pct        as body_fat_percent,
  t.smm_kg         as skeletal_muscle_kg,
  t.ffm_kg         as ffm_kg,
  t.bfm_kg         as fat_mass_kg,
  t.bmr_kcal       as bmr,
  t.inbody_score,
  t.source,
  t.updated_at
from arca.inbody_tests t
join arca.persons p on p.id = t.person_id
where p.mobile_number is not null;
comment on view arca.v_inbody_export_v2 is 'Bekuta の bf_remote（postgres_fdw）差し替え先。bf_record_id は arca.inbody_tests.id。';

grant select on all tables in schema arca to service_role, authenticated;
