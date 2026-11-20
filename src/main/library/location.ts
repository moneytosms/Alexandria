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

export function resolveLibraryRoot(): string {
  const override = process.env['ALEXANDRIA_LIBRARY_PATH']
  if (override) return override

  try {
    const raw = readFileSync(configPath(), 'utf8')
    const parsed = JSON.parse(raw) as Partial<AppConfig>
    if (typeof parsed.libraryPath === 'string' && parsed.libraryPath.length > 0) {
      return parsed.libraryPath
    }
  } catch {
    // First run, or an unreadable config. Fall through to the default.
  }

  return join(homedir(), 'Alexandria')
}

export function rememberLibraryRoot(root: string): void {
  if (process.env['ALEXANDRIA_LIBRARY_PATH']) return

  const path = configPath()
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify({ libraryPath: root }, null, 2)}\n`, 'utf8')
}
