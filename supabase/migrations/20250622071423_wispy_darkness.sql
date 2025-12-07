/*
  # Create admin user placeholder

  1. New Records
    - Creates a placeholder admin user record
    - Uses staff role for administrative access
    - Can be updated with actual admin information later

  2. Security
    - Admin user will have staff privileges
    - Can be linked to teams via staff_team_links table

  3. Notes
    - Replace placeholder values with actual admin information
    - The ID should be updated when linking to actual Supabase auth user
*/

-- 管理者用のプレースホルダーレコードを作成
-- 注意: 実際の管理者情報に変更してください
INSERT INTO users (
  id, 
  name, 
  email, 
  role, 
  team_id
) VALUES (
  '00000000-0000-0000-0000-000000000000', -- プレースホルダーID（後で更新）
  '管理者', -- 実際の管理者名に変更
  'admin@yourschool.com', -- 実際の管理者メールアドレスに変更
  'staff',
  NULL
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  email = EXCLUDED.email;