import type { DatabaseSync } from 'node:sqlite'
import { withTransaction } from '../db/transaction'
import { seedDefaultSettings } from './settings'

const walls = ['north', 'east', 'south', 'west'] as const
const wallNames: Record<(typeof walls)[number], string> = {
  north: 'North Wall',
  east: 'East Wall',
  south: 'South Wall',
  west: 'West Wall'
}

const shelvesPerBay = 5

export function seedLibraryLayout(db: DatabaseSync): void {
  const row = db.prepare('SELECT COUNT(*) AS n FROM floors').get() as { n: number }
  if (row.n > 0) return

  const insertFloor = db.prepare('INSERT INTO floors (name, sort_index) VALUES (?, ?)')
  const insertRoom = db.prepare('INSERT INTO rooms (floor_id, name, sort_index) VALUES (?, ?, ?)')
  const insertSection = db.prepare(
    'INSERT INTO sections (room_id, name, wall, sort_index) VALUES (?, ?, ?, ?)'
  )
  const insertBay = db.prepare('INSERT INTO bays (section_id, sort_index) VALUES (?, ?)')
  const insertShelf = db.prepare(
    'INSERT INTO shelves (bay_id, row_index, capacity, sort_mode, sort_dir) VALUES (?, ?, 24, ?, ?)'
  )

  withTransaction(db, () => {
    const floor = insertFloor.run('Ground Floor', 0)
    const room = insertRoom.run(Number(floor.lastInsertRowid), 'Main Hall', 0)

    walls.forEach((wall, index) => {
      const section = insertSection.run(Number(room.lastInsertRowid), wallNames[wall], wall, index)
      const bay = insertBay.run(Number(section.lastInsertRowid), 0)

      for (let row = 0; row < shelvesPerBay; row += 1) {
        insertShelf.run(Number(bay.lastInsertRowid), row, 'manual', 'asc')
      }
    })
  })

  seedDefaultSettings(db)
}
