-- 一斉通知の送信履歴テーブル
CREATE TABLE IF NOT EXISTS notification_broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  sender_user_id UUID NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('all', 'selected')),
  recipient_user_ids UUID[] DEFAULT '{}',
  recipients_count INT NOT NULL DEFAULT 0,
  delivered_count INT NOT NULL DEFAULT 0,
  failed_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE notification_broadcasts ENABLE ROW LEVEL SECURITY;

-- コーチ（staff_team_links経由）のみ閲覧可
CREATE POLICY "Staff can view own team broadcasts"
  ON notification_broadcasts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff_team_links stl
      WHERE stl.team_id = notification_broadcasts.team_id
        AND stl.staff_user_id = auth.uid()
    )
  );

-- コーチのみ挿入可
CREATE POLICY "Staff can insert own team broadcasts"
  ON notification_broadcasts FOR INSERT
  WITH CHECK (
    sender_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM staff_team_links stl
      WHERE stl.team_id = notification_broadcasts.team_id
        AND stl.staff_user_id = auth.uid()
    )
  );

CREATE INDEX idx_notification_broadcasts_team_created
  ON notification_broadcasts(team_id, created_at DESC);

-- チーム選手のPush登録状況を返すRPC
CREATE OR REPLACE FUNCTION get_team_push_status(p_team_id UUID)
RETURNS TABLE(user_id UUID, user_name TEXT, has_push BOOLEAN)
LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT
    u.id AS user_id,
    u.name AS user_name,
    EXISTS (
      SELECT 1 FROM push_subscriptions ps WHERE ps.user_id = u.id
    ) AS has_push
  FROM users u
  WHERE u.team_id = p_team_id
    AND u.role = 'athlete'
    AND u.is_active = true
  ORDER BY u.name;
$$;
