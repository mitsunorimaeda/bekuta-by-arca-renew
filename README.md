# Bekuta by ARCA

データサイエンスによるトレーニング負荷管理システム。急性・慢性ワークロード比（ACWR）を用いて、アスリートの怪我リスクを可視化し、パフォーマンス最適化をサポートします。

## 主な機能

- トレーニング負荷の記録と追跡
- ACWR の自動計算とグラフ表示
- 怪我リスクアラートの自動生成
- ユーザー役割別の画面（アスリート、スタッフ、管理者）
- ダークモード対応
- レスポンシブデザイン

## クイックスタート

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境設定

開発環境に切り替え：

```bash
npm run env:dev
```

現在の環境を確認：

```bash
npm run env:check
```

### 3. 開発サーバーの起動

```bash
npm run dev
```

### 4. ログイン

デフォルトの管理者アカウント：
- メール: `info@arca.fit`
- パスワード: `Admin2024!`

初回ログイン時にパスワード変更が求められます。

## プロジェクト構造

```
acwr-monitor-app/
├── src/
│   ├── components/        # React コンポーネント
│   ├── hooks/            # カスタム React フック
│   ├── lib/              # ユーティリティとライブラリ
│   └── App.tsx           # メインアプリケーション
├── supabase/
│   ├── migrations/       # データベースマイグレーション
│   └── functions/        # Edge Functions
├── scripts/              # 管理スクリプト
├── .env                  # 環境変数（gitignore済み）
└── .env.example          # 環境変数テンプレート
```

## 重要なドキュメント

### 本番環境へのデプロイ
- **[QUICK_PRODUCTION_SYNC.md](./QUICK_PRODUCTION_SYNC.md)** - ⚡ 最速で本番環境に反映（3ステップ）
- **[MIGRATION_TO_PRODUCTION.md](./MIGRATION_TO_PRODUCTION.md)** - 📋 マイグレーション完全ガイド
- **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)** - 📦 デプロイメントガイド

### 設定とトラブルシューティング
- **[docs/SUPABASE_SETUP.md](./docs/SUPABASE_SETUP.md)** - Supabase 設定
- **[docs/PASSWORD_RESET.md](./docs/PASSWORD_RESET.md)** - パスワードリセット手順
- **[docs/RESEND_SETUP.md](./docs/RESEND_SETUP.md)** - メール送信設定（Resend）
- **[docs/ENV_PROTECTION.md](./docs/ENV_PROTECTION.md)** - 環境変数保護システム（旧）

## 管理タスク

### ユーザー作成

管理者アカウントを作成：

```bash
node scripts/direct-create-admin.mjs
```

### パスワードリセット

ユーザーのパスワードをリセット：

```bash
node scripts/reset-user-password.mjs [メールアドレス] [新しいパスワード]
```

例：
```bash
node scripts/reset-user-password.mjs user@example.com NewPassword123!
```

### 環境の切り替え

開発環境と本番環境を切り替えるには：

```bash
# 開発環境に切り替え
npm run env:dev

# 本番環境に切り替え（注意: 本番データに影響します）
npm run env:prod

# 現在の環境を確認
npm run env:check
```

### マイグレーション管理

データベーススキーマの変更を確認・反映：

```bash
# マイグレーション一覧を表示
npm run migrations:list

# 特定のマイグレーションを表示
npm run migrations:view [filename.sql]
```

**本番環境への反映方法は [QUICK_PRODUCTION_SYNC.md](./QUICK_PRODUCTION_SYNC.md) を参照してください。**

## 開発

### ビルド

```bash
# 開発用ビルド
npm run build

# 本番用ビルド（自動的に本番環境に切り替えてビルド）
npm run build:production
```

### リント

```bash
npm run lint
```

### プレビュー

```bash
npm run preview
```

### デプロイ準備

```bash
# デプロイ前のチェックリストを実行
npm run deploy:check
```

## セキュリティ

### 重要な注意事項

- `.env` ファイルは Git にコミットしない（既に .gitignore に含まれています）
- 本番環境では強力なパスワードを使用
- サービスロールキーは絶対にクライアントサイドで使用しない
- 定期的にパスワードを変更

### 環境管理

このアプリケーションは2つの環境で運用されます：

**開発環境**: `https://qetusppzdmktdwywxghd.supabase.co`
- テスト用データ
- 機能開発とデバッグ

**本番環境**: `https://ucicxvepktvotvtafowm.supabase.co`
- 実際のユーザーデータ
- 本番運用

環境の切り替えは `npm run env:dev` または `npm run env:prod` で行います。

詳細は [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) を参照してください。

## トラブルシューティング

### ログインできない

1. 環境変数を確認：`npm run validate-env`
2. `.env` ファイルが正しい Supabase URL を使用しているか確認
3. パスワードリセットを実行：詳細は [PASSWORD_RESET.md](./PASSWORD_RESET.md)

### 環境が正しく設定されていない

環境を確認して修正：

```bash
# 現在の環境を確認
npm run env:check

# 開発環境に切り替え
npm run env:dev

# 本番環境に切り替え
npm run env:prod
```

### データベースエラー

1. Supabase プロジェクトが正しく設定されているか確認
2. マイグレーションが適用されているか確認
3. RLS ポリシーが正しく設定されているか確認

## 技術スタック

- **フロントエンド**: React, TypeScript, Vite
- **スタイリング**: Tailwind CSS
- **データベース**: Supabase (PostgreSQL)
- **認証**: Supabase Auth
- **グラフ**: Recharts
- **アイコン**: Lucide React

## ライセンス

このプロジェクトはプライベートプロジェクトです。

## サポート

問題が発生した場合は、以下の情報を含めて管理者に連絡してください：

- エラーメッセージ
- `npm run validate-env` の出力
- ブラウザのコンソールログ
- 実行しようとした操作

## メール送信機能

このシステムは **Resend** を使用してメール通知を送信します。

### メール機能一覧

- ユーザー招待メール（初回パスワード、招待URL付き）
- パスワードリセット通知
- 怪我リスクアラート通知
- 週次トレーニングサマリー

### Resend の設定

メール送信を有効にするには、Resend の API キーを設定する必要があります。
詳細な手順は **[docs/RESEND_SETUP.md](./docs/RESEND_SETUP.md)** を参照してください。

**クイック設定:**

1. [Resend](https://resend.com) でアカウントを作成
2. API キーを取得
3. Supabase ダッシュボードで Edge Functions の環境変数を設定
   - 変数名: `RESEND_API_KEY`
   - 値: 取得した API キー（`re_` で始まる）

API キーが設定されていない場合、メールはコンソールにログ出力されます（開発環境用）。

## 今後の機能拡張

- セルフサービスパスワードリセット
- 多要素認証（MFA）
- データエクスポート機能の拡張
- モバイルアプリ対応
