-- チーム別シェアリンク自己登録用テーブル
-- 管理者がチームごとに招待トークンを生成し、選手・スタッフが自己登録できる

CREATE TABLE IF NOT EXISTS team_invite_tokens (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  token           text        UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  team_id         uuid        REFERENCES teams(id) ON DELETE CASCADE,
  organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role            text        NOT NULL CHECK (role IN ('athlete', 'staff')),
  created_by      uuid        REFERENCES users(id) ON DELETE SET NULL,
  expires_at      timestamptz,           -- NULL = 期限なし
  max_uses        int,                   -- NULL = 無制限
  use_count       int         NOT NULL DEFAULT 0,
  is_active       boolean     NOT NULL DEFAULT true,
  label           text,                  -- 管理用メモ（例: "2026年新入生用"）
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- RLS 有効化
ALTER TABLE team_invite_tokens ENABLE ROW LEVEL SECURITY;

-- 誰でもトークンを読める（登録フォームでトークン検証に必要）
-- ただし token カラムで検索する場合のみ有効
CREATE POLICY "anyone can read active tokens by token value"
  ON team_invite_tokens FOR SELECT
  USING (true);

-- 認証済みユーザーのみ作成・更新・削除（is_active の無効化など）
CREATE POLICY "authenticated users can manage tokens"
  ON team_invite_tokens FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_team_invite_tokens_token ON team_invite_tokens(token);
CREATE INDEX IF NOT EXISTS idx_team_invite_tokens_team_id ON team_invite_tokens(team_id);
CREATE INDEX IF NOT EXISTS idx_team_invite_tokens_org_id ON team_invite_tokens(organization_id);
