/*
  # 本番運用用チーム設定

  1. 実際のチーム情報を登録
    - 既存のサンプルデータをクリーンアップ
    - 実際のチーム名で登録

  2. サンプルデータの削除
    - テスト用のユーザーとデータを削除
    - 本番環境をクリーンな状態に
*/

-- サンプルデータの削除
DELETE FROM training_records WHERE user_id IN (
  SELECT id FROM users WHERE email LIKE '%@example.com'
);

DELETE FROM staff_team_links WHERE staff_user_id IN (
  SELECT id FROM users WHERE email LIKE '%@example.com'
);

DELETE FROM users WHERE email LIKE '%@example.com';

DELETE FROM teams WHERE name LIKE '%サンプル%' OR name LIKE '%Sample%';

-- 実際のチーム情報を登録（例）
-- 以下を実際のチーム名に変更してください
INSERT INTO teams (name) VALUES 
  ('サッカー部'),
  ('バスケットボール部'),
  ('陸上競技部'),
  ('野球部'),
  ('テニス部')
ON CONFLICT DO NOTHING;