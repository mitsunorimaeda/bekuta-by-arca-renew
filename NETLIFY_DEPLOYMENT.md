# Netlify Deployment Guide

## 必要な環境変数

Netlifyの管理画面で以下の環境変数を設定してください：

### 必須環境変数

```
VITE_SUPABASE_URL=https://ucicxvepktvotvtafowm.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjaWN4dmVwa3R2b3R2dGFmb3dtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA1NTQ1MDcsImV4cCI6MjA2NjEzMDUwN30.qt26aAlVJw4BbicnCjWME47rqtGDr7aWGP73b2MSA38
```

### オプション環境変数

```
VITE_APP_URL=https://your-app-name.netlify.app
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjaWN4dmVwa3R2b3R2dGFmb3dtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDU1NDUwNywiZXhwIjoyMDY2MTMwNTA3fQ.5GDPMnWuYQRNixNvJEQWAe8HCrihgI4SYMSEmGQY2R8
```

## デプロイ設定

### ビルド設定

- **Build command**: `npm run build`
- **Publish directory**: `dist`
- **Node version**: 18.20.8 (自動設定)

### ビルド最適化

プロジェクトには以下のビルド最適化が適用されています：

1. **メモリ最適化**: Node.jsのヒープサイズを4GBに設定
2. **コード分割**: React、Recharts、Supabaseを個別チャンクに分離
3. **バンドルサイズ削減**: 最大チャンクサイズを1.2MBから618KBに削減

### デプロイ手順

1. Netlifyダッシュボードにログイン
2. "New site from Git" を選択
3. GitHubリポジトリを接続
4. ビルド設定を確認（自動検出されます）
5. 環境変数を設定（上記参照）
6. "Deploy site" をクリック

## トラブルシューティング

### ビルドエラーが発生した場合

1. **環境変数を確認**: 必須環境変数がすべて設定されているか
2. **Node.jsバージョン**: `.nvmrc`で18.20.8が指定されているか
3. **ローカルビルド**: `npm ci && npm run build` で確認

### メモリ不足エラー

package.jsonのbuildスクリプトに以下が含まれていることを確認：

```json
"build": "NODE_OPTIONS='--max-old-space-size=4096' vite build"
```

### チャンクサイズ警告

vite.config.tsに以下の設定が含まれていることを確認：

```typescript
build: {
  chunkSizeWarningLimit: 1000,
  rollupOptions: {
    output: {
      manualChunks: {
        'react-vendor': ['react', 'react-dom'],
        'chart-vendor': ['recharts'],
        'supabase-vendor': ['@supabase/supabase-js'],
      },
    },
  },
}
```

## 継続的デプロイメント

mainブランチへのpush時に自動的にデプロイされます。

- **Production**: main ブランチ
- **Preview**: プルリクエスト

## パフォーマンス

最適化後のバンドルサイズ：
- 最大チャンク: 618KB (gzip: 139KB)
- React vendor: 141KB (gzip: 45KB)
- Supabase vendor: 114KB (gzip: 31KB)
- Recharts vendor: 383KB (gzip: 105KB)

## セキュリティ

- セキュリティヘッダーは`netlify.toml`で自動設定
- 環境変数はNetlify UIで安全に管理
- `.env`ファイルはリポジトリにコミットしないこと
