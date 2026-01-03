# Bekuta 通信ルール（Networking Standard）

目的：
- 無駄な通信と無駄な再計算を減らし、PWA/モバイルでも安定させる
- 機能追加しても通信量が増殖しない「仕組み」を作る

---

## 1. 基本方針（最重要）

### 初回ロード
- 画面表示時のデータ取得は「1回の fetch」を基本とする
- 同じデータを複数コンポーネントが別々に取りに行かない（集約する）

### 更新方式（混在禁止）
- 更新は **Realtime か Polling のどちらか**（両方は禁止）
- 例外を作る場合は理由と期限を書く（技術的負債の見える化）

### 取得サイズ
- `select(*)` は原則禁止（必要カラムだけ）
- 履歴系は `limit` / ページング必須
- join は最小限（必要なら view / RPC / 取得分割を検討）

---

## 2. 更新方式のルール

### Realtime（WS）
- 使うのは “通知・達成・小さいイベント” を基本とする
- `VITE_ENABLE_REALTIME=false` のときはWSを張らない（subscribeしない）
- channel は必ず cleanup（removeChannel）する
- 購読対象テーブルは publication に追加されていること（DB側も管理）

### Polling（定期フェッチ）
- Realtimeを使わない画面は polling を選ぶ
- 推奨頻度：30〜120秒（機能により決める）
- 画面が非表示/バックグラウンドでは止める（通信ゼロに寄せる）
  - `document.visibilityState === "hidden"` で停止
  - `navigator.connection.saveData` が true の場合は頻度を落とす

### Fetch（単発）
- ユーザー操作（ボタン）で明示的に更新できる導線を用意すると、pollingを減らせる

---

## 3. キャッシュ・統合（90点にする要素）

### キャッシュ層（SWR / React Query など）
- 同一キーのリクエストを統合（重複fetchを防ぐ）
- バックグラウンド再取得・再試行・stale制御を一箇所に集める

### “集約ポイント” を作る
- 例：`useDashboardData(date, userId)` のような hook を作り
  - 子コンポーネントは props で受け取る（個別fetch禁止）

---

## 4. 通信予算（画面ごとの上限）

- 各画面に「1分あたりの最大リクエスト数」を決める
  - 例：Dashboard 10 req/min、設定画面 2 req/min
- 新機能追加時に「通信予算を守れているか」をチェックする

---

## 5. 計測（90点の最後のピース）

最低限、以下をログ or 計測する：
- 1分あたりの request 数
- 1分あたりの転送量（KB/MB）
- Realtime WebSocket 接続数（多重接続してないか）
- 失敗率（429/5xx/timeout）

---

## 6. PRルール（運用）

- 新しい fetch / polling / realtime を追加したら必ずこのルールに追記 or 参照する
- `select(*)` を使ったら理由を書いてレビューで明示する
- 更新方式（Realtime/Polling）の混在がないことを確認する

- 通知&更新ルール: NOTIFICATIONS_AND_UPDATES_RULES.md