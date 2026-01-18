// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],

  resolve: {
    dedupe: [
      'react',
      'react-dom',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
    ],
    alias: {
      react: path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
      'react/jsx-runtime': path.resolve(__dirname, 'node_modules/react/jsx-runtime'),
      'react/jsx-dev-runtime': path.resolve(__dirname, 'node_modules/react/jsx-dev-runtime'),
    },
  },

  // ✅ ここが今回の修正ポイント
  build: {
    chunkSizeWarningLimit: 1000,

    // ✅ esbuild minify が壊すケース対策：terser に切り替え
    minify: 'terser',

    // ✅ どこで落ちたか追えるように（preview白画面の解析が楽になる）
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

  // （任意）recharts を依存事前最適化に入れて安定化
  optimizeDeps: {
    include: ['recharts'],
  },

  server: {
    host: true,
    port: 5173,
    strictPort: false,
  },
});