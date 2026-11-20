import type { LibraryInfo } from '@shared/api'
import type { Bay, Book, Floor, Room, Section, Wall } from '@shared/types'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { BookCover } from '../components/BookCover'
import { DeskDrawer } from '../components/DeskDrawer'
import { pickImportFiles } from '../import-actions'
import { navigate } from '../router'
import { playSound } from '../sound'
import { useLibraryStore } from '../state/library-store'
import { useReaderStore } from '../state/reader-store'
import { useSetting } from '../state/settings-store'
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
const ceilingMaterial = new THREE.MeshStandardMaterial({ color: '#17120e', roughness: 0.97 })
const trimMaterial = new THREE.MeshStandardMaterial({
  color: '#2b2119',
  roughness: 0.72,
  metalness: 0.16
})
const glassMaterial = new THREE.MeshStandardMaterial({
  color: '#2f3a4c',
  emissive: '#8fa3c4',
  emissiveIntensity: 0.28,
  roughness: 0.35,
  metalness: 0.1
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

const atlasColumns = 32
const atlasRows = 16
const atlasCellWidth = 64
const atlasCellHeight = 128
const atlasCellCount = atlasColumns * atlasRows

interface SpineCell {
  u0: number
  v0: number
  u1: number
  v1: number
  centerU: number
  centerV: number
}

interface SpinePlacement {
  book: Book
  shelfId: number
  matrix: THREE.Matrix4
  position: THREE.Vector3
  normal: THREE.Vector3
  cell: SpineCell
}

interface Anchor {
  position: THREE.Vector3
  target: THREE.Vector3
}

function truncate(text: string, length: number): string {
  const value = text.trim()
  return value.length > length ? `${value.slice(0, length - 1)}…` : value
}

/* Soft radial textures, built once and shared by every room rebuild. */
let shadowTexture: THREE.CanvasTexture | null = null
let glowTexture: THREE.CanvasTexture | null = null

function radialTexture(stops: Array<[number, string]>): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const context = canvas.getContext('2d')
  if (context) {
    const gradient = context.createRadialGradient(64, 64, 2, 64, 64, 64)
    for (const [offset, color] of stops) gradient.addColorStop(offset, color)
    context.fillStyle = gradient
    context.fillRect(0, 0, 128, 128)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function contactShadowTexture(): THREE.CanvasTexture {
  if (!shadowTexture) {
    shadowTexture = radialTexture([
      [0, 'rgba(0,0,0,0.55)'],
      [0.55, 'rgba(0,0,0,0.26)'],
      [1, 'rgba(0,0,0,0)']
    ])
  }
  return shadowTexture
}

function warmGlowTexture(): THREE.CanvasTexture {
  if (!glowTexture) {
    glowTexture = radialTexture([
      [0, 'rgba(255,201,131,0.85)'],
      [0.4, 'rgba(255,178,96,0.28)'],
      [1, 'rgba(255,170,80,0)']
    ])
  }
  return glowTexture
}

function buildSpineAtlas(books: Book[]): {
  texture: THREE.CanvasTexture
  cells: Map<number, SpineCell>
} {
  const canvas = document.createElement('canvas')
  canvas.width = atlasColumns * atlasCellWidth
  canvas.height = atlasRows * atlasCellHeight
  const context = canvas.getContext('2d')
  const cells = new Map<number, SpineCell>()

  if (context) {
    context.fillStyle = '#0c0a09'
    context.fillRect(0, 0, canvas.width, canvas.height)

    books.forEach((book, index) => {
      const cellIndex = index % atlasCellCount
      const column = cellIndex % atlasColumns
      const row = Math.floor(cellIndex / atlasColumns)
      const x = column * atlasCellWidth
      const y = row * atlasCellHeight
      const base = bookColors[book.id % bookColors.length]

      context.fillStyle = base
      context.fillRect(x, y, atlasCellWidth, atlasCellHeight)

      const shade = context.createLinearGradient(x, y, x + atlasCellWidth, y)
      shade.addColorStop(0, 'rgba(0,0,0,0.32)')
      shade.addColorStop(0.32, 'rgba(255,255,255,0.08)')
      shade.addColorStop(1, 'rgba(0,0,0,0.4)')
      context.fillStyle = shade
      context.fillRect(x, y, atlasCellWidth, atlasCellHeight)

      context.fillStyle = 'rgba(197,166,110,0.85)'
      context.fillRect(x, y + 8, atlasCellWidth, 2)
      context.fillRect(x, y + atlasCellHeight - 24, atlasCellWidth, 2)

      context.save()
      context.translate(x + atlasCellWidth - 16, y + 18)
      context.rotate(Math.PI / 2)
      context.fillStyle = '#f1e5cd'
      context.font = '600 9px Inter, Georgia, serif'
      context.textBaseline = 'middle'
      context.fillText(truncate(book.title, 15), 0, 0)
      context.restore()

      context.save()
      context.translate(x + 15, y + 26)
      context.rotate(Math.PI / 2)
      context.fillStyle = 'rgba(226,210,180,0.68)'
      context.font = '500 7px Inter, Georgia, serif'
      context.textBaseline = 'middle'
      context.fillText(truncate(book.author ?? '', 18), 0, 0)
      context.restore()

      cells.set(book.id, {
        u0: x / canvas.width,
        v0: 1 - (y + atlasCellHeight) / canvas.height,
        u1: (x + atlasCellWidth) / canvas.width,
        v1: 1 - y / canvas.height,
        centerU: (x + 3) / canvas.width,
        centerV: 1 - (y + 3) / canvas.height
      })
    })
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  texture.needsUpdate = true
  return { texture, cells }
}

function shelvingBay(
  bay: Bay,
  wall: Wall,
  offset: number,
  books: Book[],
  cells: Map<number, SpineCell>,
  placements: SpinePlacement[],
  anchors: Map<number, Anchor>
): THREE.Group {
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

  const bayMatrix = new THREE.Matrix4().makeRotationY(rotate[wall])
  bayMatrix.setPosition(...position[wall])
  const normal = new THREE.Vector3(0, 0, 1).transformDirection(bayMatrix)

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

  const contact = new THREE.Mesh(
    new THREE.PlaneGeometry(width + 0.5, 1.0),
    new THREE.MeshBasicMaterial({
      map: contactShadowTexture(),
      transparent: true,
      opacity: 0.7,
      depthWrite: false
    })
  )
  contact.rotation.x = -Math.PI / 2
  contact.position.set(0, 0.008, depth / 2 + 0.3)
  contact.renderOrder = 1
  group.add(contact)

  bay.shelves.forEach((shelf, row) => {
    const y = 0.16 + row * spacing
    const board = new THREE.Mesh(new THREE.BoxGeometry(width - 0.08, 0.05, depth), wood)
    board.position.set(0, y, 0)
    board.receiveShadow = true
    board.userData.shelfId = shelf.id
    group.add(board)

    const anchorTarget = new THREE.Vector3(0, 1.45, 0).applyMatrix4(bayMatrix)
    anchors.set(shelf.id, {
      target: anchorTarget,
      position: anchorTarget.clone().addScaledVector(normal, 2.35).setY(1.68)
    })

    const shelved = (booksByShelf.get(shelf.id) ?? []).slice(0, 22)
    const usable = width - 0.22
    const step = shelved.length > 0 ? usable / shelved.length : usable

    shelved.forEach((book, index) => {
      const cell = cells.get(book.id)
      if (!cell) return

      const thickness = Math.min(0.07, step * 0.62)
      const bookHeight = 0.2 + ((book.id * 37) % 9) * 0.012
      const local = new THREE.Matrix4().compose(
        new THREE.Vector3(
          -usable / 2 + step * (index + 0.5),
          y + 0.025 + bookHeight / 2,
          0.015
        ),
        new THREE.Quaternion().setFromEuler(
          new THREE.Euler(0, 0, ((book.id % 5) - 2) * 0.004)
        ),
        new THREE.Vector3(thickness, bookHeight, 0.21)
      )
      const matrix = bayMatrix.clone().multiply(local)

      placements.push({
        book,
        shelfId: shelf.id,
        matrix,
        position: new THREE.Vector3().setFromMatrixPosition(matrix),
        normal,
        cell
      })
    })
  })

  return group
}

function buildSpineBatch(placements: SpinePlacement[], texture: THREE.Texture): THREE.Mesh | null {
  if (placements.length === 0) return null

  const base = new THREE.BoxGeometry(1, 1, 1)
  const geometries: THREE.BufferGeometry[] = []

  for (const placement of placements) {
    const geometry = base.clone()
    const uv = geometry.attributes.uv as THREE.BufferAttribute
    const { u0, v0, u1, v1, centerU, centerV } = placement.cell

    // All faces sample the plain colour at the cell's corner.
    for (let index = 0; index < uv.count; index += 1) {
      uv.setXY(index, centerU, centerV)
    }

    // BoxGeometry orders the +Z face last-but-one: 4 vertices starting at 16.
    for (let index = 16; index < 20; index += 1) {
      const x = geometry.attributes.position.getX(index)
      const y = geometry.attributes.position.getY(index)
      uv.setXY(index, u0 + (x + 0.5) * (u1 - u0), v0 + (y + 0.5) * (v1 - v0))
    }
    uv.needsUpdate = true

    geometry.applyMatrix4(placement.matrix)
    geometries.push(geometry)
  }

  base.dispose()
  const merged = mergeGeometries(geometries, false)
  geometries.forEach((geometry) => geometry.dispose())
  if (!merged) return null

  const material = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.72,
    metalness: 0.03
  })
  const mesh = new THREE.Mesh(merged, material)
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.userData.spineBatch = true
  return mesh
}

function buildScene(
  room: Room,
  books: Book[],
  quality: string
): {
  group: THREE.Group
  anchors: Map<number, Anchor>
  placements: SpinePlacement[]
  bookMesh: THREE.Mesh | null
  texture: THREE.CanvasTexture
  dust: THREE.Points | null
} {
  const scene = new THREE.Group()
  const anchors = new Map<number, Anchor>()
  const placements: SpinePlacement[] = []
  const { texture, cells } = buildSpineAtlas(books)

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

  // Ceiling with dark beams, so looking up closes the hall.
  const ceiling = new THREE.Mesh(new THREE.BoxGeometry(roomWidth, 0.12, roomDepth), ceilingMaterial)
  ceiling.position.y = wallHeight + 0.04
  scene.add(ceiling)
  for (const z of [-2.4, 0, 2.4]) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(roomWidth, 0.16, 0.18), woodDark)
    beam.position.set(0, wallHeight - 0.08, z)
    beam.castShadow = true
    scene.add(beam)
  }

  // Columns at the corners, with a base and a capital.
  for (const x of [-roomWidth / 2 + 0.3, roomWidth / 2 - 0.3]) {
    for (const z of [-roomDepth / 2 + 0.3, roomDepth / 2 - 0.3]) {
      const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.18, wallHeight - 0.2, 18),
        trimMaterial
      )
      shaft.position.set(x, wallHeight / 2, z)
      shaft.castShadow = true
      scene.add(shaft)

      const base = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.42), trimMaterial)
      base.position.set(x, 0.08, z)
      scene.add(base)

      const capital = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.14, 0.44), trimMaterial)
      capital.position.set(x, wallHeight - 0.12, z)
      scene.add(capital)
    }
  }

  // Clerestory windows above the shelves, with muntins and a dusk glow.
  const windowXs = [-3.0, 0, 3.0]
  for (const x of windowXs) {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.72, 0.08), trimMaterial)
    frame.position.set(x, 2.98, -roomDepth / 2 + 0.02)
    scene.add(frame)

    const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.34, 0.56), glassMaterial)
    glass.position.set(x, 2.98, -roomDepth / 2 + 0.07)
    scene.add(glass)

    for (const offset of [-0.45, 0, 0.45]) {
      const muntin = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.6, 0.03), trimMaterial)
      muntin.position.set(x + offset, 2.98, -roomDepth / 2 + 0.09)
      scene.add(muntin)
    }
    const crossbar = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.035, 0.03), trimMaterial)
    crossbar.position.set(x, 2.98, -roomDepth / 2 + 0.09)
    scene.add(crossbar)

    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: warmGlowTexture(),
        color: '#9db1d4',
        transparent: true,
        opacity: 0.3,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    )
    glow.position.set(x, 2.9, -roomDepth / 2 + 0.4)
    glow.scale.set(2.4, 1.5, 1)
    scene.add(glow)
  }

  // A rolling ladder leans against the north wall beside the bays.
  const ladder = new THREE.Group()
  for (const x of [-0.28, 0.28]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.75, 0.06), wood)
    rail.position.set(x, 1.35, 0)
    rail.castShadow = true
    ladder.add(rail)
  }
  for (let rung = 0; rung < 8; rung += 1) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.035, 0.035), wood)
    bar.position.set(0, 0.28 + rung * 0.32, 0)
    ladder.add(bar)
  }
  const hook = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.018, 8, 14, Math.PI), brassMaterial)
  hook.position.set(0, 2.73, 0)
  ladder.add(hook)
  ladder.position.set(3.95, 0, -roomDepth / 2 + 0.36)
  ladder.rotation.x = -0.1
  ladder.rotation.z = 0.02
  scene.add(ladder)

  // Gramophone on a side table near the desk.
  const gramophone = new THREE.Group()
  const table = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 0.5), wood)
  table.position.y = 0.72
  table.castShadow = true
  gramophone.add(table)
  for (const x of [-0.28, 0.28]) {
    for (const z of [-0.18, 0.18]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.72, 0.05), woodDark)
      leg.position.set(x, 0.36, z)
      gramophone.add(leg)
    }
  }
  const gramoBase = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.28), woodDark)
  gramoBase.position.y = 0.8
  gramophone.add(gramoBase)
  const platter = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.13, 0.015, 24),
    new THREE.MeshStandardMaterial({ color: '#141210', roughness: 0.6 })
  )
  platter.position.y = 0.86
  gramophone.add(platter)
  const horn = new THREE.Mesh(
    new THREE.ConeGeometry(0.26, 0.46, 22, 1, true),
    new THREE.MeshStandardMaterial({
      color: '#8a6a35',
      roughness: 0.42,
      metalness: 0.55,
      side: THREE.DoubleSide
    })
  )
  horn.position.set(0.02, 1.18, -0.02)
  horn.rotation.set(0.55, 0, 0.35)
  horn.castShadow = true
  gramophone.add(horn)
  const crank = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.2, 8), brassMaterial)
  crank.position.set(0.2, 0.86, 0.16)
  crank.rotation.z = Math.PI / 2
  gramophone.add(crank)
  gramophone.position.set(-2.35, 0, 1.8)
  scene.add(gramophone)

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
      scene.add(shelvingBay(bay, wall, offset, books, cells, placements, anchors))
    })
  }

  const bookMesh = buildSpineBatch(placements, texture)

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

  const lampGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: warmGlowTexture(),
      color: '#ffc179',
      transparent: true,
      opacity: 0.62,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  )
  lampGlow.position.set(0.75, 1.36, -0.25)
  lampGlow.scale.set(1.5, 1.5, 1)
  desk.add(lampGlow)

  const openBook = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.02, 0.32),
    new THREE.MeshStandardMaterial({ color: '#d9c9a3', roughness: 0.9 })
  )
  openBook.position.set(-0.5, 0.84, 0.05)
  openBook.rotation.y = 0.2
  desk.add(openBook)

  scene.add(desk)

  const deskShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(3.3, 2.0),
    new THREE.MeshBasicMaterial({
      map: contactShadowTexture(),
      transparent: true,
      opacity: 0.65,
      depthWrite: false
    })
  )
  deskShadow.rotation.x = -Math.PI / 2
  deskShadow.position.set(0, 0.009, 0.1)
  deskShadow.renderOrder = 1
  scene.add(deskShadow)

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

  // Dust motes catch the lamp light and give the air some depth.
  let dust: THREE.Points | null = null
  if (quality !== 'low') {
    const count = quality === 'high' ? 320 : 190
    const positions = new Float32Array(count * 3)
    for (let index = 0; index < count; index += 1) {
      positions[index * 3] = (Math.random() - 0.5) * (roomWidth - 0.6)
      positions[index * 3 + 1] = Math.random() * (wallHeight - 0.3) + 0.15
      positions[index * 3 + 2] = (Math.random() - 0.5) * (roomDepth - 0.6)
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    dust = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        color: '#f0dfb9',
        size: quality === 'high' ? 0.016 : 0.012,
        transparent: true,
        opacity: 0.34,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true
      })
    )
    scene.add(dust)
  }

  return { group: scene, anchors, placements, bookMesh, texture, dust }
}

function qualitySettings(quality: string): { pixelRatio: number; shadows: boolean; shadowMap: number } {
  if (quality === 'low') return { pixelRatio: 1, shadows: false, shadowMap: 512 }
  if (quality === 'high') return { pixelRatio: 2, shadows: true, shadowMap: 2048 }
  return { pixelRatio: 1.5, shadows: true, shadowMap: 1024 }
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
    playSound('pull')
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

interface RoomStats {
  fps: number
  frameMs: number
  drawCalls: number
  triangles: number
  books: number
  bookBatches: number
}

export function RoomView({ library }: Props) {
  const floors = useLibraryStore((state) => state.layout)
  const books = useLibraryStore((state) => state.books)
  const refresh = useLibraryStore((state) => state.refresh)
  const selection = useUiStore((state) => state.room)
  const setRoom = useUiStore((state) => state.setRoom)
  const openShelfId = useUiStore((state) => state.openShelfId)
  const openShelf = useUiStore((state) => state.openShelf)
  const returningBookId = useUiStore((state) => state.returningBookId)
  const clearReturningBook = useUiStore((state) => state.clearReturningBook)
  const openBook = useReaderStore((state) => state.open)
  const quality = useSetting('ui.quality', 'auto')
  const reducedMotion = useSetting('ui.reducedMotion', 'false') === 'true'
  const mountRef = useRef<HTMLDivElement | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [deskOpen, setDeskOpen] = useState(false)
  const [stats, setStats] = useState<RoomStats | null>(null)
  const [showStats, setShowStats] = useState(false)

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

    const preset = qualitySettings(quality)
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#0c0a09')
    scene.fog = new THREE.Fog('#0c0a09', 9, 18)

    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 60)
    camera.position.set(0, 2.35, 6.1)

    const renderer = new THREE.WebGLRenderer({ antialias: quality !== 'low', powerPreference: 'high-performance' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, preset.pixelRatio))
    renderer.shadowMap.enabled = preset.shadows
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
    key.castShadow = preset.shadows
    key.shadow.mapSize.set(preset.shadowMap, preset.shadowMap)
    key.shadow.bias = -0.0004
    scene.add(key)

    const fill = new THREE.PointLight('#7c8ba0', 9, 13, 1.8)
    fill.position.set(-3.2, 2.8, 1.8)
    scene.add(fill)

    const built = buildScene(room, roomBooks, quality)
    scene.add(built.group)
    if (built.bookMesh) {
      built.bookMesh.userData.bookIds = built.placements.map((placement) => placement.book.id)
      built.bookMesh.userData.shelfIds = built.placements.map((placement) => placement.shelfId)
      built.bookMesh.userData.placements = built.placements
      scene.add(built.bookMesh)
    }

    const placementsByBook = new Map<number, SpinePlacement>()
    for (const placement of built.placements) placementsByBook.set(placement.book.id, placement)

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
      const hits = raycaster.intersectObjects(built.group.children, true)
      if (built.bookMesh) hits.push(...raycaster.intersectObject(built.bookMesh, false))
      hits.sort((a, b) => a.distance - b.distance)

      for (const hit of hits) {
        if (hit.object === built.bookMesh && hit.faceIndex != null) {
          const index = Math.floor(hit.faceIndex / 12)
          const placement = built.placements[index]
          if (placement) return { bookId: placement.book.id, shelfId: placement.shelfId }
          continue
        }
        const data = hit.object.userData as { bookId?: number; shelfId?: number }
        if (data.bookId) return { bookId: data.bookId, shelfId: data.shelfId }
        if (data.shelfId) return { shelfId: data.shelfId }
      }
      return null
    }

    let travel: {
      from: THREE.Vector3
      to: THREE.Vector3
      targetFrom: THREE.Vector3
      targetTo: THREE.Vector3
      start: number
      duration: number
    } | null = null

    const flyTo = (shelfId: number): void => {
      const anchor = built.anchors.get(shelfId)
      if (!anchor) return
      if (reducedMotion) {
        camera.position.copy(anchor.position)
        controls.target.copy(anchor.target)
        controls.update()
        return
      }
      travel = {
        from: camera.position.clone(),
        to: anchor.position.clone(),
        targetFrom: controls.target.clone(),
        targetTo: anchor.target.clone(),
        start: performance.now(),
        duration: 850
      }
      controls.enabled = false
    }

    // Enter the hall from the doorway, then settle into the reading position.
    if (!reducedMotion) {
      camera.position.set(0, 3.1, 8.4)
      travel = {
        from: camera.position.clone(),
        to: new THREE.Vector3(0, 2.35, 6.1),
        targetFrom: new THREE.Vector3(0, 1.55, 0),
        targetTo: new THREE.Vector3(0, 1.25, 0),
        start: performance.now(),
        duration: 1100
      }
      controls.enabled = false
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
        color: bookColors[book.id % bookColors.length],
        roughness: 0.68,
        metalness: 0.04
      })

    const pullBook = (placement: SpinePlacement, book: Book): void => {
      const proxy = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.3, 0.22), proxyMaterial(book))
      proxy.position.copy(placement.position).addScaledVector(placement.normal, 0.02)
      proxy.rotation.y = Math.atan2(placement.normal.x, placement.normal.z)
      proxy.castShadow = true
      scene.add(proxy)

      const forward = new THREE.Vector3()
      camera.getWorldDirection(forward)
      const destination = camera.position
        .clone()
        .addScaledVector(forward, 1.05)
        .add(new THREE.Vector3(0, -0.25, 0))

      pull = {
        mesh: proxy,
        from: proxy.position.clone(),
        to: destination,
        start: performance.now(),
        duration: 460,
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
      const proxy = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.3, 0.22), proxyMaterial(book))
      const forward = new THREE.Vector3()
      camera.getWorldDirection(forward)
      proxy.position.copy(camera.position).addScaledVector(forward, 1.05)
      scene.add(proxy)

      clearReturningBook()

      if (reducedMotion) {
        scene.remove(proxy)
        proxy.geometry.dispose()
        ;(proxy.material as THREE.Material).dispose()
        flyTo(placement.shelfId)
        return
      }

      arrive = {
        mesh: proxy,
        from: proxy.position.clone(),
        to: placement.position.clone().addScaledVector(placement.normal, 0.02),
        start: performance.now(),
        duration: 480,
        bookId: book.id,
        page: null,
        opened: true
      }
      flyTo(placement.shelfId)
    }

    const onPointerMove = (event: PointerEvent): void => {
      if (travel || pull) return
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
      if (pull) return
      const target = pick(event)
      if (!target) return

      if (target.bookId) {
        const book = roomBooks.find((entry) => entry.id === target.bookId)
        const placement = placementsByBook.get(target.bookId)
        if (!book || !placement) return

        playSound('pull')
        if (reducedMotion) {
          openBook(book.id, book.lastPage)
          navigate('reader')
          return
        }
        flyTo(placement.shelfId)
        pullBook(placement, book)
      } else if (target.shelfId) {
        playSound('tick')
        openShelf(target.shelfId)
        flyTo(target.shelfId)
      }
    }

    renderer.domElement.addEventListener('pointermove', onPointerMove)
    renderer.domElement.addEventListener('click', onClick)

    // Arrow keys walk the shelves, so the room is usable without a mouse.
    const shelfIds = [...built.anchors.keys()].sort((a, b) => a - b)
    let shelfCursor = -1
    const onKeyDown = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')
      ) {
        return
      }
      if (event.key === 'Escape') {
        openShelf(null)
        return
      }
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
      if (shelfIds.length === 0) return
      event.preventDefault()
      shelfCursor =
        event.key === 'ArrowRight'
          ? (shelfCursor + 1) % shelfIds.length
          : (shelfCursor - 1 + shelfIds.length) % shelfIds.length
      const shelfId = shelfIds[shelfCursor]
      if (shelfId === undefined) return
      playSound('tick')
      openShelf(shelfId)
      flyTo(shelfId)
    }
    window.addEventListener('keydown', onKeyDown)

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
    let lastRender = 0
    let frames = 0
    let since = performance.now()
    let frameMs = 0

    const animate = (now: number): void => {
      frame = requestAnimationFrame(animate)

      if (document.hidden) return
      const interval = document.hasFocus() ? 0 : 1000 / 15
      if (interval > 0 && now - lastRender < interval) return
      const delta = lastRender === 0 ? 16 : now - lastRender
      lastRender = now
      frameMs = frameMs === 0 ? delta : frameMs * 0.9 + delta * 0.1

      if (travel) {
        const progress = Math.min(1, (now - travel.start) / travel.duration)
        const eased = progress * progress * (3 - 2 * progress)
        camera.position.lerpVectors(travel.from, travel.to, eased)
        controls.target.lerpVectors(travel.targetFrom, travel.targetTo, eased)
        camera.lookAt(controls.target)
        if (progress >= 1) {
          travel = null
          controls.enabled = true
          controls.update()
        }
      } else {
        controls.update()
      }

      if (pull) {
        const progress = Math.min(1, (now - pull.start) / pull.duration)
        const eased = progress * progress * (3 - 2 * progress)
        pull.mesh.position.lerpVectors(pull.from, pull.to, eased)
        pull.mesh.rotation.y += 0.012
        pull.mesh.scale.setScalar(1 + eased * 1.6)
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
          }, 90)
        }
      }

      if (arrive) {
        const progress = Math.min(1, (now - arrive.start) / arrive.duration)
        const eased = progress * progress * (3 - 2 * progress)
        arrive.mesh.position.lerpVectors(arrive.from, arrive.to, eased)
        arrive.mesh.scale.setScalar(2.6 - eased * 1.6)
        if (progress >= 1) {
          scene.remove(arrive.mesh)
          arrive.mesh.geometry.dispose()
          ;(arrive.mesh.material as THREE.Material).dispose()
          arrive = null
          playSound('thud')
        }
      }

      if (built.dust) {
        built.dust.rotation.y += 0.00045
        built.dust.position.y = Math.sin(now / 5200) * 0.06
      }

      renderer.render(scene, camera)

      frames += 1
      if (now - since >= 500) {
        const snapshot: RoomStats = {
          fps: Math.round((frames * 1000) / Math.max(1, now - since)),
          frameMs: Math.round(frameMs * 10) / 10,
          drawCalls: renderer.info.render.calls,
          triangles: renderer.info.render.triangles,
          books: built.placements.length,
          bookBatches: built.bookMesh ? 1 : 0
        }
        if (import.meta.env.DEV) setStats(snapshot)
        ;(window as unknown as { __alexandriaRoomStats?: () => RoomStats }).__alexandriaRoomStats =
          () => snapshot
        frames = 0
        since = now
      }
    }

    placeArrivingBook()
    animate(performance.now())

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      if (navigateTimer) clearTimeout(navigateTimer)
      renderer.domElement.removeEventListener('pointermove', onPointerMove)
      renderer.domElement.removeEventListener('click', onClick)
      window.removeEventListener('keydown', onKeyDown)
      controls.dispose()
      const shared = new Set<THREE.Material>([
        wood,
        woodDark,
        wallMaterial,
        floorMaterial,
        brassMaterial
      ])
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Points) {
          object.geometry.dispose()
        }
        const material = (object as { material?: THREE.Material | THREE.Material[] }).material
        if (!material) return
        const materials = Array.isArray(material) ? material : [material]
        for (const entry of materials) {
          if (!shared.has(entry)) entry.dispose()
        }
      })
      built.texture.dispose()
      renderer.dispose()
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement)
      setHovered(null)
      setStats(null)
    }
  }, [
    room,
    roomBooks,
    openBook,
    openShelf,
    clearReturningBook,
    returningBookId,
    reducedMotion,
    quality
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

  return (
    <div className="room room--scene">
      <div className="room__canvas" ref={mountRef} />
      <div
        key={room?.id ?? 'room'}
        className={reducedMotion ? 'room__fade' : 'room__fade room__fade--animate'}
        aria-hidden="true"
      />

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
          {import.meta.env.DEV ? (
            <button
              className="button button--quiet"
              type="button"
              onClick={() => setShowStats((current) => !current)}
              aria-pressed={showStats}
            >
              Stats
            </button>
          ) : null}
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

      <p className="room__hint">
        Drag to look · click a book to read · ← → to walk the shelves · Esc to close
      </p>

      {hovered ? <div className="room__tooltip">{hovered}</div> : null}

      {showStats && stats ? (
        <div className="room__stats" role="status">
          <span>{stats.fps} fps</span>
          <span>{stats.frameMs} ms</span>
          <span>{stats.drawCalls} draws</span>
          <span>{stats.triangles.toLocaleString()} tris</span>
        </div>
      ) : null}

      {openShelfId !== null ? (
        <ShelfDrawer shelfId={openShelfId} onClose={() => openShelf(null)} />
      ) : null}

      {deskOpen ? <DeskDrawer onClose={() => setDeskOpen(false)} /> : null}
    </div>
  )
}
