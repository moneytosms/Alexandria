import type { DatabaseSync } from 'node:sqlite'
import type {
  Annotation,
  AnnotationPatch,
  AnnotationType,
  InkPoint,
  NewAnnotation,
  NormalizedRect
} from '../../../shared/types'

interface RawAnnotation {
  id: number
  book_id: number
  page: number
  type: AnnotationType
  color: string | null
  rects_json: string | null
  path_json: string | null
  note: string | null
  created_at: string
  updated_at: string | null
}

function parseRects(json: string | null): NormalizedRect[] {
  if (!json) return []
  try {
    const value = JSON.parse(json) as unknown
    if (!Array.isArray(value)) return []
    return value.filter(
      (rect): rect is NormalizedRect =>
        typeof rect === 'object' &&
        rect !== null &&
        ['x', 'y', 'w', 'h'].every((key) => typeof (rect as Record<string, unknown>)[key] === 'number')
    )
  } catch {
    return []
  }
}

function parseStrokes(json: string | null): InkPoint[][] {
  if (!json) return []
  try {
    const value = JSON.parse(json) as unknown
    if (!Array.isArray(value)) return []
    return value.filter(
      (stroke): stroke is InkPoint[] =>
        Array.isArray(stroke) &&
        stroke.every(
          (point) =>
            typeof point === 'object' &&
            point !== null &&
            typeof (point as InkPoint).x === 'number' &&
            typeof (point as InkPoint).y === 'number'
        )
    )
  } catch {
    return []
  }
}

function toAnnotation(row: RawAnnotation): Annotation {
  return {
    id: row.id,
    bookId: row.book_id,
    page: row.page,
    type: row.type,
    color: row.color,
    rects: parseRects(row.rects_json),
    strokes: parseStrokes(row.path_json),
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export function listAnnotations(db: DatabaseSync, bookId: number): Annotation[] {
  const rows = db
    .prepare(
      'SELECT * FROM annotations WHERE book_id = ? ORDER BY page ASC, created_at ASC, id ASC'
    )
    .all(bookId) as unknown as RawAnnotation[]
  return rows.map(toAnnotation)
}

export function countAnnotations(db: DatabaseSync, bookId: number): number {
  const row = db
    .prepare('SELECT COUNT(*) AS n FROM annotations WHERE book_id = ?')
    .get(bookId) as { n: number }
  return Number(row.n)
}

export function createAnnotation(db: DatabaseSync, input: NewAnnotation): Annotation {
  const row = db
    .prepare(
      `INSERT INTO annotations (book_id, page, type, color, rects_json, path_json, note)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       RETURNING *`
    )
    .get(
      input.bookId,
      input.page,
      input.type,
      input.color ?? null,
      input.rects && input.rects.length > 0 ? JSON.stringify(input.rects) : null,
      input.strokes && input.strokes.length > 0 ? JSON.stringify(input.strokes) : null,
      input.note ?? null
    ) as unknown as RawAnnotation

  return toAnnotation(row)
}

export function updateAnnotation(db: DatabaseSync, id: number, patch: AnnotationPatch): Annotation {
  const sets: string[] = []
  const values: Array<string | number | null> = []

  const push = (column: string, value: string | number | null): void => {
    sets.push(`${column} = ?`)
    values.push(value)
  }

  if (patch.page !== undefined) push('page', Math.max(1, Math.round(patch.page)))
  if (patch.color !== undefined) push('color', patch.color)
  if (patch.note !== undefined) push('note', patch.note)
  if (patch.rects !== undefined) {
    push('rects_json', patch.rects.length > 0 ? JSON.stringify(patch.rects) : null)
  }
  if (patch.strokes !== undefined) {
    push('path_json', patch.strokes.length > 0 ? JSON.stringify(patch.strokes) : null)
  }

  if (sets.length > 0) {
    sets.push("updated_at = datetime('now')")
    db.prepare(`UPDATE annotations SET ${sets.join(', ')} WHERE id = ?`).run(...values, id)
  }

  const row = db.prepare('SELECT * FROM annotations WHERE id = ?').get(id) as
    | RawAnnotation
    | undefined
  if (!row) throw new Error(`Annotation ${id} not found`)
  return toAnnotation(row)
}

export function deleteAnnotation(db: DatabaseSync, id: number): void {
  db.prepare('DELETE FROM annotations WHERE id = ?').run(id)
}

export function deleteAnnotationsForPage(
  db: DatabaseSync,
  bookId: number,
  page: number,
  type?: AnnotationType
): void {
  if (type) {
    db.prepare('DELETE FROM annotations WHERE book_id = ? AND page = ? AND type = ?').run(
      bookId,
      page,
      type
    )
  } else {
    db.prepare('DELETE FROM annotations WHERE book_id = ? AND page = ?').run(bookId, page)
  }
}
