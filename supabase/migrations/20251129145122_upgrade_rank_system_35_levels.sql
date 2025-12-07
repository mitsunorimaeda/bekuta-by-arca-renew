/*
  # ランク称号システムの35段階への拡張

  ## 概要
  ユーザーのランク称号システムを7大ランクから35段階（7大ランク × 各5レベル）に拡張します。
  これにより、より細かい進捗の可視化と長期的なモチベーション維持を実現します。

  ## 新しいランクシステム

  ### ビギナー (Beginner) I-V: 0-999pt
  - ビギナー I: 0-199pt
  - ビギナー II: 200-399pt
  - ビギナー III: 400-599pt
  - ビギナー IV: 600-799pt
  - ビギナー V: 800-999pt

  ### ブロンズ (Bronze) I-V: 1,000-2,999pt
  - ブロンズ I: 1,000-1,399pt
  - ブロンズ II: 1,400-1,799pt
  - ブロンズ III: 1,800-2,199pt
  - ブロンズ IV: 2,200-2,599pt
  - ブロンズ V: 2,600-2,999pt

  ### シルバー (Silver) I-V: 3,000-4,999pt
  - シルバー I: 3,000-3,399pt
  - シルバー II: 3,400-3,799pt
  - シルバー III: 3,800-4,399pt
  - シルバー IV: 4,400-4,699pt
  - シルバー V: 4,700-4,999pt

  ### ゴールド (Gold) I-V: 5,000-7,999pt
  - ゴールド I: 5,000-5,599pt
  - ゴールド II: 5,600-6,199pt
  - ゴールド III: 6,200-6,799pt
  - ゴールド IV: 6,800-7,399pt
  - ゴールド V: 7,400-7,999pt

  ### プラチナ (Platinum) I-V: 8,000-11,999pt
  - プラチナ I: 8,000-8,799pt
  - プラチナ II: 8,800-9,599pt
  - プラチナ III: 9,600-10,399pt
  - プラチナ IV: 10,400-11,199pt
  - プラチナ V: 11,200-11,999pt

  ### ダイヤモンド (Diamond) I-V: 12,000-17,999pt
  - ダイヤモンド I: 12,000-13,199pt
  - ダイヤモンド II: 13,200-14,399pt
  - ダイヤモンド III: 14,400-15,599pt
  - ダイヤモンド IV: 15,600-16,799pt
  - ダイヤモンド V: 16,800-17,999pt

  ### マスター (Master) I-V: 18,000pt+
  - マスター I: 18,000-19,499pt
  - マスター II: 19,500-20,999pt
  - マスター III: 21,000-22,999pt
  - マスター IV: 23,000-24,999pt
  - マスター V: 25,000pt+

  ## 想定スケジュール（1日30pt平均）
  - 1ヶ月: ビギナー V (900pt)
  - 3ヶ月: ブロンズ V (2,700pt)
  - 6ヶ月: ゴールド II (5,400pt)
  - 1年: プラチナ IV (10,950pt)
  - 2年: マスター II (21,900pt)

  ## 修正内容
  - award_points()関数を更新して35段階のランクタイトルを設定
  - rank_level カラムを追加（I-V）
  - rank_tier カラムを追加（ビギナー、ブロンズ、シルバー、ゴールド、プラチナ、ダイヤモンド、マスター）
*/

-- user_pointsテーブルにカラムを追加
ALTER TABLE user_points ADD COLUMN IF NOT EXISTS rank_tier text DEFAULT 'ビギナー';
ALTER TABLE user_points ADD COLUMN IF NOT EXISTS rank_level text DEFAULT 'I';

-- インデックスを追加
CREATE INDEX IF NOT EXISTS idx_user_points_tier_level ON user_points(rank_tier, rank_level);

-- award_points関数を更新（35段階ランクシステム）
CREATE OR REPLACE FUNCTION award_points(
  p_user_id uuid,
  p_points integer,
  p_reason text,
  p_category text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_points integer;
  v_current_level integer;
  v_new_level integer;
  v_points_for_next integer;
  v_rank_tier text;
  v_rank_level text;
  v_rank_title text;
BEGIN
  -- ポイント履歴を記録
  INSERT INTO point_transactions (user_id, points, reason, category, metadata)
  VALUES (p_user_id, p_points, p_reason, p_category, p_metadata);

  -- user_pointsの初期化または更新
  INSERT INTO user_points (user_id, total_points)
  VALUES (p_user_id, p_points)
  ON CONFLICT (user_id)
  DO UPDATE SET
    total_points = user_points.total_points + p_points,
    updated_at = now();

  -- 現在の合計ポイントとレベルを取得
  SELECT total_points, current_level
  INTO v_total_points, v_current_level
  FROM user_points
  WHERE user_id = p_user_id;

  -- レベル計算（100ポイントごとに1レベルアップ、レベルが上がるごとに必要ポイント増加）
  v_new_level := 1;
  v_points_for_next := 100;

  WHILE v_total_points >= v_points_for_next LOOP
    v_new_level := v_new_level + 1;
    v_points_for_next := v_points_for_next + (v_new_level * 50);
  END LOOP;

  -- 35段階ランクシステム（7大ランク × 5レベル）
  -- ポイントに基づいてランクを決定
  IF v_total_points >= 25000 THEN
    v_rank_tier := 'マスター';
    v_rank_level := 'V';
    v_rank_title := 'マスター V';
  ELSIF v_total_points >= 23000 THEN
    v_rank_tier := 'マスター';
    v_rank_level := 'IV';
    v_rank_title := 'マスター IV';
  ELSIF v_total_points >= 21000 THEN
    v_rank_tier := 'マスター';
    v_rank_level := 'III';
    v_rank_title := 'マスター III';
  ELSIF v_total_points >= 19500 THEN
    v_rank_tier := 'マスター';
    v_rank_level := 'II';
    v_rank_title := 'マスター II';
  ELSIF v_total_points >= 18000 THEN
    v_rank_tier := 'マスター';
    v_rank_level := 'I';
    v_rank_title := 'マスター I';
  ELSIF v_total_points >= 16800 THEN
    v_rank_tier := 'ダイヤモンド';
    v_rank_level := 'V';
    v_rank_title := 'ダイヤモンド V';
  ELSIF v_total_points >= 15600 THEN
    v_rank_tier := 'ダイヤモンド';
    v_rank_level := 'IV';
    v_rank_title := 'ダイヤモンド IV';
  ELSIF v_total_points >= 14400 THEN
    v_rank_tier := 'ダイヤモンド';
    v_rank_level := 'III';
    v_rank_title := 'ダイヤモンド III';
  ELSIF v_total_points >= 13200 THEN
    v_rank_tier := 'ダイヤモンド';
    v_rank_level := 'II';
    v_rank_title := 'ダイヤモンド II';
  ELSIF v_total_points >= 12000 THEN
    v_rank_tier := 'ダイヤモンド';
    v_rank_level := 'I';
    v_rank_title := 'ダイヤモンド I';
  ELSIF v_total_points >= 11200 THEN
    v_rank_tier := 'プラチナ';
    v_rank_level := 'V';
    v_rank_title := 'プラチナ V';
  ELSIF v_total_points >= 10400 THEN
    v_rank_tier := 'プラチナ';
    v_rank_level := 'IV';
    v_rank_title := 'プラチナ IV';
  ELSIF v_total_points >= 9600 THEN
    v_rank_tier := 'プラチナ';
    v_rank_level := 'III';
    v_rank_title := 'プラチナ III';
  ELSIF v_total_points >= 8800 THEN
    v_rank_tier := 'プラチナ';
    v_rank_level := 'II';
    v_rank_title := 'プラチナ II';
  ELSIF v_total_points >= 8000 THEN
    v_rank_tier := 'プラチナ';
    v_rank_level := 'I';
    v_rank_title := 'プラチナ I';
  ELSIF v_total_points >= 7400 THEN
    v_rank_tier := 'ゴールド';
    v_rank_level := 'V';
    v_rank_title := 'ゴールド V';
  ELSIF v_total_points >= 6800 THEN
    v_rank_tier := 'ゴールド';
    v_rank_level := 'IV';
    v_rank_title := 'ゴールド IV';
  ELSIF v_total_points >= 6200 THEN
    v_rank_tier := 'ゴールド';
    v_rank_level := 'III';
    v_rank_title := 'ゴールド III';
  ELSIF v_total_points >= 5600 THEN
    v_rank_tier := 'ゴールド';
    v_rank_level := 'II';
    v_rank_title := 'ゴールド II';
  ELSIF v_total_points >= 5000 THEN
    v_rank_tier := 'ゴールド';
    v_rank_level := 'I';
    v_rank_title := 'ゴールド I';
  ELSIF v_total_points >= 4700 THEN
    v_rank_tier := 'シルバー';
    v_rank_level := 'V';
    v_rank_title := 'シルバー V';
  ELSIF v_total_points >= 4400 THEN
    v_rank_tier := 'シルバー';
    v_rank_level := 'IV';
    v_rank_title := 'シルバー IV';
  ELSIF v_total_points >= 3800 THEN
    v_rank_tier := 'シルバー';
    v_rank_level := 'III';
    v_rank_title := 'シルバー III';
  ELSIF v_total_points >= 3400 THEN
    v_rank_tier := 'シルバー';
    v_rank_level := 'II';
    v_rank_title := 'シルバー II';
  ELSIF v_total_points >= 3000 THEN
    v_rank_tier := 'シルバー';
    v_rank_level := 'I';
    v_rank_title := 'シルバー I';
  ELSIF v_total_points >= 2600 THEN
    v_rank_tier := 'ブロンズ';
    v_rank_level := 'V';
    v_rank_title := 'ブロンズ V';
  ELSIF v_total_points >= 2200 THEN
    v_rank_tier := 'ブロンズ';
    v_rank_level := 'IV';
    v_rank_title := 'ブロンズ IV';
  ELSIF v_total_points >= 1800 THEN
    v_rank_tier := 'ブロンズ';
    v_rank_level := 'III';
    v_rank_title := 'ブロンズ III';
  ELSIF v_total_points >= 1400 THEN
    v_rank_tier := 'ブロンズ';
    v_rank_level := 'II';
    v_rank_title := 'ブロンズ II';
  ELSIF v_total_points >= 1000 THEN
    v_rank_tier := 'ブロンズ';
    v_rank_level := 'I';
    v_rank_title := 'ブロンズ I';
  ELSIF v_total_points >= 800 THEN
    v_rank_tier := 'ビギナー';
    v_rank_level := 'V';
    v_rank_title := 'ビギナー V';
  ELSIF v_total_points >= 600 THEN
    v_rank_tier := 'ビギナー';
    v_rank_level := 'IV';
    v_rank_title := 'ビギナー IV';
  ELSIF v_total_points >= 400 THEN
    v_rank_tier := 'ビギナー';
    v_rank_level := 'III';
    v_rank_title := 'ビギナー III';
  ELSIF v_total_points >= 200 THEN
    v_rank_tier := 'ビギナー';
    v_rank_level := 'II';
    v_rank_title := 'ビギナー II';
  ELSE
    v_rank_tier := 'ビギナー';
    v_rank_level := 'I';
    v_rank_title := 'ビギナー I';
  END IF;

  -- レベルとランクタイトルの更新
  UPDATE user_points
  SET
    current_level = v_new_level,
    points_to_next_level = v_points_for_next - v_total_points,
    rank_title = v_rank_title,
    rank_tier = v_rank_tier,
    rank_level = v_rank_level,
    updated_at = now()
  WHERE user_id = p_user_id;
END;
$$;

-- 既存ユーザーのランクを再計算
DO $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN SELECT user_id, total_points FROM user_points LOOP
    PERFORM award_points(
      user_record.user_id,
      0,
      'ランクシステムアップグレード',
      'bonus',
      '{"migration": true}'::jsonb
    );
  END LOOP;
END $$;
