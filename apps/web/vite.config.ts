import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        // Stable vendor chunks: they rarely change, so returning visitors keep them cached across releases.
        manualChunks: (id) => {
          if (!id.includes('node_modules')) return undefined;
          if (/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(id)) return 'vendor-react';
          if (/node_modules\/(@mui|@emotion)\//.test(id)) return 'vendor-mui';
          if (/node_modules\/(@tanstack|zustand|react-hook-form|@hookform|zod|@dnd-kit)\//.test(id)) return 'vendor-data';
          return undefined;
        },
      },
    },
  },
  server: {
    port: 5180,
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:4000',
      '/uploads': 'http://localhost:4000',
    },
  },
});
