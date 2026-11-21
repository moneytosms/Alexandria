import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const webCsp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' ws: wss: http: https:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'"
].join('; ')

function webCspPlugin(): Plugin {
  return {
    name: 'alexandria-web-csp',
    transformIndexHtml(html) {
      return html.replace('__CSP__', webCsp)
    }
  }
}

export default defineConfig({
  base: process.env.VITE_BASE || '/',
  root: resolve(__dirname, 'src/renderer'),
  resolve: {
    alias: {
      '@renderer': resolve(__dirname, 'src/renderer/src'),
      '@shared': resolve(__dirname, 'src/shared')
    }
  },
  plugins: [react(), webCspPlugin()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true
  },
  build: {
    outDir: process.env.VITE_OUT_DIR
      ? resolve(__dirname, process.env.VITE_OUT_DIR)
      : resolve(__dirname, 'dist'),
    emptyOutDir: true
  }
})
