# Supabase 設定ガイド

## 重要な注意事項

このプロジェクトは **特定の Supabase プロジェクト** に接続する必要があります。

### 正しい Supabase プロジェクト

```
URL: https://ucicxvepktvotvtafowm.supabase.co
プロジェクト参照: ucicxvepktvotvtafowm
```

### 使用してはいけないプロジェクト

```
❌ https://qetusppzdmktdwywxghd.supabase.co （間違い！）
```

このURLは古いプロジェクトまたは誤ったプロジェクトです。このURLを使用すると、ログインやデータベース操作が失敗します。

## 環境設定

### 1. 環境変数ファイルの作成

`.env.example` をコピーして `.env` を作成してください：

```bash
cp .env.example .env
```

### 2. 環境変数の確認

`.env` ファイルには以下の内容が含まれている必要があります：

```env
VITE_SUPABASE_URL=https://ucicxvepktvotvtafowm.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 3. 環境変数の検証

設定が正しいか確認するには：

```bash
npm run validate-env
```

このコマンドは環境変数をチェックし、間違った Supabase URL が設定されている場合は警告を表示します。

## 問題のトラブルシューティング

### ログインできない場合

1. `.env` ファイルの `VITE_SUPABASE_URL` を確認
2. 正しいURL（`https://ucicxvepktvotvtafowm.supabase.co`）であることを確認
3. 間違ったURLの場合は、`.env.example` からコピーして修正
4. 環境変数を検証：`npm run validate-env`
5. 開発サーバーを再起動

### 環境設定が勝手に変更された場合

Bolt やその他のツールによって `.env` ファイルが誤って変更されることがあります。

**復旧手順：**

1. `.env.example` を確認（これは常に正しい設定を保持）
2. `.env` を削除
3. `.env.example` をコピー：`cp .env.example .env`
4. 検証スクリプトを実行：`npm run validate-env`
5. 開発サーバーを再起動

## 自動保護機能

このプロジェクトには、間違った Supabase 設定での起動を防ぐ保護機能が含まれています：

### 1. 開発サーバー起動時の検証

`npm run dev` を実行すると、自動的に環境変数が検証されます。間違った設定の場合、サーバーは起動せず、エラーメッセージが表示されます。

### 2. アプリケーションレベルの検証

`src/lib/supabase.ts` には、アプリケーション起動時に Supabase URL をチェックするロジックが含まれています。間違った URL が検出された場合、アプリケーションは起動せず、詳細なエラーメッセージが表示されます。

### 3. スクリプトの環境変数読み込み

すべてのスクリプト（管理者作成、パスワードリセットなど）は、ハードコードされた値ではなく `.env` ファイルから環境変数を読み込みます。

## 管理者アカウントの作成

正しい Supabase 設定が確認できたら、管理者アカウントを作成できます：

```bash
node scripts/direct-create-admin.mjs
```

このスクリプトは自動的に `.env` から環境変数を読み込み、正しい Supabase プロジェクトに管理者を作成します。

## よくある質問

**Q: なぜ特定の Supabase プロジェクトを使用する必要があるのですか？**

A: このアプリケーションのデータベーススキーマ、認証設定、RLS ポリシーは特定の Supabase プロジェクトに設定されています。別のプロジェクトを使用すると、データが見つからない、認証が失敗するなどの問題が発生します。

**Q: 新しい Supabase プロジェクトに移行したい場合は？**

A: 新しいプロジェクトに移行するには：
1. すべてのマイグレーションファイル（`supabase/migrations/`）を新しいプロジェクトに適用
2. Edge Functions をデプロイ
3. `.env` ファイルを新しいプロジェクトの URL とキーで更新
4. `src/lib/supabase.ts` の `CORRECT_SUPABASE_URL` を更新
5. `.env.example` も更新

**Q: 環境変数検証を無効にできますか？**

A: 技術的には可能ですが、**強く推奨しません**。検証機能は、間違った設定によるデータ損失や認証エラーを防ぐために実装されています。

## サポート

問題が解決しない場合は、以下の情報を含めて管理者に連絡してください：

- `.env` ファイルの内容（キーは含めずに URL のみ）
- `npm run validate-env` の出力
- ブラウザのコンソールに表示されるエラーメッセージ
- 実行しようとしている操作（ログイン、データ作成など）
