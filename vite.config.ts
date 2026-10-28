import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    // The 3D cube chunk (three.js, ~250 KB gzipped) is loaded only when shown.
    chunkSizeWarningLimit: 1000,
  },
  worker: {
    // Vision code will run in Web Workers (Phase 3).
    format: 'es',
  },
})
