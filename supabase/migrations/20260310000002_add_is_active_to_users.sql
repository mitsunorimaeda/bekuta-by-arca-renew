-- users テーブルに is_active カラムを追加
-- 選手: 自己登録後即時有効（true）
-- スタッフ: 管理者の承認後に有効化（false → true）

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- 既存ユーザーは全員 is_active = true（影響なし）
-- 承認待ちスタッフ取得用インデックス
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active) WHERE is_active = false;
