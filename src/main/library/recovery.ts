import { readdirSync, statSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'

export function databaseIntegrity(db: DatabaseSync): string {
  try {
    const rows = db.prepare('PRAGMA quick_check').all() as Array<Record<string, unknown>>
    const result = rows.map((row) => String(Object.values(row)[0])).join('; ')
    return result || 'ok'
  } catch (error) {
    return error instanceof Error ? error.message : 'unknown'
  }
}

/**
 * A crash during import can leave a copied PDF with no book row. Those copies
 * are inside the managed `books/` folder, so anything unreferenced after a
 * clean start is a half-finished import and safe to discard.
 */
export function cleanOrphanedCopies(
  db: DatabaseSync,
  booksDir: string,
  log: (message: string) => void
): number {
  let entries: string[]
  try {
    entries = readdirSync(booksDir)
  } catch {
    return 0
  }

  const referenced = new Set(
    (
      db.prepare('SELECT rel_path FROM books WHERE rel_path IS NOT NULL').all() as Array<{
        rel_path: string
      }>
    ).map((row) => row.rel_path.replace(/^books\//, ''))
  )

  let removed = 0
  for (const name of entries) {
    if (name.startsWith('.')) continue
    const path = join(booksDir, name)
    let info
    try {
      info = statSync(path)
    } catch {
      continue
    }
    if (!info.isFile()) continue
    if (referenced.has(name)) continue

    // Ignore very recent files so a second app instance cannot race an import.
    if (Date.now() - info.mtimeMs < 60_000) continue

    try {
      unlinkSync(path)
      removed += 1
    } catch {
      // A locked or already-removed file is not worth failing startup over.
    }
  }

  if (removed > 0) log(`Removed ${removed} orphaned import file(s)`)
  return removed
}
