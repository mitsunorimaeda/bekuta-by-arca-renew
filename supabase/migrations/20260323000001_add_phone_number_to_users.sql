-- users テーブルの phone_number カラムをマイグレーションとして管理する
-- 本番DBにはダッシュボードから直接追加されているため IF NOT EXISTS で安全に実行

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS phone_number text;

-- 日本の携帯番号による InBody データ紐付けに使用
COMMENT ON COLUMN public.users.phone_number IS
  '電話番号（携帯番号推奨）。InBodyデータのphone_number_normと照合してユーザー紐付けに使用。';

-- phone_number が NULL でない場合のユニーク制約（ローカル環境に存在しない場合のみ追加）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'users'
      AND indexname = 'users_phone_number_unique'
  ) THEN
    CREATE UNIQUE INDEX users_phone_number_unique
      ON public.users (phone_number)
      WHERE phone_number IS NOT NULL;
  END IF;
END $$;

-- 正規化済み電話番号によるユニーク制約（normalize_phone 関数が存在する場合のみ）
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'normalize_phone'
      AND pronamespace = 'public'::regnamespace
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'users'
      AND indexname = 'users_phone_norm_unique'
  ) THEN
    CREATE UNIQUE INDEX users_phone_norm_unique
      ON public.users (public.normalize_phone(phone_number))
      WHERE phone_number IS NOT NULL;
  END IF;
END $$;
