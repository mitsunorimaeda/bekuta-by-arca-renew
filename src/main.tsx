// src/main.tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// ✅ RealtimeHubProvider
import { RealtimeHubProvider } from "./hooks/useRealtimeHub";

// ✅ Sentry
import * as Sentry from "@sentry/react";

// ---------------------------
// ✅ Sentry init（最優先で一番上で実行）
// ---------------------------
Sentry.init({
  dsn: "https://ef38d8a37ebc8c6e3960fbe47f15123b@o4510731847008256.ingest.us.sentry.io/4510731981881344",

  /**
   * ⚠️ これは注意
   * sendDefaultPii: true は IP などの PII を送る可能性があるので、
   * まずは false 推奨（運用方針が固まってから true を検討）
   */
  sendDefaultPii: false,
});

// （任意）“このユーザーのエラー”として紐づけたいなら
// user.id が取れるのは main.tsx ではなくログイン後なので、ここではやらない。
// → 後で AthleteView 等で Sentry.setUser({ id: user.id }) を入れるのが正解。

console.log("🚀 main.tsx is executing");
console.log("📍 Current URL:", window.location.href);
console.log("🔍 Checking for root element...");

const rootElement = document.getElementById("root");
if (!rootElement) {
  console.error("❌ Root element not found!");
  document.body.innerHTML =
    '<div style="padding: 40px; font-family: sans-serif;"><h1>Error: Root element not found</h1><p>The #root div is missing from index.html</p></div>';
  throw new Error("Root element not found");
}

console.log("✅ Root element found, creating React root...");

try {
  const root = createRoot(rootElement);
  console.log("✅ React root created, rendering App...");

  root.render(
    <StrictMode>
      <RealtimeHubProvider>
        <App />
      </RealtimeHubProvider>
    </StrictMode>
  );

  console.log("✅ App render initiated successfully");
} catch (error) {
  // ✅ Sentry にも送る（React 初期化で死ぬ系を拾える）
  Sentry.captureException(error);

  console.error("❌ Error during React initialization:", error);
  document.body.innerHTML = `<div style="padding: 40px; font-family: sans-serif;">
    <h1>React Initialization Error</h1>
    <pre>${String(error)}</pre>
  </div>`;
}