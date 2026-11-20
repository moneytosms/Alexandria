import { DatabaseSync } from 'node:sqlite'
import { migrate } from './migrations'

export function openDatabase(path: string): DatabaseSync {
  const db = new DatabaseSync(path)

  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA foreign_keys = ON')
  db.exec('PRAGMA busy_timeout = 5000')
  db.exec('PRAGMA synchronous = NORMAL')

  migrate(db)

  return db
}

export function closeDatabase(db: DatabaseSync): void {
  db.close()
}
