// src/main.tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

import { RealtimeHubProvider } from "./hooks/useRealtimeHub";

// ✅ Sentry
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: "https://ef38d8a37ebc8c6e3960fbe47f15123b@o4510731847008256.ingest.us.sentry.io/4510731981881344",
  sendDefaultPii: false,

  // ✅ 環境（Netlify本番を production に揃える）
  environment: import.meta.env.PROD ? "production" : "development",

  // ✅ ここは後で release を入れる（ソースマップとセット）
  // release: import.meta.env.VITE_SENTRY_RELEASE,
});

console.log("🚀 main.tsx is executing");
console.log("📍 Current URL:", window.location.href);

const rootElement = document.getElementById("root");
if (!rootElement) {
  console.error("❌ Root element not found!");
  document.body.innerHTML =
    '<div style="padding: 40px; font-family: sans-serif;"><h1>Error: Root element not found</h1><p>The #root div is missing from index.html</p></div>';
  throw new Error("Root element not found");
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

  console.log("✅ App render initiated successfully");
} catch (error) {
  // ✅ React 初期化で死ぬ系だけ拾う（これは残してOK）
  Sentry.captureException(error);
  console.error("❌ Error during React initialization:", error);

  document.body.innerHTML = `<div style="padding: 40px; font-family: sans-serif;">
    <h1>React Initialization Error</h1>
    <pre>${String(error)}</pre>
  </div>`;
}