import { app } from 'electron'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

interface AppConfig {
  libraryPath: string
}

function configPath(): string {
  return join(app.getPath('userData'), 'app-config.json')
}

function readConfig(): AppConfig | null {
  try {
    const raw = readFileSync(configPath(), 'utf8')
    const parsed = JSON.parse(raw) as Partial<AppConfig>
    if (typeof parsed.libraryPath === 'string' && parsed.libraryPath.length > 0) {
      return { libraryPath: parsed.libraryPath }
    }
  } catch {
    // Missing or unreadable config. Caller falls back to the default.
  }

  return null
}

export function defaultLibraryRoot(): string {
  return join(homedir(), 'Alexandria')
}

export function hasStoredLibraryRoot(): boolean {
  if (process.env['ALEXANDRIA_LIBRARY_PATH']) return true
  return readConfig() !== null
}

export function resolveLibraryRoot(): string {
  const override = process.env['ALEXANDRIA_LIBRARY_PATH']
  if (override) return override

  return readConfig()?.libraryPath ?? defaultLibraryRoot()
}

export function rememberLibraryRoot(root: string): void {
  if (process.env['ALEXANDRIA_LIBRARY_PATH']) return

  const path = configPath()
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify({ libraryPath: root }, null, 2)}\n`, 'utf8')
}
