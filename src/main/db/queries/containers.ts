import type { DatabaseSync } from 'node:sqlite'
import type {
  Bay,
  ContainerCreateInput,
  ContainerDeleteInput,
  ContainerKind,
  ContainerUpdateInput,
  Floor,
  Room,
  Section,
  Shelf,
  SortDirection,
  SortMode,
  Wall
} from '../../../shared/types'
import { withTransaction } from '../transaction'

export const shelvesPerBay = 5
export const baysPerSection = 6
export const roomsPerFloor = 4
export const walls: Wall[] = ['north', 'east', 'south', 'west']
export const wallNames: Record<Wall, string> = {
  north: 'North Wall',
  east: 'East Wall',
  south: 'South Wall',
  west: 'West Wall'
}

interface ShelfRow {
  id: number
  bay_id: number
  label: string | null
  row_index: number
  capacity: number
  sort_mode: SortMode
  sort_dir: SortDirection
  book_count: number
}

interface BayRow {
  id: number
  section_id: number
  sort_index: number
  auto_created: number
}

interface SectionRow {
  id: number
  room_id: number
  name: string
  wall: Wall
  sort_index: number
}

interface RoomRow {
  id: number
  floor_id: number
  name: string
  sort_index: number
}

interface FloorRow {
  id: number
  name: string
  sort_index: number
}

const shelfSelect = `
  SELECT s.*, (SELECT COUNT(*) FROM books b WHERE b.shelf_id = s.id) AS book_count
  FROM shelves s
`

function toShelf(row: ShelfRow): Shelf {
  return {
    id: row.id,
    bayId: row.bay_id,
    label: row.label,
    rowIndex: row.row_index,
    capacity: row.capacity,
    sortMode: row.sort_mode,
    sortDir: row.sort_dir,
    bookCount: Number(row.book_count)
  }
}

export function getLayout(db: DatabaseSync): Floor[] {
  const floors = db
    .prepare('SELECT * FROM floors ORDER BY sort_index ASC, id ASC')
    .all() as unknown as FloorRow[]
  const rooms = db
    .prepare('SELECT * FROM rooms ORDER BY sort_index ASC, id ASC')
    .all() as unknown as RoomRow[]
  const sections = db
    .prepare('SELECT * FROM sections ORDER BY sort_index ASC, id ASC')
    .all() as unknown as SectionRow[]
  const bays = db
    .prepare('SELECT * FROM bays ORDER BY sort_index ASC, id ASC')
    .all() as unknown as BayRow[]
  const shelves = db
    .prepare(`${shelfSelect} ORDER BY s.row_index ASC, s.id ASC`)
    .all() as unknown as ShelfRow[]

  const shelvesByBay = new Map<number, Shelf[]>()
  for (const row of shelves) {
    const list = shelvesByBay.get(row.bay_id) ?? []
    list.push(toShelf(row))
    shelvesByBay.set(row.bay_id, list)
  }

  const baysBySection = new Map<number, Bay[]>()
  for (const row of bays) {
    const list = baysBySection.get(row.section_id) ?? []
    list.push({
      id: row.id,
      sectionId: row.section_id,
      sortIndex: row.sort_index,
      autoCreated: row.auto_created === 1,
      shelves: shelvesByBay.get(row.id) ?? []
    })
    baysBySection.set(row.section_id, list)
  }

  const sectionsByRoom = new Map<number, Section[]>()
  for (const row of sections) {
    const list = sectionsByRoom.get(row.room_id) ?? []
    list.push({
      id: row.id,
      roomId: row.room_id,
      name: row.name,
      wall: row.wall,
      sortIndex: row.sort_index,
      bays: baysBySection.get(row.id) ?? []
    })
    sectionsByRoom.set(row.room_id, list)
  }

  const roomsByFloor = new Map<number, Room[]>()
  for (const row of rooms) {
    const list = roomsByFloor.get(row.floor_id) ?? []
    list.push({
      id: row.id,
      floorId: row.floor_id,
      name: row.name,
      sortIndex: row.sort_index,
      sections: sectionsByRoom.get(row.id) ?? []
    })
    roomsByFloor.set(row.floor_id, list)
  }

  return floors.map((row) => ({
    id: row.id,
    name: row.name,
    sortIndex: row.sort_index,
    rooms: roomsByFloor.get(row.id) ?? []
  }))
}

export function getShelf(db: DatabaseSync, id: number): Shelf | null {
  const row = db.prepare(`${shelfSelect} WHERE s.id = ?`).get(id) as ShelfRow | undefined
  return row ? toShelf(row) : null
}

export function listShelfIds(db: DatabaseSync): number[] {
  return (db.prepare('SELECT id FROM shelves ORDER BY id').all() as Array<{ id: number }>).map(
    (row) => row.id
  )
}

function nextSortIndex(db: DatabaseSync, table: string, parentColumn: string, parentId: number): number {
  const row = db
    .prepare(`SELECT COALESCE(MAX(sort_index), -1) + 1 AS next FROM ${table} WHERE ${parentColumn} = ?`)
    .get(parentId) as { next: number }
  return Number(row.next)
}

function createShelves(db: DatabaseSync, bayId: number): void {
  const insert = db.prepare(
    `INSERT INTO shelves (bay_id, row_index, capacity, sort_mode, sort_dir)
     VALUES (?, ?, 24, 'manual', 'asc')`
  )
  for (let row = 0; row < shelvesPerBay; row += 1) insert.run(bayId, row)
}

export function createBayWithShelves(db: DatabaseSync, sectionId: number): number {
  const sortIndex = nextSortIndex(db, 'bays', 'section_id', sectionId)
  const result = db
    .prepare('INSERT INTO bays (section_id, sort_index) VALUES (?, ?)')
    .run(sectionId, sortIndex)
  const bayId = Number(result.lastInsertRowid)
  createShelves(db, bayId)
  return bayId
}

function createSectionInRoom(db: DatabaseSync, roomId: number, wall: Wall, name?: string): number {
  const sortIndex = nextSortIndex(db, 'sections', 'room_id', roomId)
  const result = db
    .prepare('INSERT INTO sections (room_id, name, wall, sort_index) VALUES (?, ?, ?, ?)')
    .run(roomId, name ?? wallNames[wall], wall, sortIndex)
  const sectionId = Number(result.lastInsertRowid)
  createBayWithShelves(db, sectionId)
  return sectionId
}

function createRoomInFloor(db: DatabaseSync, floorId: number, name: string): number {
  const sortIndex = nextSortIndex(db, 'rooms', 'floor_id', floorId)
  const result = db
    .prepare('INSERT INTO rooms (floor_id, name, sort_index) VALUES (?, ?, ?)')
    .run(floorId, name, sortIndex)
  const roomId = Number(result.lastInsertRowid)
  createSectionInRoom(db, roomId, 'north')
  return roomId
}

export function createContainer(db: DatabaseSync, input: ContainerCreateInput): number {
  return withTransaction(db, () => {
    switch (input.kind) {
      case 'floor': {
        const sortIndex = Number(
          (
            db
              .prepare('SELECT COALESCE(MAX(sort_index), -1) + 1 AS next FROM floors')
              .get() as { next: number }
          ).next
        )
        const result = db
          .prepare('INSERT INTO floors (name, sort_index) VALUES (?, ?)')
          .run(input.name ?? `Floor ${sortIndex + 1}`, sortIndex)
        const floorId = Number(result.lastInsertRowid)
        createRoomInFloor(db, floorId, 'Main Hall')
        return floorId
      }
      case 'room': {
        if (input.parentId == null) throw new Error('A room needs a floor')
        return createRoomInFloor(db, input.parentId, input.name ?? 'Reading Room')
      }
      case 'section': {
        if (input.parentId == null) throw new Error('A section needs a room')
        const used = (
          db.prepare('SELECT wall FROM sections WHERE room_id = ?').all(input.parentId) as Array<{
            wall: Wall
          }>
        ).map((row) => row.wall)
        const wall = input.wall ?? walls.find((candidate) => !used.includes(candidate)) ?? 'north'
        return createSectionInRoom(db, input.parentId, wall, input.name)
      }
      case 'bay': {
        if (input.parentId == null) throw new Error('A bay needs a section')
        return createBayWithShelves(db, input.parentId)
      }
      case 'shelf': {
        if (input.parentId == null) throw new Error('A shelf needs a bay')
        const rowIndex = Number(
          (
            db
              .prepare('SELECT COALESCE(MAX(row_index), -1) + 1 AS next FROM shelves WHERE bay_id = ?')
              .get(input.parentId) as { next: number }
          ).next
        )
        const trimmed = input.name?.trim()
        const label = trimmed && trimmed.length > 0 ? trimmed.slice(0, 64) : null
        const result = db
          .prepare(
            `INSERT INTO shelves (bay_id, label, row_index, capacity, sort_mode, sort_dir)
             VALUES (?, ?, ?, 24, 'manual', 'asc')`
          )
          .run(input.parentId, label, rowIndex)
        return Number(result.lastInsertRowid)
      }
    }
  })
}

export function updateContainer(db: DatabaseSync, input: ContainerUpdateInput): void {
  switch (input.kind) {
    case 'floor':
      if (input.name !== undefined) {
        db.prepare('UPDATE floors SET name = ? WHERE id = ?').run(input.name, input.id)
      }
      return
    case 'room':
      if (input.name !== undefined) {
        db.prepare('UPDATE rooms SET name = ? WHERE id = ?').run(input.name, input.id)
      }
      return
    case 'section': {
      if (input.name !== undefined) {
        db.prepare('UPDATE sections SET name = ? WHERE id = ?').run(input.name, input.id)
      }
      if (input.wall !== undefined) {
        db.prepare('UPDATE sections SET wall = ? WHERE id = ?').run(input.wall, input.id)
      }
      return
    }
    case 'bay':
      return
    case 'shelf': {
      const rawLabel = input.label !== undefined ? input.label : input.name
      if (rawLabel !== undefined) {
        const trimmed = rawLabel === null ? '' : rawLabel.trim()
        const normalized = trimmed.length > 0 ? trimmed.slice(0, 64) : null
        db.prepare('UPDATE shelves SET label = ? WHERE id = ?').run(normalized, input.id)
      }
      if (input.capacity !== undefined) {
        const capacity = Math.max(1, Math.min(200, Math.round(input.capacity)))
        db.prepare('UPDATE shelves SET capacity = ? WHERE id = ?').run(capacity, input.id)
      }
      if (input.sortMode !== undefined) {
        db.prepare('UPDATE shelves SET sort_mode = ? WHERE id = ?').run(input.sortMode, input.id)
      }
      if (input.sortDir !== undefined) {
        db.prepare('UPDATE shelves SET sort_dir = ? WHERE id = ?').run(input.sortDir, input.id)
      }
      return
    }
  }
}

function reassignBooks(db: DatabaseSync, fromShelfIds: number[], toShelfId: number | null): void {
  if (fromShelfIds.length === 0) return
  const placeholders = fromShelfIds.map(() => '?').join(', ')

  if (toShelfId === null) {
    db.prepare(
      `UPDATE books SET shelf_id = NULL, slot_index = 0 WHERE shelf_id IN (${placeholders})`
    ).run(...fromShelfIds)
    return
  }

  let next = Number(
    (
      db
        .prepare('SELECT COALESCE(MAX(slot_index), -1) + 1 AS next FROM books WHERE shelf_id = ?')
        .get(toShelfId) as { next: number }
    ).next
  )

  const books = db
    .prepare(
      `SELECT id FROM books WHERE shelf_id IN (${placeholders}) ORDER BY shelf_id, slot_index, id`
    )
    .all(...fromShelfIds) as Array<{ id: number }>

  const move = db.prepare('UPDATE books SET shelf_id = ?, slot_index = ? WHERE id = ?')
  for (const book of books) {
    move.run(toShelfId, next, book.id)
    next += 1
  }
}

function shelfIdsFor(db: DatabaseSync, kind: ContainerKind, id: number): number[] {
  switch (kind) {
    case 'shelf':
      return [id]
    case 'bay':
      return (
        db.prepare('SELECT id FROM shelves WHERE bay_id = ?').all(id) as Array<{ id: number }>
      ).map((row) => row.id)
    case 'section':
      return (
        db
          .prepare(
            'SELECT s.id FROM shelves s JOIN bays b ON b.id = s.bay_id WHERE b.section_id = ?'
          )
          .all(id) as Array<{ id: number }>
      ).map((row) => row.id)
    case 'room':
      return (
        db
          .prepare(
            `SELECT s.id FROM shelves s
             JOIN bays b ON b.id = s.bay_id
             JOIN sections c ON c.id = b.section_id
             WHERE c.room_id = ?`
          )
          .all(id) as Array<{ id: number }>
      ).map((row) => row.id)
    case 'floor':
      return (
        db
          .prepare(
            `SELECT s.id FROM shelves s
             JOIN bays b ON b.id = s.bay_id
             JOIN sections c ON c.id = b.section_id
             JOIN rooms r ON r.id = c.room_id
             WHERE r.floor_id = ?`
          )
          .all(id) as Array<{ id: number }>
      ).map((row) => row.id)
  }
}

export function deleteContainer(db: DatabaseSync, input: ContainerDeleteInput): void {
  withTransaction(db, () => {
    const shelfIds = shelfIdsFor(db, input.kind, input.id)
    const target = input.reassignShelfId ?? null

    if (target !== null && shelfIds.includes(target)) {
      throw new Error('Books cannot be reassigned to the shelf being removed')
    }

    reassignBooks(db, shelfIds, target)

    switch (input.kind) {
      case 'floor':
        db.prepare('DELETE FROM floors WHERE id = ?').run(input.id)
        break
      case 'room':
        db.prepare('DELETE FROM rooms WHERE id = ?').run(input.id)
        break
      case 'section':
        db.prepare('DELETE FROM sections WHERE id = ?').run(input.id)
        break
      case 'bay':
        db.prepare('DELETE FROM bays WHERE id = ?').run(input.id)
        break
      case 'shelf':
        db.prepare('DELETE FROM shelves WHERE id = ?').run(input.id)
        break
    }
  })
}

/** Appends a bay to the last section, or builds out the next wall, room, or floor. */
export function growLibrary(db: DatabaseSync): {
  shelfId: number
  bayId: number
  sectionId: number
  roomId: number
  floorId: number
} {
  return withTransaction(db, () => {
    const lastFloor = db
      .prepare('SELECT * FROM floors ORDER BY sort_index DESC, id DESC LIMIT 1')
      .get() as FloorRow | undefined

    if (!lastFloor) throw new Error('The library has no floor to grow')

    let lastRoom = db
      .prepare('SELECT * FROM rooms WHERE floor_id = ? ORDER BY sort_index DESC, id DESC LIMIT 1')
      .get(lastFloor.id) as RoomRow | undefined

    if (!lastRoom) {
      const roomId = createRoomInFloor(db, lastFloor.id, 'Reading Room')
      lastRoom = db
        .prepare('SELECT * FROM rooms WHERE id = ?')
        .get(roomId) as unknown as RoomRow
    }

    const sections = db
      .prepare('SELECT * FROM sections WHERE room_id = ? ORDER BY sort_index ASC, id ASC')
      .all(lastRoom.id) as unknown as SectionRow[]

    if (sections.length === 0) {
      const sectionId = createSectionInRoom(db, lastRoom.id, 'north')
      const bayId = (
        db.prepare('SELECT id FROM bays WHERE section_id = ? ORDER BY id LIMIT 1').get(sectionId) as {
          id: number
        }
      ).id
      return finishGrowth(db, sectionId, bayId, lastRoom.id, lastFloor.id)
    }

    const lastSection = sections.at(-1) as SectionRow
    const bayCount = Number(
      (
        db.prepare('SELECT COUNT(*) AS n FROM bays WHERE section_id = ?').get(lastSection.id) as {
          n: number
        }
      ).n
    )

    if (bayCount < baysPerSection) {
      const bayId = createBayWithShelves(db, lastSection.id)
      return finishGrowth(db, lastSection.id, bayId, lastRoom.id, lastFloor.id)
    }

    const usedWalls = sections.map((section) => section.wall)
    const freeWall = walls.find((wall) => !usedWalls.includes(wall))

    if (freeWall) {
      const sectionId = createSectionInRoom(db, lastRoom.id, freeWall)
      const bayId = (
        db.prepare('SELECT id FROM bays WHERE section_id = ? ORDER BY id LIMIT 1').get(sectionId) as {
          id: number
        }
      ).id
      return finishGrowth(db, sectionId, bayId, lastRoom.id, lastFloor.id)
    }

    const roomCount = Number(
      (db.prepare('SELECT COUNT(*) AS n FROM rooms WHERE floor_id = ?').get(lastFloor.id) as {
        n: number
      }).n
    )

    if (roomCount < roomsPerFloor) {
      const roomId = createRoomInFloor(db, lastFloor.id, `Reading Room ${roomCount + 1}`)
      const section = db
        .prepare('SELECT id FROM sections WHERE room_id = ? ORDER BY id LIMIT 1')
        .get(roomId) as { id: number }
      const bayId = (
        db.prepare('SELECT id FROM bays WHERE section_id = ? ORDER BY id LIMIT 1').get(
          section.id
        ) as { id: number }
      ).id
      return finishGrowth(db, section.id, bayId, roomId, lastFloor.id)
    }

    const floorIndex = Number(
      (db.prepare('SELECT COALESCE(MAX(sort_index), -1) + 1 AS next FROM floors').get() as {
        next: number
      }).next
    )
    const floorResult = db
      .prepare('INSERT INTO floors (name, sort_index) VALUES (?, ?)')
      .run(`Floor ${floorIndex + 1}`, floorIndex)
    const floorId = Number(floorResult.lastInsertRowid)
    const roomId = createRoomInFloor(db, floorId, 'Main Hall')
    const section = db
      .prepare('SELECT id FROM sections WHERE room_id = ? ORDER BY id LIMIT 1')
      .get(roomId) as { id: number }
    const bayId = (
      db.prepare('SELECT id FROM bays WHERE section_id = ? ORDER BY id LIMIT 1').get(section.id) as {
        id: number
      }
    ).id
    return finishGrowth(db, section.id, bayId, roomId, floorId)
  })
}

function finishGrowth(
  db: DatabaseSync,
  sectionId: number,
  bayId: number,
  roomId: number,
  floorId: number
): {
  shelfId: number
  bayId: number
  sectionId: number
  roomId: number
  floorId: number
} {
  db.prepare('UPDATE bays SET auto_created = 1 WHERE id = ?').run(bayId)
  const shelf = db
    .prepare('SELECT id FROM shelves WHERE bay_id = ? ORDER BY row_index LIMIT 1')
    .get(bayId) as { id: number }
  return { shelfId: shelf.id, bayId, sectionId, roomId, floorId }
}

export function undoLastGrowth(db: DatabaseSync): boolean {
  const row = db
    .prepare(
      `SELECT b.id
       FROM bays b
       WHERE b.auto_created = 1
         AND NOT EXISTS (
           SELECT 1 FROM shelves s JOIN books k ON k.shelf_id = s.id WHERE s.bay_id = b.id
         )
       ORDER BY b.id DESC
       LIMIT 1`
    )
    .get() as { id: number } | undefined

  if (!row) return false

  db.prepare('DELETE FROM bays WHERE id = ?').run(row.id)
  return true
}

export function nextFreeShelf(db: DatabaseSync, afterId: number | null): Shelf | null {
  const query =
    afterId === null
      ? `${shelfSelect}
         WHERE (SELECT COUNT(*) FROM books b WHERE b.shelf_id = s.id) < s.capacity
         ORDER BY s.id LIMIT 1`
      : `${shelfSelect}
         WHERE s.id >= ?
           AND (SELECT COUNT(*) FROM books b WHERE b.shelf_id = s.id) < s.capacity
         ORDER BY s.id LIMIT 1`

  const row =
    afterId === null
      ? (db.prepare(query).get() as ShelfRow | undefined)
      : (db.prepare(query).get(afterId) as ShelfRow | undefined)

  return row ? toShelf(row) : null
}

export function sortShelfBooks(db: DatabaseSync, shelfId: number): void {
  const shelf = getShelf(db, shelfId)
  if (!shelf || shelf.sortMode === 'manual') return

  const column: Record<Exclude<SortMode, 'manual'>, string> = {
    title: 'title COLLATE NOCASE',
    author: "COALESCE(author, '') COLLATE NOCASE",
    added: 'added_at',
    read: "COALESCE(last_opened_at, '')",
    format: 'format'
  }

  const direction = shelf.sortDir === 'desc' ? 'DESC' : 'ASC'
  const rows = db
    .prepare(`SELECT id FROM books WHERE shelf_id = ? ORDER BY ${column[shelf.sortMode]} ${direction}, id ASC`)
    .all(shelfId) as Array<{ id: number }>

  const update = db.prepare('UPDATE books SET slot_index = ? WHERE id = ?')
  rows.forEach((row, index) => update.run(index, row.id))
}
