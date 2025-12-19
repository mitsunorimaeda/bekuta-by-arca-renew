import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  // ✅ 追加：React の二重読み込みを防ぐ
  resolve: {
    dedupe: ['react', 'react-dom'],
  },

  optimizeDeps: {
    exclude: ['lucide-react'],
  },

  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'chart-vendor': ['recharts'],
          'supabase-vendor': ['@supabase/supabase-js'],
        },
      },
    },
  },

  server: {
    host: true,
    port: 5173,
    strictPort: false,
  },
});