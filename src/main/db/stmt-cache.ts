import type { DatabaseSync, StatementSync } from 'node:sqlite'

const cacheByDb = new WeakMap<DatabaseSync, Map<string, StatementSync>>()

/**
 * Caches compiled SQLite statements per DatabaseSync connection using a WeakMap
 * so closing/garbage-collecting a database releases its statements automatically.
 */
export function prepareCached(db: DatabaseSync, sql: string): StatementSync {
  let map = cacheByDb.get(db)
  if (!map) {
    map = new Map<string, StatementSync>()
    cacheByDb.set(db, map)
  }
  let stmt = map.get(sql)
  if (!stmt) {
    stmt = db.prepare(sql)
    map.set(sql, stmt)
  }
  return stmt
}

export function clearStatementCache(db: DatabaseSync): void {
  cacheByDb.delete(db)
}
