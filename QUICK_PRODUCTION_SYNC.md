# 本番環境へのクイック反映ガイド

開発環境の最新コードとテーブルを本番環境に反映する最速の手順です。

---

## 🚀 3ステップで完了

### ステップ1: マイグレーションを確認 (1分)

```bash
# マイグレーション一覧を表示
npm run migrations:list
```

すべてのマイグレーションファイルが表示されます（現在25個）。

---

### ステップ2: マイグレーションを本番に適用 (5-15分)

#### オプションA: Supabase Dashboard経由（推奨）

1. **Supabase Dashboardを開く**
   - https://supabase.com/dashboard
   - 本番プロジェクト（`ucicxvepktvotvtafowm`）を選択

2. **SQL Editorを開く**
   - 左メニュー → `SQL Editor`

3. **マイグレーションを1つずつ実行**

   ```bash
   # 特定のマイグレーションを表示
   npm run migrations:view 20250622013949_rapid_moon.sql
   ```

   表示されたSQLをコピーして、SQL Editorに貼り付けて実行。

4. **すべてのマイグレーションを順番に実行**
   - 表示される順番通りに実行してください
   - 各実行後、エラーがないか確認

**ヒント**: 既に適用済みのマイグレーションは `relation already exists` エラーが出ます。これは正常です。次に進んでください。

#### オプションB: 一括コピーで実行（上級者向け）

すべてのマイグレーションを一度に実行したい場合：

```bash
# すべてのマイグレーションを結合
cat supabase/migrations/*.sql > /tmp/all_migrations.sql

# ファイルを表示
cat /tmp/all_migrations.sql
```

内容をコピーしてSupabase DashboardのSQL Editorで実行。

---

### ステップ3: コードをデプロイ (5-10分)

#### デプロイ前チェック

```bash
# 1. デプロイ準備ができているか確認
npm run deploy:check

# 2. 本番用ビルド
npm run build:production
```

すべてのチェックが✅になり、ビルドが成功したらデプロイ可能です。

#### Vercelにデプロイ

```bash
# Vercel CLIをインストール（初回のみ）
npm install -g vercel

# 本番環境にデプロイ
vercel --prod
```

または Vercel Dashboardから：
1. プロジェクトを選択
2. `Deploy` をクリック
3. 環境変数が正しいか確認
4. デプロイ

#### Netlifyにデプロイ

```bash
# Netlify CLIをインストール（初回のみ）
npm install -g netlify-cli

# 本番環境にデプロイ
netlify deploy --prod --dir=dist
```

---

## ✅ 完了チェックリスト

デプロイ後、以下を確認してください：

### データベース確認

Supabase Dashboard → `Database` → `Tables` で以下を確認：

- [ ] users テーブルが存在する
- [ ] teams テーブルが存在する
- [ ] training_records テーブルが存在する
- [ ] weight_records テーブルが存在する
- [ ] organizations テーブルが存在する
- [ ] departments テーブルが存在する
- [ ] subscriptions テーブルが存在する（新規）

### アプリケーション確認

本番URLにアクセスして：

- [ ] ログインできる（info@arca.fit）
- [ ] ダッシュボードが表示される
- [ ] データの作成・更新・削除ができる
- [ ] エラーが表示されない

---

## 🔥 最速手順（経験者向け）

1つのコマンドで完了：

```bash
# すべてのマイグレーションをコピー
cat supabase/migrations/*.sql | pbcopy

# Supabase DashboardのSQL Editorに貼り付けて実行

# ビルドとデプロイ
npm run build:production && vercel --prod
```

---

## ⚠️ 注意事項

### 必ずバックアップを取る

マイグレーション実行前：

1. Supabase Dashboard → `Database` → `Backups`
2. `Create backup` をクリック

### 問題が発生したら

**データベースをロールバック:**
1. Supabase Dashboard → `Database` → `Backups`
2. 最新のバックアップから `Restore`

**コードをロールバック:**
- Vercel: デプロイ履歴から以前のバージョンを選択
- Netlify: デプロイ履歴から以前のバージョンを選択

---

## 📚 詳細ガイド

より詳しい手順が必要な場合：

- `MIGRATION_TO_PRODUCTION.md` - 完全な手順書
- `DEPLOYMENT_GUIDE.md` - デプロイメントガイド

---

## 💡 よくある質問

### Q: 既に適用済みのマイグレーションはどうなる？

A: エラーが出ますが、無視してOKです。`IF NOT EXISTS` を使用しているので、既存のテーブルは変更されません。

### Q: マイグレーションの順序を間違えたら？

A: 一部のマイグレーションが失敗する可能性があります。バックアップから復元し、正しい順序で再実行してください。

### Q: すべてのマイグレーションを実行する必要がある？

A: はい。開発環境と本番環境のスキーマを同一にするため、すべて実行してください。

### Q: 本番環境に既にデータがある場合は？

A: マイグレーションは既存データを削除しません。新しいテーブルや列を追加するだけです。ただし、必ずバックアップを取ってください。

---

**所要時間**: 約10-20分
**難易度**: 中級
**リスク**: 低（バックアップがある場合）

---

最終更新: 2025-10-11
