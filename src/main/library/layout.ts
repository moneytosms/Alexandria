import type { DatabaseSync } from 'node:sqlite'
import { growLibrary, nextFreeShelf } from '../db/queries/containers'
import { getSetting, setSetting } from './settings'

export interface ShelfTarget {
  shelfId: number | null
  newBayId: number | null
  newSectionId?: number | null
  newRoomId?: number | null
  newFloorId?: number | null
}

/**
 * Chooses where a new import goes: the last shelf used, then the first shelf
 * with room, then an appended bay. The inbox is opt-in.
 */
export function nextImportShelf(db: DatabaseSync): ShelfTarget {
  if (getSetting(db, 'import.destination') === 'inbox') return { shelfId: null, newBayId: null }

  const remembered = Number(getSetting(db, 'import.lastShelfId') ?? '')
  const start = Number.isFinite(remembered) && remembered > 0 ? remembered : null

  let shelf = nextFreeShelf(db, start)
  if (!shelf && start !== null) shelf = nextFreeShelf(db, null)

  if (shelf) {
    setSetting(db, 'import.lastShelfId', String(shelf.id))
    return { shelfId: shelf.id, newBayId: null }
  }

  const grown = growLibrary(db)
  setSetting(db, 'import.lastShelfId', String(grown.shelfId))
  return {
    shelfId: grown.shelfId,
    newBayId: grown.bayId,
    newSectionId: grown.sectionId,
    newRoomId: grown.roomId,
    newFloorId: grown.floorId
  }
}

export { undoLastGrowth } from '../db/queries/containers'
