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

  // ✅ これがソースマップに必須（vite plugin の release と揃える）
  release: import.meta.env.VITE_SENTRY_RELEASE,

  integrations: [
    Sentry.browserTracingIntegration({
      tracePropagationTargets: [
        "localhost",
        "bekuta.netlify.app",
        /^https:\/\/bekuta\.netlify\.app\/.*/,
        // APIが別ドメインなら追加
        // /^https:\/\/api\.yourdomain\.com\/.*/,
      ],
    }),
    // Sentry.replayIntegration(),
  ],

  // ✅ 本番は控えめ推奨
  tracesSampleRate: 0.2,

  sendDefaultPii: false,

  // ✅ envから（固定でもOKだが、切り替えられる方が便利）
  environment: import.meta.env.MODE,
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

// ✅ 接続確認用：DEVだけ 1回だけ（確認できたら消してOK）
if (import.meta.env.DEV) {
  const k = "bekuta:sentry_test_main_mounted";
  try {
    if (!localStorage.getItem(k)) {
      localStorage.setItem(k, "1");
      Sentry.captureMessage("Bekuta Sentry test: main mounted", "info");
    }
  } catch {
    Sentry.captureMessage("Bekuta Sentry test: main mounted", "info");
  }
}