-- =====================================================================
-- ARCA 中央DB（②）  スキーマ arca
-- InBody 社 LookinBody（①）から届いた測定を「人（person）」単位で保持し、
-- 各アプリ（③ PHYSICAL LAB / Bekuta / …）へ配るための中核テーブル群。
-- 既存の public スキーマ（ARCA PHYSICAL LAB のアプリ用）には触れない。
-- =====================================================================
create schema if not exists arca;
comment on schema arca is 'ARCA 中央DB（②）。InBody 等の測定を人単位で保持し各アプリ（③）に配る。public（PHYSICAL LAB アプリ）とは独立。';

-- ---------------------------------------------------------------------
-- 接続アプリの台帳
-- ---------------------------------------------------------------------
create table if not exists arca.apps (
  app_key               text primary key,
  name                  text not null,
  supabase_project_ref  text,
  notes                 text,
  created_at            timestamptz not null default now()
);
comment on table arca.apps is '③ 接続アプリの台帳。app_links.app_key の参照先。';

insert into arca.apps (app_key, name, supabase_project_ref, notes) values
  ('physical_lab', 'ARCA PHYSICAL LAB', 'snbnycunbvtmcprsylnx', '同一プロジェクトの public スキーマ。users.id を app_user_id に持つ'),
  ('bekuta',       'Bekuta v2',         'cymnqmbdwaveccoooics', '別プロジェクト。postgres_fdw または API 経由で購読')
on conflict (app_key) do nothing;

-- ---------------------------------------------------------------------
-- 人（アプリ非依存のアイデンティティ）
-- ---------------------------------------------------------------------
create table if not exists arca.persons (
  id                    uuid primary key default gen_random_uuid(),
  lookinbody_id         text unique,          -- LookinBody の ID（Webhook の UserID / API の ID）
  mobile_number         text,                 -- LookinBody の MobileNumber（数字のみに正規化）
  name                  text,                 -- 表示名（アプリ側の漢字名を優先）
  inbody_name           text,                 -- InBody に登録されているカナ名
  gender                text check (gender in ('M','F')),
  birth_date            date,
  height_cm             numeric,              -- 最後に分かった身長
  email                 text,
  inbody_registered_at  timestamptz,          -- LookinBody への登録日
  merged_into           uuid references arca.persons(id),  -- 重複統合時の統合先
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists persons_mobile_idx on arca.persons (mobile_number);
comment on table arca.persons is '測定の主体となる人。lookinbody_id または mobile_number で InBody と突き合わせる。';

-- ---------------------------------------------------------------------
-- アプリのユーザーとの対応
-- ---------------------------------------------------------------------
create table if not exists arca.app_links (
  id            uuid primary key default gen_random_uuid(),
  person_id     uuid not null references arca.persons(id),
  app_key       text not null references arca.apps(app_key),
  app_user_id   text not null,                 -- 各アプリ側の users.id（文字列）
  confidence    text not null default 'exact' check (confidence in ('exact','phone','manual')),
  linked_at     timestamptz not null default now(),
  unlinked_at   timestamptz,
  notes         text
);
create unique index if not exists app_links_app_user_uq  on arca.app_links (app_key, app_user_id) where unlinked_at is null;
create unique index if not exists app_links_app_person_uq on arca.app_links (app_key, person_id)  where unlinked_at is null;
comment on table arca.app_links is '人 ↔ 各アプリのユーザー ID の対応。1アプリにつき1人1ユーザー。';

-- ---------------------------------------------------------------------
-- InBody 測定（1行 = 1回の測定）
-- ---------------------------------------------------------------------
create table if not exists arca.inbody_tests (
  id                    uuid primary key default gen_random_uuid(),
  person_id             uuid not null references arca.persons(id),
  lookinbody_id         text,                               -- 測定時点の LookinBody ID
  test_key              text not null,                      -- 'YYYYMMDDHHMMSS'（時刻不明の旧データは 'YYYYMMDD000000'）
  tested_at             timestamptz not null,
  tested_on             date not null,                      -- 日本時間での測定日
  time_known            boolean not null default true,
  source                text not null check (source in ('lookinbody_api','lookinbody_csv','legacy_import','app_manual')),
  equip_serial          text,
  inbody_type           text,
  name_at_test          text,
  gender                text,
  age_at_test           numeric,
  -- 基本
  height_cm             numeric,
  weight_kg             numeric,
  bmi                   numeric,
  pbf_pct               numeric,   -- 体脂肪率
  bfm_kg                numeric,   -- 体脂肪量
  ffm_kg                numeric,   -- 除脂肪量
  smm_kg                numeric,   -- 骨格筋量
  slm_kg                numeric,   -- 軟部除脂肪量
  tbw_kg                numeric,   -- 体水分量
  protein_kg            numeric,
  minerals_kg           numeric,
  bmc_kg                numeric,   -- 骨ミネラル量
  bmr_kcal              numeric,   -- 基礎代謝
  smi                   numeric,
  ffmi                  numeric,
  skeletal_muscle_rate  numeric,   -- 骨格筋量 / 体重
  inbody_score          numeric,
  growth_score          numeric,
  obesity_degree        numeric,
  obesity_degree_child  numeric,
  vfl                   numeric,   -- 内臓脂肪レベル
  whr                   numeric,
  target_weight_kg      numeric,
  weight_control_kg     numeric,
  bfm_control_kg        numeric,
  ffm_control_kg        numeric,
  recommended_kcal      numeric,
  clothes_weight_kg     numeric,
  phase_angle           numeric,   -- 機種により無し
  ecw_tbw               numeric,   -- 機種により無し
  vfa                   numeric,   -- 機種により無し
  -- 部位別 除脂肪量（kg と 標準比 %）
  lbm_right_arm_kg      numeric, lbm_left_arm_kg  numeric, lbm_trunk_kg  numeric, lbm_right_leg_kg  numeric, lbm_left_leg_kg  numeric,
  lbm_right_arm_pct     numeric, lbm_left_arm_pct numeric, lbm_trunk_pct numeric, lbm_right_leg_pct numeric, lbm_left_leg_pct numeric,
  -- 部位別 体脂肪量（kg と 標準比 %）
  bfm_right_arm_kg      numeric, bfm_left_arm_kg  numeric, bfm_trunk_kg  numeric, bfm_right_leg_kg  numeric, bfm_left_leg_kg  numeric,
  bfm_right_arm_pct     numeric, bfm_left_arm_pct numeric, bfm_trunk_pct numeric, bfm_right_leg_pct numeric, bfm_left_leg_pct numeric,
  -- 判定・標準範囲・生データ
  evaluations           jsonb,     -- {"PBF":"Normal", "Upper":"Balanced", ...}
  normal_ranges         jsonb,     -- {"PBF":{"low":10,"high":20}, ...}
  raw                   jsonb,     -- 取得したままの JSON
  -- 由来
  origin_table          text,
  origin_id             uuid,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (person_id, test_key)
);
create index if not exists inbody_tests_person_time_idx on arca.inbody_tests (person_id, tested_at desc);
create index if not exists inbody_tests_tested_on_idx   on arca.inbody_tests (tested_on);
create index if not exists inbody_tests_lk_idx          on arca.inbody_tests (lookinbody_id, tested_at desc);
comment on table arca.inbody_tests is 'InBody 測定。1行＝1回。person_id + test_key で一意。';

-- ---------------------------------------------------------------------
-- 取込ログ（失敗を飲み込まず記録する）
-- ---------------------------------------------------------------------
create table if not exists arca.ingest_log (
  id            bigint generated always as identity primary key,
  happened_at   timestamptz not null default now(),
  level         text not null default 'info' check (level in ('info','warn','error')),
  action        text not null,
  origin_table  text,
  origin_id     uuid,
  person_id     uuid,
  test_id       uuid,
  message       text,
  payload       jsonb
);
create index if not exists ingest_log_time_idx on arca.ingest_log (happened_at desc);

-- ---------------------------------------------------------------------
-- updated_at 自動更新
-- ---------------------------------------------------------------------
create or replace function arca.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists persons_touch on arca.persons;
create trigger persons_touch before update on arca.persons for each row execute function arca.touch_updated_at();
drop trigger if exists inbody_tests_touch on arca.inbody_tests;
create trigger inbody_tests_touch before update on arca.inbody_tests for each row execute function arca.touch_updated_at();

-- ---------------------------------------------------------------------
-- 権限：RLS を有効化し、ポリシー無し（= service_role と postgres 以外は読めない）。
-- ③ の各アプリへは後続で「ビュー + ポリシー」または FDW / API で公開する。
-- ---------------------------------------------------------------------
grant usage on schema arca to service_role, authenticated;
grant all on all tables in schema arca to service_role;
grant usage, select on all sequences in schema arca to service_role;
grant select on all tables in schema arca to authenticated;
alter default privileges in schema arca grant all on tables to service_role;
alter default privileges in schema arca grant select on tables to authenticated;
alter default privileges in schema arca grant usage, select on sequences to service_role;
revoke execute on all functions in schema arca from public, anon, authenticated;
alter default privileges in schema arca revoke execute on functions from public;

alter table arca.apps          enable row level security;
alter table arca.persons       enable row level security;
alter table arca.app_links     enable row level security;
alter table arca.inbody_tests  enable row level security;
alter table arca.ingest_log    enable row level security;
