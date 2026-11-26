import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'

const rootDir = process.cwd()
const viteBin = resolve(
  rootDir,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'vite.cmd' : 'vite'
)

console.log('[android] Building standalone static web bundle -> dist-android/')
execFileSync(viteBin, ['build', '--config', 'vite.config.ts'], {
  cwd: rootDir,
  stdio: 'inherit',
  env: {
    ...process.env,
    VITE_STATIC_DEMO: 'true',
    VITE_ANDROID_APP: 'true',
    VITE_BASE: '/',
    VITE_OUT_DIR: 'dist-android'
  }
})
console.log('[android] Completed standalone renderer bundle in dist-android/')
