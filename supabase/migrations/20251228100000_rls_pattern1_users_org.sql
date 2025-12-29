-- ============================================================
-- RLS fix (Pattern 1): public.users.id = auth.users.id
-- ============================================================

-- Helper: current_app_user_id() = auth.uid()
create or replace function public.current_app_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid()
$$;

-- Helper: global admin check
create or replace function public.is_global_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
   