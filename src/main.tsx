// src/main.tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

import { RealtimeHubProvider } from "./hooks/useRealtimeHub";
import * as Sentry from "@sentry/react";

// ✅ Sentry init（最上流）
Sentry.init({
  dsn: "https://ef38d8a37ebc8c6e3960fbe47f15123b@o4510731847008256.ingest.us.sentry.io/4510731981881344",
  sendDefaultPii: false,

  // ✅ 一時的にON：Sentryが内部で何してるか console に出る
  debug: true,

  // ✅ イベントが作られたか確認用（送信前に必ず通る）
  beforeSend(event) {
    console.log("[Sentry] beforeSend", event?.event_id, event?.exception?.values?.[0]?.type);
    return event;
  },
});

console.log("🚀 main.tsx is executing");
console.log("📍 Current URL:", window.location.href);

// ✅ ここが肝：アプリ起動時に「確実に」Sentryへイベントを作る
Sentry.captureMessage("Bekuta Sentry test: app boot");

const rootElement = document.getElementById("root");
if (!rootElement) {
  const err = new Error("Root element not found");
  Sentry.captureException(err);
  throw err;
}

try {
  const root = createRoot(rootElement);

  root.render(
    <StrictMode>
      <RealtimeHubProvider>
        <App />
      </RealtimeHubProvider>
    </StrictMode>
  );
} catch (error) {
  Sentry.captureException(error);
  console.error("❌ Error during React initialization:", error);
}