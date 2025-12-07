# ACWR Monitor - デプロイメントガイド

本番環境へのデプロイ手順と環境管理方法を説明します。

## 目次

- [環境の概要](#環境の概要)
- [環境の切り替え方法](#環境の切り替え方法)
- [デプロイ前のチェックリスト](#デプロイ前のチェックリスト)
- [デプロイ手順](#デプロイ手順)
- [推奨デプロイプラットフォーム](#推奨デプロイプラットフォーム)
- [トラブルシューティング](#トラブルシューティング)

---

## 環境の概要

本プロジェクトは2つの環境で運用されます:

### 開発環境 (Development)
- **Supabase URL**: `https://qetusppzdmktdwywxghd.supabase.co`
- **用途**: 開発、テスト、機能追加
- **データ**: テストデータのみ
- **設定ファイル**: `.env.development`

### 本番環境 (Production)
- **Supabase URL**: `https://ucicxvepktvotvtafowm.supabase.co`
- **用途**: 本番運用、実際のユーザーデータ
- **データ**: 本番データ（重要）
- **設定ファイル**: `.env.production`

---

## 環境の切り替え方法

### 開発環境に切り替え

```bash
npm run env:dev
```

### 本番環境に切り替え

```bash
npm run env:prod
```

⚠️ **警告**: 本番環境に切り替えると、すべての操作が実際のデータに影響します。

### 現在の環境を確認

```bash
npm run env:check
```

---

## デプロイ前のチェックリスト

デプロイ前に以下のコマンドで自動チェックを実行してください:

```bash
npm run deploy:check
```

このコマンドは以下を確認します:

- ✅ 本番環境設定が正しく構成されているか
- ✅ ローカルオーバーライド（.env.local）が存在しないか
- ✅ 必要なスクリプトがpackage.jsonに存在するか
- ✅ ハードコードされた認証情報が存在しないか
- ✅ README.mdが存在するか
- ✅ .gitignoreが適切に設定されているか

### 手動チェック項目

1. **データベースマイグレーション**
   - すべてのマイグレーションが本番環境に適用されているか確認
   - Supabaseダッシュボードで確認: Database → Migrations

2. **RLSポリシー**
   - すべてのテーブルでRow Level Security（RLS）が有効になっているか
   - セキュリティポリシーが適切に設定されているか

3. **認証設定**
   - Supabase Authの設定が完了しているか
   - Email確認が適切に設定されているか（デフォルトは無効）

4. **Edge Functions**
   - 必要なEdge Functionsがデプロイされているか
   - 環境変数が正しく設定されているか

---

## デプロイ手順

### 1. 環境の確認

```bash
# 現在の環境を確認
npm run env:check

# 開発環境の場合は本番環境に切り替え
npm run env:prod
```

### 2. デプロイ前チェック

```bash
npm run deploy:check
```

すべてのチェックが✅になるまで問題を修正してください。

### 3. ビルド

```bash
# 本番用ビルド（自動的に本番環境に切り替えてビルド）
npm run build:production
```

または手動で:

```bash
npm run env:prod
npm run build
```

### 4. ローカルプレビュー

```bash
npm run preview
```

ブラウザで http://localhost:4173 にアクセスして動作確認

### 5. デプロイ

選択したプラットフォームにデプロイします（下記参照）

---

## 推奨デプロイプラットフォーム

### Netlify（最推奨）⭐

**利点:**
- 静的サイトホスティングに最適化
- 自動CI/CD（Gitプッシュで自動デプロイ）
- 無料枠が充実（月100GB帯域、300分ビルド時間）
- 環境変数管理が直感的
- カスタムドメイン対応
- HTTPS自動設定
- 高速CDN標準搭載

**手順:**

1. **Netlifyアカウント作成**
   - https://netlify.com でサインアップ

2. **GitHubリポジトリと連携**
   - 「New site from Git」をクリック
   - GitHubリポジトリを選択

3. **ビルド設定**
   - Build command: `npm run build:production`
   - Publish directory: `dist`
   - Node version: 18 (または最新LTS)

4. **環境変数を設定**
   - Site settings → Environment variables
   - 以下を追加:
     ```
     VITE_SUPABASE_URL=https://ucicxvepktvotvtafowm.supabase.co
     VITE_SUPABASE_ANON_KEY=[本番環境のAnon Key]
     ```

5. **デプロイ**
   - 「Deploy site」をクリック
   - 以降はGitプッシュで自動デプロイ

**環境変数の設定場所:**
Site settings → Environment variables → Add a variable

---

### Vercel（代替案1）

**利点:**
- Next.jsに最適化（将来のフレームワーク移行に有利）
- 自動デプロイ
- プレビュー環境
- 簡単な環境変数管理
- 無料プランあり

**手順:**

1. Vercelアカウントを作成: https://vercel.com
2. プロジェクトをインポート
3. 環境変数を設定:
   - `VITE_SUPABASE_URL`: 本番環境のURL
   - `VITE_SUPABASE_ANON_KEY`: 本番環境のAnon Key
4. ビルドコマンドを設定: `npm run build:production`
5. デプロイ

**環境変数の設定場所:**
Project Settings → Environment Variables

---

### Cloudflare Pages（代替案2）

**利点:**
- 無制限帯域（完全無料）
- 世界最速級のCDN
- DDoS保護標準装備

**手順:**

1. Cloudflare Pagesにアクセス: https://pages.cloudflare.com
2. GitHubリポジトリを接続
3. ビルド設定:
   - Build command: `npm run build:production`
   - Build output directory: `dist`
4. 環境変数を設定
5. デプロイ

---

### その他のプラットフォーム

- **AWS Amplify**: エンタープライズ向け、AWSエコシステムとの統合
- **自社サーバー**: Nginx/Apacheでdistフォルダを配信

---

## 重要なセキュリティ注意事項

### 絶対にコミットしてはいけないファイル

- `.env` - ローカル環境設定
- `.env.local` - ローカルオーバーライド
- `.env.*.local` - 個人用設定

### コミットして良いファイル

- `.env.development` - 開発環境テンプレート
- `.env.production` - 本番環境テンプレート（本番キーは含めない）
- `.env.example` - 環境変数の例

⚠️ **重要**: `.env.production` には実際の本番環境の認証情報を含めないでください。デプロイプラットフォームの環境変数機能を使用してください。

---

## 環境変数の管理

### ローカル開発

1. `.env.development` を使用（開発環境）
2. `.env.production` を使用（本番環境のテスト）
3. `.env.local` を作成（個人用オーバーライド、gitignore済み）

### デプロイプラットフォーム

デプロイプラットフォームの環境変数機能を使用:

```
VITE_SUPABASE_URL=https://ucicxvepktvotvtafowm.supabase.co
VITE_SUPABASE_ANON_KEY=[本番環境のAnon Key]
```

**Service Role Key** は絶対にクライアントサイドで使用しないでください。

---

## トラブルシューティング

### 問題: 環境が正しく切り替わらない

**解決策:**

```bash
# 環境を確認
npm run env:check

# 強制的に切り替え
npm run env:prod  # または env:dev
```

### 問題: ビルドが失敗する

**解決策:**

```bash
# 依存関係を再インストール
rm -rf node_modules
npm install

# 再度ビルド
npm run build:production
```

### 問題: デプロイ後に認証エラー

**原因:** 環境変数が正しく設定されていない

**解決策:**
1. デプロイプラットフォームの環境変数を確認
2. VITE_SUPABASE_URLとVITE_SUPABASE_ANON_KEYが正しいか確認
3. 環境変数を更新後、再デプロイ

### 問題: 本番データが表示されない

**原因:** 開発環境を使用している可能性

**解決策:**

```bash
# 環境を確認
npm run env:check

# 本番環境に切り替え
npm run env:prod
npm run build:production
```

### 問題: RLSポリシーエラー

**原因:** Row Level Securityポリシーが正しく設定されていない

**解決策:**
1. Supabaseダッシュボードでテーブルを確認
2. RLSが有効になっているか確認
3. ポリシーが適切に設定されているか確認
4. 必要に応じてマイグレーションを再実行

---

## サポート

問題が発生した場合:

1. `npm run env:check` で環境を確認
2. `npm run deploy:check` でデプロイ準備状況を確認
3. ブラウザのコンソールログを確認
4. Supabaseダッシュボードでログを確認

---

## 関連ドキュメント

- [README.md](./README.md) - プロジェクト概要
- [docs/SUPABASE_SETUP.md](./docs/SUPABASE_SETUP.md) - Supabase設定
- [docs/ENV_PROTECTION.md](./docs/ENV_PROTECTION.md) - 環境変数保護（旧システム）

---

## 推奨構成まとめ

本プロジェクトの本番環境推奨構成:

| コンポーネント | サービス | 状態 | 備考 |
|------------|---------|------|------|
| フロントエンド | Netlify | 推奨 | 静的サイトホスティング |
| データベース | Supabase | 実装済み | PostgreSQL + RLS |
| 認証 | Supabase Auth | 実装済み | メール/パスワード認証 |
| サーバーレス関数 | Supabase Edge Functions | 実装済み | Deno実行環境 |
| メール送信 | Resend | 実装済み | トランザクションメール |
| カスタムドメイン | Netlify/Cloudflare | 要設定 | 独自ドメイン |

**総コスト見積もり（月額）:**
- Netlify: 無料〜$19（プロプランで追加機能）
- Supabase: 無料〜$25（Pro以上で本番運用推奨）
- Resend: 無料〜$10（月3,000通まで無料）

**合計: 無料〜$54/月**

---

**最終更新日**: 2025-11-15
