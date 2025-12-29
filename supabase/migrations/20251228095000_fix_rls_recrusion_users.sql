-- =========================================
-- Fix RLS infinite recursion (users/teams/org_members/staff_team_links)
-- Pattern: public.users.id = auth.uid()
-- =========================================

-- 0) Helper: make sure we can use gen_random_uuid if needed
create extension if not exists pgcrypto;

-- 1) Create helper functions that bypass RLS safely
--    IMPORTANT: SECURITY DEFINER + SET row_security = off
create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public, auth
set row_security = off
as $$
  select u.role
  from public.users u
  where u.id = auth.uid()
  limit 1
$$;

create or replace function public.is_global_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
set row_security = off
as $$
  select coalesce((public.current_app_role() = 'admin'), false)
$$;

-- staff/athlete が “所属組織” を取る（org→team→user の構造に対応）
create or replace function public.my_organization_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public, auth
set row_security = off
as $$
  -- 自分が所属している team_id（users.team_id）経由
  select t.organization_id
  from public.users u
  join public.teams t on t.id = u.team_id
  where u.id = auth.uid()

  union

  -- staff が担当している team_id（staff_team_links.team_id）経由
  select t.organization_id
  from public.staff_team_links stl
  join public.teams t on t.id = stl.team_id
  where stl.staff_user_id = auth.uid()
$$;

-- org admin 判定（organization_members に organization_admin があるか）
create or replace function public.is_org_admin(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
set row_security = off
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.user_id = auth.uid()
      and om.organization_id = org_id
      and om.role = 'organization_admin'
  )
$$;

-- 2) USERS: reset policies to avoid recursion
alter table public.users disable row level security;

drop policy if exists users_select_all on public.users;
drop policy if exists users_insert_own on public.users;
drop policy if exists users_update_own on public.users;

alter table public.users enable row level security;

-- admin は全員見える / それ以外は「同じ組織内だけ見える」+「自分は見える」
create policy users_select_safe
on public.users
for select
to authenticated
using (
  public.is_global_admin()
  or id = auth.uid()
  or team_id in (
    select t.id
    from public.teams t
    where t.organization_id in (select public.my_organization_ids())
  )
);

create policy users_insert_own_safe
on public.users
for insert
to authenticated
with check (
  id = auth.uid()
);

create policy users_update_safe
on public.users
for update
to authenticated
using (
  public.is_global_admin() or id = auth.uid()
)
with check (
  public.is_global_admin() or id = auth.uid()
);

-- 3) TEAMS: remove policies that query users table
alter table public.teams disable row level security;

-- 既存ポリシーを全部落とす（名前がバラついてても安全にするため if exists）
do $$
declare p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname='public' and tablename='teams'
  loop
    execute format('drop policy if exists %I on public.teams;', p.policyname);
  end loop;
end $$;

alter table public.teams enable row level security;

create policy teams_select_safe
on public.teams
for select
to authenticated
using (
  public.is_global_admin()
  or organization_id in (select public.my_organization_ids())
);

create policy teams_write_org_admin
on public.teams
for all
to authenticated
using (
  public.is_global_admin()
  or public.is_org_admin(organization_id)
)
with check (
  public.is_global_admin()
  or public.is_org_admin(organization_id)
);

-- 4) STAFF_TEAM_LINKS: avoid querying users table in policies
alter table public.staff_team_links disable row level security;

do $$
declare p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname='public' and tablename='staff_team_links'
  loop
    execute format('drop policy if exists %I on public.staff_team_links;', p.policyname);
  end loop;
end $$;

alter table public.staff_team_links enable row level security;

create policy staff_team_links_select_safe
on public.staff_team_links
for select
to authenticated
using (
  public.is_global_admin()
  or staff_user_id = auth.uid()
);

create policy staff_team_links_write_admin_or_org_admin
on public.staff_team_links
for all
to authenticated
using (
  public.is_global_admin()
  or (
    -- 対象 team の organization に対して org admin なら操作OK
    exists (
      select 1
      from public.teams t
      where t.id = staff_team_links.team_id
        and public.is_org_admin(t.organization_id)
    )
  )
)
with check (
  public.is_global_admin()
  or (
    exists (
      select 1
      from public.teams t
      where t.id = staff_team_links.team_id
        and public.is_org_admin(t.organization_id)
    )
  )
);

-- 5) ORGANIZATION_MEMBERS: recursion回避（organization_members 自体は users を見に行かない）
alter table public.organization_members disable row level security;

do $$
declare p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname='public' and tablename='organization_members'
  loop
    execute format('drop policy if exists %I on public.organization_members;', p.policyname);
  end loop;
end $$;

alter table public.organization_members enable row level security;

create policy org_members_select_safe
on public.organization_members
for select
to authenticated
using (
  public.is_global_admin()
  or user_id = auth.uid()
  or organization_id in (select public.my_organization_ids())
);

create policy org_members_write_org_admin
on public.organization_members
for all
to authenticated
using (
  public.is_global_admin()
  or public.is_org_admin(organization_id)
)
with check (
  public.is_global_admin()
  or public.is_org_admin(organization_id)
);