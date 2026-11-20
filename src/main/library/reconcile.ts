import { join } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'

interface CopiedBook {
  id: number
  file_path: string
  rel_path: string
}

export function rebaseCopiedBooks(db: DatabaseSync, root: string): number {
  const rows = db
    .prepare(
      `SELECT id, file_path, rel_path
       FROM books
       WHERE storage_mode = 'copy' AND rel_path IS NOT NULL`
    )
    .all() as unknown as CopiedBook[]

  const update = db.prepare('UPDATE books SET file_path = ? WHERE id = ?')
  let changed = 0

  for (const row of rows) {
    const expected = join(root, row.rel_path)
    if (expected === row.file_path) continue
    update.run(expected, row.id)
    changed += 1
  }

  return changed
}
