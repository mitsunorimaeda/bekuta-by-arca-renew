-- Reset users RLS policies to a non-recursive minimal safe set
-- Goal: eliminate "infinite recursion detected in policy for relation users"

begin;

-- 1) Ensure RLS is enabled but not forced (forced=false so table owner/security definer can bypass)
alter table public.users enable row level security;
alter table public.users no force row level security;

-- 2) Drop ALL existing policies on public.users (no matter what their names are)
do $$
declare
  r record;
begin
  for r in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename  = 'users'
  loop
    execute format('drop policy if exists %I on public.users;', r.policyname);
  end loop;
end $$;

-- 3) Create minimal non-recursive policies
-- ✅ SELECT: allow authenticated to read users (you can tighten later, but first fix recursion)
create policy users_select_all
on public.users
for select
to authenticated
using (true);

-- ✅ INSERT: only allow creating own row (id must equal auth.uid())
create policy users_insert_own
on public.users
for insert
to authenticated
with check (id = auth.uid());

-- ✅ UPDATE: only allow updating own row
create policy users_update_own
on public.users
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

commit;