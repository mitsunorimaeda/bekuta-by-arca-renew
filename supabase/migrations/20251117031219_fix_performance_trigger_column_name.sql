/*
  # パフォーマンス記録トリガーのカラム名修正

  ## 修正内容
  - トリガー関数内で誤った`recorded_date`を正しい`date`カラムに修正
  - パーソナルベストの判定ロジックを修正（higher_is_betterフィールドを使用）

  ## 影響
  - パフォーマンス記録追加時のゲーミフィケーション処理が正しく動作するようになる
*/

-- トリガー関数: パフォーマンス記録追加時のゲーミフィケーション処理（修正版）
CREATE OR REPLACE FUNCTION process_performance_record_gamification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_base_points integer := 15;
  v_total_records integer;
  v_is_personal_best boolean := false;
  v_test_type_higher_is_better boolean;
  v_best_value numeric;
BEGIN
  -- テストタイプの情報を取得
  SELECT higher_is_better INTO v_test_type_higher_is_better
  FROM performance_test_types
  WHERE id = NEW.test_type_id;

  -- パーソナルベストチェック（同じテストでの過去最高値/最低値）
  IF v_test_type_higher_is_better THEN
    -- 値が大きい方が良い場合（例：ジャンプ高）
    SELECT MAX((pr.values->>'primary_value')::numeric) INTO v_best_value
    FROM performance_records pr
    WHERE pr.user_id = NEW.user_id
    AND pr.test_type_id = NEW.test_type_id
    AND pr.id != NEW.id;
    
    IF v_best_value IS NULL OR (NEW.values->>'primary_value')::numeric > v_best_value THEN
      v_is_personal_best := true;
    END IF;
  ELSE
    -- 値が小さい方が良い場合（例：スプリント時間）
    SELECT MIN((pr.values->>'primary_value')::numeric) INTO v_best_value
    FROM performance_records pr
    WHERE pr.user_id = NEW.user_id
    AND pr.test_type_id = NEW.test_type_id
    AND pr.id != NEW.id;
    
    IF v_best_value IS NULL OR (NEW.values->>'primary_value')::numeric < v_best_value THEN
      v_is_personal_best := true;
    END IF;
  END IF;

  -- ストリーク更新（正しいカラム名 'date' を使用）
  PERFORM update_user_streak(NEW.user_id, 'all', NEW.date);

  -- ポイント付与
  PERFORM award_points(
    NEW.user_id,
    v_base_points,
    'パフォーマンス記録',
    'record',
    jsonb_build_object('record_id', NEW.id, 'record_type', 'performance', 'is_pb', v_is_personal_best)
  );

  -- パーソナルベストバッジ
  IF v_is_personal_best THEN
    PERFORM earn_badge(NEW.user_id, 'パーソナルベスト');
  END IF;

  -- 初回記録チェック
  SELECT COUNT(*) INTO v_total_records
  FROM performance_records
  WHERE user_id = NEW.user_id;

  IF v_total_records = 1 THEN
    SELECT COUNT(*) INTO v_total_records
    FROM training_records
    WHERE user_id = NEW.user_id;
    
    IF v_total_records = 0 THEN
      PERFORM earn_badge(NEW.user_id, 'はじめの一歩');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- トリガーを再作成
DROP TRIGGER IF EXISTS trigger_performance_record_gamification ON performance_records;
CREATE TRIGGER trigger_performance_record_gamification
  AFTER INSERT ON performance_records
  FOR EACH ROW
  EXECUTE FUNCTION process_performance_record_gamification();
