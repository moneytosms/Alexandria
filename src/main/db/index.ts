import { DatabaseSync } from 'node:sqlite'
import { migrate } from './migrations'
import { clearStatementCache } from './stmt-cache'

export function openDatabase(path: string): DatabaseSync {
  const db = new DatabaseSync(path)

  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA foreign_keys = ON')
  db.exec('PRAGMA busy_timeout = 5000')
  db.exec('PRAGMA synchronous = NORMAL')
  db.exec('PRAGMA cache_size = -16000')
  db.exec('PRAGMA temp_store = MEMORY')
  db.exec('PRAGMA mmap_size = 134217728')

  migrate(db)

  return db
}

export function closeDatabase(db: DatabaseSync): void {
  try {
    db.exec('PRAGMA optimize')
  } catch {
    // Ignore optimization errors on already-closing handles
  }
  clearStatementCache(db)
  db.close()
}
