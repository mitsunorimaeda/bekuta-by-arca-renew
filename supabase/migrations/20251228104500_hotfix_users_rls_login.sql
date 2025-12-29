begin;

-- 1) users のポリシーを全部削除して作り直す（再帰の元を断つ）
alter table public.users enable row level security;

drop policy if exists users_select_scope on public.users;
drop policy if exists users_select_all on public.users;
drop policy if exists users_insert_own on public.users;
drop policy if exists users_update_own on public.users;

-- 2) 最小：ログイン後に「自分の users 行」を必ず読めるようにする
create policy users_select_own
on public.users
for select
to authenticated
using (id = auth.uid());

-- 3) 最小：自分のプロフィールだけ更新OK
create policy users_update_own
on public.users
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- 4) 任意：サインアップ直後に自分の行を作れるように（必要なら）
create policy users_insert_own
on public.users
for insert
to authenticated
with check (id = auth.uid());

commit;