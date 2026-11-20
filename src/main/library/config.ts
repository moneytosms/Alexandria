import { readFileSync, writeFileSync } from 'node:fs'

export interface LibraryConfig {
  version: 1
  name: string
  createdAt: string
}

export function readLibraryConfig(path: string): LibraryConfig | null {
  try {
    const raw = readFileSync(path, 'utf8')
    const parsed = JSON.parse(raw) as Partial<LibraryConfig>
    if (parsed.version !== 1 || typeof parsed.name !== 'string') return null
    return {
      version: 1,
      name: parsed.name,
      createdAt: typeof parsed.createdAt === 'string' ? parsed.createdAt : new Date().toISOString()
    }
  } catch {
    return null
  }
}

export function writeLibraryConfig(path: string, config: LibraryConfig): void {
  writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`, 'utf8')
}
