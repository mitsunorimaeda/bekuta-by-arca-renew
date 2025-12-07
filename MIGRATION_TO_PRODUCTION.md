# 本番環境へのマイグレーション手順

## 概要

このガイドは、開発環境で作成・テストしたデータベース変更を本番環境に安全に反映する手順を説明します。

---

## 事前準備

### 1. 現在のマイグレーション状態を確認

```bash
# 開発環境のマイグレーションファイル一覧
ls -la supabase/migrations/
```

### 2. 本番環境の現在の状態を確認

1. [Supabase Dashboard](https://supabase.com/dashboard)にログイン
2. 本番プロジェクト（`ucicxvepktvotvtafowm`）を選択
3. `Database` → `Migrations` で適用済みマイグレーションを確認

---

## 方法A: Supabase Dashboard経由（推奨）

最も安全な方法です。各マイグレーションを確認しながら手動で実行します。

### ステップ1: 本番環境にアクセス

1. [Supabase Dashboard](https://supabase.com/dashboard)
2. 本番プロジェクト（`ucicxvepktvotvtafowm`）を選択
3. `SQL Editor` を開く

### ステップ2: マイグレーションを順番に実行

**重要**: マイグレーションは必ず作成日時順に実行してください。

#### 実行するマイグレーション一覧

プロジェクトの `supabase/migrations/` フォルダにあるSQLファイルを、以下の順序で実行します：

1. `20250622013949_rapid_moon.sql` - 初期スキーマ
2. `20250622041459_plain_ember.sql`
3. `20250622043749_graceful_pond.sql`
4. `20250622045232_wild_sun.sql`
5. `20250622065231_snowy_shrine.sql`
6. `20250622071423_wispy_darkness.sql`
7. `20250622073359_nameless_boat.sql`
8. `20250622073534_small_spring.sql`
9. `20250622073618_pink_scene.sql`
10. `20250622080410_rustic_torch.sql`
11. `20250804123911_wispy_base.sql`
12. `20251005031711_add_weight_records.sql`
13. `20251005050431_sync_auth_users_trigger.sql`
14. `20251009003528_fix_admin_role.sql`
15. `20251009020646_create_weight_records_table.sql`
16. `20251009133650_add_email_notification_preferences.sql`
17. `20251009135238_add_tutorial_progress.sql`
18. `20251009205958_add_organization_hierarchy_tables.sql`
19. `20251009210139_add_organization_data_integrity_protection.sql`
20. `20251011073000_add_subscription_billing_tables.sql`
21. `20251011074803_fix_organization_rls_policies.sql`
22. `20251011074841_set_admin_user.sql`
23. `20251011080232_20251011080000_enable_organization_hierarchy.sql`
24. `20251011080316_20251011080100_add_organization_data_integrity.sql`
25. `20251011080551_20251011080200_fix_organization_rls_access.sql`

### ステップ3: 各マイグレーションの実行手順

各SQLファイルに対して：

1. **ファイルを開く**
   ```bash
   cat supabase/migrations/[ファイル名].sql
   ```

2. **内容を確認**
   - マイグレーションの先頭にあるコメントを読む
   - 何をするマイグレーションか理解する

3. **SQL Editorにコピペ**
   - Supabase DashboardのSQL Editorにコードをコピー

4. **実行前チェック**
   - 破壊的な操作（DROP、DELETE）がないか確認
   - 既存データへの影響を確認

5. **実行**
   - `RUN` ボタンをクリック
   - エラーがないか確認

6. **結果を確認**
   - 成功メッセージを確認
   - `Database` → `Tables` で新しいテーブルを確認

### ステップ4: 検証

すべてのマイグレーションを実行後：

1. **テーブル構造を確認**
   ```
   Database → Tables
   ```
   以下のテーブルが存在することを確認：
   - users
   - teams
   - training_records
   - weight_records
   - organizations
   - departments
   - organization_members
   - department_managers
   - staff_team_links
   - tutorial_progress
   - menstrual_cycles
   - subscriptions
   - billing_history

2. **RLSポリシーを確認**
   各テーブルで `Row Level Security` が有効になっていることを確認

3. **トリガーと関数を確認**
   ```sql
   SELECT * FROM pg_trigger;
   ```

---

## 方法B: Supabase CLI経由（上級者向け）

Supabase CLIを使用すると、マイグレーションを自動的に実行できます。

### 前提条件

```bash
# Supabase CLIをインストール
npm install -g supabase

# ログイン
supabase login

# プロジェクトとリンク
supabase link --project-ref ucicxvepktvotvtafowm
```

### マイグレーション実行

```bash
# 本番環境に接続
supabase db push --db-url "postgresql://postgres:[PASSWORD]@db.ucicxvepktvotvtafowm.supabase.co:5432/postgres"
```

**注意**: この方法は自動的にすべてのマイグレーションを実行するため、慎重に使用してください。

---

## 方法C: スクリプト経由で実行（完全自動）

すべてのマイグレーションを一度に実行するスクリプトを使用します。

### ステップ1: マイグレーション実行スクリプトを作成

プロジェクトルートに以下のスクリプトを作成：

```bash
node scripts/apply-migrations-to-production.mjs
```

### ステップ2: 実行

```bash
npm run migrate:production
```

**警告**: この方法は最も危険です。必ずバックアップを取ってから実行してください。

---

## コードの反映（フロントエンド）

マイグレーション完了後、フロントエンドコードをデプロイします。

### ステップ1: デプロイ前チェック

```bash
npm run deploy:check
```

すべてのチェックが✅になることを確認。

### ステップ2: 本番用ビルド

```bash
npm run build:production
```

### ステップ3: デプロイ

選択したプラットフォーム（Vercel、Netlifyなど）にデプロイ：

#### Vercelの場合

```bash
# Vercel CLIをインストール（初回のみ）
npm install -g vercel

# デプロイ
vercel --prod
```

#### Netlifyの場合

```bash
# Netlify CLIをインストール（初回のみ）
npm install -g netlify-cli

# デプロイ
netlify deploy --prod --dir=dist
```

---

## 安全のためのベストプラクティス

### 1. バックアップを取る

マイグレーション実行前に必ずバックアップを取得：

1. Supabase Dashboard → `Database` → `Backups`
2. `Create backup` をクリック

### 2. ステージング環境でテスト

可能であれば、ステージング環境で先にテストします：

```bash
# ステージング環境用の設定を作成
cp .env.production .env.staging

# ステージング環境に切り替え
npm run env:staging
```

### 3. ロールバック計画を準備

問題が発生した場合の対処方法：

1. **データベースのロールバック**
   - Supabase Dashboard → `Database` → `Backups`
   - 最新のバックアップから復元

2. **コードのロールバック**
   - 以前のデプロイバージョンに戻す
   - Vercel: デプロイ履歴から選択
   - Netlify: デプロイ履歴から選択

### 4. 段階的に実行

すべてを一度に実行せず、段階的に：

1. 重要度の低いマイグレーションから開始
2. 各マイグレーション後に動作確認
3. 問題があれば即座に停止

---

## トラブルシューティング

### エラー: "relation already exists"

**原因**: テーブルが既に存在する

**解決策**:
1. マイグレーションファイルで `IF NOT EXISTS` を使用
2. または、既存のテーブルをスキップ

### エラー: "column does not exist"

**原因**: 依存するマイグレーションが実行されていない

**解決策**:
1. マイグレーションの順序を確認
2. 依存するマイグレーションを先に実行

### エラー: "permission denied"

**原因**: データベースの権限が不足

**解決策**:
1. Service Role Keyを使用していることを確認
2. Supabase Dashboardから実行（推奨）

---

## チェックリスト

本番環境への反映前に確認：

- [ ] 開発環境ですべての機能が正常に動作している
- [ ] すべてのマイグレーションファイルを確認した
- [ ] バックアップを取得した
- [ ] デプロイ前チェック（`npm run deploy:check`）が成功した
- [ ] ロールバック計画を準備した
- [ ] チームメンバーに通知した（該当する場合）
- [ ] メンテナンス時間を設定した（必要に応じて）

本番環境への反映後に確認：

- [ ] すべてのテーブルが作成されている
- [ ] RLSポリシーが有効になっている
- [ ] フロントエンドが正常に動作している
- [ ] ログインできる
- [ ] データの作成・更新・削除が正常に動作する
- [ ] エラーログを確認した

---

## サポート

問題が発生した場合：

1. エラーメッセージを確認
2. Supabase Dashboardのログを確認
3. バックアップから復元を検討
4. `DEPLOYMENT_GUIDE.md` のトラブルシューティングを参照

---

**最終更新**: 2025-10-11
