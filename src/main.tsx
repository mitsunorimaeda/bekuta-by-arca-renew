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
      ],
    }),
    // Sentry.replayIntegration(),
  ],

  tracesSampleRate: 0.2,
  sendDefaultPii: false,
  environment: import.meta.env.MODE,
});

console.log("🚀 main.tsx is executing");

// ✅✅ ここに差し込み（createRoot より前）
if (import.meta.env.PROD) {
  // ✅ chunk / module 読み込み失敗をSentryに残す（どのURLが落ちたか取る）
  window.addEventListener(
    "error",
    (e: any) => {
      const t = e?.target as any;

      // <script src="..."> のロード失敗（404/ネットワーク/ブロック等）
      if (t?.tagName === "SCRIPT" && t?.src) {
        Sentry.captureMessage(`Script load failed: ${t.src}`, "error");
      }

      // <link rel="modulepreload" href="..."> の失敗（Safariで起きやすい）
      if (t?.tagName === "LINK" && t?.rel === "modulepreload" && t?.href) {
        Sentry.captureMessage(`Modulepreload failed: ${t.href}`, "error");
      }
    },
    true
  );

  // ✅ Vite の preload 失敗（Safariで起きやすい）
  window.addEventListener("vite:preloadError", () => {
    const key = "__bekuta_preload_reload__";
    let already = false;

    try {
      already = sessionStorage.getItem(key) === "1";
      if (!already) sessionStorage.setItem(key, "1");
    } catch {
      // sessionStorage が死んでる環境向けフォールバック
      try {
        already = localStorage.getItem(key) === "1";
        if (!already) localStorage.setItem(key, "1");
      } catch {}
    }

    if (already) return;

    Sentry.captureMessage("vite:preloadError -> reload", "error");
    // 送信をちょい待ってからリロード（最大1秒だけ）
    Sentry.flush(1000).finally(() => window.location.reload());
  });

  // ✅ 動的import失敗（"Importing a module script failed" 等）
  window.addEventListener("unhandledrejection", (e: any) => {
    const msg = String(e?.reason?.message ?? e?.reason ?? "");
    if (
      msg.includes("Importing a module script failed") ||
      msg.includes("Failed to fetch dynamically imported module")
    ) {
      const key = "__bekuta_import_reload__";
      let already = false;

      try {
        already = sessionStorage.getItem(key) === "1";
        if (!already) sessionStorage.setItem(key, "1");
      } catch {
        // sessionStorage が死んでる環境向けフォールバック
        try {
          already = localStorage.getItem(key) === "1";
          if (!already) localStorage.setItem(key, "1");
        } catch {}
      }

      if (already) return;

      Sentry.captureMessage(`Dynamic import failed -> reload: ${msg}`, "error");
      // 送信をちょい待ってからリロード（最大1秒だけ）
      Sentry.flush(1000).finally(() => window.location.reload());
    }
  });
}

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