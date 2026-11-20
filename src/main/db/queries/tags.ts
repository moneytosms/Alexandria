import type { DatabaseSync } from 'node:sqlite'
import type { Tag } from '../../../shared/types'

export function listTags(db: DatabaseSync): Tag[] {
  const rows = db
    .prepare(
      `SELECT t.id, t.name, COUNT(bt.book_id) AS count
       FROM tags t
       LEFT JOIN book_tags bt ON bt.tag_id = t.id
       GROUP BY t.id
       ORDER BY t.name COLLATE NOCASE ASC`
    )
    .all() as Array<{ id: number; name: string; count: number }>
  return rows.map((row) => ({ id: row.id, name: row.name, count: Number(row.count) }))
}

export function createTag(db: DatabaseSync, name: string): Tag {
  const trimmed = name.trim()
  if (trimmed.length === 0) throw new Error('A tag needs a name')

  db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)').run(trimmed)
  const row = db.prepare('SELECT id, name FROM tags WHERE name = ?').get(trimmed) as {
    id: number
    name: string
  }
  return { id: row.id, name: row.name, count: 0 }
}

export function deleteTag(db: DatabaseSync, id: number): void {
  db.prepare('DELETE FROM tags WHERE id = ?').run(id)
}

export function tagsForBook(db: DatabaseSync, bookId: number): Tag[] {
  const rows = db
    .prepare(
      `SELECT t.id, t.name FROM tags t
       JOIN book_tags bt ON bt.tag_id = t.id
       WHERE bt.book_id = ?
       ORDER BY t.name COLLATE NOCASE`
    )
    .all(bookId) as Array<{ id: number; name: string }>
  return rows.map((row) => ({ id: row.id, name: row.name, count: 1 }))
}

export function setBookTags(db: DatabaseSync, bookId: number, names: string[]): Tag[] {
  const cleaned = [...new Set(names.map((name) => name.trim()).filter((name) => name.length > 0))]

  db.prepare('DELETE FROM book_tags WHERE book_id = ?').run(bookId)

  const insertTag = db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)')
  const findTag = db.prepare('SELECT id FROM tags WHERE name = ?')
  const attach = db.prepare('INSERT OR IGNORE INTO book_tags (book_id, tag_id) VALUES (?, ?)')

  for (const name of cleaned) {
    insertTag.run(name)
    const tag = findTag.get(name) as { id: number }
    attach.run(bookId, tag.id)
  }

  return tagsForBook(db, bookId)
}
