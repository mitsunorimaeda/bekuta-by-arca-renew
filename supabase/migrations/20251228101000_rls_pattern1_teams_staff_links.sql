-- ============================================================
-- RLS fix (Pattern 1): teams + staff_team_links
-- public.users.id = auth.uid()
-- ============================================================

-- Ensure RLS enabled
alter table public.teams enable row level security;
alter table public.staff_team_links enable row level security;

-- Helper: team membership (athlete via users.team_id, staff via staff_team_links)
create or replace function public.is_team_member(team uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.team_id = team
  )
  or exists (
    select 1
    from public.staff_team_links stl
    where stl.staff_user_id = auth.uid()
      and stl.team_id = team
  )
$$;

-- Helper: team belongs to an organization where caller is org member
create or replace function public.in_same_org_as_team(team uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.teams t
    join public.organization_members om
      on om.organization_id = t.organization_id
    where t.id = team
      and om.user_id = auth.uid()
  )
$$;

-- Helper: org admin by team id
create or replace function public.is_org_admin_by_team(team uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.teams t
    join public.organization_members om
      on om.organization_id = t.organization_id
    where t.id = team
      and om.user_id = auth.uid()
      and om.role = 'organization_admin'
  )
$$;

-- ------------------------------------------------------------
-- TEAMS policies reset (drop legacy policies safely)
-- ------------------------------------------------------------
drop policy if exists "Admin users can manage all teams" on public.teams;
drop policy if exists "Admin users can view all teams" on public.teams;
drop policy if exists "Organization admins can create teams in their organization" on public.teams;
drop policy if exists "Organization admins can update teams in their organization" on public.teams;
drop policy if exists "Organization admins can delete teams in their organization" on public.teams;
drop policy if exists "Organization admins can view teams in their organization" on public.teams;
drop policy if exists "Organization members can view all teams in their organization" on public.teams;
drop policy if exists "Users can view teams they belong to" on public.teams;

-- SELECT: global admin OR same org member OR team member
create policy teams_select_visible
on public.teams
for select
to authenticated
using (
  public.is_global_admin()
  or public.in_same_org_as_team(id)
  or public.is_team_member(id)
);

-- INSERT/UPDATE/DELETE: global admin OR org admin (by org)
create policy teams_manage_by_admins
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

-- ------------------------------------------------------------
-- STAFF_TEAM_LINKS policies reset (drop legacy policies)
-- ------------------------------------------------------------
drop policy if exists "Admin users can manage all staff team links" on public.staff_team_links;
drop policy if exists "Admin users can view all staff team links" on public.staff_team_links;
drop policy if exists "Staff can view their team links" on public.staff_team_links;

-- SELECT: global admin OR self OR same org (optional: org members can read)
create policy staff_links_select
on public.staff_team_links
for select
to authenticated
using (
  public.is_global_admin()
  or staff_user_id = auth.uid()
  or public.in_same_org_as_team(team_id)
);

-- MANAGE: global admin OR org admin of that team
create policy staff_links_manage
on public.staff_team_links
for all
to authenticated
using (
  public.is_global_admin()
  or public.is_org_admin_by_team(team_id)
)
with check (
  public.is_global_admin()
  or public.is_org_admin_by_team(team_id)
);