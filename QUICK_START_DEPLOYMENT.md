# クイックスタート: 本番環境デプロイ

最速で本番環境にデプロイするための5ステップガイド

## 前提条件

- GitHubアカウント
- プロジェクトがGitHubリポジトリにプッシュされている
- Supabase本番環境が設定済み
- Resend APIキーが取得済み

## 5ステップでデプロイ

### ステップ1: Netlifyアカウント作成（2分）

1. https://netlify.com にアクセス
2. 「Sign up」→「GitHub」で連携
3. アカウント作成完了

### ステップ2: プロジェクト接続（1分）

1. Netlifyダッシュボードで「Add new site」→「Import an existing project」
2. 「GitHub」を選択
3. リポジトリを選択

### ステップ3: ビルド設定（1分）

以下を入力:

```
Build command: npm run build:production
Publish directory: dist
```

「Deploy site」をクリック（まだデプロイしない場合は後で設定）

### ステップ4: 環境変数設定（2分）

1. Site settings → Environment variables
2. 以下を追加:

```
VITE_SUPABASE_URL
→ 値: https://ucicxvepktvotvtafowm.supabase.co

VITE_SUPABASE_ANON_KEY
→ 値: [本番環境のAnon Key]
```

3. 「Save」をクリック

**Anon Keyの確認方法:**
- Supabaseダッシュボード → Project Settings → API
- 「anon public」の値をコピー

### ステップ5: デプロイ実行（3分）

1. Deploys → Trigger deploy → Deploy site
2. ビルド完了まで待つ（約2-3分）
3. 完了したら「Open production deploy」をクリック

## デプロイ完了

本番環境URLが発行されます:
```
https://random-name-123456.netlify.app
```

## 動作確認チェックリスト

最小限の確認項目:

- [ ] ログインページが表示される
- [ ] 管理者アカウントでログインできる
- [ ] ダッシュボードが表示される
- [ ] ユーザー招待が動作する
- [ ] 招待メールが届く

## 次のステップ

### カスタムドメイン設定（オプション）

1. Site settings → Domain management
2. 「Add custom domain」
3. 独自ドメインを入力（例: acwr-monitor.com）
4. DNSレコードを設定（Netlifyが指示を表示）
5. SSL証明書が自動発行される（数分）

### 自動デプロイ設定

既に設定済み！

- Gitにプッシュすると自動的にデプロイされます
- Pull Requestごとにプレビュー環境が作成されます

## トラブルシューティング

### ビルドが失敗する

**原因**: Node.jsバージョンが古い

**解決策**:
1. Site settings → Environment variables
2. `NODE_VERSION` を追加
3. 値: `18`
4. 再デプロイ

### ログインできない

**原因**: 環境変数が正しくない

**解決策**:
1. Site settings → Environment variables
2. `VITE_SUPABASE_URL` と `VITE_SUPABASE_ANON_KEY` を確認
3. 値が本番環境のものか確認
4. 修正後、再デプロイ

### データが表示されない

**原因**: RLSポリシーが設定されていない

**解決策**:
1. Supabaseダッシュボード → Database → Tables
2. 各テーブルでRLSが有効になっているか確認
3. ポリシーが正しく設定されているか確認

## サポート

詳細なドキュメント:
- [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) - 完全なデプロイガイド
- [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) - チェックリスト

---

**所要時間: 約10分**

**推定コスト: 無料〜$54/月**
