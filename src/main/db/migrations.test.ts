import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { openDatabase } from './index'
import { currentSchemaVersion } from './migrations'

function seedHierarchy(db: ReturnType<typeof openDatabase>): void {
  db.exec("INSERT INTO floors (name) VALUES ('Ground Floor')")
  db.exec("INSERT INTO rooms (floor_id, name) VALUES (1, 'Main Hall')")
  db.exec("INSERT INTO sections (room_id, name, wall) VALUES (1, 'North Wall', 'north')")
  db.exec('INSERT INTO bays (section_id) VALUES (1)')
  db.exec('INSERT INTO shelves (bay_id, row_index) VALUES (1, 0)')
}

describe('database', () => {
  it('migrates an empty database to the current schema', () => {
    const db = openDatabase(':memory:')

    expect(currentSchemaVersion()).toBeGreaterThanOrEqual(1)

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type IN ('table','view') ORDER BY name")
      .all()
      .map((row) => String((row as { name: string }).name))

    expect(tables).toContain('books')
    expect(tables).toContain('annotations')
    expect(tables).toContain('bays')
    expect(tables).toContain('pages_fts')
    expect(tables).toContain('settings')

    db.close()
  })

  it('is idempotent and reports the current version', () => {
    const db = openDatabase(':memory:')
    const first = db.prepare('PRAGMA user_version').get() as { user_version: number }

    db.close()

    const reopened = openDatabase(':memory:')
    const second = reopened.prepare('PRAGMA user_version').get() as { user_version: number }

    expect(second.user_version).toBe(first.user_version)
    reopened.close()
  })

  it('reopens a file database without rerunning migrations', () => {
    const dir = mkdtempSync(join(tmpdir(), 'alexandria-db-'))
    const path = join(dir, 'library.db')

    try {
      const db = openDatabase(path)
      seedHierarchy(db)
      db.prepare(
        `INSERT INTO books
          (title, file_path, storage_mode, sha256, shelf_id)
         VALUES (?, ?, 'copy', ?, 1)`
      ).run('Persisted', '/tmp/persisted.pdf', 'hash-persisted')
      db.close()

      const reopened = openDatabase(path)
      const version = reopened.prepare('PRAGMA user_version').get() as { user_version: number }
      const book = reopened
        .prepare('SELECT title FROM books WHERE sha256 = ?')
        .get('hash-persisted') as { title: string }

      expect(version.user_version).toBe(currentSchemaVersion())
      expect(book.title).toBe('Persisted')
      expect(reopened.prepare('PRAGMA journal_mode').get()).toEqual({ journal_mode: 'wal' })

      reopened.close()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('enforces foreign keys and cascades annotations with their book', () => {
    const db = openDatabase(':memory:')
    seedHierarchy(db)

    db.prepare(
      `INSERT INTO books
        (title, file_path, storage_mode, sha256, shelf_id)
       VALUES (?, ?, 'copy', ?, 1)`
    ).run('The Book', '/tmp/the-book.pdf', 'hash-1')

    db.prepare(
      `INSERT INTO annotations (book_id, page, type, color)
       VALUES (1, 1, 'highlight', '#f2c14e')`
    ).run()

    expect(db.prepare('SELECT COUNT(*) AS n FROM annotations').get()).toEqual({ n: 1 })

    db.prepare('DELETE FROM books WHERE id = 1').run()

    expect(db.prepare('SELECT COUNT(*) AS n FROM annotations').get()).toEqual({ n: 0 })

    db.close()
  })

  it('keeps a book when its shelf is deleted', () => {
    const db = openDatabase(':memory:')
    seedHierarchy(db)

    db.prepare(
      `INSERT INTO books
        (title, file_path, storage_mode, sha256, shelf_id)
       VALUES (?, ?, 'copy', ?, 1)`
    ).run('Shelf Book', '/tmp/shelf-book.pdf', 'hash-2')

    db.prepare('DELETE FROM shelves WHERE id = 1').run()

    const book = db.prepare('SELECT shelf_id FROM books WHERE id = 1').get() as {
      shelf_id: number | null
    }

    expect(book.shelf_id).toBeNull()

    db.close()
  })

  it('indexes page text with FTS5', () => {
    const db = openDatabase(':memory:')
    seedHierarchy(db)

    db.prepare(
      `INSERT INTO books
        (title, file_path, storage_mode, sha256, shelf_id)
       VALUES (?, ?, 'copy', ?, 1)`
    ).run('Alexandria', '/tmp/alexandria.pdf', 'hash-3')

    db.prepare('INSERT INTO pages (book_id, page, text) VALUES (?, ?, ?)').run(
      1,
      7,
      'The library at Alexandria held the known world.'
    )
    db.prepare('INSERT INTO pages_fts (text, book_id, page) VALUES (?, ?, ?)').run(
      'The library at Alexandria held the known world.',
      1,
      7
    )

    const hit = db
      .prepare("SELECT book_id, page FROM pages_fts WHERE pages_fts MATCH 'Alexandria'")
      .get() as { book_id: number; page: number }

    expect(hit.book_id).toBe(1)
    expect(hit.page).toBe(7)

    db.close()
  })
})
