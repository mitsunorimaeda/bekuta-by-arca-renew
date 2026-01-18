// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { sentryVitePlugin } from '@sentry/vite-plugin';

export default defineConfig(() => {
  // ✅ Sentryのアップロードを「環境変数が揃っている時だけ」有効化（ローカル開発で楽）
  const hasSentry =
    !!process.env.SENTRY_AUTH_TOKEN &&
    !!process.env.SENTRY_ORG &&
    !!process.env.SENTRY_PROJECT;

  return {
    plugins: [
      react(),

      // ✅ Sentry: ソースマップをアップロード（本番だけON推奨）
      ...(hasSentry
        ? [
            sentryVitePlugin({
              authToken: process.env.SENTRY_AUTH_TOKEN,
              org: process.env.SENTRY_ORG,
              project: process.env.SENTRY_PROJECT,

              // ✅ NetlifyならCOMMIT_REFが使える（なければSENTRY_RELEASE or git sha自動推定でもOK）
              release: {
                name:
                  process.env.SENTRY_RELEASE ||
                  process.env.COMMIT_REF ||
                  process.env.GITHUB_SHA,
                inject: true, // 推奨：SDKがリリース紐付けしやすくなる
              },

              // ✅ .map をアップロード後に削除（コード漏洩リスクを下げる）
              sourcemaps: {
                filesToDeleteAfterUpload: ['dist/**/*.map'],
              },

              // 任意：ログが欲しいとき true
              // debug: true,
            }),
          ]
        : []),
    ],

    resolve: {
      dedupe: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
      alias: {
        react: path.resolve(__dirname, 'node_modules/react'),
        'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
        'react/jsx-runtime': path.resolve(__dirname, 'node_modules/react/jsx-runtime'),
        'react/jsx-dev-runtime': path.resolve(__dirname, 'node_modules/react/jsx-dev-runtime'),
      },
    },

    build: {
      chunkSizeWarningLimit: 1000,
      minify: 'terser',

      // ✅ Sentryアップロードにはソースマップ生成が必要
      // ただし公開されうるので、上の filesToDeleteAfterUpload で消す運用にするのが安全
      sourcemap: true,

      rollupOptions: {
        output: {
          manualChunks: {
            'chart-vendor': ['recharts'],
            'supabase-vendor': ['@supabase/supabase-js'],
          },
        },
      },
    },

    optimizeDeps: {
      include: ['recharts'],
    },

    server: {
      host: true,
      port: 5173,
      strictPort: false,
    },
  };
});