import type { LibraryInfo } from '@shared/api'
import type { Floor, Section, Wall } from '@shared/types'
import { useMemo, useState } from 'react'
import { navigate } from '../router'
import { useLibraryStore } from '../state/library-store'
import { useUiStore } from '../state/ui-store'

interface Props {
  library: LibraryInfo | null
}

const wallOrder: Wall[] = ['north', 'east', 'south', 'west']

const wallClass: Record<Wall, string> = {
  north: 'map__section--north',
  east: 'map__section--east',
  south: 'map__section--south',
  west: 'map__section--west'
}

function sectionSummary(section: Section): string {
  const shelves = section.bays.reduce((sum, bay) => sum + bay.shelves.length, 0)
  return `${section.bays.length} ${section.bays.length === 1 ? 'bay' : 'bays'} · ${shelves} shelves`
}

export function MapView({ library }: Props) {
  const floors = useLibraryStore((state) => state.layout)
  const books = useLibraryStore((state) => state.books)
  const setRoom = useUiStore((state) => state.setRoom)
  const [floorId, setFloorId] = useState<number | null>(null)

  const floor: Floor | null = useMemo(
    () => floors.find((entry) => entry.id === floorId) ?? floors[0] ?? null,
    [floors, floorId]
  )
  const [roomId, setRoomId] = useState<number | null>(null)
  const room = useMemo(
    () => floor?.rooms.find((entry) => entry.id === roomId) ?? floor?.rooms[0] ?? null,
    [floor, roomId]
  )

  const sectionsByWall = useMemo(() => {
    const map = new Map<Wall, Section[]>()
    for (const wall of wallOrder) map.set(wall, [])
    for (const section of room?.sections ?? []) {
      map.get(section.wall)?.push(section)
    }
    return map
  }, [room])

  const roomBooks = room
    ? books.filter((book) =>
        room.sections.some((section) =>
          section.bays.some((bay) => bay.shelves.some((shelf) => shelf.id === book.shelfId))
        )
      ).length
    : 0

  const openRoom = (): void => {
    if (!room) return
    setRoom({ floorId: room.floorId, roomId: room.id })
    navigate('room')
  }

  return (
    <div className="map">
      <div>
        <div className="map__floors">
          {floors.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className="chip"
              aria-current={floor?.id === entry.id ? 'true' : undefined}
              onClick={() => {
                setFloorId(entry.id)
                setRoomId(entry.rooms[0]?.id ?? null)
              }}
            >
              {entry.name}
            </button>
          ))}
        </div>

        <div className="map__plan" aria-label={room ? `${room.name} floor plan` : 'Floor plan'}>
          {wallOrder.map((wall) => {
            const sections = sectionsByWall.get(wall) ?? []
            return (
              <div
                key={wall}
                className={`map__section ${wallClass[wall]} ${sections.length === 0 ? 'map__section--empty' : ''}`}
              >
                <span className="map__wall">{wall}</span>
                {sections.length === 0 ? (
                  <span className="map__detail">empty wall</span>
                ) : (
                  sections.map((section) => (
                    <button
                      key={section.id}
                      type="button"
                      className="map__section-button"
                      onClick={() => {
                        if (!room) return
                        setRoom({ floorId: room.floorId, roomId: room.id })
                        navigate('room')
                      }}
                    >
                      <span>{section.name}</span>
                      <span className="map__detail">{sectionSummary(section)}</span>
                    </button>
                  ))
                )}
              </div>
            )
          })}

          <div className="map__hall">
            <span className="map__hall-name">{room?.name ?? 'Main Hall'}</span>
            <span className="map__detail">{roomBooks} volumes · reading desks</span>
            <button className="button button--quiet map__enter" type="button" onClick={openRoom}>
              Enter the room
            </button>
          </div>
        </div>
      </div>

      <aside className="map__side">
        <p className="eyebrow">{floor?.name ?? 'Floor'}</p>
        <h2 className="display">{room?.name ?? 'No room yet'}</h2>
        <p className="lede">
          Each wall holds a section. A section grows by adding bays at its end; nothing already
          shelved moves when the collection does.
        </p>

        <div className="map__rooms">
          {(floor?.rooms ?? []).map((entry) => (
            <button
              key={entry.id}
              type="button"
              className="chip"
              aria-current={room?.id === entry.id ? 'true' : undefined}
              onClick={() => setRoomId(entry.id)}
            >
              {entry.name}
            </button>
          ))}
        </div>

        <dl className="map__stats">
          <div>
            <dt>Floors</dt>
            <dd>{floors.length || library?.floors || '—'}</dd>
          </div>
          <div>
            <dt>Sections</dt>
            <dd>{library?.sections ?? '—'}</dd>
          </div>
          <div>
            <dt>Shelves</dt>
            <dd>{library?.shelves ?? '—'}</dd>
          </div>
          <div>
            <dt>Slots</dt>
            <dd>{library?.slots ?? '—'}</dd>
          </div>
        </dl>
      </aside>
    </div>
  )
}
