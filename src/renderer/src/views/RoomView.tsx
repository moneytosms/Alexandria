import type { LibraryInfo } from '@shared/api'
import type { Book, Floor, Room, Shelf, Wall } from '@shared/types'
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { AtmospherePopover } from '../components/AtmospherePopover'
import { BookCover } from '../components/BookCover'
import { BookPreviewCard } from '../components/BookPreviewCard'
import type { DeskTab } from '../components/DeskDrawer'
import { HALL_TOUR_STOPS, HallTourOverlay } from '../components/HallTourOverlay'
import { MiniMapHud, type MiniMapMarker, type MiniMapPlayerPose } from '../components/MiniMapHud'
import { TouchMovePad, type TouchMoveVector } from '../components/TouchMovePad'
import { pickImportFiles } from '../import-actions'
import { formatShortcut, usePlatformCapabilities } from '../platform'
import { navigate } from '../router'
import {
  AdaptiveQualityGovernor,
  normalizeQualityPreference
} from '../room/adaptive-quality'
import {
  HALL_MOOD_RIGS,
  normalizeHallMood,
  normalizeHallTheme,
  type HallMood,
  type HallTheme
} from '../room/atmosphere'
import { MovementInputController, normalizeMoveKey } from '../room/controls'
import {
  EYE_HEIGHT,
  GALLERY_Y,
  isInsideSecretNook,
  resolveWalkPosition,
  stairHeightAt
} from '../room/physics'
import {
  BOOK_COLORS,
  buildLibraryScene,
  shelfDisplayName,
  type RoomAnchor,
  type SpinePlacement
} from '../room/scene-builders'
import { RARE_NOOK_BOOK_ID } from '../sample-pdfs'
import { playSound, useAmbientStore } from '../sound'
import { useLibraryStore } from '../state/library-store'
import { useReaderStore } from '../state/reader-store'
import { getRankForXp, useScholarStore } from '../state/scholar-store'
import { useSetting, useSettingsStore } from '../state/settings-store'
import { formatClock, modeDurationSeconds, useStudyStore } from '../state/study-store'
import { usePlayerStore, useUiStore } from '../state/ui-store'

const DeskDrawer = lazy(() =>
  import('../components/DeskDrawer').then((m) => ({ default: m.DeskDrawer }))
)
const ObservatoryModal = lazy(() =>
  import('../components/ObservatoryModal').then((m) => ({ default: m.ObservatoryModal }))
)
const AtlasWayfinderModal = lazy(() =>
  import('../components/AtlasWayfinderModal').then((m) => ({ default: m.AtlasWayfinderModal }))
)

interface Props {
  library: LibraryInfo | null
}

interface RoomStats {
  fps: number
  frameMs: number
  drawCalls: number
  triangles: number
  books: number
  bookBatches: number
  qualityTier: number
}

interface HoverTarget {
  label: string
  hint: string
  bookId?: number
  shelfId?: number
  ladderIndex?: number
  kind?:
    | 'desk'
    | 'gramophone'
    | 'globe'
    | 'fireplace'
    | 'balcony'
    | 'telescope'
    | 'ladder'
    | 'nook'
    | 'nook-codex'
}

interface AnchorSummary {
  id: string
  label: string
  meta?: string
  kind: RoomAnchor['kind']
  level: 1 | 2
  shelfId?: number
}

const DEFAULT_FOV = 58
const MIN_FOV = 40
const MAX_FOV = 72

function acquireWebGL2Context(
  wantAntialias: boolean
): { canvas: HTMLCanvasElement; gl: WebGL2RenderingContext; antialias: boolean } | null {
  const attempts: Array<{ attrs?: WebGLContextAttributes; antialias: boolean }> = [
    {
      attrs: {
        antialias: wantAntialias,
        powerPreference: 'high-performance',
        failIfMajorPerformanceCaveat: false
      },
      antialias: wantAntialias
    },
    {
      attrs: {
        antialias: false,
        powerPreference: 'default',
        failIfMajorPerformanceCaveat: false
      },
      antialias: false
    },
    {
      attrs: undefined,
      antialias: false
    }
  ]

  for (const attempt of attempts) {
    try {
      const canvas = document.createElement('canvas')
      const gl = (
        attempt.attrs ? canvas.getContext('webgl2', attempt.attrs) : canvas.getContext('webgl2')
      ) as WebGL2RenderingContext | null
      if (gl && !gl.isContextLost()) {
        return { canvas, gl, antialias: attempt.antialias }
      }
    } catch {
      // Try next attribute set
    }
  }
  return null
}

function isSoftwareGlContext(gl: WebGL2RenderingContext): boolean {
  try {
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER
    const gpu = String(gl.getParameter(param) ?? '')
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu)
  } catch {
    return false
  }
}

function yawPitchFromLook(from: THREE.Vector3, lookAt: THREE.Vector3): { yaw: number; pitch: number } {
  const dx = lookAt.x - from.x
  const dy = lookAt.y - from.y
  const dz = lookAt.z - from.z
  const horiz = Math.hypot(dx, dz) || 0.001
  const yaw = Math.atan2(-dx, -dz)
  const pitch = Math.max(-1.05, Math.min(1.05, Math.atan2(dy, horiz)))
  return { yaw, pitch }
}

function shortestAngleDelta(from: number, to: number): number {
  let diff = (to - from + Math.PI) % (Math.PI * 2)
  if (diff < 0) diff += Math.PI * 2
  return diff - Math.PI
}

function ShelfDrawer({
  shelfId,
  autoFocusRename,
  onInspectBook,
  onSelectShelf,
  onClose
}: {
  shelfId: number
  autoFocusRename?: boolean
  onInspectBook: (book: Book) => void
  onSelectShelf: (nextShelfId: number) => void
  onClose: () => void
}) {
  const layout = useLibraryStore((state) => state.layout)
  const books = useLibraryStore((state) => state.books)
  const refresh = useLibraryStore((state) => state.refresh)
  const openBook = useReaderStore((state) => state.open)

  const [busy, setBusy] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [sectionDraft, setSectionDraft] = useState('')
  const [editingSection, setEditingSection] = useState(false)
  const [savedNotice, setSavedNotice] = useState<string | null>(null)
  const [draggingBookId, setDraggingBookId] = useState<number | null>(null)
  const [dragOverBookId, setDragOverBookId] = useState<number | null>(null)
  const [dragOverShelfId, setDragOverShelfId] = useState<number | null>(null)
  const [addingShelf, setAddingShelf] = useState(false)
  const [newShelfLabel, setNewShelfLabel] = useState('')
  const nameInputRef = useRef<HTMLInputElement | null>(null)

  const found = useMemo(() => {
    for (const floor of layout) {
      for (const room of floor.rooms) {
        for (const section of room.sections) {
          for (const bay of section.bays) {
            const match = bay.shelves.find((entry) => entry.id === shelfId)
            if (match) return { shelf: match, bay, section, room, floor }
          }
        }
      }
    }
    return null
  }, [layout, shelfId])

  const otherShelves = useMemo(() => {
    if (!found) return []
    const out: Array<{ id: number; label: string; sectionName: string; count: number; capacity: number }> = []
    for (const section of found.room.sections) {
      for (const bay of section.bays) {
        for (const s of bay.shelves) {
          if (s.id === shelfId) continue
          out.push({
            id: s.id,
            label: shelfDisplayName(s),
            sectionName: section.name,
            count: s.bookCount,
            capacity: s.capacity
          })
        }
      }
    }
    return out.slice(0, 12)
  }, [found, shelfId])

  useEffect(() => {
    if (!found) return
    setNameDraft(found.shelf.label ?? '')
    setSectionDraft(found.section.name)
    setEditingSection(false)
    setSavedNotice(null)
    setAddingShelf(false)
  }, [found])

  useEffect(() => {
    if (autoFocusRename && nameInputRef.current) {
      nameInputRef.current.focus()
      nameInputRef.current.select()
    }
  }, [autoFocusRename, shelfId])

  if (!found) return null

  const { shelf, bay, section, room, floor } = found
  const shelved = books
    .filter((book) => book.shelfId === shelfId)
    .sort((a, b) => a.slotIndex - b.slotIndex)

  const open = (book: Book): void => {
    playSound('pull')
    openBook(book.id, book.lastPage)
    navigate('reader')
  }

  const unshelve = async (book: Book): Promise<void> => {
    setBusy(true)
    try {
      await window.alexandria.unshelveBook(book.id)
      playSound('thud')
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  const moveBookToShelf = async (bookId: number, targetShelfId: number): Promise<void> => {
    setBusy(true)
    try {
      await window.alexandria.moveBook(bookId, targetShelfId)
      playSound('thud')
      await refresh()
      setSavedNotice('Moved book to target shelf')
    } finally {
      setBusy(false)
      setDraggingBookId(null)
      setDragOverShelfId(null)
      setDragOverBookId(null)
    }
  }

  const reorderWithinShelf = async (sourceId: number, targetId: number): Promise<void> => {
    if (sourceId === targetId) return
    const ids = shelved.map((b) => b.id)
    const fromIdx = ids.indexOf(sourceId)
    const toIdx = ids.indexOf(targetId)
    if (fromIdx < 0 || toIdx < 0) return
    ids.splice(fromIdx, 1)
    ids.splice(toIdx, 0, sourceId)
    setBusy(true)
    try {
      await window.alexandria.reorderShelf(shelf.id, ids)
      playSound('thud')
      await refresh()
      setSavedNotice('Shelf order updated')
    } finally {
      setBusy(false)
      setDraggingBookId(null)
      setDragOverBookId(null)
    }
  }

  const saveShelfName = async (): Promise<void> => {
    setBusy(true)
    try {
      const cleaned = nameDraft.trim()
      await window.alexandria.updateContainer({
        kind: 'shelf',
        id: shelf.id,
        label: cleaned.length > 0 ? cleaned : null
      })
      await refresh()
      playSound('tick')
      setSavedNotice(cleaned.length > 0 ? `Named "${cleaned}"` : 'Reset to default name')
    } finally {
      setBusy(false)
    }
  }

  const saveSectionName = async (): Promise<void> => {
    const cleaned = sectionDraft.trim()
    if (!cleaned) return
    setBusy(true)
    try {
      await window.alexandria.updateContainer({
        kind: 'section',
        id: section.id,
        name: cleaned
      })
      await refresh()
      setEditingSection(false)
      playSound('tick')
      setSavedNotice(`Wing renamed to "${cleaned}"`)
    } finally {
      setBusy(false)
    }
  }

  const addNewShelfToBay = async (): Promise<void> => {
    setBusy(true)
    try {
      const label = newShelfLabel.trim()
      const createdId = await window.alexandria.createContainer({
        kind: 'shelf',
        parentId: bay.id,
        name: label.length > 0 ? label : `Shelf ${bay.shelves.length + 1}`
      })
      await refresh()
      playSound('tick')
      setAddingShelf(false)
      setNewShelfLabel('')
      onSelectShelf(createdId)
    } finally {
      setBusy(false)
    }
  }

  const removeEmptyShelf = async (): Promise<void> => {
    if (shelved.length > 0 || bay.shelves.length <= 1) return
    setBusy(true)
    try {
      await window.alexandria.deleteContainer({ kind: 'shelf', id: shelf.id })
      await refresh()
      playSound('thud')
      onClose()
    } finally {
      setBusy(false)
    }
  }

  const changeSort = async (mode: Shelf['sortMode']): Promise<void> => {
    setBusy(true)
    try {
      await window.alexandria.updateContainer({
        kind: 'shelf',
        id: shelf.id,
        sortMode: mode
      })
      await window.alexandria.resortShelf(shelf.id)
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  const currentLabel = shelfDisplayName(shelf)
  const isDirty = (shelf.label ?? '') !== nameDraft.trim()

  return (
    <aside className="shelf-drawer" aria-label="Shelf details">
      <header className="shelf-drawer__head">
        <div className="shelf-drawer__identity">
          {editingSection ? (
            <form
              className="shelf-drawer__section-form"
              onSubmit={(event) => {
                event.preventDefault()
                void saveSectionName()
              }}
            >
              <input
                type="text"
                value={sectionDraft}
                maxLength={48}
                aria-label="Wing name"
                onChange={(event) => setSectionDraft(event.target.value)}
              />
              <button type="submit" className="shelf-drawer__mini-btn" disabled={busy}>
                Save
              </button>
              <button
                type="button"
                className="shelf-drawer__mini-btn"
                onClick={() => {
                  setSectionDraft(section.name)
                  setEditingSection(false)
                }}
              >
                Cancel
              </button>
            </form>
          ) : (
            <p className="eyebrow shelf-drawer__crumb">
              <span>
                {floor.name} · {room.name} · {section.name}
              </span>
              <button
                type="button"
                className="shelf-drawer__crumb-edit"
                onClick={() => setEditingSection(true)}
                title="Rename this wall wing"
              >
                Rename wing
              </button>
            </p>
          )}
          <h2>{currentLabel}</h2>
        </div>
        <button className="icon-button" type="button" onClick={onClose} aria-label="Close shelf">
          ×
        </button>
      </header>

      <form
        className="shelf-drawer__rename"
        onSubmit={(event) => {
          event.preventDefault()
          void saveShelfName()
        }}
      >
        <label className="shelf-drawer__rename-label" htmlFor="shelf-name-input">
          Brass nameplate
        </label>
        <div className="shelf-drawer__rename-row">
          <input
            id="shelf-name-input"
            ref={nameInputRef}
            type="text"
            value={nameDraft}
            maxLength={64}
            placeholder={`Shelf ${shelf.rowIndex + 1} (e.g. Philosophy, Sci-Fi)`}
            onChange={(event) => {
              setNameDraft(event.target.value)
              setSavedNotice(null)
            }}
          />
          <button
            type="submit"
            className="button shelf-drawer__save-btn"
            disabled={busy || !isDirty}
          >
            Save
          </button>
        </div>
        {savedNotice ? <p className="shelf-drawer__notice">{savedNotice}</p> : null}
      </form>

      <div className="shelf-drawer__bar">
        <span className="shelf-drawer__meta">
          {shelved.length} of {shelf.capacity} slots
        </span>
        <div className="shelf-drawer__bar-right">
          <label className="shelf-drawer__sort">
            <span>Order</span>
            <select
              value={shelf.sortMode}
              disabled={busy}
              onChange={(event) => void changeSort(event.target.value as Shelf['sortMode'])}
            >
              <option value="manual">Manual</option>
              <option value="title">Title</option>
              <option value="author">Author</option>
              <option value="added">Date added</option>
              <option value="read">Last read</option>
              <option value="format">Format</option>
            </select>
          </label>
          <button
            type="button"
            className="shelf-drawer__mini-btn"
            onClick={() => setAddingShelf((prev) => !prev)}
            title="Add another shelf row to this bookcase"
          >
            + Shelf
          </button>
        </div>
      </div>

      {addingShelf ? (
        <form
          className="shelf-drawer__add-form"
          onSubmit={(e) => {
            e.preventDefault()
            void addNewShelfToBay()
          }}
        >
          <input
            type="text"
            value={newShelfLabel}
            maxLength={48}
            placeholder={`New shelf name (e.g. Essays)`}
            onChange={(e) => setNewShelfLabel(e.target.value)}
            autoFocus
          />
          <button type="submit" className="shelf-drawer__mini-btn" disabled={busy}>
            Add
          </button>
          <button
            type="button"
            className="shelf-drawer__mini-btn"
            onClick={() => setAddingShelf(false)}
          >
            Cancel
          </button>
        </form>
      ) : null}

      {/* Live Drag-and-Drop Target Rail when dragging any book */}
      {draggingBookId !== null && otherShelves.length > 0 ? (
        <div className="shelf-drop-rail" aria-label="Drop on another shelf to move">
          <p className="shelf-drop-rail__label">Drop onto another shelf to move</p>
          <div className="shelf-drop-rail__chips">
            {otherShelves.map((target) => (
              <div
                key={target.id}
                className={`shelf-drop-target ${dragOverShelfId === target.id ? 'shelf-drop-target--hot' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragOverShelfId(target.id)
                }}
                onDragLeave={() => setDragOverShelfId((curr) => (curr === target.id ? null : curr))}
                onDrop={(e) => {
                  e.preventDefault()
                  if (draggingBookId !== null) void moveBookToShelf(draggingBookId, target.id)
                }}
              >
                <span>{target.label}</span>
                <small>{target.sectionName}</small>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <ul className="shelf-drawer__list">
        {shelved.length === 0 ? (
          <li className="shelf-drawer__empty">
            <p>This shelf is open for new books. Drop a PDF anywhere or drag books here.</p>
            {bay.shelves.length > 1 ? (
              <button
                type="button"
                className="shelf-drawer__mini-btn"
                disabled={busy}
                onClick={() => void removeEmptyShelf()}
              >
                Remove empty shelf
              </button>
            ) : null}
          </li>
        ) : (
          shelved.map((book) => (
            <li
              key={book.id}
              draggable
              onDragStart={(e) => {
                setDraggingBookId(book.id)
                e.dataTransfer.effectAllowed = 'move'
                e.dataTransfer.setData('text/plain', String(book.id))
              }}
              onDragEnd={() => {
                setDraggingBookId(null)
                setDragOverBookId(null)
                setDragOverShelfId(null)
              }}
              onDragOver={(e) => {
                if (draggingBookId !== null && draggingBookId !== book.id) {
                  e.preventDefault()
                  setDragOverBookId(book.id)
                }
              }}
              onDrop={(e) => {
                e.preventDefault()
                if (draggingBookId !== null && draggingBookId !== book.id) {
                  void reorderWithinShelf(draggingBookId, book.id)
                }
              }}
              className={`shelf-drawer__book ${draggingBookId === book.id ? 'shelf-drawer__book--dragging' : ''} ${dragOverBookId === book.id ? 'shelf-drawer__book--over' : ''}`}
            >
              <span className="shelf-drawer__handle" title="Drag to reorder or drop onto another shelf">
                ⋮⋮
              </span>
              <button type="button" className="shelf-drawer__open" onClick={() => open(book)}>
                <BookCover book={book} className="cover--mini" />
                <span>
                  <span className="shelf-drawer__title">{book.title}</span>
                  <span className="shelf-drawer__author">
                    {book.author ?? 'Unknown author'}
                    {book.readingState === 'finished'
                      ? ' · Finished'
                      : book.pageCount
                        ? ` · p. ${Math.max(1, book.lastPage)}/${book.pageCount}`
                        : ''}
                  </span>
                </span>
              </button>
              <div className="shelf-drawer__row-actions">
                <button
                  type="button"
                  className="shelf-drawer__action"
                  title="Preview details, tags & move"
                  onClick={() => onInspectBook(book)}
                >
                  Info
                </button>
                <button
                  type="button"
                  className="shelf-drawer__action"
                  title="Return to inbox"
                  onClick={() => void unshelve(book)}
                  disabled={busy}
                >
                  Inbox
                </button>
              </div>
            </li>
          ))
        )}
      </ul>
    </aside>
  )
}

export function RoomView({ library }: Props) {
  const floors = useLibraryStore((state) => state.layout)
  const books = useLibraryStore((state) => state.books)
  const refresh = useLibraryStore((state) => state.refresh)
  const selection = useUiStore((state) => state.room)
  const setRoom = useUiStore((state) => state.setRoom)
  const openShelfId = useUiStore((state) => state.openShelfId)
  const openShelf = useUiStore((state) => state.openShelf)
  const setSearchOpen = useUiStore((state) => state.setSearchOpen)
  const setSettingsOpen = useUiStore((state) => state.setSettingsOpen)
  const setTipsOpen = useUiStore((state) => state.setTipsOpen)
  const returningBookId = useUiStore((state) => state.returningBookId)
  const clearReturningBook = useUiStore((state) => state.clearReturningBook)
  const openBook = useReaderStore((state) => state.open)
  const quality = useSetting('ui.quality', 'auto')
  const reducedMotion = useSetting('ui.reducedMotion', 'false') === 'true'
  const theme = normalizeHallTheme(useSetting('hall.theme', 'dark-academia'))
  const mood = normalizeHallMood(useSetting('hall.mood', 'dusk'))
  const setSettingValue = useSettingsStore((state) => state.setValue)

  const studyRunning = useStudyStore((s) => s.running)
  const studyModeType = useStudyStore((s) => s.mode)
  const studyElapsed = useStudyStore((s) => s.elapsedSec)
  const ambientEnabled = useAmbientStore((s) => s.enabled)
  const scholarXp = useScholarStore((s) => s.ledger.xp)
  const scholarToast = useScholarStore((s) => s.toast)
  const clearScholarToast = useScholarStore((s) => s.clearToast)
  const scholarRank = useMemo(() => getRankForXp(scholarXp), [scholarXp])

  const mountRef = useRef<HTMLDivElement | null>(null)
  const fpsToggleRef = useRef<(() => void) | null>(null)
  const resetViewRef = useRef<(() => void) | null>(null)
  const jumpToAnchorRef = useRef<((anchorId: string) => void) | null>(null)
  const tourJumpRef = useRef<((stopIndex: number) => void) | null>(null)
  const hearthLevelRef = useRef<0 | 1 | 2>(1)
  const tourActiveRef = useRef(false)
  const miniMapPoseRef = useRef<MiniMapPlayerPose>({ x: 0, y: 0, z: 4.45, yaw: 0 })
  const cameraPoseRef = useRef<{
    roomId: number
    x: number
    y: number
    z: number
    yaw: number
    pitch: number
    fov: number
  } | null>(null)
  const clearKeysRef = useRef<(() => void) | null>(null)
  const popoverOpenRef = useRef(false)
  const modalOpenRef = useRef(false)
  const touchMoveRef = useRef<TouchMoveVector>({ forward: 0, right: 0 })
  const platform = usePlatformCapabilities()
  const isTouchPrimaryRef = useRef(platform.isTouchPrimary)
  isTouchPrimaryRef.current = platform.isTouchPrimary

  const [hovered, setHovered] = useState<HoverTarget | null>(null)
  const [fpsActive, setFpsActive] = useState(false)
  const [dockOpen, setDockOpen] = useState(true)
  const [placesOpen, setPlacesOpen] = useState(false)
  const [atmosphereOpen, setAtmosphereOpen] = useState(false)
  const [miniMapOpen, setMiniMapOpen] = useState(true)
  const [deskOpen, setDeskOpen] = useState(false)
  const [deskInitialTab, setDeskInitialTab] = useState<DeskTab>('desk')
  const [observatoryOpen, setObservatoryOpen] = useState(false)
  const [atlasOpen, setAtlasOpen] = useState(false)
  const [tourActive, setTourActive] = useState(false)
  const [tourStopIndex, setTourStopIndex] = useState(0)
  const [tourPaused, setTourPaused] = useState(false)
  const [renameFocus, setRenameFocus] = useState(false)
  const [previewBook, setPreviewBook] = useState<Book | null>(null)
  const [anchorList, setAnchorList] = useState<AnchorSummary[]>([])
  const [miniMapMarkers, setMiniMapMarkers] = useState<MiniMapMarker[]>([])
  const [scanning, setScanning] = useState(false)
  const [webglStatus, setWebglStatus] = useState<'ok' | 'lost' | 'unavailable'>('ok')

  const searchOpen = useUiStore((state) => state.searchOpen)
  const settingsOpen = useUiStore((state) => state.settingsOpen)
  const tipsOpen = useUiStore((state) => state.tipsOpen)

  // In-Hall New Wing Builder state
  const [newWingOpen, setNewWingOpen] = useState(false)
  const [newWingName, setNewWingName] = useState('')
  const [newWingWall, setNewWingWall] = useState<Wall>('east')
  const [creatingWing, setCreatingWing] = useState(false)

  useEffect(() => {
    popoverOpenRef.current = placesOpen || atmosphereOpen
  }, [placesOpen, atmosphereOpen])

  useEffect(() => {
    tourActiveRef.current = tourActive
  }, [tourActive])

  useEffect(() => {
    if (!tourActive) return
    tourJumpRef.current?.(tourStopIndex)
    if (tourPaused) return
    const stop = HALL_TOUR_STOPS[tourStopIndex] ?? HALL_TOUR_STOPS[0]
    const timer = window.setTimeout(() => {
      if (tourStopIndex >= HALL_TOUR_STOPS.length - 1) {
        setTourActive(false)
        setTourPaused(false)
      } else {
        setTourStopIndex((idx) => idx + 1)
      }
    }, stop.durationMs)
    return () => window.clearTimeout(timer)
  }, [tourActive, tourStopIndex, tourPaused])

  useEffect(() => {
    const blocked = Boolean(
      previewBook || searchOpen || settingsOpen || tipsOpen || observatoryOpen || atlasOpen
    )
    modalOpenRef.current = blocked
    if (blocked || deskOpen || openShelfId !== null || placesOpen || atmosphereOpen || newWingOpen) {
      clearKeysRef.current?.()
    }
  }, [
    previewBook,
    searchOpen,
    settingsOpen,
    tipsOpen,
    observatoryOpen,
    atlasOpen,
    deskOpen,
    openShelfId,
    placesOpen,
    atmosphereOpen,
    newWingOpen
  ])

  const room = useMemo<Room | null>(() => {
    const direct = floors
      .flatMap((floor) => floor.rooms)
      .find((entry) => entry.id === selection.roomId)
    if (direct) return direct
    return floors[0]?.rooms[0] ?? null
  }, [floors, selection.roomId])

  const allRooms = useMemo(
    () =>
      floors.flatMap((floor: Floor) =>
        floor.rooms.map((entry) => ({
          floor,
          room: entry
        }))
      ),
    [floors]
  )

  const roomBooks = useMemo(
    () =>
      books.filter(
        (book) =>
          book.shelfId === null ||
          room?.sections.some((section) =>
            section.bays.some((bay) => bay.shelves.some((shelf) => shelf.id === book.shelfId))
          )
      ),
    [books, room]
  )

  const inboxCount = useMemo(() => books.filter((b) => b.shelfId === null).length, [books])
  const missingCount = useMemo(() => books.filter((b) => b.missing).length, [books])

  useEffect(() => {
    if (!room) return
    if (selection.roomId !== room.id) {
      setRoom({ floorId: room.floorId, roomId: room.id })
    }
  }, [room, selection.roomId, setRoom])

  useEffect(() => {
    const mount = mountRef.current
    if (!mount || !room) return

    const acquired = acquireWebGL2Context(quality !== 'low')
    if (!acquired) {
      setWebglStatus('unavailable')
      return
    }

    const { canvas } = acquired
    const isSoftwareGl = isSoftwareGlContext(acquired.gl)
    const qualityPref = normalizeQualityPreference(quality)
    const governor = new AdaptiveQualityGovernor({
      preference: qualityPref,
      isSoftwareGl,
      isTouchPrimary: isTouchPrimaryRef.current,
      devicePixelRatio: window.devicePixelRatio || 1
    })
    const initialProfile = governor.getProfile()
    const useShadows = initialProfile.shadowsEnabled
    const pixelRatio = isSoftwareGl
      ? 1
      : Math.min(window.devicePixelRatio || 1, initialProfile.dprCap)
    const moodRig = HALL_MOOD_RIGS[mood]

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        context: acquired.gl,
        antialias: !isSoftwareGl && acquired.antialias,
        powerPreference: 'high-performance'
      })
    } catch {
      setWebglStatus('unavailable')
      return
    }

    setWebglStatus('ok')
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(moodRig.background)
    scene.fog = new THREE.FogExp2(moodRig.fogColor, moodRig.fogDensity)

    const savedPose = cameraPoseRef.current?.roomId === room.id ? cameraPoseRef.current : null
    const camera = new THREE.PerspectiveCamera(savedPose?.fov ?? DEFAULT_FOV, 1, 0.08, 60)
    camera.rotation.order = 'YXZ'

    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = moodRig.exposure
    renderer.setPixelRatio(pixelRatio)
    renderer.shadowMap.enabled = useShadows
    renderer.shadowMap.autoUpdate = initialProfile.shadowAutoUpdate
    renderer.shadowMap.needsUpdate = useShadows
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.domElement.style.touchAction = 'none'
    mount.appendChild(renderer.domElement)

    const onContextLost = (e: Event): void => {
      e.preventDefault()
      setWebglStatus('lost')
    }
    const onContextRestored = (): void => setWebglStatus('ok')
    renderer.domElement.addEventListener('webglcontextlost', onContextLost)
    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored)

    const pmrem = new THREE.PMREMGenerator(renderer)
    const envTarget = pmrem.fromScene(new RoomEnvironment(), 0.04)
    scene.environment = envTarget.texture
    scene.environmentIntensity = moodRig.envIntensity
    pmrem.dispose()

    const hemi = new THREE.HemisphereLight(moodRig.hemiSky, moodRig.hemiGround, moodRig.hemiIntensity)
    scene.add(hemi)

    const dirKey = new THREE.DirectionalLight(moodRig.keyColor, moodRig.keyIntensity)
    dirKey.position.set(...moodRig.keyPos)
    dirKey.castShadow = useShadows
    if (useShadows) {
      dirKey.shadow.mapSize.set(1024, 1024)
      dirKey.shadow.camera.left = -9
      dirKey.shadow.camera.right = 9
      dirKey.shadow.camera.top = 9
      dirKey.shadow.camera.bottom = -9
      dirKey.shadow.camera.near = 0.5
      dirKey.shadow.camera.far = 20
      dirKey.shadow.bias = -0.0005
      dirKey.shadow.normalBias = 0.02
    }
    scene.add(dirKey)

    const duskFill = new THREE.DirectionalLight(moodRig.fillColor, moodRig.fillIntensity)
    duskFill.position.set(-4.5, 5.8, -6.0)
    scene.add(duskFill)

    const built = buildLibraryScene(
      room,
      roomBooks,
      quality,
      renderer.capabilities.getMaxAnisotropy(),
      isSoftwareGl,
      theme,
      mood
    )
    scene.add(built.group)

    // O(1) book lookup table for hover & click raycasts (eliminates O(N) scans)
    const roomBooksById = new Map<number, Book>()
    for (const b of roomBooks) roomBooksById.set(b.id, b)

    const totalDustCount = built.dust
      ? built.dust.geometry.getAttribute('position')?.count ?? 0
      : 0
    const totalEmberCount = built.hearthEmbers
      ? built.hearthEmbers.geometry.getAttribute('position')?.count ?? 0
      : 0

    const applyQualityProfile = (): void => {
      const profile = governor.getProfile()
      const nextDpr = isSoftwareGl
        ? 1
        : Math.min(window.devicePixelRatio || 1, profile.dprCap)
      renderer.setPixelRatio(nextDpr)
      renderer.setSize(mount.clientWidth, mount.clientHeight, false)
      renderer.shadowMap.enabled = profile.shadowsEnabled
      dirKey.castShadow = profile.shadowsEnabled
      renderer.shadowMap.autoUpdate = profile.shadowAutoUpdate
      if (profile.shadowsEnabled) renderer.shadowMap.needsUpdate = true
      if (built.dust && totalDustCount > 0) {
        built.dust.geometry.setDrawRange(0, Math.max(12, Math.round(totalDustCount * profile.particleRatio)))
      }
      if (built.hearthEmbers && totalEmberCount > 0) {
        built.hearthEmbers.geometry.setDrawRange(
          0,
          Math.max(8, Math.round(totalEmberCount * profile.particleRatio))
        )
      }
    }
    applyQualityProfile()

    // Subscribe to reactive audio state outside tick() to avoid store polling every frame
    let musicPlaying = usePlayerStore.getState().playing
    const unsubPlayer = usePlayerStore.subscribe((state) => {
      musicPlaying = state.playing
    })
    let ambientEnabled = useAmbientStore.getState().enabled
    let ambientFireLevel = useAmbientStore.getState().fire
    const unsubAmbient = useAmbientStore.subscribe((state) => {
      ambientEnabled = state.enabled
      ambientFireLevel = state.fire
    })

    setAnchorList(
      built.anchors.map((a) => ({
        id: a.id,
        label: a.label,
        meta: a.meta,
        kind: a.kind,
        level: a.level,
        shelfId: a.shelfId
      }))
    )
    setMiniMapMarkers(built.miniMapMarkers)

    if (built.bookMesh) {
      built.bookMesh.userData.bookIds = built.placements.map((p) => p.book.id)
      built.bookMesh.userData.shelfIds = built.placements.map((p) => p.shelfId)
      built.bookMesh.userData.placements = built.placements
      scene.add(built.bookMesh)
    }

    const placementsByBook = new Map<number, SpinePlacement>()
    for (const p of built.placements) placementsByBook.set(p.book.id, p)

    const hoverBoxGeo = new THREE.BoxGeometry(1.06, 1.04, 1.18)
    const hoverBoxMat = new THREE.MeshBasicMaterial({
      color: '#ecc782',
      wireframe: true,
      transparent: true,
      opacity: 0.78
    })
    const hoverHighlight = new THREE.Mesh(hoverBoxGeo, hoverBoxMat)
    hoverHighlight.visible = false
    scene.add(hoverHighlight)

    const floorCursorGeo = new THREE.RingGeometry(0.18, 0.23, 32)
    const floorCursorMat = new THREE.MeshBasicMaterial({
      color: '#d8b26e',
      transparent: true,
      opacity: 0.36,
      side: THREE.DoubleSide,
      depthWrite: false
    })
    const floorCursor = new THREE.Mesh(floorCursorGeo, floorCursorMat)
    floorCursor.rotation.x = -Math.PI / 2
    floorCursor.position.y = 0.028
    floorCursor.visible = false
    scene.add(floorCursor)

    const walkRingGeo = new THREE.RingGeometry(0.15, 0.24, 32)
    const walkRingMat = new THREE.MeshBasicMaterial({
      color: '#ecc782',
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false
    })
    const walkRing = new THREE.Mesh(walkRingGeo, walkRingMat)
    walkRing.rotation.x = -Math.PI / 2
    walkRing.position.y = 0.032
    scene.add(walkRing)

    const spawnFloorPos = new THREE.Vector3(0, 0, 4.45)
    const spawnLook = new THREE.Vector3(0, 1.55, -5.2)
    const initialAngles = yawPitchFromLook(
      new THREE.Vector3(spawnFloorPos.x, EYE_HEIGHT, spawnFloorPos.z),
      spawnLook
    )

    // Track player FLOOR elevation y (0 on ground, 0..3.85 on stairs, 3.85 on mezzanine)
    const playerFloor = savedPose
      ? new THREE.Vector3(savedPose.x, savedPose.y, savedPose.z)
      : spawnFloorPos.clone()
    const targetFloor = playerFloor.clone()

    let yaw = savedPose ? savedPose.yaw : initialAngles.yaw
    let targetYaw = yaw
    let pitch = savedPose ? savedPose.pitch : initialAngles.pitch
    let targetPitch = pitch
    let targetFov = savedPose ? savedPose.fov : DEFAULT_FOV
    let walkBobPhase = 0
    let ringFade = 0
    let globeSpinBoost = 0
    let lightningFlash = 0
    let nextLightningAt = performance.now() + 7000 + Math.random() * 11000

    camera.position.set(playerFloor.x, playerFloor.y + EYE_HEIGHT, playerFloor.z)
    camera.rotation.set(pitch, yaw, 0, 'YXZ')

    let glide: {
      toFloor: THREE.Vector3
      toYaw?: number
      toPitch?: number
    } | null = null

    const cancelGlide = (): void => {
      if (!glide) return
      glide = null
      targetFloor.copy(playerFloor)
      targetYaw = yaw
      targetPitch = pitch
    }

    const glideTo = (eyeOrFloorPos: THREE.Vector3, lookAt?: THREE.Vector3, floorY?: number): void => {
      const resolvedFloorY = floorY !== undefined ? floorY : Math.max(0, eyeOrFloorPos.y - EYE_HEIGHT)
      const destFloor = new THREE.Vector3(eyeOrFloorPos.x, resolvedFloorY, eyeOrFloorPos.z)
      const destEye = new THREE.Vector3(destFloor.x, destFloor.y + EYE_HEIGHT, destFloor.z)
      const next: { toFloor: THREE.Vector3; toYaw?: number; toPitch?: number } = { toFloor: destFloor }
      if (lookAt) {
        const angles = yawPitchFromLook(destEye, lookAt)
        next.toYaw = angles.yaw
        next.toPitch = angles.pitch
      }
      if (reducedMotion) {
        playerFloor.copy(destFloor)
        targetFloor.copy(destFloor)
        if (next.toYaw !== undefined) {
          yaw = next.toYaw
          targetYaw = next.toYaw
        }
        if (next.toPitch !== undefined) {
          pitch = next.toPitch
          targetPitch = next.toPitch
        }
        glide = null
        return
      }
      glide = next
    }

    resetViewRef.current = () => {
      targetFov = DEFAULT_FOV
      glideTo(spawnFloorPos, spawnLook, 0)
    }

    const flyToShelf = (shelfId: number): void => {
      const anchor = built.shelfAnchors.get(shelfId)
      if (!anchor) return
      glideTo(anchor.position, anchor.lookAt, anchor.level === 2 ? GALLERY_Y : 0)
    }

    jumpToAnchorRef.current = (anchorId: string) => {
      const anchor = built.anchors.find((a) => a.id === anchorId)
      if (!anchor) return
      playSound('tick')
      if (tourActiveRef.current) setTourActive(false)
      glideTo(anchor.position, anchor.lookAt, anchor.level === 2 ? GALLERY_Y : 0)
    }

    tourJumpRef.current = (idx: number) => {
      const stop = HALL_TOUR_STOPS[idx]
      if (!stop) return
      glideTo(
        new THREE.Vector3(...stop.position),
        new THREE.Vector3(...stop.lookAt),
        stop.floorY
      )
    }

    interface PullFlight {
      mesh: THREE.Mesh
      from: THREE.Vector3
      to: THREE.Vector3
      start: number
      duration: number
      bookId: number
      page: number | null
      opened: boolean
    }

    let pull: PullFlight | null = null
    let arrive: PullFlight | null = null
    let navigateTimer: ReturnType<typeof setTimeout> | null = null

    const proxyMaterial = (book: Book): THREE.MeshStandardMaterial =>
      new THREE.MeshStandardMaterial({
        color: BOOK_COLORS[book.id % BOOK_COLORS.length],
        roughness: 0.62,
        metalness: 0.06
      })

    const pullBook = (placement: SpinePlacement, book: Book): void => {
      const proxy = new THREE.Mesh(
        new THREE.BoxGeometry(placement.size.x, placement.size.y, placement.size.z),
        proxyMaterial(book)
      )
      proxy.position.copy(placement.position).addScaledVector(placement.normal, 0.03)
      proxy.rotation.y = Math.atan2(placement.normal.x, placement.normal.z)
      scene.add(proxy)

      const forward = new THREE.Vector3()
      camera.getWorldDirection(forward)
      const destination = camera.position
        .clone()
        .addScaledVector(forward, 0.95)
        .add(new THREE.Vector3(0, -0.18, 0))

      pull = {
        mesh: proxy,
        from: proxy.position.clone(),
        to: destination,
        start: performance.now(),
        duration: 420,
        bookId: book.id,
        page: book.lastPage,
        opened: false
      }
    }

    const placeArrivingBook = (): void => {
      if (returningBookId === null) return
      const placement = placementsByBook.get(returningBookId)
      if (!placement) {
        clearReturningBook()
        return
      }
      const book = placement.book
      clearReturningBook()
      flyToShelf(placement.shelfId)

      if (reducedMotion) return

      const proxy = new THREE.Mesh(
        new THREE.BoxGeometry(placement.size.x, placement.size.y, placement.size.z),
        proxyMaterial(book)
      )
      const forward = new THREE.Vector3()
      camera.getWorldDirection(forward)
      proxy.position.copy(camera.position).addScaledVector(forward, 1.0)
      scene.add(proxy)

      arrive = {
        mesh: proxy,
        from: proxy.position.clone(),
        to: placement.position.clone().addScaledVector(placement.normal, 0.03),
        start: performance.now(),
        duration: 450,
        bookId: book.id,
        page: null,
        opened: true
      }
    }

    const raycaster = new THREE.Raycaster()
    const pointerNdc = new THREE.Vector2(0, 0)
    const input = new MovementInputController()
    clearKeysRef.current = () => {
      input.clear()
      isDragging = false
    }
    let isDragging = false
    let dragMoved = false
    let consumedByPopover = false
    let dragStartX = 0
    let dragStartY = 0
    let totalDragDist = 0
    let lastPointerX = 0
    let lastPointerY = 0
    let lastHoverTime = 0
    let activeHover: HoverTarget | null = null

    const raycastAt = (
      ndcX: number,
      ndcY: number
    ): {
      target: HoverTarget | null
      floorPoint: THREE.Vector3 | null
      placement: SpinePlacement | null
    } => {
      pointerNdc.set(ndcX, ndcY)
      raycaster.setFromCamera(pointerNdc, camera)

      const hits: THREE.Intersection[] = []
      if (built.bookMesh) hits.push(...raycaster.intersectObject(built.bookMesh, false))
      hits.push(...raycaster.intersectObjects(built.interactables, false))
      hits.sort((a, b) => a.distance - b.distance)

      for (const hit of hits) {
        if (hit.object === built.bookMesh && hit.faceIndex != null) {
          const idx = Math.floor(hit.faceIndex / 12)
          const placement = built.placements[idx]
          if (placement) {
            return {
              target: {
                label: placement.book.title,
                hint: placement.book.author
                  ? `Click to read · Right-click to preview · ${placement.book.author}`
                  : 'Click to read · Right-click to preview',
                bookId: placement.book.id,
                shelfId: placement.shelfId
              },
              floorPoint: null,
              placement
            }
          }
          continue
        }

        const data = hit.object.userData as {
          bookId?: number
          shelfId?: number
          ladderIndex?: number
          interactiveKind?:
            | 'desk'
            | 'gramophone'
            | 'globe'
            | 'fireplace'
            | 'balcony'
            | 'telescope'
            | 'ladder'
            | 'nook'
            | 'nook-codex'
          interactLabel?: string
          interactMeta?: string
          walkableFloor?: boolean
        }

        if (data.bookId) {
          const found = roomBooksById.get(data.bookId)
          if (found) {
            return {
              target: {
                label: found.title,
                hint: 'Click to read · Right-click to preview',
                bookId: found.id
              },
              floorPoint: null,
              placement: null
            }
          }
        }
        if (data.interactiveKind === 'desk') {
          return {
            target: {
              label: 'Reading Desk',
              hint: 'Click to open Desk, Inbox, Study Timer & Scholar Ledger',
              kind: 'desk'
            },
            floorPoint: null,
            placement: null
          }
        }
        if (data.interactiveKind === 'globe') {
          return {
            target: {
              label: 'Hall Atlas Globe',
              hint: 'Click to spin & open the Hall Atlas Wayfinder',
              kind: 'globe'
            },
            floorPoint: null,
            placement: null
          }
        }
        if (data.interactiveKind === 'gramophone') {
          return {
            target: {
              label: 'Brass Gramophone',
              hint: 'Click to toggle ambient soundscape or music',
              kind: 'gramophone'
            },
            floorPoint: null,
            placement: null
          }
        }
        if (data.interactiveKind === 'fireplace') {
          const modeLabel =
            hearthLevelRef.current === 0
              ? 'Stoke to Warm Hearth'
              : hearthLevelRef.current === 1
                ? 'Stoke to Roaring Fire'
                : 'Bank to Low Embers'
          return {
            target: {
              label: 'Limestone Fireplace Hearth',
              hint: `Click to ${modeLabel.toLowerCase()} & adjust crackle`,
              kind: 'fireplace'
            },
            floorPoint: null,
            placement: null
          }
        }
        if (data.interactiveKind === 'telescope' || data.interactiveKind === 'balcony') {
          return {
            target: {
              label: 'Observatory Brass Telescope',
              hint: 'Click to peer through the star chart & shift hall sky',
              kind: 'telescope'
            },
            floorPoint: null,
            placement: null
          }
        }
        if (data.interactiveKind === 'ladder') {
          return {
            target: {
              label: data.interactLabel ?? 'Rolling Bookshelf Ladder',
              hint: 'Click to roll along the brass track & climb to upper tiers',
              kind: 'ladder',
              ladderIndex: data.ladderIndex ?? 0
            },
            floorPoint: null,
            placement: null
          }
        }
        if (data.interactiveKind === 'nook') {
          return {
            target: {
              label: 'Secret Study Nook Armchair',
              hint: 'Click to settle into the candlelit upper gallery alcove',
              kind: 'nook'
            },
            floorPoint: null,
            placement: null
          }
        }
        if (data.interactiveKind === 'nook-codex') {
          return {
            target: {
              label: 'Codex Alexandrinus (Rare Vault)',
              hint: 'Click to open the secret upper gallery manuscript',
              kind: 'nook-codex'
            },
            floorPoint: null,
            placement: null
          }
        }
        if (data.shelfId) {
          return {
            target: {
              label: data.interactLabel ?? 'Bookshelf',
              hint: data.interactMeta ?? 'Click to open, reorder or rename shelf',
              shelfId: data.shelfId
            },
            floorPoint: null,
            placement: null
          }
        }
        if (data.walkableFloor) {
          return { target: null, floorPoint: hit.point.clone(), placement: null }
        }
      }

      return { target: null, floorPoint: null, placement: null }
    }

    const triggerInteract = (
      target: HoverTarget | null,
      floorPoint: THREE.Vector3 | null
    ): void => {
      if (pull) return
      if (tourActiveRef.current) setTourActive(false)

      if (target?.bookId) {
        const book = roomBooksById.get(target.bookId)
        if (!book) return
        playSound('pull')
        if (document.pointerLockElement === renderer.domElement) {
          document.exitPointerLock()
        }
        const placement = placementsByBook.get(book.id)
        if (reducedMotion || !placement) {
          openBook(book.id, book.lastPage)
          navigate('reader')
          return
        }
        flyToShelf(placement.shelfId)
        pullBook(placement, book)
        return
      }

      if (target?.kind === 'desk') {
        playSound('tick')
        if (document.pointerLockElement === renderer.domElement) {
          document.exitPointerLock()
        }
        glideTo(new THREE.Vector3(0, EYE_HEIGHT, 2.65), new THREE.Vector3(0, 0.96, 0.35), 0)
        setPlacesOpen(false)
        setAtmosphereOpen(false)
        setDeskInitialTab('desk')
        setDeskOpen(true)
        return
      }

      if (target?.kind === 'globe') {
        playSound('tick')
        globeSpinBoost = 8.5
        if (document.pointerLockElement === renderer.domElement) {
          document.exitPointerLock()
        }
        useScholarStore.getState().recordDiscovery('globe', 'Hall Atlas Globe')
        setPlacesOpen(false)
        setAtmosphereOpen(false)
        setAtlasOpen(true)
        return
      }

      if (target?.kind === 'gramophone') {
        playSound('tick')
        const player = usePlayerStore.getState()
        if (player.tracks.length > 0) {
          player.toggle()
        } else {
          useAmbientStore.getState().toggleEnabled()
        }
        return
      }

      if (target?.kind === 'fireplace') {
        playSound('tick')
        const nextLevel = ((hearthLevelRef.current + 1) % 3) as 0 | 1 | 2
        hearthLevelRef.current = nextLevel
        const amb = useAmbientStore.getState()
        const fireVolume = nextLevel === 0 ? 0.14 : nextLevel === 1 ? 0.55 : 0.95
        amb.setChannel('fire', fireVolume)
        amb.setEnabled(true)
        useScholarStore.getState().recordDiscovery('hearth', 'Limestone Fireplace Hearth')
        return
      }

      if (target?.kind === 'telescope' || target?.kind === 'balcony') {
        playSound('tick')
        if (document.pointerLockElement === renderer.domElement) {
          document.exitPointerLock()
        }
        jumpToAnchorRef.current?.('balcony')
        useScholarStore.getState().recordDiscovery('telescope', 'Observatory Brass Telescope')
        setPlacesOpen(false)
        setAtmosphereOpen(false)
        setObservatoryOpen(true)
        return
      }

      if (target?.kind === 'ladder') {
        playSound('tick')
        const rig = built.rollingLadders[target.ladderIndex ?? 0]
        if (rig) {
          const mid = (rig.minOffset + rig.maxOffset) / 2
          const nextOffset =
            rig.targetOffset <= mid
              ? rig.maxOffset - 0.75
              : rig.minOffset + 0.75
          rig.targetOffset = nextOffset
          const destPos = rig.vantagePos.clone()
          const destLook = rig.lookAt.clone()
          if (rig.axis === 'x') {
            destPos.x = nextOffset
            destLook.x = nextOffset
          } else {
            destPos.z = nextOffset
            destLook.z = nextOffset
          }
          glideTo(destPos, destLook, GALLERY_Y)
          useScholarStore.getState().recordDiscovery('ladder', rig.label)
        }
        return
      }

      if (target?.kind === 'nook') {
        playSound('tick')
        jumpToAnchorRef.current?.('nook')
        useScholarStore.getState().recordDiscovery('secret-nook', 'Secret Upper Study Nook')
        return
      }

      if (target?.kind === 'nook-codex') {
        playSound('pull')
        if (document.pointerLockElement === renderer.domElement) {
          document.exitPointerLock()
        }
        useScholarStore.getState().recordDiscovery('secret-nook', 'Secret Upper Study Nook')
        const rareBook =
          roomBooks.find((b) => b.id === RARE_NOOK_BOOK_ID) ??
          roomBooks.find((b) => b.title.toLowerCase().includes('codex')) ??
          roomBooks[0]
        if (rareBook) {
          openBook(rareBook.id, rareBook.lastPage)
          navigate('reader')
        }
        return
      }

      if (target?.shelfId) {
        playSound('tick')
        if (document.pointerLockElement === renderer.domElement) {
          document.exitPointerLock()
        }
        setPlacesOpen(false)
        setAtmosphereOpen(false)
        setRenameFocus(false)
        openShelf(target.shelfId)
        flyToShelf(target.shelfId)
        return
      }

      if (floorPoint) {
        playSound('tick')
        setPlacesOpen(false)
        setAtmosphereOpen(false)
        const exactStairY = stairHeightAt(floorPoint.x, floorPoint.z)
        const targetFloorY =
          exactStairY !== null && floorPoint.y > 0.15
            ? exactStairY
            : floorPoint.y > 0.35
              ? Math.min(GALLERY_Y, floorPoint.y)
              : 0
        walkRing.position.set(floorPoint.x, targetFloorY + 0.032, floorPoint.z)
        ringFade = 1
        const resolved = resolveWalkPosition(
          { x: floorPoint.x, y: targetFloorY, z: floorPoint.z },
          { x: floorPoint.x, z: floorPoint.z }
        )
        glideTo(
          new THREE.Vector3(resolved.x, resolved.y + EYE_HEIGHT, resolved.z),
          undefined,
          resolved.y
        )
      }
    }

    const updateHoverVisual = (ndcX: number, ndcY: number): void => {
      const now = performance.now()
      if (now - lastHoverTime < 40) return
      lastHoverTime = now

      const { target, floorPoint, placement } = raycastAt(ndcX, ndcY)
      activeHover = target
      setHovered((prev) =>
        prev?.label === target?.label && prev?.hint === target?.hint ? prev : target
      )

      if (placement) {
        hoverHighlight.visible = true
        hoverHighlight.position.copy(placement.position).addScaledVector(placement.normal, 0.025)
        hoverHighlight.quaternion.setFromRotationMatrix(placement.matrix)
        hoverHighlight.scale.copy(placement.size)
      } else {
        hoverHighlight.visible = false
      }

      const locked = document.pointerLockElement === renderer.domElement
      if (!target && floorPoint && !isDragging && !locked) {
        floorCursor.visible = true
        floorCursor.position.set(floorPoint.x, floorPoint.y + 0.028, floorPoint.z)
      } else {
        floorCursor.visible = false
      }

      if (!isDragging && !locked) {
        renderer.domElement.style.cursor = target ? 'pointer' : 'grab'
      }
    }

    const onPointerDown = (event: PointerEvent): void => {
      if (event.button !== 0 && event.button !== 2) return
      if (document.activeElement instanceof HTMLElement && document.activeElement !== document.body) {
        document.activeElement.blur()
      }
      const hadPopover = popoverOpenRef.current
      if (hadPopover) {
        setPlacesOpen(false)
        setAtmosphereOpen(false)
      }
      if (document.pointerLockElement === renderer.domElement) {
        const res = raycastAt(0, 0)
        triggerInteract(res.target, null)
        return
      }
      isDragging = true
      dragMoved = false
      consumedByPopover = hadPopover
      dragStartX = event.clientX
      dragStartY = event.clientY
      totalDragDist = 0
      lastPointerX = event.clientX
      lastPointerY = event.clientY
      floorCursor.visible = false
      renderer.domElement.style.cursor = 'grabbing'
    }

    const onPointerMove = (event: PointerEvent): void => {
      if (document.pointerLockElement === renderer.domElement) {
        targetYaw -= event.movementX * 0.0023
        targetPitch = Math.max(-1.05, Math.min(1.05, targetPitch - event.movementY * 0.0021))
        if (glide) {
          glide.toYaw = undefined
          glide.toPitch = undefined
        }
        updateHoverVisual(0, 0)
        return
      }

      if (isDragging) {
        const dx = event.clientX - lastPointerX
        const dy = event.clientY - lastPointerY
        totalDragDist += Math.hypot(dx, dy)
        const netDist = Math.hypot(event.clientX - dragStartX, event.clientY - dragStartY)
        if (!dragMoved && (totalDragDist > 5 || netDist > 5)) {
          dragMoved = true
          cancelGlide()
        }
        lastPointerX = event.clientX
        lastPointerY = event.clientY
        targetYaw -= dx * 0.004
        targetPitch = Math.max(-1.05, Math.min(1.05, targetPitch - dy * 0.0034))
        return
      }

      const rect = renderer.domElement.getBoundingClientRect()
      const nx = ((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1
      const ny = -((event.clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1
      updateHoverVisual(nx, ny)
    }

    const onPointerUp = (event: PointerEvent): void => {
      if (document.pointerLockElement === renderer.domElement) return
      const wasLeftClick = isDragging && !dragMoved && !consumedByPopover && event.button === 0
      const wasRightClick = isDragging && !dragMoved && !consumedByPopover && event.button === 2
      isDragging = false
      consumedByPopover = false
      renderer.domElement.style.cursor = activeHover ? 'pointer' : 'grab'

      if (wasLeftClick || wasRightClick) {
        const rect = renderer.domElement.getBoundingClientRect()
        const nx = ((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1
        const ny = -((event.clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1
        const res = raycastAt(nx, ny)

        if (wasRightClick && res.target?.bookId) {
          const book = roomBooksById.get(res.target.bookId)
          if (book) {
            playSound('tick')
            setPreviewBook(book)
          }
          return
        }

        // Single left-click interacts with books, shelves & landmarks only (never accidental floor walk)
        if (wasLeftClick && res.target) {
          triggerInteract(res.target, null)
        }
      }
    }

    const onDoubleClick = (event: MouseEvent): void => {
      if (document.pointerLockElement === renderer.domElement) return
      const rect = renderer.domElement.getBoundingClientRect()
      const nx = ((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1
      const ny = -((event.clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1
      const res = raycastAt(nx, ny)
      if (!res.target && res.floorPoint) {
        triggerInteract(null, res.floorPoint)
      }
    }

    const onWheel = (event: WheelEvent): void => {
      event.preventDefault()
      if (event.altKey || event.ctrlKey) {
        targetFov = Math.max(MIN_FOV, Math.min(MAX_FOV, targetFov + Math.sign(event.deltaY) * 4))
        return
      }
      cancelGlide()
      const step = -Math.sign(event.deltaY) * 0.65
      const forwardX = -Math.sin(targetYaw)
      const forwardZ = -Math.cos(targetYaw)
      const resolved = resolveWalkPosition(targetFloor, {
        x: targetFloor.x + forwardX * step,
        z: targetFloor.z + forwardZ * step
      })
      targetFloor.set(resolved.x, resolved.y, resolved.z)
    }

    const onContextMenu = (event: MouseEvent): void => {
      event.preventDefault()
      input.clear()
    }

    const onPointerLockChange = (): void => {
      const locked = document.pointerLockElement === renderer.domElement
      setFpsActive(locked)
      input.clear()
      isDragging = false
      if (!locked) {
        renderer.domElement.style.cursor = 'grab'
      } else {
        floorCursor.visible = false
        setPlacesOpen(false)
        setAtmosphereOpen(false)
      }
    }

    fpsToggleRef.current = () => {
      if (document.pointerLockElement === renderer.domElement) {
        document.exitPointerLock()
      } else {
        renderer.domElement.requestPointerLock?.()
      }
    }

    let anchorIndex = 0
    const onKeyDown = (event: KeyboardEvent): void => {
      const el = event.target as HTMLElement | null
      if (
        el &&
        (el.tagName === 'INPUT' ||
          el.tagName === 'TEXTAREA' ||
          el.tagName === 'SELECT' ||
          el.isContentEditable)
      ) {
        return
      }
      if (event.metaKey || event.ctrlKey || event.altKey) {
        input.clear()
        return
      }

      const ui = useUiStore.getState()
      if (modalOpenRef.current || ui.searchOpen || ui.settingsOpen || ui.tipsOpen) {
        input.clear()
        return
      }

      if (event.key === '?') {
        event.preventDefault()
        setTipsOpen(true)
        return
      }

      const moveToken = normalizeMoveKey(event)
      if (moveToken) {
        if (moveToken === 'E' && document.pointerLockElement === renderer.domElement) {
          event.preventDefault()
          const res = raycastAt(0, 0)
          triggerInteract(res.target, null)
          return
        }
        if (
          document.activeElement instanceof HTMLButtonElement ||
          document.activeElement instanceof HTMLAnchorElement
        ) {
          document.activeElement.blur()
        }
        if (
          moveToken === 'Up' ||
          moveToken === 'Down' ||
          moveToken === 'Left' ||
          moveToken === 'Right'
        ) {
          event.preventDefault()
        }
        input.onKeyDown(moveToken, performance.now(), event.repeat)
        if (moveToken !== 'Shift') {
          cancelGlide()
          if (tourActiveRef.current) setTourActive(false)
        }
        return
      }

      const code = event.code
      if (code === 'Tab') {
        event.preventDefault()
        fpsToggleRef.current?.()
        return
      }

      if (code === 'Equal' || code === 'NumpadAdd') {
        event.preventDefault()
        targetFov = Math.max(MIN_FOV, targetFov - 5)
        return
      }
      if (code === 'Minus' || code === 'NumpadSubtract') {
        event.preventDefault()
        targetFov = Math.min(MAX_FOV, targetFov + 5)
        return
      }

      if (code.startsWith('Digit')) {
        const digit = Number(code.slice(5))
        if (digit >= 1 && digit <= 9) {
          const anchor = built.anchors[digit - 1]
          if (anchor) {
            event.preventDefault()
            anchorIndex = digit - 1
            playSound('tick')
            glideTo(anchor.position, anchor.lookAt, anchor.level === 2 ? GALLERY_Y : 0)
          }
          return
        }
      }

      if (code === 'BracketRight' || code === 'BracketLeft') {
        if (built.anchors.length === 0) return
        event.preventDefault()
        anchorIndex =
          code === 'BracketRight'
            ? (anchorIndex + 1) % built.anchors.length
            : (anchorIndex - 1 + built.anchors.length) % built.anchors.length
        const nextAnchor = built.anchors[anchorIndex]
        if (nextAnchor) {
          playSound('tick')
          glideTo(nextAnchor.position, nextAnchor.lookAt, nextAnchor.level === 2 ? GALLERY_Y : 0)
        }
        return
      }

      if (code === 'KeyR') {
        event.preventDefault()
        targetFov = DEFAULT_FOV
        glideTo(spawnFloorPos, spawnLook, 0)
        return
      }

      if (code === 'KeyH') {
        event.preventDefault()
        setDockOpen((prev) => !prev)
        return
      }

      if (code === 'KeyP') {
        event.preventDefault()
        setAtmosphereOpen(false)
        setPlacesOpen((prev) => !prev)
        return
      }

      if (code === 'KeyT') {
        event.preventDefault()
        setPlacesOpen(false)
        setAtmosphereOpen((prev) => !prev)
        return
      }

      if (code === 'KeyN') {
        event.preventDefault()
        setMiniMapOpen((prev) => !prev)
        return
      }

      if (code === 'KeyM') {
        event.preventDefault()
        if (document.pointerLockElement) document.exitPointerLock()
        navigate('map')
        return
      }

      if (code === 'KeyI') {
        event.preventDefault()
        if (document.pointerLockElement) document.exitPointerLock()
        navigate('index')
        return
      }

      if (code === 'KeyL') {
        event.preventDefault()
        if (document.pointerLockElement) document.exitPointerLock()
        navigate('librarian')
        return
      }

      if (code === 'Escape') {
        input.clear()
        openShelf(null)
        setDeskOpen(false)
        setPlacesOpen(false)
        setAtmosphereOpen(false)
        setObservatoryOpen(false)
        setAtlasOpen(false)
        setTourActive(false)
        setPreviewBook(null)
      }
    }

    const onKeyUp = (event: KeyboardEvent): void => {
      const moveToken = normalizeMoveKey(event)
      if (moveToken) input.onKeyUp(moveToken, performance.now())
    }

    const onWindowBlur = (): void => {
      input.clear()
      isDragging = false
    }

    // Two-finger pinch-to-zoom FOV on touch screens
    let pinchStartDist = 0
    let pinchStartFov = DEFAULT_FOV
    const onTouchStart = (event: TouchEvent): void => {
      if (event.touches.length === 2) {
        isDragging = false
        pinchStartDist = Math.hypot(
          event.touches[0].clientX - event.touches[1].clientX,
          event.touches[0].clientY - event.touches[1].clientY
        )
        pinchStartFov = targetFov
      }
    }
    const onTouchMove = (event: TouchEvent): void => {
      if (event.touches.length === 2 && pinchStartDist > 20) {
        event.preventDefault()
        const dist = Math.hypot(
          event.touches[0].clientX - event.touches[1].clientX,
          event.touches[0].clientY - event.touches[1].clientY
        )
        const ratio = pinchStartDist / Math.max(10, dist)
        targetFov = Math.max(MIN_FOV, Math.min(MAX_FOV, pinchStartFov * ratio))
      }
    }
    const onTouchEnd = (event: TouchEvent): void => {
      if (event.touches.length < 2) pinchStartDist = 0
    }

    const onVisibilityChange = (): void => {
      input.clear()
      touchMoveRef.current = { forward: 0, right: 0 }
      if (document.hidden) {
        isDragging = false
        cancelAnimationFrame(frameId)
        clearTimeout(frameId)
        frameId = 0
      } else if (!disposed && frameId === 0) {
        lastNow = performance.now()
        tick()
      }
    }

    renderer.domElement.addEventListener('pointerdown', onPointerDown)
    renderer.domElement.addEventListener('dblclick', onDoubleClick)
    renderer.domElement.addEventListener('touchstart', onTouchStart, { passive: true })
    renderer.domElement.addEventListener('touchmove', onTouchMove, { passive: false })
    renderer.domElement.addEventListener('touchend', onTouchEnd, { passive: true })
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false })
    renderer.domElement.addEventListener('contextmenu', onContextMenu)
    document.addEventListener('pointerlockchange', onPointerLockChange)
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('keyup', onKeyUp, true)
    window.addEventListener('blur', onWindowBlur)

    const resize = (): void => {
      const width = mount.clientWidth
      const height = mount.clientHeight
      renderer.setSize(width, height, false)
      camera.aspect = width / Math.max(1, height)
      camera.updateProjectionMatrix()
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(mount)

    if (!isSoftwareGl) {
      renderer.compile(scene, camera)
    }

    let frameId = 0
    let disposed = false
    let lastNow = performance.now()
    let frames = 0
    let statsSince = lastNow
    let avgFrameMs = 16

    const afterDraw = (cb: () => void): void => {
      const gl = renderer.getContext() as WebGL2RenderingContext
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0)
      gl.flush()
      const poll = (): void => {
        if (disposed) return
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS)
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5)
        } else {
          if (sync) gl.deleteSync(sync)
          frameId = window.setTimeout(cb, 70)
        }
      }
      frameId = window.setTimeout(poll, 5)
    }

    const scheduleNext = (): void => {
      if (disposed) return
      if (isSoftwareGl) {
        afterDraw(tick)
      } else {
        frameId = requestAnimationFrame(tick)
      }
    }

    let wasMoving = false
    let wasTapOnly = false
    let frameIndex = 0

    const tick = (): void => {
      if (disposed || document.hidden) {
        frameId = 0
        return
      }
      const now = performance.now()
      const dt = Math.min(0.08, Math.max(0.001, (now - lastNow) / 1000))
      lastNow = now
      frameIndex += 1

      const frameMs = dt * 1000
      avgFrameMs = avgFrameMs * 0.9 + frameMs * 0.1
      if (governor.recordFrame(frameMs)) {
        applyQualityProfile()
      }
      const activeProfile = governor.getProfile()

      // 1. WASD / Arrow + Touch Thumbstick first-person walking with continuous staircase & mezzanine elevation physics
      const sample = input.sample(now)
      const touchVec = touchMoveRef.current
      const moveForward = sample.moveForward + touchVec.forward
      const moveRight = sample.moveRight + touchVec.right
      const { turnInput, sprint, tapOnly } = sample
      const isMoving = Math.abs(moveForward) > 0.04 || Math.abs(moveRight) > 0.04

      if (turnInput !== 0 && document.pointerLockElement !== renderer.domElement) {
        targetYaw += turnInput * 1.95 * dt
      }

      if (isMoving) {
        const speed = sprint ? 5.8 : 3.6
        const stepDt = tapOnly && Math.abs(touchVec.forward) < 0.04 && Math.abs(touchVec.right) < 0.04
          ? Math.max(dt, 0.095)
          : dt
        const rawMag = Math.hypot(moveForward, moveRight)
        const clampedMag = Math.min(1, rawMag)
        const inv = rawMag > 0.0001 ? clampedMag / rawMag : 0
        const f = moveForward * inv
        const r = moveRight * inv
        const forwardX = -Math.sin(yaw)
        const forwardZ = -Math.cos(yaw)
        const rightX = Math.cos(yaw)
        const rightZ = -Math.sin(yaw)
        const resolved = resolveWalkPosition(targetFloor, {
          x: targetFloor.x + (forwardX * f + rightX * r) * speed * stepDt,
          z: targetFloor.z + (forwardZ * f + rightZ * r) * speed * stepDt
        })
        targetFloor.set(resolved.x, resolved.y, resolved.z)
      } else if (wasMoving && !wasTapOnly && !glide) {
        // Stop crisply when releasing a sustained hold while preserving quick single-tap steps
        targetFloor.lerp(playerFloor, 0.55)
      }
      wasMoving = isMoving
      wasTapOnly = tapOnly

      // 2. Smooth double-click / waypoint glide (including between Ground and Mezzanine!)
      if (glide) {
        targetFloor.copy(glide.toFloor)
        if (glide.toYaw !== undefined) {
          targetYaw = yaw + shortestAngleDelta(yaw, glide.toYaw)
        }
        if (glide.toPitch !== undefined) {
          targetPitch = glide.toPitch
        }
        const dist = playerFloor.distanceTo(glide.toFloor)
        const angleDist =
          glide.toYaw !== undefined ? Math.abs(shortestAngleDelta(yaw, glide.toYaw)) : 0
        if (dist < 0.05 && angleDist < 0.025) {
          glide = null
        }
      }

      // 3. Crisp responsive damping for manual walk & silky glide for waypoints
      const posLambda = glide ? 5.5 : 22
      const yLambda = glide ? 5.5 : 18
      const rotLambda = 14
      playerFloor.x = THREE.MathUtils.damp(playerFloor.x, targetFloor.x, posLambda, dt)
      playerFloor.y = THREE.MathUtils.damp(playerFloor.y, targetFloor.y, yLambda, dt)
      playerFloor.z = THREE.MathUtils.damp(playerFloor.z, targetFloor.z, posLambda, dt)
      yaw = THREE.MathUtils.damp(yaw, targetYaw, rotLambda, dt)
      pitch = THREE.MathUtils.damp(pitch, targetPitch, rotLambda, dt)

      if (Math.abs(camera.fov - targetFov) > 0.05) {
        camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, 10, dt)
        camera.updateProjectionMatrix()
      }

      // Update saved pose & live mini-map ref (zero React state churn!)
      cameraPoseRef.current = {
        roomId: room.id,
        x: playerFloor.x,
        y: playerFloor.y,
        z: playerFloor.z,
        yaw,
        pitch,
        fov: targetFov
      }
      miniMapPoseRef.current = {
        x: playerFloor.x,
        y: playerFloor.y,
        z: playerFloor.z,
        yaw
      }

      const speedNow = Math.hypot(targetFloor.x - playerFloor.x, targetFloor.z - playerFloor.z)
      let bobY = 0
      if (!reducedMotion && (isMoving || speedNow > 0.14)) {
        walkBobPhase += dt * 9.5
        bobY = Math.sin(walkBobPhase) * 0.024
      } else {
        walkBobPhase = 0
      }

      camera.position.set(playerFloor.x, playerFloor.y + EYE_HEIGHT + bobY, playerFloor.z)
      camera.rotation.set(pitch, yaw, 0, 'YXZ')

      // 4. Floor destination ring animation
      if (ringFade > 0) {
        ringFade = Math.max(0, ringFade - dt * 1.45)
        walkRingMat.opacity = ringFade * 0.8
        walkRing.scale.setScalar(1 + (1 - ringFade) * 0.6)
      }

      // 5. Book pull / return flights
      if (pull) {
        const progress = Math.min(1, (now - pull.start) / pull.duration)
        const eased = progress * progress * (3 - 2 * progress)
        pull.mesh.position.lerpVectors(pull.from, pull.to, eased)
        pull.mesh.rotation.y += dt * 1.1
        pull.mesh.scale.setScalar(1 + eased * 1.45)
        if (progress >= 1 && !pull.opened) {
          pull.opened = true
          const { bookId, page } = pull
          scene.remove(pull.mesh)
          pull.mesh.geometry.dispose()
          ;(pull.mesh.material as THREE.Material).dispose()
          pull = null
          navigateTimer = setTimeout(() => {
            openBook(bookId, page)
            navigate('reader')
          }, 80)
        }
      }

      if (arrive) {
        const progress = Math.min(1, (now - arrive.start) / arrive.duration)
        const eased = progress * progress * (3 - 2 * progress)
        arrive.mesh.position.lerpVectors(arrive.from, arrive.to, eased)
        arrive.mesh.scale.setScalar(2.4 - eased * 1.4)
        if (progress >= 1) {
          scene.remove(arrive.mesh)
          arrive.mesh.geometry.dispose()
          ;(arrive.mesh.material as THREE.Material).dispose()
          arrive = null
          playSound('thud')
        }
      }

      // 6. Living Grand Hall ambient animations: globe, armillary orrery, gramophone, fireplace flicker, storm rain & lightning
      if (built.globeSphere && !reducedMotion) {
        globeSpinBoost = THREE.MathUtils.damp(globeSpinBoost, 0, 2.5, dt)
        built.globeSphere.rotation.y += dt * (0.14 + globeSpinBoost)
      }
      if (built.orreryRings.length >= 3 && !reducedMotion) {
        built.orreryRings[0].rotation.y += dt * 0.14
        built.orreryRings[1].rotation.x += dt * 0.19
        built.orreryRings[2].rotation.z -= dt * 0.24
      }
      if (built.platter && musicPlaying) {
        built.platter.rotation.y -= dt * 2.2
      }
      if (built.dust && !reducedMotion) {
        built.dust.rotation.y += dt * 0.02
        built.dust.position.y = Math.sin(now / 5000) * 0.06
      }

      // Cozy animated fireplace hearth glow, embers & 3-stage intensity
      if (built.hearthLight && built.hearthFlame) {
        const levelMul = hearthLevelRef.current === 0 ? 0.42 : hearthLevelRef.current === 1 ? 1.0 : 1.55
        const fireBoost = ambientEnabled && ambientFireLevel > 0.05 ? 1 + ambientFireLevel * 0.35 : 1
        const flicker = reducedMotion
          ? 1
          : 0.88 + Math.sin(now * 0.011) * 0.09 + Math.sin(now * 0.027) * 0.06
        built.hearthLight.intensity = moodRig.fireplaceIntensity * levelMul * fireBoost * flicker
        const flameScale = hearthLevelRef.current === 0 ? 0.55 : hearthLevelRef.current === 1 ? 1.0 : 1.32
        built.hearthFlame.scale.set(
          (0.92 + (flicker - 0.88) * 0.8) * flameScale,
          (0.85 + (flicker - 0.85) * 1.4) * flameScale,
          (0.92 + (flicker - 0.88) * 0.8) * flameScale
        )
      }

      if (built.hearthEmbers && !reducedMotion && frameIndex % activeProfile.ambientStep === 0) {
        const attr = built.hearthEmbers.geometry.getAttribute('position') as THREE.BufferAttribute
        const stepDt = dt * activeProfile.ambientStep
        const riseRate = hearthLevelRef.current === 0 ? 0.28 : hearthLevelRef.current === 1 ? 0.62 : 1.05
        const limit = Math.min(attr.count, built.hearthEmbers.geometry.drawRange.count)
        for (let i = 0; i < limit; i += 1) {
          let ey = attr.getY(i) + stepDt * (riseRate + (i % 4) * 0.14)
          let ex = attr.getX(i) + Math.sin(now * 0.004 + i) * stepDt * 0.12
          if (ey > 1.24) {
            ey = 0.24
            ex = ((i * 37) % 100) / 100 - 0.5
          }
          attr.setXYZ(i, ex, ey, attr.getZ(i))
        }
        attr.needsUpdate = true
      }

      if (built.nookCandleLight && !reducedMotion) {
        const baseIntensity = mood === 'afternoon' ? 2.6 : 6.4
        built.nookCandleLight.intensity =
          baseIntensity * (0.92 + Math.sin(now * 0.009) * 0.07 + Math.cos(now * 0.023) * 0.04)
      }

      // Smooth rolling bookshelf ladders gliding on tubular brass tracks
      for (const rig of built.rollingLadders) {
        if (Math.abs(rig.currentOffset - rig.targetOffset) > 0.004) {
          rig.currentOffset = THREE.MathUtils.damp(rig.currentOffset, rig.targetOffset, 6.5, dt)
          if (rig.axis === 'x') {
            rig.group.position.x = rig.currentOffset
          } else {
            rig.group.position.z = rig.currentOffset
          }
        }
      }

      // Passive Hall Discovery checks (walking onto wide mezzanine or into Secret Study Nook)
      if (!tourActiveRef.current) {
        if (playerFloor.y >= GALLERY_Y - 0.25) {
          useScholarStore.getState().recordDiscovery('mezzanine', 'Wide Upper Gallery')
        }
        if (isInsideSecretNook(playerFloor)) {
          useScholarStore.getState().recordDiscovery('secret-nook', 'Secret Upper Study Nook')
        }
      }

      // Stormy Night animated rain streaks & subtle distant lightning shimmer
      if (built.rainLines && !reducedMotion) {
        const attr = built.rainLines.geometry.getAttribute('position') as THREE.BufferAttribute
        const fall = dt * 3.8
        for (let i = 0; i < attr.count; i += 2) {
          let y0 = attr.getY(i) - fall
          let y1 = attr.getY(i + 1) - fall
          if (y0 < 4.15) {
            const lift = 2.35
            y0 += lift
            y1 += lift
          }
          attr.setY(i, y0)
          attr.setY(i + 1, y1)
        }
        attr.needsUpdate = true
      }

      if (moodRig.hasLightning && !reducedMotion) {
        if (now >= nextLightningAt) {
          lightningFlash = 1
          nextLightningAt = now + 9000 + Math.random() * 14000
        }
        if (lightningFlash > 0.01) {
          lightningFlash = Math.max(0, lightningFlash - dt * 4.5)
          duskFill.intensity = moodRig.fillIntensity + lightningFlash * 2.2
          for (const h of built.windowHalos) {
            ;(h.material as THREE.SpriteMaterial).opacity =
              moodRig.windowHaloOpacity + lightningFlash * 0.35
          }
        } else {
          duskFill.intensity = moodRig.fillIntensity
        }
      }

      renderer.render(scene, camera)

      frames += 1
      if (now - statsSince >= 600) {
        const snapshot: RoomStats = {
          fps: Math.round((frames * 1000) / Math.max(1, now - statsSince)),
          frameMs: Math.round(avgFrameMs * 10) / 10,
          drawCalls: renderer.info.render.calls,
          triangles: renderer.info.render.triangles,
          books: built.placements.length,
          bookBatches: built.bookMesh ? 1 : 0,
          qualityTier: governor.getTier()
        }
        ;(window as unknown as { __alexandriaRoomStats?: () => RoomStats }).__alexandriaRoomStats =
          () => snapshot
        frames = 0
        statsSince = now
      }

      scheduleNext()
    }

    placeArrivingBook()
    if (!document.hidden) {
      tick()
    }

    return () => {
      disposed = true
      cancelAnimationFrame(frameId)
      clearTimeout(frameId)
      unsubPlayer()
      unsubAmbient()
      observer.disconnect()
      if (navigateTimer) clearTimeout(navigateTimer)
      if (document.pointerLockElement === renderer.domElement) {
        document.exitPointerLock()
      }
      renderer.domElement.removeEventListener('pointerdown', onPointerDown)
      renderer.domElement.removeEventListener('dblclick', onDoubleClick)
      renderer.domElement.removeEventListener('touchstart', onTouchStart)
      renderer.domElement.removeEventListener('touchmove', onTouchMove)
      renderer.domElement.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      renderer.domElement.removeEventListener('wheel', onWheel)
      renderer.domElement.removeEventListener('contextmenu', onContextMenu)
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost)
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored)
      document.removeEventListener('pointerlockchange', onPointerLockChange)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('keyup', onKeyUp, true)
      window.removeEventListener('blur', onWindowBlur)
      input.clear()
      touchMoveRef.current = { forward: 0, right: 0 }
      clearKeysRef.current = null

      hoverBoxGeo.dispose()
      hoverBoxMat.dispose()
      floorCursorGeo.dispose()
      floorCursorMat.dispose()
      walkRingGeo.dispose()
      walkRingMat.dispose()
      if (built.bookMesh) {
        built.bookMesh.geometry.dispose()
        ;(built.bookMesh.material as THREE.Material).dispose()
      }
      built.disposables.geometries.forEach((g) => g.dispose())
      built.disposables.materials.forEach((m) => m.dispose())
      built.disposables.textures.forEach((t) => t.dispose())
      envTarget.dispose()
      renderer.dispose()
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement)
      setHovered(null)
      setFpsActive(false)
    }
  }, [
    room,
    roomBooks,
    openBook,
    openShelf,
    clearReturningBook,
    returningBookId,
    reducedMotion,
    quality,
    theme,
    mood,
    setSettingsOpen,
    setTipsOpen
  ])

  const scanMissing = async (): Promise<void> => {
    setScanning(true)
    try {
      await window.alexandria.scanMissing()
      await refresh()
    } finally {
      setScanning(false)
    }
  }

  const handleChangeTheme = (next: HallTheme): void => {
    void setSettingValue('hall.theme', next)
  }

  const handleChangeMood = (next: HallMood): void => {
    void setSettingValue('hall.mood', next)
  }

  const handleCreateWing = async (): Promise<void> => {
    if (!room) return
    const cleaned = newWingName.trim()
    if (!cleaned) return
    setCreatingWing(true)
    try {
      const sectionId = await window.alexandria.createContainer({
        kind: 'section',
        parentId: room.id,
        name: cleaned,
        wall: newWingWall
      })
      await refresh()
      const freshLayout = useLibraryStore.getState().layout
      const createdSection = freshLayout
        .flatMap((f) => f.rooms)
        .flatMap((r) => r.sections)
        .find((s) => s.id === sectionId)
      const firstShelfId = createdSection?.bays[0]?.shelves[0]?.id
      if (firstShelfId) {
        await window.alexandria.updateContainer({
          kind: 'shelf',
          id: firstShelfId,
          label: `${cleaned} I`
        })
        await refresh()
        playSound('tick')
        setNewWingName('')
        setNewWingOpen(false)
        setPlacesOpen(false)
        window.setTimeout(() => {
          jumpToAnchorRef.current?.(`shelf-${firstShelfId}`)
        }, 120)
      }
    } finally {
      setCreatingWing(false)
    }
  }

  const totalBooks = library?.books ?? books.length
  const shelfAnchors = anchorList.filter((a) => a.kind === 'shelf')
  const landmarkAnchors = anchorList.filter((a) => a.kind !== 'shelf')

  const studyTarget = modeDurationSeconds(studyModeType)
  const studyDisplay =
    studyTarget > 0 ? formatClock(Math.max(0, studyTarget - studyElapsed)) : formatClock(studyElapsed)

  return (
    <div className="room room--scene">
      <div className="room__canvas" ref={mountRef} />

      {webglStatus !== 'ok' ? (
        <div className="room__fallback">
          <p className="room__fallback-title">
            {webglStatus === 'unavailable'
              ? '3D Grand Hall Unavailable in This Browser'
              : '3D viewport paused'}
          </p>
          <p className="room__fallback-body">
            {webglStatus === 'unavailable'
              ? 'Hardware WebGL2 acceleration is disabled in this environment. You can still explore every shelf, book, PDF reader tool, study timer, and Scholar Ledger below.'
              : 'Your browser reset WebGL. You can keep reading from the Index or Floor Plan while graphics recover.'}
          </p>
          <div className="dialog__actions">
            <button className="button" type="button" onClick={() => navigate('map')}>
              Open 2D Floor Plan
            </button>
            <button className="button button--quiet" type="button" onClick={() => navigate('index')}>
              Open Library Index
            </button>
            <button
              className="button button--quiet"
              type="button"
              onClick={() => {
                setDeskInitialTab('desk')
                setDeskOpen(true)
              }}
            >
              Open Reading Desk
            </button>
          </div>
        </div>
      ) : null}

      <div
        key={room?.id ?? 'room'}
        className={reducedMotion ? 'room__fade' : 'room__fade room__fade--animate'}
        aria-hidden="true"
      />

      {/* Minimal unobtrusive top-left title & optional multi-room selector */}
      <div className="room-brand">
        <div className="room-brand__line">
          <span className="room-brand__title">{room?.name ?? 'Main Hall'}</span>
          <span className="room-brand__sep" aria-hidden="true">
            ·
          </span>
          <span className="room-brand__meta">
            {totalBooks} {totalBooks === 1 ? 'book' : 'books'}
          </span>
        </div>

        {allRooms.length > 1 ? (
          <nav className="room-brand__rooms" aria-label="Rooms">
            {allRooms.map(({ floor, room: entry }) => (
              <button
                key={entry.id}
                type="button"
                className="room-brand__room-btn"
                aria-current={room?.id === entry.id ? 'true' : undefined}
                onClick={() => setRoom({ floorId: floor.id, roomId: entry.id })}
              >
                {floor.name === 'Ground Floor' ? entry.name : `${floor.name} / ${entry.name}`}
              </button>
            ))}
          </nav>
        ) : null}

        {missingCount > 0 ? (
          <button
            className="room-brand__alert"
            type="button"
            onClick={() => void scanMissing()}
            disabled={scanning}
          >
            {scanning ? 'Checking files…' : `${missingCount} missing — check files`}
          </button>
        ) : null}
      </div>

      {/* Live Corner Architectural Mini-Map HUD */}
      <MiniMapHud
        markers={miniMapMarkers}
        poseRef={miniMapPoseRef}
        onJump={(anchorId) => jumpToAnchorRef.current?.(anchorId)}
        visible={miniMapOpen}
        onToggleVisible={() => setMiniMapOpen((open) => !open)}
      />

      {/* Subtle FPS center reticle & status banner */}
      {fpsActive ? (
        <>
          <div className="room__fps-banner" role="status">
            First-Person Walk · WASD Move · Mouse Look · E Interact · Esc Exit
          </div>
          <div
            className={`room__reticle ${hovered ? 'room__reticle--active' : ''}`}
            aria-hidden="true"
          />
        </>
      ) : null}

      {/* Diegetic interaction prompt on hover / aim */}
      {hovered ? (
        <div className="room__inspect" role="status">
          <span className="room__inspect-title">{hovered.label}</span>
          <span className="room__inspect-hint">{hovered.hint}</span>
        </div>
      ) : null}

      {/* Unified Collapsible Bottom Game Dock with Places & Atmosphere Popovers */}
      <div className={`game-dock-wrap ${dockOpen ? '' : 'game-dock-wrap--collapsed'}`}>
        {atmosphereOpen && dockOpen ? (
          <AtmospherePopover
            theme={theme}
            mood={mood}
            onChangeTheme={handleChangeTheme}
            onChangeMood={handleChangeMood}
            onClose={() => setAtmosphereOpen(false)}
          />
        ) : null}

        {placesOpen && dockOpen ? (
          <div className="places-popover" role="dialog" aria-label="Shelves, wings and hall landmarks">
            <div className="places-popover__head">
              <span>Shelves, Wings &amp; Landmarks</span>
              <div className="places-popover__head-actions">
                <button
                  type="button"
                  className="places-popover__add-btn"
                  onClick={() => setNewWingOpen((prev) => !prev)}
                >
                  {newWingOpen ? 'Close' : '+ New Wing'}
                </button>
                <button
                  type="button"
                  className="places-popover__close"
                  onClick={() => setPlacesOpen(false)}
                  aria-label="Close places menu"
                >
                  ×
                </button>
              </div>
            </div>

            {newWingOpen ? (
              <form
                className="wing-builder"
                onSubmit={(e) => {
                  e.preventDefault()
                  void handleCreateWing()
                }}
              >
                <input
                  type="text"
                  value={newWingName}
                  maxLength={40}
                  placeholder="Wing name (e.g. Philosophy, Sci-Fi)"
                  onChange={(e) => setNewWingName(e.target.value)}
                  autoFocus
                />
                <div className="wing-builder__row">
                  <select
                    value={newWingWall}
                    aria-label="Choose wall"
                    onChange={(e) => setNewWingWall(e.target.value as Wall)}
                  >
                    <option value="north">North Wall</option>
                    <option value="east">East Wall</option>
                    <option value="west">West Wall</option>
                    <option value="south">South Balcony</option>
                  </select>
                  <button
                    type="submit"
                    className="button wing-builder__submit"
                    disabled={creatingWing || !newWingName.trim()}
                  >
                    {creatingWing ? 'Building…' : 'Build Wing'}
                  </button>
                </div>
              </form>
            ) : null}

            {shelfAnchors.length > 0 ? (
              <div className="places-popover__group">
                <p className="places-popover__label">Named Shelves</p>
                <div className="places-popover__list">
                  {shelfAnchors.map((anchor) => (
                    <div key={anchor.id} className="places-popover__row">
                      <button
                        type="button"
                        className="places-popover__go"
                        onClick={() => {
                          jumpToAnchorRef.current?.(anchor.id)
                          setPlacesOpen(false)
                        }}
                      >
                        <span className="places-popover__name">{anchor.label}</span>
                        {anchor.meta ? (
                          <span className="places-popover__meta">{anchor.meta}</span>
                        ) : null}
                      </button>
                      {anchor.shelfId !== undefined ? (
                        <button
                          type="button"
                          className="places-popover__edit"
                          title={`Rename ${anchor.label}`}
                          onClick={() => {
                            jumpToAnchorRef.current?.(anchor.id)
                            setRenameFocus(true)
                            openShelf(anchor.shelfId ?? null)
                            setPlacesOpen(false)
                          }}
                        >
                          Edit
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="places-popover__group">
              <p className="places-popover__label">Hall Landmarks</p>
              <div className="places-popover__landmarks">
                {landmarkAnchors.map((anchor) => (
                  <button
                    key={anchor.id}
                    type="button"
                    className="places-popover__landmark"
                    onClick={() => {
                      jumpToAnchorRef.current?.(anchor.id)
                      setPlacesOpen(false)
                    }}
                  >
                    {anchor.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        <button
          type="button"
          className="game-dock__toggle"
          onClick={(e) => {
            e.currentTarget.blur()
            setDockOpen((open) => !open)
            setPlacesOpen(false)
            setAtmosphereOpen(false)
          }}
          aria-expanded={dockOpen}
          title={dockOpen ? 'Hide HUD (H)' : 'Show HUD (H)'}
        >
          {dockOpen ? '▾ Hide' : '▴ Menu'}
        </button>

        <div className="game-dock" role="toolbar" aria-label="Library controls">
          <button
            type="button"
            className="game-dock__btn game-dock__btn--primary"
            onClick={(e) => {
              e.currentTarget.blur()
              void pickImportFiles()
            }}
          >
            Import
          </button>

          <button
            type="button"
            className={`game-dock__btn ${placesOpen ? 'game-dock__btn--active' : ''}`}
            onClick={(e) => {
              e.currentTarget.blur()
              setAtmosphereOpen(false)
              setPlacesOpen((open) => !open)
            }}
            title="Jump to shelves, build wings, or visit Mezzanine (P)"
          >
            Shelves
          </button>

          <button
            type="button"
            className={`game-dock__btn ${atmosphereOpen || ambientEnabled ? 'game-dock__btn--active' : ''}`}
            onClick={(e) => {
              e.currentTarget.blur()
              setPlacesOpen(false)
              setAtmosphereOpen((open) => !open)
            }}
            title="Theme, Time & Weather Mood, and Ambient Soundscape (T)"
          >
            Atmosphere
          </button>

          <button
            type="button"
            className={`game-dock__btn ${studyRunning ? 'game-dock__btn--active' : ''}`}
            onClick={(e) => {
              e.currentTarget.blur()
              setDeskInitialTab('desk')
              setDeskOpen(true)
            }}
            title="Reading Desk, Inbox & Study Tracker"
          >
            {studyRunning ? `Desk · ${studyDisplay}` : `Desk${inboxCount > 0 ? ` (${inboxCount})` : ''}`}
          </button>

          <button
            type="button"
            className={`game-dock__btn ${deskOpen && deskInitialTab === 'ledger' ? 'game-dock__btn--active' : ''}`}
            onClick={(e) => {
              e.currentTarget.blur()
              setDeskInitialTab('ledger')
              setDeskOpen(true)
            }}
            title={`Scholar Ledger · ${scholarRank.current.title} (${scholarXp} XP)`}
          >
            Ledger · {scholarRank.current.crest}
          </button>

          <button
            type="button"
            className={`game-dock__btn ${tourActive ? 'game-dock__btn--active' : ''}`}
            onClick={(e) => {
              e.currentTarget.blur()
              playSound('tick')
              if (tourActive) {
                setTourActive(false)
                setTourPaused(false)
              } else {
                setPlacesOpen(false)
                setAtmosphereOpen(false)
                setDeskOpen(false)
                openShelf(null)
                setTourStopIndex(0)
                setTourPaused(false)
                setTourActive(true)
                useScholarStore.getState().recordDiscovery('grand-tour', 'Guided Grand Hall Tour')
              }
            }}
            title="Cinematic Guided Grand Hall Tour"
          >
            {tourActive ? 'End Tour' : 'Tour'}
          </button>

          <button
            type="button"
            className="game-dock__btn"
            onClick={(e) => {
              e.currentTarget.blur()
              setSearchOpen(true)
            }}
            title="Search library (Ctrl/Cmd + K)"
          >
            Search
          </button>

          <span className="game-dock__divider" aria-hidden="true" />

          <button
            type="button"
            className="game-dock__btn"
            onClick={(e) => {
              e.currentTarget.blur()
              navigate('map')
            }}
            title="Floor Plan & Atlas (M)"
          >
            Map
          </button>

          <button
            type="button"
            className="game-dock__btn"
            onClick={(e) => {
              e.currentTarget.blur()
              navigate('index')
            }}
            title="Library Catalogue Index (I)"
          >
            Index
          </button>

          <button
            type="button"
            className="game-dock__btn"
            onClick={(e) => {
              e.currentTarget.blur()
              navigate('librarian')
            }}
            title="Manage Library & Shelves (L)"
          >
            Manage
          </button>

          <span className="game-dock__divider" aria-hidden="true" />

          <button
            type="button"
            className={`game-dock__btn ${fpsActive ? 'game-dock__btn--active' : ''}`}
            onClick={(e) => {
              e.currentTarget.blur()
              fpsToggleRef.current?.()
            }}
            title="First-person walk mode (Tab)"
          >
            {fpsActive ? 'Exit Walk' : 'Walk'}
          </button>

          <button
            type="button"
            className="game-dock__btn"
            onClick={(e) => {
              e.currentTarget.blur()
              setTourActive(false)
              resetViewRef.current?.()
            }}
            title="Return to Grand Hall Entrance (R)"
            aria-label="Return to entrance"
          >
            ↺
          </button>

          <button
            type="button"
            className="game-dock__btn"
            onClick={(e) => {
              e.currentTarget.blur()
              setSettingsOpen(true)
            }}
            title="Settings (Ctrl/Cmd + ,)"
            aria-label="Settings"
          >
            ⚙
          </button>

          <button
            type="button"
            className="game-dock__btn"
            onClick={(e) => {
              e.currentTarget.blur()
              setTipsOpen(true)
            }}
            title="Detailed Controls & Navigation Guide (?)"
          >
            Controls
          </button>
        </div>

        <p className="game-dock__keys" aria-hidden="true">
          {platform.isTouchPrimary
            ? 'Thumbstick Move · Drag Look · Pinch Zoom · Tap Books & Landmarks'
            : `WASD Move · Drag Look · Double-Click Floor · ${formatShortcut('K', platform)} Search · ? Controls`}
        </p>
      </div>

      {platform.isTouchPrimary && webglStatus === 'ok' && !deskOpen && openShelfId === null ? (
        <TouchMovePad
          onVectorChange={(vector) => {
            touchMoveRef.current = vector
          }}
        />
      ) : null}

      {tourActive ? (
        <HallTourOverlay
          stopIndex={tourStopIndex}
          paused={tourPaused}
          onPrev={() => setTourStopIndex((idx) => Math.max(0, idx - 1))}
          onNext={() => setTourStopIndex((idx) => Math.min(HALL_TOUR_STOPS.length - 1, idx + 1))}
          onTogglePause={() => setTourPaused((p) => !p)}
          onExit={() => {
            setTourActive(false)
            setTourPaused(false)
          }}
        />
      ) : null}

      {scholarToast ? (
        <div
          className="scholar-toast"
          role="status"
          onClick={() => {
            clearScholarToast()
            setDeskInitialTab('ledger')
            setDeskOpen(true)
          }}
        >
          <span className="scholar-toast__crest">{scholarRank.current.crest}</span>
          <div className="scholar-toast__body">
            <span className="scholar-toast__kicker">{scholarToast.subtitle}</span>
            <strong className="scholar-toast__title">{scholarToast.title}</strong>
          </div>
          <span className="scholar-toast__xp">+{scholarToast.xp} XP</span>
        </div>
      ) : null}

      {openShelfId !== null ? (
        <ShelfDrawer
          shelfId={openShelfId}
          autoFocusRename={renameFocus}
          onInspectBook={(book) => setPreviewBook(book)}
          onSelectShelf={(nextId) => {
            openShelf(nextId)
            jumpToAnchorRef.current?.(`shelf-${nextId}`)
          }}
          onClose={() => {
            openShelf(null)
            setRenameFocus(false)
          }}
        />
      ) : null}

      {deskOpen ? (
        <Suspense fallback={null}>
          <DeskDrawer
            initialTab={deskInitialTab}
            onInspectBook={(book) => setPreviewBook(book)}
            onClose={() => setDeskOpen(false)}
          />
        </Suspense>
      ) : null}

      {observatoryOpen ? (
        <Suspense fallback={null}>
          <ObservatoryModal
            mood={mood}
            onChangeMood={handleChangeMood}
            onClose={() => setObservatoryOpen(false)}
          />
        </Suspense>
      ) : null}

      {atlasOpen ? (
        <Suspense fallback={null}>
          <AtlasWayfinderModal
            anchors={anchorList}
            totalBooks={totalBooks}
            onJump={(anchorId) => jumpToAnchorRef.current?.(anchorId)}
            onClose={() => setAtlasOpen(false)}
          />
        </Suspense>
      ) : null}

      {previewBook ? (
        <BookPreviewCard book={previewBook} onClose={() => setPreviewBook(null)} />
      ) : null}
    </div>
  )
}
