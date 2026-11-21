import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const rootDir = process.cwd()
const rawBase = (process.env.VITE_PAGES_BASE || '/').trim()
const normalizedBase = rawBase.endsWith('/') ? rawBase : `${rawBase}/`
const demoBase = `${normalizedBase}demo/`

const viteBin = resolve(
  rootDir,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'vite.cmd' : 'vite'
)

console.log(`[pages] Building landing page with base "${normalizedBase}" -> dist-pages/`)
execFileSync(viteBin, ['build', '--config', 'vite.landing.config.ts'], {
  cwd: rootDir,
  stdio: 'inherit',
  env: {
    ...process.env,
    VITE_PAGES_BASE: normalizedBase,
    VITE_LANDING_OUT_DIR: 'dist-pages'
  }
})

console.log(`[pages] Building static interactive web demo with base "${demoBase}" -> dist-pages/demo/`)
execFileSync(viteBin, ['build', '--config', 'vite.config.ts'], {
  cwd: rootDir,
  stdio: 'inherit',
  env: {
    ...process.env,
    VITE_STATIC_DEMO: 'true',
    VITE_BASE: demoBase,
    VITE_OUT_DIR: 'dist-pages/demo'
  }
})

const outDir = resolve(rootDir, 'dist-pages')
mkdirSync(outDir, { recursive: true })
writeFileSync(resolve(outDir, '.nojekyll'), '', 'utf8')
console.log('[pages] Completed GitHub Pages bundle in dist-pages/')
