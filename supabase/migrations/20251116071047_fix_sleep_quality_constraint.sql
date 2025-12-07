/*
  # 睡眠の質の制約を修正

  1. 変更内容
    - `sleep_records.sleep_quality` の制約を 1-5 から 1-10 に変更
    - UIでは1-10段階で入力するため、データベースの制約と一致させる

  2. セキュリティ
    - 既存のRLSポリシーは変更なし
*/

-- 既存の制約を削除
ALTER TABLE sleep_records DROP CONSTRAINT IF EXISTS sleep_records_sleep_quality_check;

-- 新しい制約を追加（1-10段階）
ALTER TABLE sleep_records ADD CONSTRAINT sleep_records_sleep_quality_check
  CHECK (sleep_quality >= 1 AND sleep_quality <= 10);
