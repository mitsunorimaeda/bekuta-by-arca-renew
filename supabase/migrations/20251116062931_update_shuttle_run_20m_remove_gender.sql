/*
  # 20mシャトルランの性別フィールドを削除

  ## 概要
  文部科学省の換算表を使用するため、性別による計算式の違いは不要になりました。
  往復回数のみで正確なVO2maxを推定できるよう、性別フィールドを削除します。

  ## 変更内容
  - 20mシャトルランのフィールド定義から性別を削除
  - 往復回数のみで換算表を参照

  ## セキュリティ
  - 既存のRLSポリシーを維持
*/

DO $$
DECLARE
  endurance_category_id uuid;
BEGIN
  SELECT id INTO endurance_category_id FROM performance_categories WHERE name = 'endurance';

  UPDATE performance_test_types
  SET
    description = '20m間を往復走します。往復回数からVO2maxを推定します。文部科学省の換算表を使用（6〜19歳対象）。',
    fields = '[
      {"name": "count", "label": "往復回数", "type": "number", "unit": "回", "required": true, "min": 1, "max": 200}
    ]'::jsonb
  WHERE category_id = endurance_category_id
    AND name = 'shuttle_run_20m';
END $$;
