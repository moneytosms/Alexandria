import type { DatabaseSync } from 'node:sqlite'

export const defaultSettings: Record<string, string> = {
  'import.destination': 'shelf',
  'import.storage': 'copy',
  'ui.quality': 'auto',
  'ui.reducedMotion': 'false',
  'sound.enabled': 'true',
  'sound.volume': '0.3',
  'music.folders': '[]'
}

export function getSetting(db: DatabaseSync, key: string): string | null {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined
  return row?.value ?? null
}

export function setSetting(db: DatabaseSync, key: string, value: string): void {
  db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(key, value)
}

export function getAllSettings(db: DatabaseSync): Record<string, string> {
  const rows = db.prepare('SELECT key, value FROM settings').all() as Array<{
    key: string
    value: string
  }>
  return Object.fromEntries(rows.map((row) => [row.key, row.value]))
}

export function seedDefaultSettings(db: DatabaseSync): void {
  const insert = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)')
  for (const [key, value] of Object.entries(defaultSettings)) {
    insert.run(key, value)
  }
}
