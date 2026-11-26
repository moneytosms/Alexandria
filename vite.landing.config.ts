import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  base: process.env.VITE_PAGES_BASE || '/',
  root: resolve(__dirname, 'site'),
  cacheDir: resolve(__dirname, 'node_modules/.vite-landing'),
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true
  },
  build: {
    outDir: process.env.VITE_LANDING_OUT_DIR
      ? resolve(__dirname, process.env.VITE_LANDING_OUT_DIR)
      : resolve(__dirname, 'dist-pages'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three/')) return 'vendor-three'
          if (id.includes('node_modules/lucide-react/') || id.includes('node_modules/lenis/')) {
            return 'vendor-ui'
          }
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
            return 'vendor-react'
          }
          return undefined
        }
      }
    }
  }
})
