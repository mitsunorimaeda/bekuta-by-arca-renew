-- Helper: current_app_user_id() = auth.uid()
create or replace function public.current_app_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $func$
  select auth.uid();
$func$;

-- Helper: global admin check
create or replace function public.is_global_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $func$
  select exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'global_admin'
  );
$func$;