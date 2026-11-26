import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const isAndroidApp = process.env.VITE_ANDROID_APP === 'true'
const basePath = process.env.VITE_BASE || '/'
const normalizedBase = basePath.endsWith('/') ? basePath : `${basePath}/`

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
  base: basePath,
  root: resolve(__dirname, 'src/renderer'),
  cacheDir: resolve(__dirname, 'node_modules/.vite-demo'),
  optimizeDeps: {
    include: ['react', 'react-dom', 'zustand', 'three', 'pdfjs-dist']
  },
  resolve: {
    alias: {
      '@renderer': resolve(__dirname, 'src/renderer/src'),
      '@shared': resolve(__dirname, 'src/shared')
    }
  },
  plugins: [
    react(),
    webCspPlugin(),
    ...(isAndroidApp
      ? []
      : [
          VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['apple-touch-icon.png', 'icon.svg'],
            manifest: {
              id: normalizedBase,
              name: 'Alexandria — 3D PDF Library',
              short_name: 'Alexandria',
              description:
                'A local-first 3D reading room and exact-click PDF library that works completely offline.',
              theme_color: '#0c0a09',
              background_color: '#0c0a09',
              display: 'standalone',
              orientation: 'any',
              start_url: normalizedBase,
              scope: normalizedBase,
              icons: [
                {
                  src: 'pwa-192x192.png',
                  sizes: '192x192',
                  type: 'image/png',
                  purpose: 'any'
                },
                {
                  src: 'pwa-512x512.png',
                  sizes: '512x512',
                  type: 'image/png',
                  purpose: 'any'
                },
                {
                  src: 'pwa-maskable-512x512.png',
                  sizes: '512x512',
                  type: 'image/png',
                  purpose: 'maskable'
                }
              ]
            },
            workbox: {
              globPatterns: ['**/*.{js,mjs,css,html,ico,png,svg,woff,woff2}'],
              maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
              navigateFallback: 'index.html'
            },
            devOptions: {
              enabled: true,
              type: 'module'
            }
          })
        ])
  ],
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true
  },
  build: {
    outDir: process.env.VITE_OUT_DIR
      ? resolve(__dirname, process.env.VITE_OUT_DIR)
      : resolve(__dirname, 'dist'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three/')) return 'vendor-three'
          if (id.includes('node_modules/pdfjs-dist/')) return 'vendor-pdfjs'
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/zustand/')
          ) {
            return 'vendor-react'
          }
          return undefined
        }
      }
    }
  }
})
