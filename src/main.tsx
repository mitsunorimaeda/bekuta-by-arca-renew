// src/main.tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

import { RealtimeHubProvider } from "./hooks/useRealtimeHub";

// ✅ Sentry
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: "https://ef38d8a37ebc8c6e3960fbe47f15123b@o4510731847008256.ingest.us.sentry.io/4510731981881344",

  // ✅ 重要：Performanceを見たいならTracingを入れる
  integrations: [
    Sentry.browserTracingIntegration({
      // ✅ 自分のAPIだけ tracing 対象に（必要に応じて追加）
      tracePropagationTargets: [
        "localhost",
        "bekuta.netlify.app",
        /^https:\/\/bekuta\.netlify\.app\/.*/,
        // もしAPIドメインが別ならここに追加
        // /^https:\/\/api\.yourdomain\.com\/.*/,
      ],
    }),
    // （任意）Session Replayも見たいなら有効化（無料枠だと量に注意）
    // Sentry.replayIntegration(),
  ],

  // ✅ 本番は 0.05〜0.2 推奨（いきなり 1.0 は多い）
  tracesSampleRate: 0.2,

  // （任意）Replay
  // replaysSessionSampleRate: 0.0,
  // replaysOnErrorSampleRate: 1.0,

  sendDefaultPii: false,

  // （任意）環境名を固定したい場合
  environment: "production",
});

console.log("🚀 main.tsx is executing");

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

const root = createRoot(rootElement);

root.render(
  <StrictMode>
    <RealtimeHubProvider>
      <App />
    </RealtimeHubProvider>
  </StrictMode>
);

// ✅ 「Sentryが本当に届いてるか」確認用（最初だけ）
// これが Sentry > Issues に出れば “接続OK”
// ※確認できたら消してOK
Sentry.captureMessage("Bekuta Sentry test: main mounted", "info");