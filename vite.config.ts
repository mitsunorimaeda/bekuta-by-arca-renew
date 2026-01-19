// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { sentryVitePlugin } from "@sentry/vite-plugin";

export default defineConfig({
  plugins: [
    react(),

    // ✅ Sentry: ビルド時にソースマップをアップロード
    sentryVitePlugin({
      org: "arca-zu",
      project: "javascript-react",

      // ✅ NetlifyのコミットSHAを release にするのが鉄板（後述の環境変数で渡す）
      release: process.env.SENTRY_RELEASE || process.env.COMMIT_REF,

      // これで dist 配下を拾いにいく（Vite標準）
      sourcemaps: {
        assets: "./dist/**",
      },
    }),
  ],

  resolve: {
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
    alias: {
      react: path.resolve(__dirname, "node_modules/react"),
      "react-dom": path.resolve(__dirname, "node_modules/react-dom"),
      "react/jsx-runtime": path.resolve(__dirname, "node_modules/react/jsx-runtime"),
      "react/jsx-dev-runtime": path.resolve(__dirname, "node_modules/react/jsx-dev-runtime"),
    },
  },

  build: {
    chunkSizeWarningLimit: 1000,
    minify: "terser",

    // ✅ 重要：ソースマップを吐く
    sourcemap: true,

    rollupOptions: {
      output: {
        manualChunks: {
          "chart-vendor": ["recharts"],
          "supabase-vendor": ["@supabase/supabase-js"],
        },
      },
    },
  },

  optimizeDeps: {
    include: ["recharts"],
  },

  server: {
    host: true,
    port: 5173,
    strictPort: false,
  },
});