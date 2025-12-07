/*
  # ユーザープロフィール拡張フィールドの追加

  ## 概要
  アスリートの体組成管理と女性アスリート向け機能のため、usersテーブルに基本情報フィールドを追加します。

  ## 新しいカラム
  - `gender` (text, nullable) - 性別
    - 'male', 'female', 'other', 'prefer_not_to_say' のいずれか
    - プライバシー配慮のため選択しない選択肢も含む
  - `height_cm` (decimal, nullable) - 身長（センチメートル）
    - 範囲: 100-250cm（合理的なアスリートの身長範囲）
    - 小数点第1位まで記録可能（例: 175.5cm）
  - `date_of_birth` (date, nullable) - 生年月日
    - 年齢計算、年齢別基準値の判定に使用

  ## 使用目的
  1. BMI計算（身長 + 体重から算出）
  2. 年齢別の適正体重範囲の表示
  3. 女性アスリート向け機能の有効化判定
  4. 年齢別パフォーマンス基準値の適用

  ## データ特性
  - すべてのフィールドはNULL可能（既存ユーザーへの影響ゼロ）
  - 既存のクエリに影響を与えない安全な拡張
  - ユーザーが任意で入力可能

  ## セキュリティ
  - 既存のRLSポリシーが適用される
  - ユーザー本人のみが自分のデータを更新可能
  - コーチ/スタッフはチームメンバーの情報を閲覧可能（既存の権限設定に従う）

  ## 注意事項
  - この変更は非破壊的（既存データへの影響なし）
  - ロールバックが容易（列の削除のみで元に戻せる）
  - パフォーマンスへの影響は最小限（インデックス不要）
*/

-- gender列を追加（性別）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'users'
    AND column_name = 'gender'
  ) THEN
    ALTER TABLE users ADD COLUMN gender text;

    -- gender値の制約を追加
    ALTER TABLE users ADD CONSTRAINT users_gender_check
      CHECK (gender IS NULL OR gender IN ('male', 'female', 'other', 'prefer_not_to_say'));

    COMMENT ON COLUMN users.gender IS '性別: male, female, other, prefer_not_to_say';
  END IF;
END $$;

-- height_cm列を追加（身長）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'users'
    AND column_name = 'height_cm'
  ) THEN
    ALTER TABLE users ADD COLUMN height_cm decimal(5,1);

    -- 身長の妥当性チェック（100-250cm）
    ALTER TABLE users ADD CONSTRAINT users_height_check
      CHECK (height_cm IS NULL OR (height_cm >= 100 AND height_cm <= 250));

    COMMENT ON COLUMN users.height_cm IS '身長（cm）: 100-250の範囲、小数点第1位まで記録可能';
  END IF;
END $$;

-- date_of_birth列を追加（生年月日）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'users'
    AND column_name = 'date_of_birth'
  ) THEN
    ALTER TABLE users ADD COLUMN date_of_birth date;

    -- 生年月日の妥当性チェック（10歳以上、150歳以下）
    ALTER TABLE users ADD CONSTRAINT users_date_of_birth_check
      CHECK (
        date_of_birth IS NULL OR
        (
          date_of_birth <= CURRENT_DATE - INTERVAL '10 years' AND
          date_of_birth >= CURRENT_DATE - INTERVAL '150 years'
        )
      );

    COMMENT ON COLUMN users.date_of_birth IS '生年月日: BMI基準値や年齢別パフォーマンス評価に使用';
  END IF;
END $$;
