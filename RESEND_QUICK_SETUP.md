# Resend メール送信 クイックセットアップ

## 概要

Bekutaの招待メール機能を有効にするには、Resend APIキーが必要です。

## セットアップ手順（5分）

### 1. Resendアカウント作成

1. https://resend.com にアクセス
2. 「Sign Up」でアカウント作成（無料）
3. メールアドレスを確認

**無料プラン：** 月3,000通、1日100通まで無料

### 2. APIキー取得

1. Resendダッシュボードにログイン
2. 左サイドバー「API Keys」をクリック
3. 「Create API Key」をクリック
4. 名前を入力（例：`Bekuta Production`）
5. 「Add」をクリック
6. **表示されたAPIキー（`re_` で始まる文字列）をコピー**

⚠️ **重要：** APIキーは一度しか表示されません！必ずコピーしてください。

### 3. Supabaseに設定

#### 開発環境

1. https://supabase.com/dashboard にログイン
2. **開発プロジェクト**を選択（URL: `qetusppzdmktdwywxghd`）
3. 左メニュー「Edge Functions」をクリック
4. 「Manage secrets」ボタンをクリック
5. シークレットを追加：
   - **Name:** `RESEND_API_KEY`
   - **Value:** コピーしたAPIキー
6. 「Save」をクリック

#### 本番環境

1. **本番プロジェクト**を選択（URL: `ucicxvepktvotvtafowm`）
2. 同じ手順を繰り返す

### 4. 動作確認

1. Bekutaにログイン（管理者アカウント）
2. 「ユーザー管理」→「新規ユーザー招待」
3. テストユーザーを招待（自分のメールアドレスを使用）
4. 数秒〜数分でメールが届きます

メールが届かない場合：
- 迷惑メールフォルダを確認
- ブラウザのコンソールログを確認
- Supabase → Edge Functions → send-email → Logs を確認

## メール送信元について

無料プランでは `onboarding@resend.dev` から送信されます。

カスタムドメイン（例：`noreply@arca.fit`）を使いたい場合は、[詳細ガイド](docs/RESEND_SETUP.md)を参照してください。

## トラブルシューティング

### メールが送信されない

**症状：** 「メール未送信」と表示される

**解決策：**

1. **APIキーが正しく設定されているか確認**
   - Supabase → Edge Functions → Secrets タブ
   - `RESEND_API_KEY` が存在するか確認

2. **APIキーが有効か確認**
   - Resendダッシュボード → API Keys
   - キーが削除されていないか確認

3. **Edge Functionのログを確認**
   - Supabase → Edge Functions → send-email → Logs
   - エラーメッセージを確認

4. **よくあるエラー：**
   - `API key not found` → APIキーが設定されていない
   - `Invalid API key` → APIキーが間違っている
   - `Rate limit exceeded` → 送信制限を超えた（無料プラン：1日100通）

### パスワードが一致しない

**症状：** Edge Functionのログとメールのパスワードが違う

**解決策：**
- 今回の修正で解決済み
- ブラウザキャッシュをクリアして再試行

### 招待URLが無効

**症状：** 招待リンクをクリックすると「無効または期限切れ」と表示

**解決策：**
- 招待リンクは24時間で期限切れ
- 管理者画面の招待履歴から新しいリンクをコピー

## セキュリティ注意事項

- ✅ APIキーは環境変数として保存（コードに書かない）
- ✅ APIキーをGitにコミットしない
- ✅ 定期的にAPIキーをローテーション
- ✅ 不要なキーは削除

## サポート

詳細なドキュメント：[docs/RESEND_SETUP.md](docs/RESEND_SETUP.md)

問題が解決しない場合：
1. ブラウザのコンソールログをスクリーンショット
2. Supabase Edge Functionのログをスクリーンショット
3. 開発チームに連絡
