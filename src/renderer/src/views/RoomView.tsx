import type { LibraryInfo } from '@shared/api'
import type { Bay, Book, Floor, Room, Section, Wall } from '@shared/types'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { BookCover } from '../components/BookCover'
import { DeskDrawer } from '../components/DeskDrawer'
import { pickImportFiles } from '../import-actions'
import { navigate } from '../router'
import { useLibraryStore } from '../state/library-store'
import { useReaderStore } from '../state/reader-store'
import { useUiStore } from '../state/ui-store'

interface Props {
  library: LibraryInfo | null
}

const roomWidth = 10
const roomDepth = 8
const wallHeight = 3.3

const wood = new THREE.MeshStandardMaterial({ color: '#3a281c', roughness: 0.82, metalness: 0.04 })
const woodDark = new THREE.MeshStandardMaterial({
  color: '#241a13',
  roughness: 0.9,
  metalness: 0.02
})
const wallMaterial = new THREE.MeshStandardMaterial({ color: '#1e1712', roughness: 0.95 })
const floorMaterial = new THREE.MeshStandardMaterial({ color: '#2a1c13', roughness: 0.78 })
const brassMaterial = new THREE.MeshStandardMaterial({
  color: '#b08d57',
  roughness: 0.35,
  metalness: 0.7
})

const bookColors = [
  '#6d2f27',
  '#33463a',
  '#3d3555',
  '#6b5330',
  '#2f4452',
  '#5a3b2b',
  '#7d6a45',
  '#473a4d',
  '#59463a',
  '#2c3f3b'
]

function shelvingBay(bay: Bay, wall: Wall, offset: number, books: Book[]): THREE.Group {
  const group = new THREE.Group()
  const width = 1.55
  const height = 2.62
  const depth = 0.36

  const rotate: Record<Wall, number> = {
    north: 0,
    east: -Math.PI / 2,
    south: Math.PI,
    west: Math.PI / 2
  }

  const position: Record<Wall, [number, number, number]> = {
    north: [offset, 0, -roomDepth / 2 + 0.22],
    east: [roomWidth / 2 - 0.22, 0, offset],
    south: [offset, 0, roomDepth / 2 - 0.22],
    west: [-roomWidth / 2 + 0.22, 0, offset]
  }

  group.position.set(...position[wall])
  group.rotation.y = rotate[wall]

  const back = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.05), woodDark)
  back.position.set(0, height / 2, -depth / 2)
  back.receiveShadow = true
  group.add(back)

  const sideGeometry = new THREE.BoxGeometry(0.07, height, depth)
  for (const x of [-width / 2, width / 2]) {
    const side = new THREE.Mesh(sideGeometry, wood)
    side.position.set(x, height / 2, 0)
    side.castShadow = true
    group.add(side)
  }

  const top = new THREE.Mesh(new THREE.BoxGeometry(width, 0.08, depth + 0.06), wood)
  top.position.set(0, height, 0)
  top.castShadow = true
  group.add(top)

  const shelfCount = bay.shelves.length
  const spacing = (height - 0.3) / Math.max(1, shelfCount)
  const booksByShelf = new Map<number, Book[]>()
  for (const book of books) {
    if (book.shelfId === null) continue
    const shelf = bay.shelves.find((entry) => entry.id === book.shelfId)
    if (!shelf) continue
    const list = booksByShelf.get(shelf.id) ?? []
    list.push(book)
    booksByShelf.set(shelf.id, list)
  }

  bay.shelves.forEach((shelf, row) => {
    const y = 0.16 + row * spacing
    const board = new THREE.Mesh(new THREE.BoxGeometry(width - 0.08, 0.05, depth), wood)
    board.position.set(0, y, 0)
    board.receiveShadow = true
    board.userData.shelfId = shelf.id
    group.add(board)

    const shelved = (booksByShelf.get(shelf.id) ?? []).slice(0, 22)
    const usable = width - 0.22
    const step = shelved.length > 0 ? usable / shelved.length : usable

    shelved.forEach((book, index) => {
      const thickness = Math.min(0.07, step * 0.62)
      const bookHeight = 0.2 + ((book.id * 37) % 9) * 0.012
      const geometry = new THREE.BoxGeometry(thickness, bookHeight, 0.21)
      const material = new THREE.MeshStandardMaterial({
        color: bookColors[book.id % bookColors.length],
        roughness: 0.7,
        metalness: 0.03
      })
      const mesh = new THREE.Mesh(geometry, material)
      const x = -usable / 2 + step * (index + 0.5)
      mesh.position.set(x, y + 0.025 + bookHeight / 2, 0.015)
      mesh.rotation.z = ((book.id % 5) - 2) * 0.004
      mesh.castShadow = true
      mesh.userData.bookId = book.id
      mesh.userData.shelfId = shelf.id
      group.add(mesh)

      if (book.title.length > 0 && index % 4 === 0) {
        const band = new THREE.Mesh(
          new THREE.BoxGeometry(thickness + 0.002, 0.012, 0.213),
          brassMaterial
        )
        band.position.copy(mesh.position)
        band.position.y += bookHeight * 0.28
        band.userData.bookId = book.id
        group.add(band)
      }
    })
  })

  return group
}

function buildScene(room: Room, books: Book[]): THREE.Group {
  const scene = new THREE.Group()

  const floor = new THREE.Mesh(new THREE.BoxGeometry(roomWidth, 0.12, roomDepth), floorMaterial)
  floor.position.y = -0.06
  floor.receiveShadow = true
  scene.add(floor)

  const rug = new THREE.Mesh(
    new THREE.BoxGeometry(4.6, 0.015, 3.2),
    new THREE.MeshStandardMaterial({ color: '#3d2a22', roughness: 0.95 })
  )
  rug.position.y = 0.006
  rug.receiveShadow = true
  scene.add(rug)

  const walls: Array<[Wall, [number, number, number], [number, number, number]]> = [
    ['north', [0, wallHeight / 2, -roomDepth / 2 - 0.05], [roomWidth, wallHeight, 0.1]],
    ['east', [roomWidth / 2 + 0.05, wallHeight / 2, 0], [0.1, wallHeight, roomDepth]],
    ['south', [0, wallHeight / 2, roomDepth / 2 + 0.05], [roomWidth, wallHeight, 0.1]],
    ['west', [-roomWidth / 2 - 0.05, wallHeight / 2, 0], [0.1, wallHeight, roomDepth]]
  ]

  for (const [, position, size] of walls) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), wallMaterial)
    mesh.position.set(...position)
    mesh.receiveShadow = true
    scene.add(mesh)
  }

  const sectionWalls = new Map<Wall, Section[]>()
  for (const section of room.sections) {
    const list = sectionWalls.get(section.wall) ?? []
    list.push(section)
    sectionWalls.set(section.wall, list)
  }

  for (const [wall, sections] of sectionWalls) {
    const wallLength = wall === 'north' || wall === 'south' ? roomWidth : roomDepth
    const bays = sections.flatMap((section) => section.bays)

    if (bays.length === 0) continue

    const bayWidth = 1.7
    const span = Math.min(wallLength - 1.4, bays.length * bayWidth)
    const step = span / bays.length

    bays.forEach((bay, index) => {
      const offset = -span / 2 + step * (index + 0.5)
      scene.add(shelvingBay(bay, wall, offset, books))
    })
  }

  // Desk and lamp in the middle of the hall.
  const desk = new THREE.Group()
  const top = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.09, 1.25), wood)
  top.position.y = 0.78
  top.castShadow = true
  top.receiveShadow = true
  desk.add(top)

  const legGeometry = new THREE.BoxGeometry(0.09, 0.78, 0.09)
  for (const x of [-1.15, 1.15]) {
    for (const z of [-0.48, 0.48]) {
      const leg = new THREE.Mesh(legGeometry, woodDark)
      leg.position.set(x, 0.39, z)
      leg.castShadow = true
      desk.add(leg)
    }
  }

  const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.05, 24), brassMaterial)
  lampBase.position.set(0.75, 0.85, -0.25)
  desk.add(lampBase)

  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.52, 12), brassMaterial)
  stem.position.set(0.75, 1.11, -0.25)
  desk.add(stem)

  const shade = new THREE.Mesh(
    new THREE.ConeGeometry(0.24, 0.18, 24, 1, true),
    new THREE.MeshStandardMaterial({
      color: '#c9a06a',
      emissive: '#8a5f2b',
      emissiveIntensity: 0.6,
      side: THREE.DoubleSide,
      roughness: 0.6
    })
  )
  shade.position.set(0.75, 1.4, -0.25)
  desk.add(shade)

  const lampLight = new THREE.PointLight('#ffbd73', 12, 5.5, 1.6)
  lampLight.position.set(0.75, 1.35, -0.25)
  lampLight.castShadow = false
  desk.add(lampLight)

  const openBook = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.02, 0.32),
    new THREE.MeshStandardMaterial({ color: '#d9c9a3', roughness: 0.9 })
  )
  openBook.position.set(-0.5, 0.84, 0.05)
  openBook.rotation.y = 0.2
  desk.add(openBook)

  scene.add(desk)

  const inbox = books.filter((book) => book.shelfId === null).slice(0, 4)
  inbox.forEach((book, index) => {
    const stack = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.05, 0.26),
      new THREE.MeshStandardMaterial({ color: bookColors[book.id % bookColors.length], roughness: 0.75 })
    )
    stack.position.set(-0.55, 0.855 + index * 0.052, -0.28)
    stack.rotation.y = (index % 2 === 0 ? 1 : -1) * 0.08
    stack.userData.bookId = book.id
    scene.add(stack)
  })

  return scene
}

function ShelfDrawer({ shelfId, onClose }: { shelfId: number; onClose: () => void }) {
  const layout = useLibraryStore((state) => state.layout)
  const books = useLibraryStore((state) => state.books)
  const refresh = useLibraryStore((state) => state.refreshBooks)
  const openBook = useReaderStore((state) => state.open)
  const [busy, setBusy] = useState(false)

  const shelf = useMemo(() => {
    for (const floor of layout) {
      for (const room of floor.rooms) {
        for (const section of room.sections) {
          for (const bay of section.bays) {
            const found = bay.shelves.find((entry) => entry.id === shelfId)
            if (found) return { shelf: found, section, room, floor }
          }
        }
      }
    }
    return null
  }, [layout, shelfId])

  if (!shelf) return null

  const shelved = books
    .filter((book) => book.shelfId === shelfId)
    .sort((a, b) => a.slotIndex - b.slotIndex)

  const open = (book: Book): void => {
    openBook(book.id, book.lastPage)
    navigate('reader')
  }

  const unshelve = async (book: Book): Promise<void> => {
    setBusy(true)
    try {
      await window.alexandria.unshelveBook(book.id)
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <aside className="shelf-drawer" aria-label="Shelf contents">
      <header className="shelf-drawer__head">
        <div>
          <p className="eyebrow">
            {shelf.floor.name} · {shelf.room.name} · {shelf.section.name}
          </p>
          <h2>Shelf {shelf.shelf.id}</h2>
        </div>
        <button className="icon-button" type="button" onClick={onClose} aria-label="Close shelf">
          ×
        </button>
      </header>

      <p className="shelf-drawer__meta">
        {shelved.length} of {shelf.shelf.capacity} slots · sorted by {shelf.shelf.sortMode}
      </p>

      <ul className="shelf-drawer__list">
        {shelved.length === 0 ? (
          <li className="shelf-drawer__empty">No volumes on this shelf yet.</li>
        ) : (
          shelved.map((book) => (
            <li key={book.id} className="shelf-drawer__book">
              <button type="button" className="shelf-drawer__open" onClick={() => open(book)}>
                <BookCover book={book} className="cover--mini" />
                <span>
                  <span className="shelf-drawer__title">{book.title}</span>
                  <span className="shelf-drawer__author">{book.author ?? 'Unknown author'}</span>
                </span>
              </button>
              <button
                type="button"
                className="shelf-drawer__action"
                title="Return to inbox"
                onClick={() => void unshelve(book)}
                disabled={busy}
              >
                Unshelve
              </button>
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
  const openBook = useReaderStore((state) => state.open)
  const mountRef = useRef<HTMLDivElement | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [deskOpen, setDeskOpen] = useState(false)

  const room = useMemo<Room | null>(() => {
    const direct = floors
      .flatMap((floor) => floor.rooms)
      .find((entry) => entry.id === selection.roomId)
    if (direct) return direct
    return floors[0]?.rooms[0] ?? null
  }, [floors, selection.roomId])

  const roomBooks = useMemo(
    () =>
      books.filter((book) =>
        room?.sections.some((section) =>
          section.bays.some((bay) =>
            bay.shelves.some((shelf) => shelf.id === book.shelfId)
          )
        )
      ),
    [books, room]
  )

  useEffect(() => {
    if (!room) return
    if (selection.roomId !== room.id) {
      setRoom({ floorId: room.floorId, roomId: room.id })
    }
  }, [room, selection.roomId, setRoom])

  useEffect(() => {
    const mount = mountRef.current
    if (!mount || !room) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#0c0a09')
    scene.fog = new THREE.Fog('#0c0a09', 9, 18)

    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 60)
    camera.position.set(0, 2.35, 6.1)

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    mount.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(0, 1.25, 0)
    controls.enablePan = false
    controls.enableDamping = true
    controls.dampingFactor = 0.06
    controls.minDistance = 3.2
    controls.maxDistance = 8.5
    controls.minPolarAngle = 0.75
    controls.maxPolarAngle = 1.48
    controls.minAzimuthAngle = -1.15
    controls.maxAzimuthAngle = 1.15
    controls.update()

    const ambient = new THREE.AmbientLight('#6b5a45', 1.15)
    scene.add(ambient)

    const key = new THREE.SpotLight('#ffcf9a', 38, 14, Math.PI / 4.5, 0.6, 1.5)
    key.position.set(2.6, 4.2, 2.4)
    key.castShadow = true
    key.shadow.mapSize.set(1024, 1024)
    key.shadow.bias = -0.0004
    scene.add(key)

    const fill = new THREE.PointLight('#7c8ba0', 9, 13, 1.8)
    fill.position.set(-3.2, 2.8, 1.8)
    scene.add(fill)

    const roomGroup = buildScene(room, roomBooks)
    scene.add(roomGroup)

    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()

    const toPointer = (event: PointerEvent): void => {
      const rect = renderer.domElement.getBoundingClientRect()
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    }

    const pick = (event: PointerEvent): { bookId?: number; shelfId?: number } | null => {
      toPointer(event)
      raycaster.setFromCamera(pointer, camera)
      const hits = raycaster.intersectObjects(roomGroup.children, true)
      for (const hit of hits) {
        const data = hit.object.userData as { bookId?: number; shelfId?: number }
        if (data.bookId) return { bookId: data.bookId, shelfId: data.shelfId }
        if (data.shelfId) return { shelfId: data.shelfId }
      }
      return null
    }

    const onPointerMove = (event: PointerEvent): void => {
      const target = pick(event)
      renderer.domElement.style.cursor = target ? 'pointer' : 'grab'

      if (!target?.bookId) {
        setHovered(null)
        return
      }

      const book = roomBooks.find((entry) => entry.id === target.bookId)
      setHovered(book ? book.title : null)
    }

    const onClick = (event: PointerEvent): void => {
      const target = pick(event)
      if (!target) return
      if (target.bookId) {
        const book = roomBooks.find((entry) => entry.id === target.bookId)
        openBook(target.bookId, book?.lastPage ?? 1)
        navigate('reader')
      } else if (target.shelfId) {
        openShelf(target.shelfId)
      }
    }

    renderer.domElement.addEventListener('pointermove', onPointerMove)
    renderer.domElement.addEventListener('click', onClick)

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

    let frame = 0
    const animate = (): void => {
      frame = requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      renderer.domElement.removeEventListener('pointermove', onPointerMove)
      renderer.domElement.removeEventListener('click', onClick)
      controls.dispose()
      const shared = new Set<THREE.Material>([
        wood,
        woodDark,
        wallMaterial,
        floorMaterial,
        brassMaterial
      ])
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose()
          const materials = Array.isArray(object.material) ? object.material : [object.material]
          for (const material of materials) {
            if (!shared.has(material)) material.dispose()
          }
        }
      })
      renderer.dispose()
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement)
      setHovered(null)
    }
  }, [room, roomBooks, openBook, openShelf])

  const scanMissing = async (): Promise<void> => {
    setScanning(true)
    try {
      await window.alexandria.scanMissing()
      await refresh()
    } finally {
      setScanning(false)
    }
  }

  return (
    <div className="room room--scene">
      <div className="room__canvas" ref={mountRef} />

      <div className="room__hud">
        <p className="eyebrow">
          {room ? `${floors.find((floor) => floor.id === room.floorId)?.name ?? 'Floor'} · ${room.name}` : 'The reading room'}
        </p>
        <h2 className="room__hud-title">{room?.name ?? 'Main Hall'}</h2>
        <p className="room__hud-sub">
          {roomBooks.length} {roomBooks.length === 1 ? 'volume' : 'volumes'} on this floor&apos;s
          shelves
        </p>

        <div className="room__picker">
          {floors.map((floor: Floor) =>
            floor.rooms.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className="chip"
                aria-current={room?.id === entry.id ? 'true' : undefined}
                onClick={() => setRoom({ floorId: floor.id, roomId: entry.id })}
              >
                {floor.name === 'Ground Floor' ? entry.name : `${floor.name} · ${entry.name}`}
              </button>
            ))
          )}
        </div>

        <div className="room__hud-actions">
          <button className="button" type="button" onClick={() => void pickImportFiles()}>
            Import
          </button>
          <button className="button button--quiet" type="button" onClick={() => navigate('index')}>
            Browse index
          </button>
          <button className="button button--quiet" type="button" onClick={() => navigate('map')}>
            Map
          </button>
          <button className="button button--quiet" type="button" onClick={() => setDeskOpen(true)}>
            Desk & inbox
          </button>
        </div>

        <dl className="room__hud-stats">
          <div>
            <dt>Volumes</dt>
            <dd>{library?.books ?? '—'}</dd>
          </div>
          <div>
            <dt>Inbox</dt>
            <dd>{books.filter((book) => book.shelfId === null).length}</dd>
          </div>
          <div>
            <dt>Missing</dt>
            <dd>{books.filter((book) => book.missing).length}</dd>
          </div>
        </dl>

        {books.some((book) => book.missing) ? (
          <button className="room__alert" type="button" onClick={() => void scanMissing()} disabled={scanning}>
            {scanning ? 'Checking linked files…' : 'Some volumes are missing. Check the shelves.'}
          </button>
        ) : null}
      </div>

      <p className="room__hint">Drag to look around · click a book to read · click a shelf to browse</p>

      {hovered ? <div className="room__tooltip">{hovered}</div> : null}

      {openShelfId !== null ? (
        <ShelfDrawer shelfId={openShelfId} onClose={() => openShelf(null)} />
      ) : null}

      {deskOpen ? <DeskDrawer onClose={() => setDeskOpen(false)} /> : null}
    </div>
  )
}
