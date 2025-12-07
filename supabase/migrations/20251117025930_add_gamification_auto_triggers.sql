/*
  # ゲーミフィケーション自動トリガーの追加

  ## 概要
  データ記録時に自動的にゲーミフィケーション報酬を付与するトリガーシステムを構築します。

  ## 新機能
  1. **自動ポイント付与**: 各種記録追加時に自動的にポイントを付与
  2. **自動ストリーク更新**: 記録追加時にストリークを自動更新
  3. **自動バッジチェック**: 条件達成時に自動的にバッジを付与

  ## トリガー対象テーブル
  - `training_records` - トレーニング記録
  - `weight_records` - 体重記録
  - `sleep_records` - 睡眠記録
  - `motivation_records` - モチベーション記録
  - `performance_records` - パフォーマンス記録

  ## ポイント体系
  - トレーニング記録: 10ポイント
  - パフォーマンス記録: 15ポイント
  - 体重記録: 5ポイント
  - 睡眠記録: 5ポイント
  - モチベーション記録: 5ポイント
  - 早朝記録ボーナス (5-6時): +10ポイント

  ## バッジ自動チェック
  - はじめの一歩: 初回記録時
  - 7日連続: ストリーク7日達成時
  - 30日連続: ストリーク30日達成時
  - 100日連続: ストリーク100日達成時
  - 記録マニア: 合計100記録達成時

  ## セキュリティ
  - SECURITY DEFINER関数でユーザー権限に依存しない実行
  - トリガーは記録追加時のみ実行（更新・削除では実行しない）
*/

-- トリガー関数: トレーニング記録追加時のゲーミフィケーション処理
CREATE OR REPLACE FUNCTION process_training_record_gamification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_base_points integer := 10;
  v_bonus_points integer := 0;
  v_hour integer;
  v_is_first_record boolean;
  v_total_records integer;
  v_current_streak integer;
BEGIN
  -- 早朝ボーナスチェック (5-6時)
  v_hour := EXTRACT(HOUR FROM now());
  IF v_hour >= 5 AND v_hour < 6 THEN
    v_bonus_points := 10;
  END IF;

  -- ストリーク更新
  PERFORM update_user_streak(NEW.user_id, 'training', NEW.date::date);
  PERFORM update_user_streak(NEW.user_id, 'all', NEW.date::date);

  -- ポイント付与
  PERFORM award_points(
    NEW.user_id,
    v_base_points + v_bonus_points,
    CASE 
      WHEN v_bonus_points > 0 THEN '練習記録（早朝ボーナス）'
      ELSE '練習記録'
    END,
    'record',
    jsonb_build_object('record_id', NEW.id, 'record_type', 'training')
  );

  -- 初回記録チェック
  SELECT COUNT(*) INTO v_total_records
  FROM training_records
  WHERE user_id = NEW.user_id;

  IF v_total_records = 1 THEN
    PERFORM earn_badge(NEW.user_id, 'はじめの一歩');
  END IF;

  -- ストリークバッジチェック
  SELECT current_streak INTO v_current_streak
  FROM user_streaks
  WHERE user_id = NEW.user_id AND streak_type = 'training';

  IF v_current_streak = 7 THEN
    PERFORM earn_badge(NEW.user_id, '7日連続');
  ELSIF v_current_streak = 30 THEN
    PERFORM earn_badge(NEW.user_id, '30日連続');
  ELSIF v_current_streak = 100 THEN
    PERFORM earn_badge(NEW.user_id, '100日連続');
  END IF;

  -- 合計記録数バッジチェック
  SELECT total_records INTO v_total_records
  FROM user_streaks
  WHERE user_id = NEW.user_id AND streak_type = 'all';

  IF v_total_records = 100 THEN
    PERFORM earn_badge(NEW.user_id, '記録マニア');
  END IF;

  RETURN NEW;
END;
$$;

-- トリガー関数: 体重記録追加時のゲーミフィケーション処理
CREATE OR REPLACE FUNCTION process_weight_record_gamification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_base_points integer := 5;
  v_total_records integer;
  v_current_streak integer;
BEGIN
  -- ストリーク更新
  PERFORM update_user_streak(NEW.user_id, 'weight', NEW.date::date);
  PERFORM update_user_streak(NEW.user_id, 'all', NEW.date::date);

  -- ポイント付与
  PERFORM award_points(
    NEW.user_id,
    v_base_points,
    '体重記録',
    'record',
    jsonb_build_object('record_id', NEW.id, 'record_type', 'weight')
  );

  -- 初回記録チェック
  SELECT COUNT(*) INTO v_total_records
  FROM weight_records
  WHERE user_id = NEW.user_id;

  IF v_total_records = 1 THEN
    SELECT COUNT(*) INTO v_total_records
    FROM training_records
    WHERE user_id = NEW.user_id;
    
    IF v_total_records = 0 THEN
      PERFORM earn_badge(NEW.user_id, 'はじめの一歩');
    END IF;
  END IF;

  -- ストリークバッジチェック
  SELECT current_streak INTO v_current_streak
  FROM user_streaks
  WHERE user_id = NEW.user_id AND streak_type = 'weight';

  IF v_current_streak = 7 THEN
    PERFORM earn_badge(NEW.user_id, '7日連続');
  ELSIF v_current_streak = 30 THEN
    PERFORM earn_badge(NEW.user_id, '30日連続');
  ELSIF v_current_streak = 100 THEN
    PERFORM earn_badge(NEW.user_id, '100日連続');
  END IF;

  RETURN NEW;
END;
$$;

-- トリガー関数: 睡眠記録追加時のゲーミフィケーション処理
CREATE OR REPLACE FUNCTION process_sleep_record_gamification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_base_points integer := 5;
  v_total_records integer;
  v_current_streak integer;
BEGIN
  -- ストリーク更新
  PERFORM update_user_streak(NEW.user_id, 'sleep', NEW.date::date);
  PERFORM update_user_streak(NEW.user_id, 'all', NEW.date::date);

  -- ポイント付与
  PERFORM award_points(
    NEW.user_id,
    v_base_points,
    '睡眠記録',
    'record',
    jsonb_build_object('record_id', NEW.id, 'record_type', 'sleep')
  );

  -- 初回記録チェック
  SELECT COUNT(*) INTO v_total_records
  FROM sleep_records
  WHERE user_id = NEW.user_id;

  IF v_total_records = 1 THEN
    SELECT COUNT(*) INTO v_total_records
    FROM training_records
    WHERE user_id = NEW.user_id;
    
    IF v_total_records = 0 THEN
      PERFORM earn_badge(NEW.user_id, 'はじめの一歩');
    END IF;
  END IF;

  -- ストリークバッジチェック
  SELECT current_streak INTO v_current_streak
  FROM user_streaks
  WHERE user_id = NEW.user_id AND streak_type = 'sleep';

  IF v_current_streak = 7 THEN
    PERFORM earn_badge(NEW.user_id, '7日連続');
  ELSIF v_current_streak = 30 THEN
    PERFORM earn_badge(NEW.user_id, '30日連続');
  ELSIF v_current_streak = 100 THEN
    PERFORM earn_badge(NEW.user_id, '100日連続');
  END IF;

  RETURN NEW;
END;
$$;

-- トリガー関数: モチベーション記録追加時のゲーミフィケーション処理
CREATE OR REPLACE FUNCTION process_motivation_record_gamification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_base_points integer := 5;
  v_total_records integer;
  v_current_streak integer;
BEGIN
  -- ストリーク更新
  PERFORM update_user_streak(NEW.user_id, 'motivation', NEW.date::date);
  PERFORM update_user_streak(NEW.user_id, 'all', NEW.date::date);

  -- ポイント付与
  PERFORM award_points(
    NEW.user_id,
    v_base_points,
    'モチベーション記録',
    'record',
    jsonb_build_object('record_id', NEW.id, 'record_type', 'motivation')
  );

  -- 初回記録チェック
  SELECT COUNT(*) INTO v_total_records
  FROM motivation_records
  WHERE user_id = NEW.user_id;

  IF v_total_records = 1 THEN
    SELECT COUNT(*) INTO v_total_records
    FROM training_records
    WHERE user_id = NEW.user_id;
    
    IF v_total_records = 0 THEN
      PERFORM earn_badge(NEW.user_id, 'はじめの一歩');
    END IF;
  END IF;

  -- ストリークバッジチェック
  SELECT current_streak INTO v_current_streak
  FROM user_streaks
  WHERE user_id = NEW.user_id AND streak_type = 'motivation';

  IF v_current_streak = 7 THEN
    PERFORM earn_badge(NEW.user_id, '7日連続');
  ELSIF v_current_streak = 30 THEN
    PERFORM earn_badge(NEW.user_id, '30日連続');
  ELSIF v_current_streak = 100 THEN
    PERFORM earn_badge(NEW.user_id, '100日連続');
  END IF;

  RETURN NEW;
END;
$$;

-- トリガー関数: パフォーマンス記録追加時のゲーミフィケーション処理
CREATE OR REPLACE FUNCTION process_performance_record_gamification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_base_points integer := 15;
  v_total_records integer;
  v_is_personal_best boolean := false;
BEGIN
  -- パーソナルベストチェック（同じテストでの過去最高値）
  SELECT NOT EXISTS (
    SELECT 1 FROM performance_records
    WHERE user_id = NEW.user_id
    AND test_id = NEW.test_id
    AND value > NEW.value
    AND id != NEW.id
  ) INTO v_is_personal_best;

  -- ストリーク更新（パフォーマンス記録は日付ベースのストリークに含めない）
  PERFORM update_user_streak(NEW.user_id, 'all', NEW.recorded_date::date);

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

-- トリガーの作成
DROP TRIGGER IF EXISTS trigger_training_record_gamification ON training_records;
CREATE TRIGGER trigger_training_record_gamification
  AFTER INSERT ON training_records
  FOR EACH ROW
  EXECUTE FUNCTION process_training_record_gamification();

DROP TRIGGER IF EXISTS trigger_weight_record_gamification ON weight_records;
CREATE TRIGGER trigger_weight_record_gamification
  AFTER INSERT ON weight_records
  FOR EACH ROW
  EXECUTE FUNCTION process_weight_record_gamification();

DROP TRIGGER IF EXISTS trigger_sleep_record_gamification ON sleep_records;
CREATE TRIGGER trigger_sleep_record_gamification
  AFTER INSERT ON sleep_records
  FOR EACH ROW
  EXECUTE FUNCTION process_sleep_record_gamification();

DROP TRIGGER IF EXISTS trigger_motivation_record_gamification ON motivation_records;
CREATE TRIGGER trigger_motivation_record_gamification
  AFTER INSERT ON motivation_records
  FOR EACH ROW
  EXECUTE FUNCTION process_motivation_record_gamification();

DROP TRIGGER IF EXISTS trigger_performance_record_gamification ON performance_records;
CREATE TRIGGER trigger_performance_record_gamification
  AFTER INSERT ON performance_records
  FOR EACH ROW
  EXECUTE FUNCTION process_performance_record_gamification();
