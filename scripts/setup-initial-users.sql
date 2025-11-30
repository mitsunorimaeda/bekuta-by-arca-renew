-- Supabase Dashboardで3人のユーザーを作成した後、このSQLを実行してください
-- Authentication → Users で以下のユーザーを作成：
-- 1. info@arca.fit
-- 2. maeda@arca.fit
-- 3. mitsunorimaeda@icloud.com

-- ユーザー作成後、このSQLを実行して役割を設定します

-- 1. 管理者の役割を設定
UPDATE users
SET
  role = 'admin',
  name = '管理者 (ARCA)',
  team_id = NULL
WHERE email = 'info@arca.fit';

-- 2. コーチの役割を設定（スタッフ）
UPDATE users
SET
  role = 'staff',
  name = '前田コーチ',
  team_id = NULL
WHERE email = 'maeda@arca.fit';

-- 3. 選手の役割を設定（チームに所属）
UPDATE users
SET
  role = 'athlete',
  name = '前田 光憲',
  team_id = (SELECT id FROM teams LIMIT 1)
WHERE email = 'mitsunorimaeda@icloud.com';

-- コーチをチームに紐付け（全チームにアクセス可能にする場合）
INSERT INTO staff_team_links (staff_user_id, team_id)
SELECT
  u.id,
  t.id
FROM users u
CROSS JOIN teams t
WHERE u.email = 'maeda@arca.fit'
ON CONFLICT (staff_user_id, team_id) DO NOTHING;

-- 確認用クエリ
SELECT
  u.user_id,
  u.email,
  u.name,
  u.role,
  t.name as team_name
FROM users u
LEFT JOIN teams t ON u.team_id = t.id
WHERE u.email IN ('info@arca.fit', 'maeda@arca.fit', 'mitsunorimaeda@icloud.com')
ORDER BY
  CASE u.role
    WHEN 'admin' THEN 1
    WHEN 'staff' THEN 2
    WHEN 'athlete' THEN 3
  END;
