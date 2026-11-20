import type { LibraryInfo } from '@shared/api'
import type { Floor, Room, Section, Wall } from '@shared/types'
import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
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
  const currentRoom = useUiStore((state) => state.room)
  const [floorId, setFloorId] = useState<number | null>(null)
  const [view, setView] = useState({ zoom: 1, x: 0, y: 0 })
  const drag = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(
    null
  )

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

  const travel = (target: Room | null = room): void => {
    if (!target) return
    setRoom({ floorId: target.floorId, roomId: target.id })
    navigate('room')
  }

  const zoomBy = (factor: number): void => {
    setView((current) => ({
      ...current,
      zoom: Math.min(2.4, Math.max(0.6, Math.round(current.zoom * factor * 100) / 100))
    }))
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0) return
    drag.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: view.x,
      originY: view.y
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const active = drag.current
    if (!active) return
    setView((current) => ({
      ...current,
      x: active.originX + (event.clientX - active.startX),
      y: active.originY + (event.clientY - active.startY)
    }))
  }

  const endDrag = (): void => {
    drag.current = null
  }

  const here = room !== null && currentRoom.roomId === room.id

  return (
    <div className="map">
      <div className="map__stage">
        <div className="map__toolbar">
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
          <div className="map__zoom" role="group" aria-label="Plan zoom">
            <button type="button" className="icon-button" aria-label="Zoom out" onClick={() => zoomBy(1 / 1.2)}>
              −
            </button>
            <span>{Math.round(view.zoom * 100)}%</span>
            <button type="button" className="icon-button" aria-label="Zoom in" onClick={() => zoomBy(1.2)}>
              +
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label="Reset view"
              onClick={() => setView({ zoom: 1, x: 0, y: 0 })}
            >
              ⌂
            </button>
          </div>
        </div>

        <div
          className="map__plan-wrap"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <div
            className="map__plan"
            aria-label={room ? `${room.name} floor plan` : 'Floor plan'}
            style={{
              transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`
            }}
          >
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
                      <div key={section.id} className="map__section-card">
                        <button
                          type="button"
                          className="map__section-button"
                          onClick={() => travel()}
                        >
                          <span>{section.name}</span>
                          <span className="map__detail">{sectionSummary(section)}</span>
                        </button>
                        {section.bays.length > 0 ? (
                          <div className="map__bays">
                            {section.bays.map((bay) => {
                              const count = bay.shelves.reduce(
                                (sum, shelf) => sum + shelf.bookCount,
                                0
                              )
                              return (
                                <button
                                  key={bay.id}
                                  type="button"
                                  className="map__bay"
                                  title={`Bay ${bay.sortIndex + 1} · ${count} volumes`}
                                  onClick={() => travel()}
                                >
                                  {bay.sortIndex + 1}
                                </button>
                              )
                            })}
                          </div>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              )
            })}

            <div className="map__hall">
              <span className="map__hall-name">{room?.name ?? 'Main Hall'}</span>
              <span className="map__detail">{roomBooks} volumes · reading desks</span>
              {here ? <span className="map__youarehere">You are here</span> : null}
              <button className="button button--quiet map__enter" type="button" onClick={() => travel()}>
                {here ? 'Back to the room' : 'Enter the room'}
              </button>
            </div>
          </div>
        </div>
        <p className="map__hint">Drag the plan to pan · use the buttons to zoom</p>
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
