import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import type { Plugin } from 'vite'

const devCsp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: alexandria:",
  "media-src 'self' blob: alexandria:",
  "font-src 'self' data:",
  "connect-src 'self' alexandria: ws://localhost:* http://localhost:*",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'"
].join('; ')

const prodCsp = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: alexandria:",
  "media-src 'self' blob: alexandria:",
  "font-src 'self' data:",
  "connect-src 'self' alexandria:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'"
].join('; ')

function cspPlugin(): Plugin {
  return {
    name: 'alexandria-csp',
    transformIndexHtml(html, ctx) {
      return html.replace('__CSP__', ctx.server ? devCsp : prodCsp)
    }
  }
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@shared': resolve('src/shared')
      }
    },
    plugins: [react(), cspPlugin()],
    build: {
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
  }
})
