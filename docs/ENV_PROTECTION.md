# 🛡️ Environment Protection System

## 問題 / Problem

`.env`ファイルが自動的に誤った Supabase プロジェクトの設定に書き換えられる問題が発生しています。

The `.env` file is being automatically overwritten with incorrect Supabase project configuration.

### 正しい設定 / Correct Configuration

```
VITE_SUPABASE_URL=https://ucicxvepktvotvtafowm.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjaWN4dmVwa3R2b3R2dGFmb3dtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA1NTQ1MDcsImV4cCI6MjA2NjEzMDUwN30.qt26aAlVJw4BbicnCjWME47rqtGDr7aWGP73b2MSA38
```

### 誤った設定（絶対に使用しない）/ Incorrect Configuration (NEVER USE)

```
❌ https://qetusppzdmktdwywxghd.supabase.co  ← 間違ったプロジェクト！
```

---

## 🔧 対策 / Solutions

### 1. 自動修復（推奨）/ Auto-Repair (Recommended)

開発サーバー起動時に自動的にチェックと修復が行われます：

```bash
npm run dev
```

このコマンドは起動前に自動的に `.env` を検証し、問題があれば修復します。

### 2. 手動修復 / Manual Repair

`.env` ファイルが壊れている場合、以下のコマンドで即座に修復できます：

```bash
npm run fix-env
```

このコマンドは：
- `.env` ファイルを検証
- 誤った設定を検出
- 自動的に正しい設定に修復

### 3. リアルタイム保護 / Real-time Protection

開発中に `.env` ファイルを常時監視し、変更があれば自動修復します：

```bash
npm run protect-env
```

**別のターミナルウィンドウで実行することを推奨**

このスクリプトは：
- `.env` ファイルをリアルタイムで監視
- 不正な変更を検出した瞬間に自動修復
- 変更があった場合にログに表示

使用例：
```bash
# ターミナル 1: 保護スクリプトを実行
npm run protect-env

# ターミナル 2: 開発サーバーを実行
npm run dev
```

---

## 🔍 検証スクリプト / Validation Scripts

### validate-env.mjs

起動時に以下をチェックします：

1. ✅ Supabase URL が正しいプロジェクト (`ucicxvepktvotvtafowm`) を指しているか
2. ✅ ANON_KEY が正しいプロジェクトのものか
3. ✅ SERVICE_ROLE_KEY が設定されているか

エラーが検出された場合、**自動的に修復**します。

### protect-env.mjs

継続的に `.env` ファイルを監視し：

1. 📝 ファイル変更を検出
2. 🔍 変更内容を検証
3. 🔧 必要に応じて自動修復
4. ⚠️ ブラウザリフレッシュの警告を表示

---

## ⚠️ 重要な注意事項 / Important Notes

### 開発サーバー起動時

`.env` が修復された場合、**必ずブラウザをリフレッシュ**してください。
環境変数はビルド時に読み込まれるため、修復後はブラウザの再読み込みが必要です。

### 保護スクリプトの使用

開発中に頻繁に `.env` が書き換えられる場合は、`npm run protect-env` をバックグラウンドで実行してください。

```bash
# 推奨: tmux または別ターミナルで実行
npm run protect-env
```

### エラーが続く場合

もし問題が解決しない場合：

1. すべての開発サーバーを停止
2. `npm run fix-env` を実行
3. ブラウザのキャッシュをクリア
4. `npm run dev` で再起動

---

## 🚨 トラブルシューティング / Troubleshooting

### Q: なぜ `.env` が書き換えられるのですか？

A: 複数の原因が考えられます：
- Bolt システムの自動設定
- 他のツールやプラグインによる干渉
- キャッシュされた古い設定

### Q: 修復してもすぐに戻ってしまいます

A: 以下を試してください：
1. `npm run protect-env` をバックグラウンドで実行
2. `.env.example` も正しい値になっているか確認
3. エディタやIDEの自動保存機能を一時的に無効化

### Q: どのスクリプトを使えばいいですか？

A:
- **通常**: `npm run dev` だけで十分（自動チェック＆修復）
- **問題発生時**: `npm run fix-env` で即座に修復
- **頻繁に問題が起きる**: `npm run protect-env` を常時実行

---

## 📊 検証の流れ / Validation Flow

```
┌─────────────────┐
│  npm run dev    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ validate-env.mjs│
│  自動実行        │
└────────┬────────┘
         │
         ▼
    問題を検出？
         │
    Yes  │  No
    ┌────┴────┐
    │         │
    ▼         ▼
 自動修復    サーバー起動
    │
    ▼
 サーバー起動
 （ブラウザリフレッシュ推奨）
```

---

## 🔐 セキュリティ / Security

このシステムは：
- ✅ 正しい Supabase プロジェクト設定を保護
- ✅ 誤ったプロジェクトへの接続を防止
- ✅ データの整合性を保証
- ✅ 本番環境のデータベースを誤操作から保護

**重要**: これらのスクリプトは開発環境でのみ使用してください。本番環境では環境変数は異なる方法で管理されます。
