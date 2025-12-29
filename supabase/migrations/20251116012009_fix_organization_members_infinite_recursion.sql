/*
  # Fix Teams RLS Policies for Admin Users

  ## Purpose
  Fix the RLS policies for teams table to correctly check admin users.
  The issue is that auth.uid() returns the auth user ID, but users.id is a different UUID.
  We need to check users.user_id instead.

  ## Changes
  - Update all teams RLS policies to correctly check admin users using users.user_id
*/

-- ============================================================================
-- Fix RLS policies for teams table
-- ============================================================================

/*
  Fix teams RLS policies with correct user mapping.
  - auth.uid() is auth.users.id (uuid)
  - public.users.user_id stores auth.users.id as text
  - public.users.id is app user id (uuid)
*/

set search_path = public;

-- 1) helper: auth.uid() -> public.users.id
create or replace function public.current_app_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select u.id
  from public.users u
  where u.user_id = auth.uid()::text
  limit 1
$$;

-- 2) 念のため teams の該当ポリシーは一旦DROP（存在しても/しなくてもOK）
drop policy if exists "Organization admins can create teams in their organization" on public.teams;
drop policy if exists "Organization admins can update teams in their organization" on public.teams;
drop policy if exists "Organization admins can delete teams in their organization" on public.teams;
drop policy if exists "Organization admins can view teams in their organization"   on public.teams;

-- 3) 再作成：organization_members.user_id は public.users.id (uuid) 前提で判定
create policy "Organization admins can create teams in their organization"
  on public.teams
  for insert
  to authenticated
  with check (
    -- global admin
    exists (
      select 1
      from public.users uu
      where uu.id = public.current_app_user_id()
        and uu.role = 'admin'
    )
    or
    -- org admin
    exists (
      select 1
      from public.organization_members om
      where om.user_id = public.current_app_user_id()
        and om.organization_id = public.teams.organization_id
        and om.role = 'organization_admin'
    )
  );

create policy "Organization admins can update teams in their organization"
  on public.teams
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.users uu
      where uu.id = public.current_app_user_id()
        and uu.role = 'admin'
    )
    or
    exists (
      select 1
      from public.organization_members om
      where om.user_id = public.current_app_user_id()
        and om.organization_id = public.teams.organization_id
        and om.role = 'organization_admin'
    )
  )
  with check (
    exists (
      select 1
      from public.users uu
      where uu.id = public.current_app_user_id()
        and uu.role = 'admin'
    )
    or
    exists (
      select 1
      from public.organization_members om
      where om.user_id = public.current_app_user_id()
        and om.organization_id = public.teams.organization_id
        and om.role = 'organization_admin'
    )
  );

create policy "Organization admins can delete teams in their organization"
  on public.teams
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.users uu
      where uu.id = public.current_app_user_id()
        and uu.role = 'admin'
    )
    or
    exists (
      select 1
      from public.organization_members om
      where om.user_id = public.current_app_user_id()
        and om.organization_id = public.teams.organization_id
        and om.role = 'organization_admin'
    )
  );

create policy "Organization admins can view teams in their organization"
  on public.teams
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.users uu
      where uu.id = public.current_app_user_id()
        and uu.role = 'admin'
    )
    or
    exists (
      select 1
      from public.organization_members om
      where om.user_id = public.current_app_user_id()
        and om.organization_id = public.teams.organization_id
        and om.role in ('organization_admin','viewer')
    )
  );