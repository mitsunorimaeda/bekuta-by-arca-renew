# Bekuta: 通知 & 更新（Realtime / Polling / Fetch）ルールとゴール

最終更新: 2026-01-02（JST）

このドキュメントは、Bekuta における **「通知」** と **「画面更新」** を、通信量・バッテリー・DB負荷を最小にしつつ、UXを損なわない形で運用するための共通ルールです。  
（例：Team Achievement Notification / Rankings / Alerts など）

---

## 0. ゴール（到達点）

### UXのゴール
- **ユーザーに必要なときだけ**更新が走る（不要な裏通信を避ける）
- **重要イベントは即時**（通知・達成・危険アラートなど）
- **それ以外は遅延許容**（ランキング・集計・履歴など）

### 技術のゴール
- **WebSocket（Realtime）は最小限**：本当に即時性が必要なものに限定
- **Pollingは中央制御で統合**：同じ目的の更新をアプリ全体で 1本に集約
- **Fetchは発火条件を明確化**：画面表示、ユーザー操作、フォーカス復帰でのみ実行
- **バックグラウンド時の通信を止める**（PWA/モバイルで特に重要）

### 指標（ベースライン例）
- Dev計測（参考）: 250 req / 10.1MB
- Local build: 62 req / 440KB / 219ms
- Polling（120秒）: 63 → 2分後 65（約 2req / 2分）, 441KB

---

## 1. 用語（運用上の定義）

- **Fetch**: 画面表示やユーザー操作など「イベント」をきっかけに1回だけ取得
- **Polling**: 一定間隔で定期的に取得（setInterval等）
- **Realtime**: WebSocketでイベントを受信して更新（supabase `.channel()`）

---

## 2. 基本ルール（優先順位）

更新方式は以下の順で選ぶ：

1) **Fetch（イベント駆動）**
- 画面表示時 / タブ復帰時 / 手動更新ボタン等
- 例: 初回ロード、詳細画面を開いた瞬間

2) **Polling（低頻度・中央制御）**
- “多少遅れても許容できる更新”
- 例: ランキング、集計、未読件数の軽量更新

3) **Realtime（最小限）**
- “即時性が価値そのもの”
- 例: 達成通知（TeamAchievement）、メッセージ、緊急アラート（将来）

---

## 3. Realtime のルール

### 3.1 使って良いケース
- 「即時に出る」ことがUX価値になるもののみ
- 例: `team_achievement_notifications` の INSERT で即モーダル表示

### 3.2 使ってはいけないケース
- どうでも良い更新（数分遅れても良い）
- DBが重いときに大量発火するテーブル
- “更新イベントのたびに再フェッチ”が連鎖する設計

### 3.3 実装ルール
- **同一目的のchannelを複数貼らない**
  - `channelRef` を使い、再購読前に必ず `removeChannel`
- **enable/disable を環境変数で統一**
  - `VITE_ENABLE_REALTIME=true/false`  
  - `src/lib/supabase.ts` の `realtime: ENABLE_REALTIME ? {} : { params: { eventsPerSecond: 0 } }` を踏襲
- **受信後の処理は「軽量」**
  - 原則は「必要な最小データだけ取り直す」
  - 可能なら「差分更新（該当IDだけ追加）」を検討

---

## 4. Polling のルール

### 4.1 重要ルール：中央制御で統合する
- `setInterval` を各所に散らすと、**画面が増えるほど通信が増える**
- 同じ目的のポーリングは **1本にまとめる**  
  - 例: `rankings:${teamId}` はアプリ内で1つだけ動く

### 4.2 隠れた状態（background）では止める
- `document.visibilityState === "hidden"` のときは **停止**（原則）
- 例外で background でも動かす場合は明示する（runWhenHidden=true）

### 4.3 推奨間隔（目安）
- ランキング/集計: **120秒〜300秒**
- 未読件数など軽量: **300秒**
- アラート生成: **30分〜**（既存の `useAlerts` は30分でOK）

※「最小で十分」から始める。必要なら短くする。

### 4.4 事故防止（必須）
- 画面アンマウントで必ず解除（unsubscribe/clearInterval）
- 同じhookが複数回マウントされても **二重タイマーを作らない設計**に寄せる

---

## 5. Fetch のルール（いつ取りに行くか）

### 5.1 取りに行く条件（推奨）
- 初回表示
- ページ/タブ復帰（visibilitychange で visible になった時）
- ユーザー操作（「更新」ボタン、モーダルを開いた時）
- Realtimeイベント受信時（必要な場合のみ）

### 5.2 取りに行かない条件
- 無関係な state 更新
- 秒単位で変わる値を“なんとなく”更新

---

## 6. 通知（Team Achievement）運用ルール

### 6.1 DB / API の方針
- 通知テーブル: `team_achievement_notifications`
- 参照（埋め込み）: PostgREST では **`achievement:team_achievements(...)`** を使う  
  - `team_achievement_notifications.select("..., achievement:team_achievements(...)")`
- `achievement` が null の可能性を許容（RLSや欠損に強く）
  - UIでは `null` の場合は描画しない（クラッシュ回避）

### 6.2 表示ルール
- 未読が複数ある場合は **FIFO（古い順）** で表示
- 1件表示して閉じたら `mark_team_notification_read` で既読化し、次を表示

### 6.3 更新（閉じる）ルール
- 既読化は RPC で統一（RLSを守る）
- UI側では optimistic update（ローカル state から除外）

---

## 7. PWA/バックグラウンド挙動について

- **PWAで表に出ていない時**（ホームに戻る/別アプリ/画面オフ）は、OSがWebViewを止めたり、タイマー精度を落とします
- そのため、**「裏でも正確に120秒ごとに動く」保証はない**
- ただし、`visibilityState` を見て **hidden時は止める設計**にしておくと、
  - 無駄通信
  - バッテリー消費
  - DB負荷
  を最小化できます

---

## 8. 今後の実装ガイド（推奨アーキテクチャ）

### 8.1 置き場所（案）
- `src/lib/pollingHub.ts` : 中央ポーリング実装
- `src/hooks/usePolling.ts` : React用の薄いHook
- `src/hooks/useRealtimeHub.ts` : “全体で1回”動かすものの置き場（Hub）

### 8.2 移行優先度（通信削減の効きが大きい順）
1. `useRankings`（60秒） → 中央ポーリングへ（120秒以上推奨）
2. 通知/軽量カウント系 → Hub に集約（必要なら）
3. `useAlerts`（30分） → 二重起動防止（Provider化 or Hub化）

---

## 9. 運用ルール（チーム開発向け）

- 新しいポーリングを追加する場合：
  1) 「本当にポーリングが必要か？」をまず検討
  2) 必要なら `pollingHub` に登録（key命名ルールを決める）
  3) **interval（秒）とrunWhenHidden** を明記
- 新しいRealtimeを追加する場合：
  - Realtimeが必須な理由（即時性の価値）をこのdocに追記
  - `VITE_ENABLE_REALTIME=false` でも壊れない設計にする（Fallback: Fetch/Polling）

---

## 10. チェックリスト（PR時に確認）

- [ ] setInterval/setTimeout を安易に追加していない
- [ ] Pollingは中央制御（Hub）にまとめている
- [ ] hidden時は止まる（または例外理由が明確）
- [ ] Realtimeは最小限で、二重subscribeしない
- [ ] PostgRESTの埋め込みで null を考慮している
- [ ] “画面に出てない時”の通信が増えない設計になっている

---

## 付録：今回の学び（短縮メモ）
- 埋め込みは `achievement:team_achievements(...)` が正しい（`achievement` が取れる）
- 例外ケース（achievement=null）でUIが落ちないようにするのが必須
- Polling間隔を 120秒にするだけで、無駄通信は目に見えて抑えられる
