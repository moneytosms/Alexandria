import type { Bay, Book, Room, Section, Shelf, Wall } from '@shared/types'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { MiniMapMarker } from '../components/MiniMapHud'
import {
  HALL_MOOD_RIGS,
  HALL_THEME_PALETTES,
  type HallMood,
  type HallTheme,
  type HallThemePalette
} from './atmosphere'
import {
  EYE_HEIGHT,
  GALLERY_Y,
  HALL_OBSTACLES,
  ROOM_DEPTH,
  ROOM_WIDTH,
  STAIR_SPEC,
  WALKWAY_DEPTH,
  WALL_HEIGHT
} from './physics'

export { GALLERY_Y, HALL_OBSTACLES, ROOM_DEPTH, ROOM_WIDTH, WALKWAY_DEPTH, WALL_HEIGHT }

export const BOOK_COLORS = [
  '#7a2f26',
  '#2d4c3b',
  '#353e63',
  '#7c592d',
  '#2c4d5c',
  '#633a2a',
  '#563854',
  '#465432',
  '#6c4438',
  '#2e3d4f'
]

const ATLAS_COLUMNS = 32
const ATLAS_ROWS = 16
const ATLAS_CELL_W = 64
const ATLAS_CELL_H = 128
const ATLAS_CELL_COUNT = ATLAS_COLUMNS * ATLAS_ROWS

export function shelfDisplayName(shelf: Pick<Shelf, 'label' | 'rowIndex'>): string {
  const custom = shelf.label?.trim()
  return custom && custom.length > 0 ? custom : `Shelf ${shelf.rowIndex + 1}`
}

export interface SpineCell {
  u0: number
  v0: number
  u1: number
  v1: number
  centerU: number
  centerV: number
}

export interface SpinePlacement {
  book: Book
  shelfId: number
  matrix: THREE.Matrix4
  position: THREE.Vector3
  normal: THREE.Vector3
  size: THREE.Vector3
  cell: SpineCell
}

export interface RoomAnchor {
  id: string
  label: string
  meta?: string
  kind: 'overview' | 'shelf' | 'desk' | 'globe' | 'gramophone' | 'fireplace' | 'balcony' | 'stairs'
  shelfId?: number
  level: 1 | 2
  position: THREE.Vector3
  lookAt: THREE.Vector3
}

export interface BuiltRoomScene {
  group: THREE.Group
  interactables: THREE.Object3D[]
  floorMesh: THREE.Mesh
  anchors: RoomAnchor[]
  shelfAnchors: Map<number, RoomAnchor>
  miniMapMarkers: MiniMapMarker[]
  placements: SpinePlacement[]
  bookMesh: THREE.Mesh | null
  dust: THREE.Points | null
  rainLines: THREE.LineSegments | null
  platter: THREE.Mesh | null
  globeSphere: THREE.Mesh | null
  lampGlows: THREE.Sprite[]
  windowHalos: THREE.Sprite[]
  hearthLight: THREE.PointLight | null
  hearthFlame: THREE.Mesh | null
  disposables: {
    textures: THREE.Texture[]
    materials: THREE.Material[]
    geometries: THREE.BufferGeometry[]
  }
}

function truncate(text: string, length: number): string {
  const value = text.trim()
  return value.length > length ? `${value.slice(0, length - 1)}…` : value
}

function createRadialTexture(stops: Array<[number, string]>): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const gradient = ctx.createRadialGradient(64, 64, 2, 64, 64, 64)
    for (const [offset, color] of stops) gradient.addColorStop(offset, color)
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 128, 128)
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function createGrandFloorTexture(anisotropy: number, palette: HallThemePalette): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.fillStyle = palette.floorBase
    ctx.fillRect(0, 0, 512, 512)

    if (palette.floorMode === 'marble') {
      // Honed travertine marble ashlar tiles with soft warm veining
      const tile = 128
      for (let row = 0; row < 4; row += 1) {
        for (let col = 0; col < 4; col += 1) {
          const x = col * tile
          const y = row * tile
          const tone = 204 + (((row * 7 + col * 13) % 14) - 6)
          ctx.fillStyle = `rgb(${tone}, ${tone - 7}, ${tone - 18})`
          ctx.fillRect(x + 2, y + 2, tile - 4, tile - 4)
          // Subtle warm mineral vein
          ctx.strokeStyle = 'rgba(155, 140, 118, 0.18)'
          ctx.lineWidth = 1.6
          ctx.beginPath()
          ctx.moveTo(x + 8, y + ((row * 31 + col * 19) % 90) + 12)
          ctx.bezierCurveTo(x + 48, y + 36, x + 84, y + 92, x + tile - 8, y + 72)
          ctx.stroke()
          ctx.strokeStyle = 'rgba(130, 115, 95, 0.35)'
          ctx.lineWidth = 2
          ctx.strokeRect(x, y, tile, tile)
        }
      }
    } else {
      // Parquet / smoked ebony planks
      const tile = 128
      const [rShift, gMul, bMul] = palette.floorSlatTint
      const baseVal = palette.floorMode === 'ebony' ? 32 : 58
      for (let row = 0; row < 4; row += 1) {
        for (let col = 0; col < 4; col += 1) {
          const x = col * tile
          const y = row * tile
          const horizontal = (row + col) % 2 === 0
          const slats = 4
          const slatSize = tile / slats
          for (let s = 0; s < slats; s += 1) {
            const shade = baseVal + (((row * 7 + col * 11 + s * 19) % 16) - 6)
            ctx.fillStyle = `rgb(${Math.round(shade + rShift)}, ${Math.round(shade * gMul)}, ${Math.round(shade * bMul)})`
            if (horizontal) {
              ctx.fillRect(x + 1, y + s * slatSize + 1, tile - 2, slatSize - 2)
            } else {
              ctx.fillRect(x + s * slatSize + 1, y + 1, slatSize - 2, tile - 2)
            }
          }
          ctx.strokeStyle =
            palette.floorMode === 'ebony' ? 'rgba(152, 117, 86, 0.24)' : 'rgba(18, 11, 7, 0.55)'
          ctx.lineWidth = 2
          ctx.strokeRect(x, y, tile, tile)
        }
      }
      for (let i = 0; i < 180; i += 1) {
        const gx = (i * 83) % 512
        const gy = (i * 47) % 512
        ctx.fillStyle = i % 2 === 0 ? 'rgba(235,190,135,0.035)' : 'rgba(12,7,4,0.06)'
        ctx.fillRect(gx, gy, 44, 1.5)
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(5.5, 4.8)
  tex.anisotropy = anisotropy
  return tex
}

function createGrandWallTexture(anisotropy: number, palette: HallThemePalette): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, 512)
    grad.addColorStop(0, palette.wallStops[0])
    grad.addColorStop(0.45, palette.wallStops[1])
    grad.addColorStop(0.54, palette.wallStops[2])
    grad.addColorStop(0.56, palette.wallStops[3])
    grad.addColorStop(1, palette.wallStops[4])
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 512, 512)

    // Subtle stone & plaster texture blocks in upper half
    for (let i = 0; i < 640; i += 1) {
      const x = (i * 97) % 512
      const y = (i * 43) % 280
      const w = 16 + (i % 28)
      const h = 10 + ((i * 5) % 18)
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,236,208,0.025)' : 'rgba(10,8,6,0.04)'
      ctx.fillRect(x, y, w, h)
    }

    // Horizontal gilt cornice molding band
    ctx.fillStyle = palette.wallCornice
    ctx.fillRect(0, 276, 512, 10)
    ctx.fillStyle = 'rgba(218, 178, 114, 0.4)'
    ctx.fillRect(0, 278, 512, 2)
    ctx.fillStyle = 'rgba(0,0,0,0.32)'
    ctx.fillRect(0, 286, 512, 5)

    // Recessed architectural wainscoting panels in lower half
    for (let p = 0; p < 4; p += 1) {
      const px = p * 128 + 14
      ctx.fillStyle = palette.wallPanel
      ctx.fillRect(px, 304, 100, 186)
      ctx.strokeStyle = 'rgba(196,158,104,0.26)'
      ctx.lineWidth = 2
      ctx.strokeRect(px, 304, 100, 186)
      ctx.strokeStyle = 'rgba(0,0,0,0.32)'
      ctx.strokeRect(px + 6, 310, 88, 174)
    }
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.ClampToEdgeWrapping
  tex.repeat.set(4, 1)
  tex.anisotropy = anisotropy
  return tex
}

function createRunnerRugTexture(anisotropy: number, palette: HallThemePalette): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 1024
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.fillStyle = palette.rugField
    ctx.fillRect(0, 0, 512, 1024)

    ctx.strokeStyle = palette.rugOuterBorder
    ctx.lineWidth = 14
    ctx.strokeRect(20, 20, 472, 984)
    ctx.strokeStyle = palette.rugInnerBorder
    ctx.lineWidth = 28
    ctx.strokeRect(48, 48, 416, 928)
    ctx.strokeStyle = palette.rugAccent
    ctx.lineWidth = 4
    ctx.strokeRect(72, 72, 368, 880)

    ctx.fillStyle = palette.rugAccent
    for (let y = 52; y <= 972; y += 28) {
      ctx.fillRect(44, y - 3, 7, 7)
      ctx.fillRect(461, y - 3, 7, 7)
    }
    for (let x = 52; x <= 460; x += 28) {
      ctx.fillRect(x - 3, 44, 7, 7)
      ctx.fillRect(x - 3, 973, 7, 7)
    }

    for (const cy of [256, 512, 768]) {
      ctx.save()
      ctx.translate(256, cy)
      ctx.rotate(Math.PI / 4)
      ctx.fillStyle = palette.rugMedallion
      ctx.fillRect(-76, -76, 152, 152)
      ctx.strokeStyle = palette.rugOuterBorder
      ctx.lineWidth = 6
      ctx.strokeRect(-76, -76, 152, 152)
      ctx.fillStyle = palette.rugField
      ctx.fillRect(-42, -42, 84, 84)
      ctx.strokeStyle = palette.rugAccent
      ctx.lineWidth = 4
      ctx.strokeRect(-42, -42, 84, 84)
      ctx.restore()
    }

    for (let y = 0; y < 1024; y += 4) {
      ctx.fillStyle = y % 8 === 0 ? 'rgba(0,0,0,0.07)' : 'rgba(255,235,200,0.03)'
      ctx.fillRect(0, y, 512, 2)
    }
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = anisotropy
  return tex
}

function createWindowTexture(anisotropy: number, mood: HallMood): THREE.CanvasTexture {
  const rig = HALL_MOOD_RIGS[mood]
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 512
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const sky = ctx.createLinearGradient(0, 0, 0, 512)
    sky.addColorStop(0, rig.windowStops[0])
    sky.addColorStop(0.5, rig.windowStops[1])
    sky.addColorStop(0.84, rig.windowStops[2])
    sky.addColorStop(1, rig.windowStops[3])
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, 256, 512)

    // Subtle clouds or storm mist
    if (mood === 'storm') {
      for (let i = 0; i < 24; i += 1) {
        ctx.fillStyle = 'rgba(130, 160, 210, 0.08)'
        ctx.beginPath()
        ctx.ellipse((i * 47) % 256, (i * 29) % 340, 48, 16, 0, 0, Math.PI * 2)
        ctx.fill()
      }
    } else if (mood === 'dusk' || mood === 'dawn') {
      for (let i = 0; i < 14; i += 1) {
        ctx.fillStyle = 'rgba(255, 240, 210, 0.25)'
        ctx.fillRect((i * 53) % 240, (i * 17) % 160, 2, 2)
      }
    }

    // Leaded diamond glass pattern
    ctx.strokeStyle = mood === 'afternoon' ? 'rgba(42, 46, 56, 0.16)' : 'rgba(24, 30, 44, 0.28)'
    ctx.lineWidth = 2
    for (let i = -512; i < 512; i += 32) {
      ctx.beginPath()
      ctx.moveTo(0, i)
      ctx.lineTo(256, i + 256)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(256, i)
      ctx.lineTo(0, i + 256)
      ctx.stroke()
    }
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = anisotropy
  return tex
}

function createOculusTexture(
  anisotropy: number,
  palette: HallThemePalette,
  mood: HallMood
): THREE.CanvasTexture {
  const rig = HALL_MOOD_RIGS[mood]
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const grad = ctx.createRadialGradient(256, 256, 12, 256, 256, 256)
    grad.addColorStop(0, rig.oculusEmissive)
    grad.addColorStop(0.7, rig.oculusColor)
    grad.addColorStop(1, rig.windowStops[0])
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 512, 512)

    const starStrength = palette.starfieldOculus ? Math.max(0.75, rig.starsOpacity) : rig.starsOpacity
    if (starStrength > 0.05) {
      // Celestial rings & starfield constellations
      ctx.strokeStyle = `rgba(220, 194, 144, ${starStrength * 0.45})`
      ctx.lineWidth = 2
      for (const r of [90, 155, 215]) {
        ctx.beginPath()
        ctx.arc(256, 256, r, 0, Math.PI * 2)
        ctx.stroke()
      }
      for (let i = 0; i < 140; i += 1) {
        const a = i * 2.39996
        const rad = Math.sqrt(i / 140) * 238
        const sx = 256 + Math.cos(a) * rad
        const sy = 256 + Math.sin(a) * rad
        const size = i % 7 === 0 ? 3 : i % 3 === 0 ? 2 : 1.3
        ctx.fillStyle = `rgba(255, 246, 224, ${starStrength * (0.45 + (i % 5) * 0.11)})`
        ctx.beginPath()
        ctx.arc(sx, sy, size, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = anisotropy
  return tex
}

function createBrassPlaqueTexture(
  title: string,
  anisotropy: number,
  palette: HallThemePalette,
  wide = false
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = wide ? 512 : 384
  canvas.height = wide ? 96 : 64
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
    grad.addColorStop(0, palette.plaqueGradient[0])
    grad.addColorStop(0.45, palette.plaqueGradient[1])
    grad.addColorStop(0.75, palette.plaqueGradient[2])
    grad.addColorStop(1, palette.plaqueGradient[3])
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    for (let y = 0; y < canvas.height; y += 3) {
      ctx.fillStyle = y % 6 === 0 ? 'rgba(255,245,215,0.08)' : 'rgba(40,26,10,0.06)'
      ctx.fillRect(0, y, canvas.width, 1)
    }

    ctx.strokeStyle = palette.plaqueInk
    ctx.lineWidth = wide ? 5 : 4
    ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8)
    ctx.strokeStyle = 'rgba(255, 240, 200, 0.42)'
    ctx.lineWidth = 1.5
    ctx.strokeRect(9, 9, canvas.width - 18, canvas.height - 18)

    const r = wide ? 4.5 : 3.2
    ctx.fillStyle = palette.plaqueInk
    for (const [rx, ry] of [
      [18, canvas.height / 2],
      [canvas.width - 18, canvas.height / 2]
    ]) {
      ctx.beginPath()
      ctx.arc(rx, ry, r, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.fillStyle = palette.plaqueInk
    ctx.font = wide ? '700 34px Georgia, serif' : '700 26px Georgia, serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(truncate(title.toUpperCase(), wide ? 26 : 22), canvas.width / 2, canvas.height / 2 + 1)
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = anisotropy
  return tex
}

function createGlobeTexture(anisotropy: number, palette: HallThemePalette): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 256
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const isCelestial = palette.id === 'observatory'
    const ocean = ctx.createLinearGradient(0, 0, 0, 256)
    ocean.addColorStop(0, isCelestial ? '#1b2745' : '#c8b48c')
    ocean.addColorStop(0.5, isCelestial ? '#141d35' : '#b69e74')
    ocean.addColorStop(1, isCelestial ? '#1b2745' : '#c8b48c')
    ctx.fillStyle = ocean
    ctx.fillRect(0, 0, 512, 256)

    if (isCelestial) {
      // Celestial star charts on Observatory globe
      ctx.strokeStyle = 'rgba(218, 184, 126, 0.45)'
      ctx.lineWidth = 1.5
      for (let i = 0; i < 65; i += 1) {
        const sx = (i * 89) % 500 + 6
        const sy = (i * 53) % 236 + 10
        ctx.fillStyle = '#f2deb4'
        ctx.beginPath()
        ctx.arc(sx, sy, i % 5 === 0 ? 2.4 : 1.4, 0, Math.PI * 2)
        ctx.fill()
      }
    } else {
      ctx.fillStyle = '#7b633f'
      const blobs: Array<[number, number, number, number]> = [
        [120, 88, 62, 42],
        [152, 162, 34, 48],
        [272, 86, 74, 38],
        [280, 148, 42, 46],
        [378, 102, 68, 44],
        [414, 178, 36, 26]
      ]
      for (const [cx, cy, rx, ry] of blobs) {
        ctx.beginPath()
        ctx.ellipse(cx, cy, rx, ry, 0.2, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = '#4e3b22'
        ctx.lineWidth = 2
        ctx.stroke()
      }
    }

    ctx.strokeStyle = isCelestial ? 'rgba(218, 184, 126, 0.35)' : 'rgba(60, 42, 22, 0.35)'
    ctx.lineWidth = 1.2
    for (let x = 0; x <= 512; x += 32) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, 256)
      ctx.stroke()
    }
    for (let y = 32; y < 256; y += 32) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(512, y)
      ctx.stroke()
    }
    ctx.strokeStyle = isCelestial ? 'rgba(224, 178, 112, 0.8)' : 'rgba(138, 60, 42, 0.55)'
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.moveTo(0, 128)
    ctx.lineTo(512, 128)
    ctx.stroke()
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = anisotropy
  return tex
}

function bookSpineColor(book: Book): string {
  // Deterministic rich bookbinding color incorporating title hash + id so every book feels distinct
  let hash = book.id * 37
  for (let i = 0; i < book.title.length; i += 1) {
    hash = (hash * 31 + book.title.charCodeAt(i)) >>> 0
  }
  return BOOK_COLORS[hash % BOOK_COLORS.length]
}

function buildSpineAtlas(
  books: Book[],
  anisotropy: number
): { texture: THREE.CanvasTexture; cells: Map<number, SpineCell> } {
  const canvas = document.createElement('canvas')
  canvas.width = ATLAS_COLUMNS * ATLAS_CELL_W
  canvas.height = ATLAS_ROWS * ATLAS_CELL_H
  const ctx = canvas.getContext('2d')
  const cells = new Map<number, SpineCell>()

  if (ctx) {
    ctx.fillStyle = '#18120e'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    books.forEach((book, index) => {
      const cellIndex = index % ATLAS_CELL_COUNT
      const col = cellIndex % ATLAS_COLUMNS
      const row = Math.floor(cellIndex / ATLAS_COLUMNS)
      const x = col * ATLAS_CELL_W
      const y = row * ATLAS_CELL_H
      const base = bookSpineColor(book)

      ctx.fillStyle = base
      ctx.fillRect(x, y, ATLAS_CELL_W, ATLAS_CELL_H)

      // Subtle leather / cloth weave texture grain
      for (let gy = y; gy < y + ATLAS_CELL_H; gy += 3) {
        ctx.fillStyle = gy % 6 === 0 ? 'rgba(255,245,225,0.035)' : 'rgba(0,0,0,0.06)'
        ctx.fillRect(x, gy, ATLAS_CELL_W, 1)
      }

      // Curved spine lighting gradient
      const shade = ctx.createLinearGradient(x, y, x + ATLAS_CELL_W, y)
      shade.addColorStop(0, 'rgba(0,0,0,0.42)')
      shade.addColorStop(0.26, 'rgba(255,245,225,0.16)')
      shade.addColorStop(0.74, 'rgba(0,0,0,0.12)')
      shade.addColorStop(1, 'rgba(0,0,0,0.48)')
      ctx.fillStyle = shade
      ctx.fillRect(x, y, ATLAS_CELL_W, ATLAS_CELL_H)

      // Raised leather spine ribs & gold-leaf bands
      ctx.fillStyle = 'rgba(226, 192, 128, 0.92)'
      ctx.fillRect(x + 2, y + 10, ATLAS_CELL_W - 4, 2.5)
      ctx.fillRect(x + 2, y + 15, ATLAS_CELL_W - 4, 1.2)
      ctx.fillRect(x + 2, y + ATLAS_CELL_H - 24, ATLAS_CELL_W - 4, 1.2)
      ctx.fillRect(x + 2, y + ATLAS_CELL_H - 18, ATLAS_CELL_W - 4, 2.5)

      // Subtle dark recessed title cartouche
      ctx.fillStyle = 'rgba(12, 8, 5, 0.24)'
      ctx.fillRect(x + 6, y + 20, ATLAS_CELL_W - 12, ATLAS_CELL_H - 48)
      ctx.strokeStyle = 'rgba(226, 192, 128, 0.32)'
      ctx.lineWidth = 1
      ctx.strokeRect(x + 6.5, y + 20.5, ATLAS_CELL_W - 13, ATLAS_CELL_H - 49)

      // Title along spine
      ctx.save()
      ctx.translate(x + ATLAS_CELL_W * 0.62, y + 26)
      ctx.rotate(Math.PI / 2)
      ctx.fillStyle = '#f7ebd2'
      ctx.font = '700 10px Georgia, serif'
      ctx.textBaseline = 'middle'
      ctx.fillText(truncate(book.title, 13), 0, 0)
      ctx.restore()

      // Author along spine
      if (book.author) {
        ctx.save()
        ctx.translate(x + ATLAS_CELL_W * 0.3, y + 27)
        ctx.rotate(Math.PI / 2)
        ctx.fillStyle = 'rgba(235, 218, 186, 0.78)'
        ctx.font = '500 7.5px Georgia, serif'
        ctx.textBaseline = 'middle'
        ctx.fillText(truncate(book.author, 15), 0, 0)
        ctx.restore()
      }

      // Reading progress & state emblems on spine!
      if (book.readingState === 'finished') {
        // Embossed gold star at spine crown
        ctx.fillStyle = '#f2cf7e'
        ctx.font = '700 11px Georgia, serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('★', x + ATLAS_CELL_W / 2, y + 6)
        ctx.textAlign = 'start'
        // Complete golden progress rule
        ctx.fillStyle = '#e5be6a'
        ctx.fillRect(x + 6, y + ATLAS_CELL_H - 11, ATLAS_CELL_W - 12, 4)
      } else if (book.readingState === 'reading' || book.lastPage > 1) {
        const pct =
          book.pageCount && book.pageCount > 0
            ? Math.max(0.12, Math.min(1, book.lastPage / book.pageCount))
            : 0.35
        // Progress track + gilded fill bar at spine foot
        ctx.fillStyle = 'rgba(0, 0, 0, 0.48)'
        ctx.fillRect(x + 6, y + ATLAS_CELL_H - 11, ATLAS_CELL_W - 12, 4)
        ctx.fillStyle = '#ebd08a'
        ctx.fillRect(x + 6, y + ATLAS_CELL_H - 11, Math.round((ATLAS_CELL_W - 12) * pct), 4)
      }

      if (book.deskPinned) {
        ctx.fillStyle = '#ffe099'
        ctx.beginPath()
        ctx.arc(x + ATLAS_CELL_W - 9, y + 6, 2.5, 0, Math.PI * 2)
        ctx.fill()
      }

      cells.set(book.id, {
        u0: x / canvas.width,
        v0: 1 - (y + ATLAS_CELL_H) / canvas.height,
        u1: (x + ATLAS_CELL_W) / canvas.width,
        v1: 1 - y / canvas.height,
        centerU: (x + 4) / canvas.width,
        centerV: 1 - (y + 4) / canvas.height
      })
    })
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = anisotropy
  texture.needsUpdate = true
  return { texture, cells }
}

function buildSpineBatch(
  placements: SpinePlacement[],
  texture: THREE.Texture
): THREE.Mesh | null {
  if (placements.length === 0) return null

  const base = new THREE.BoxGeometry(1, 1, 1)
  const geometries: THREE.BufferGeometry[] = []

  for (const placement of placements) {
    const geometry = base.clone()
    const uv = geometry.attributes.uv as THREE.BufferAttribute
    const { u0, v0, u1, v1, centerU, centerV } = placement.cell

    for (let i = 0; i < uv.count; i += 1) {
      uv.setXY(i, centerU, centerV)
    }

    for (let i = 16; i < 20; i += 1) {
      const px = geometry.attributes.position.getX(i)
      const py = geometry.attributes.position.getY(i)
      uv.setXY(i, u0 + (px + 0.5) * (u1 - u0), v0 + (py + 0.5) * (v1 - v0))
    }
    uv.needsUpdate = true
    geometry.applyMatrix4(placement.matrix)
    geometries.push(geometry)
  }

  base.dispose()
  const merged = mergeGeometries(geometries, false)
  geometries.forEach((g) => g.dispose())
  if (!merged) return null

  const material = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.6,
    metalness: 0.08
  })
  const mesh = new THREE.Mesh(merged, material)
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.userData.spineBatch = true
  return mesh
}

interface VisibleBaySpec {
  bay: Bay
  section: Section
  wall: Wall
  shelves: Shelf[]
  booksByShelf: Map<number, Book[]>
}

function computeScaledBays(room: Room, books: Book[]): VisibleBaySpec[] {
  const booksByShelf = new Map<number, Book[]>()
  for (const book of books) {
    if (book.shelfId === null) continue
    const list = booksByShelf.get(book.shelfId) ?? []
    list.push(book)
    booksByShelf.set(book.shelfId, list)
  }
  for (const list of booksByShelf.values()) {
    list.sort((a, b) => a.slotIndex - b.slotIndex)
  }

  const allBayEntries: Array<{
    bay: Bay
    section: Section
    occupiedCount: number
    hasNamedShelf: boolean
    isCustomSection: boolean
  }> = []
  for (const section of room.sections) {
    const isCustomSection =
      section.name !== 'North Wall' &&
      section.name !== 'East Wall' &&
      section.name !== 'South Wall' &&
      section.name !== 'West Wall'
    for (const bay of section.bays) {
      let occupiedCount = 0
      let hasNamedShelf = false
      for (const shelf of bay.shelves) {
        occupiedCount += (booksByShelf.get(shelf.id) ?? []).length
        if (shelf.label && shelf.label.trim().length > 0) hasNamedShelf = true
      }
      allBayEntries.push({ bay, section, occupiedCount, hasNamedShelf, isCustomSection })
    }
  }

  if (allBayEntries.length === 0) return []

  const activeEntries = allBayEntries.filter(
    (entry) => entry.occupiedCount > 0 || entry.hasNamedShelf || entry.isCustomSection
  )
  if (activeEntries.length === 0) {
    activeEntries.push(allBayEntries[0])
  } else {
    const lastActive = activeEntries[activeEntries.length - 1]
    const lastCap = lastActive.bay.shelves.reduce((sum, s) => sum + s.capacity, 0)
    if (lastCap > 0 && lastActive.occupiedCount >= Math.floor(lastCap * 0.8)) {
      const nextUnused = allBayEntries.find((e) => !activeEntries.includes(e))
      if (nextUnused) activeEntries.push(nextUnused)
    }
  }

  return activeEntries.map(({ bay, section }) => {
    const orderedShelves = [...bay.shelves].sort((a, b) => a.rowIndex - b.rowIndex)
    let highestRelevant = -1
    let lastShelfNearFull = false

    orderedShelves.forEach((shelf, idx) => {
      const count = (booksByShelf.get(shelf.id) ?? []).length
      const hasName = Boolean(shelf.label && shelf.label.trim().length > 0)
      if (count > 0 || hasName) {
        highestRelevant = idx
        if (count > 0) {
          lastShelfNearFull = count >= Math.max(1, Math.floor(shelf.capacity * 0.75))
        }
      }
    })

    const neededRows =
      highestRelevant < 0
        ? 1
        : Math.min(orderedShelves.length, highestRelevant + 1 + (lastShelfNearFull ? 1 : 0))

    const visibleShelves = orderedShelves.slice(0, Math.max(1, neededRows))
    const localMap = new Map<number, Book[]>()
    for (const s of visibleShelves) {
      localMap.set(s.id, booksByShelf.get(s.id) ?? [])
    }

    return {
      bay,
      section,
      wall: section.wall,
      shelves: visibleShelves,
      booksByShelf: localMap
    }
  })
}

export function buildLibraryScene(
  room: Room,
  books: Book[],
  quality: string,
  maxAnisotropy: number,
  isSoftwareGl: boolean,
  theme: HallTheme = 'dark-academia',
  mood: HallMood = 'dusk'
): BuiltRoomScene {
  const palette = HALL_THEME_PALETTES[theme]
  const moodRig = HALL_MOOD_RIGS[mood]

  const group = new THREE.Group()
  const interactables: THREE.Object3D[] = []
  const anchors: RoomAnchor[] = []
  const shelfAnchors = new Map<number, RoomAnchor>()
  const miniMapMarkers: MiniMapMarker[] = []
  const placements: SpinePlacement[] = []
  const lampGlows: THREE.Sprite[] = []
  const windowHalos: THREE.Sprite[] = []
  const disposables = {
    textures: [] as THREE.Texture[],
    materials: [] as THREE.Material[],
    geometries: [] as THREE.BufferGeometry[]
  }

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    disposables.geometries.push(g)
    return g
  }
  const trackMat = <T extends THREE.Material>(m: T): T => {
    disposables.materials.push(m)
    return m
  }
  const trackTex = <T extends THREE.Texture>(t: T): T => {
    disposables.textures.push(t)
    return t
  }

  const anisotropy = isSoftwareGl ? 1 : Math.min(maxAnisotropy, 8)
  const floorTex = trackTex(createGrandFloorTexture(anisotropy, palette))
  const wallTex = trackTex(createGrandWallTexture(anisotropy, palette))
  const rugTex = trackTex(createRunnerRugTexture(anisotropy, palette))
  const windowTex = trackTex(createWindowTexture(anisotropy, mood))
  const oculusTex = trackTex(createOculusTexture(anisotropy, palette, mood))
  const globeTex = trackTex(createGlobeTexture(anisotropy, palette))
  const shadowTex = trackTex(
    createRadialTexture([
      [0, 'rgba(0,0,0,0.48)'],
      [0.55, 'rgba(0,0,0,0.2)'],
      [1, 'rgba(0,0,0,0)']
    ])
  )
  const glowTex = trackTex(
    createRadialTexture([
      [0, 'rgba(255,216,154,0.9)'],
      [0.45, 'rgba(255,182,98,0.28)'],
      [1, 'rgba(255,160,72,0)']
    ])
  )

  const woodMat = trackMat(
    new THREE.MeshStandardMaterial({ color: palette.wood, roughness: 0.62, metalness: 0.06 })
  )
  const woodDarkMat = trackMat(
    new THREE.MeshStandardMaterial({ color: palette.woodDark, roughness: 0.72, metalness: 0.05 })
  )
  const trimMat = trackMat(
    new THREE.MeshStandardMaterial({ color: palette.trim, roughness: 0.56, metalness: 0.08 })
  )
  const limestoneMat = trackMat(
    new THREE.MeshStandardMaterial({ color: palette.limestone, roughness: 0.48, metalness: 0.04 })
  )
  const stoneTrimMat = trackMat(
    new THREE.MeshStandardMaterial({ color: palette.stoneTrim, roughness: 0.58, metalness: 0.05 })
  )
  const brassMat = trackMat(
    new THREE.MeshStandardMaterial({ color: palette.brass, roughness: 0.24, metalness: 0.88 })
  )
  const leatherChairMat = trackMat(
    new THREE.MeshStandardMaterial({ color: palette.leather, roughness: 0.54, metalness: 0.08 })
  )
  const floorMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: floorTex,
      roughness: palette.floorMode === 'marble' ? 0.32 : 0.52,
      metalness: palette.floorMode === 'marble' ? 0.06 : 0.08
    })
  )
  const wallMat = trackMat(
    new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.84, metalness: 0.02 })
  )
  const ceilingMat = trackMat(
    new THREE.MeshStandardMaterial({ color: palette.ceiling, roughness: 0.88 })
  )
  const rugMat = trackMat(
    new THREE.MeshStandardMaterial({ map: rugTex, roughness: 0.94, metalness: 0.0 })
  )
  const emeraldGlassMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: palette.bankerShade,
      emissive: palette.bankerEmissive,
      emissiveIntensity: mood === 'afternoon' ? 0.35 : 0.78,
      roughness: 0.2,
      metalness: 0.1,
      side: THREE.DoubleSide
    })
  )
  const windowGlassMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: windowTex,
      emissive: moodRig.windowEmissive,
      emissiveIntensity: moodRig.windowEmissiveIntensity,
      roughness: 0.22,
      metalness: 0.1
    })
  )
  const bulbMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#fff4da',
      emissive: '#ffd28c',
      emissiveIntensity: mood === 'afternoon' ? 0.75 : 1.9,
      roughness: 0.18
    })
  )
  const ribbonMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#e5bc64',
      emissive: '#785719',
      emissiveIntensity: 0.25,
      roughness: 0.45,
      metalness: 0.22
    })
  )

  // 1. Grand Floor, Perimeter Brass Inlay & Royal Runner Carpet
  const floorMesh = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(ROOM_WIDTH, ROOM_DEPTH)),
    floorMat
  )
  floorMesh.rotation.x = -Math.PI / 2
  floorMesh.receiveShadow = true
  floorMesh.userData.walkableFloor = true
  floorMesh.userData.walkLevel = 1
  group.add(floorMesh)
  interactables.push(floorMesh)

  const inlayMat = trackMat(
    new THREE.MeshStandardMaterial({ color: palette.inlay, roughness: 0.35, metalness: 0.75 })
  )
  for (const z of [-ROOM_DEPTH / 2 + 1.55, ROOM_DEPTH / 2 - 1.55]) {
    const strip = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(ROOM_WIDTH - 3.1, 0.008, 0.04)), inlayMat)
    strip.position.set(0, 0.004, z)
    group.add(strip)
  }
  for (const x of [-ROOM_WIDTH / 2 + 1.55, ROOM_WIDTH / 2 - 1.55]) {
    const strip = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.04, 0.008, ROOM_DEPTH - 3.1)), inlayMat)
    strip.position.set(x, 0.004, 0)
    group.add(strip)
  }

  const rug = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(4.4, 0.018, 9.2)), rugMat)
  rug.position.set(0, 0.012, 0.25)
  rug.receiveShadow = true
  rug.userData.walkableFloor = true
  rug.userData.walkLevel = 1
  group.add(rug)
  interactables.push(rug)

  // 2. Monumental Walls & Baseboards
  const wallSpecs: Array<[Wall, [number, number, number], [number, number, number]]> = [
    ['north', [0, WALL_HEIGHT / 2, -ROOM_DEPTH / 2 - 0.1], [ROOM_WIDTH + 0.3, WALL_HEIGHT, 0.2]],
    ['south', [0, WALL_HEIGHT / 2, ROOM_DEPTH / 2 + 0.1], [ROOM_WIDTH + 0.3, WALL_HEIGHT, 0.2]],
    ['east', [ROOM_WIDTH / 2 + 0.1, WALL_HEIGHT / 2, 0], [0.2, WALL_HEIGHT, ROOM_DEPTH + 0.3]],
    ['west', [-ROOM_WIDTH / 2 - 0.1, WALL_HEIGHT / 2, 0], [0.2, WALL_HEIGHT, ROOM_DEPTH + 0.3]]
  ]
  for (const [, pos, size] of wallSpecs) {
    const mesh = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(...size)), wallMat)
    mesh.position.set(...pos)
    mesh.receiveShadow = true
    group.add(mesh)
  }

  for (const [pos, size] of [
    [[0, 0.12, -ROOM_DEPTH / 2 + 0.04], [ROOM_WIDTH, 0.24, 0.08]],
    [[0, 0.12, ROOM_DEPTH / 2 - 0.04], [ROOM_WIDTH, 0.24, 0.08]],
    [[ROOM_WIDTH / 2 - 0.04, 0.12, 0], [0.08, 0.24, ROOM_DEPTH]],
    [[-ROOM_WIDTH / 2 + 0.04, 0.12, 0], [0.08, 0.24, ROOM_DEPTH]]
  ] as Array<[[number, number, number], [number, number, number]]>) {
    const base = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(...size)), woodDarkMat)
    base.position.set(...pos)
    group.add(base)
  }

  // 3. Coffered Vaulted Ceiling + Celestial/Daylight Skylight Oculus
  const ceiling = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(ROOM_WIDTH, ROOM_DEPTH)),
    ceilingMat
  )
  ceiling.rotation.x = Math.PI / 2
  ceiling.position.y = WALL_HEIGHT
  group.add(ceiling)

  for (const z of [-4.6, -1.6, 1.6, 4.6]) {
    const beam = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(ROOM_WIDTH, 0.36, 0.32)), woodDarkMat)
    beam.position.set(0, WALL_HEIGHT - 0.18, z)
    group.add(beam)

    const brassTrim = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(ROOM_WIDTH - 0.4, 0.025, 0.34)), brassMat)
    brassTrim.position.set(0, WALL_HEIGHT - 0.36, z)
    group.add(brassTrim)
  }
  for (const x of [-4.8, 4.8]) {
    const longBeam = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.32, 0.3, ROOM_DEPTH)), woodDarkMat)
    longBeam.position.set(x, WALL_HEIGHT - 0.15, 0)
    group.add(longBeam)
  }

  const oculusGroup = new THREE.Group()
  oculusGroup.position.set(0, WALL_HEIGHT - 0.06, 0)
  const oculusRingOuter = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(2.15, 0.12, 12, 40)), trimMat)
  oculusRingOuter.rotation.x = Math.PI / 2
  oculusGroup.add(oculusRingOuter)
  const oculusBrass = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(1.98, 0.045, 10, 40)), brassMat)
  oculusBrass.rotation.x = Math.PI / 2
  oculusGroup.add(oculusBrass)
  const oculusGlass = new THREE.Mesh(
    trackGeo(new THREE.CircleGeometry(1.96, 36)),
    trackMat(
      new THREE.MeshStandardMaterial({
        map: oculusTex,
        emissive: moodRig.oculusEmissive,
        emissiveMap: oculusTex,
        emissiveIntensity: moodRig.oculusIntensity,
        roughness: 0.22
      })
    )
  )
  oculusGlass.rotation.x = Math.PI / 2
  oculusGlass.position.y = 0.02
  oculusGroup.add(oculusGlass)
  for (let spoke = 0; spoke < 8; spoke += 1) {
    const bar = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(3.9, 0.04, 0.04)), brassMat)
    bar.rotation.y = (spoke / 8) * Math.PI
    bar.position.y = -0.02
    oculusGroup.add(bar)
  }
  group.add(oculusGroup)

  // 4. Walkable Upper Mezzanine Balcony (y = GALLERY_Y, widened 1.55m decks, open stairwell SE)
  const galleryY = GALLERY_Y
  const walkwayDepth = WALKWAY_DEPTH
  const swBalconyLen = STAIR_SPEC.southBalconyMaxX + ROOM_WIDTH / 2 // 1.55 + 8 = 9.55
  const swBalconyCenterX = -ROOM_WIDTH / 2 + swBalconyLen / 2
  const eastDeckMinZ = -ROOM_DEPTH / 2 + walkwayDepth
  const eastDeckMaxZ = STAIR_SPEC.f2EndZ
  const eastDeckLen = eastDeckMaxZ - eastDeckMinZ
  const eastDeckCenterZ = (eastDeckMinZ + eastDeckMaxZ) / 2

  interface GallerySide {
    pos: [number, number, number]
    deckSize: [number, number, number]
    railPos: [number, number, number]
    railSize: [number, number, number]
    railStart: number
    railEnd: number
    axis: 'x' | 'z'
  }

  const gallerySides: GallerySide[] = [
    // North Balcony (full width)
    {
      pos: [0, galleryY - 0.11, -ROOM_DEPTH / 2 + walkwayDepth / 2],
      deckSize: [ROOM_WIDTH, 0.22, walkwayDepth],
      railPos: [0, galleryY + 0.92, -ROOM_DEPTH / 2 + walkwayDepth - 0.06],
      railSize: [ROOM_WIDTH - walkwayDepth * 2, 0.06, 0.08],
      railStart: -(ROOM_WIDTH / 2 - walkwayDepth),
      railEnd: ROOM_WIDTH / 2 - walkwayDepth,
      axis: 'x'
    },
    // West Balcony (full depth)
    {
      pos: [-ROOM_WIDTH / 2 + walkwayDepth / 2, galleryY - 0.11, 0],
      deckSize: [walkwayDepth, 0.22, ROOM_DEPTH - walkwayDepth * 2],
      railPos: [-ROOM_WIDTH / 2 + walkwayDepth - 0.06, galleryY + 0.92, 0],
      railSize: [0.08, 0.06, ROOM_DEPTH - walkwayDepth * 2],
      railStart: -(ROOM_DEPTH / 2 - walkwayDepth),
      railEnd: ROOM_DEPTH / 2 - walkwayDepth,
      axis: 'z'
    },
    // South-West Balcony (stops cleanly at stairwell opening x = 1.55)
    {
      pos: [swBalconyCenterX, galleryY - 0.11, ROOM_DEPTH / 2 - walkwayDepth / 2],
      deckSize: [swBalconyLen, 0.22, walkwayDepth],
      railPos: [
        (-ROOM_WIDTH / 2 + walkwayDepth + STAIR_SPEC.southBalconyMaxX) / 2,
        galleryY + 0.92,
        ROOM_DEPTH / 2 - walkwayDepth + 0.06
      ],
      railSize: [STAIR_SPEC.southBalconyMaxX - (-ROOM_WIDTH / 2 + walkwayDepth), 0.06, 0.08],
      railStart: -ROOM_WIDTH / 2 + walkwayDepth,
      railEnd: STAIR_SPEC.southBalconyMaxX,
      axis: 'x'
    },
    // East Balcony (North of top of Flight 2 at z = 1.05)
    {
      pos: [ROOM_WIDTH / 2 - walkwayDepth / 2, galleryY - 0.11, eastDeckCenterZ],
      deckSize: [walkwayDepth, 0.22, eastDeckLen],
      railPos: [ROOM_WIDTH / 2 - walkwayDepth + 0.06, galleryY + 0.92, eastDeckCenterZ],
      railSize: [0.08, 0.06, eastDeckLen],
      railStart: eastDeckMinZ,
      railEnd: eastDeckMaxZ,
      axis: 'z'
    }
  ]

  const balusterPositions: Array<[number, number, number]> = []
  for (const side of gallerySides) {
    const deck = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(...side.deckSize)), woodDarkMat)
    deck.position.set(...side.pos)
    deck.castShadow = true
    deck.receiveShadow = true
    deck.userData.walkableFloor = true
    deck.userData.walkLevel = 2
    group.add(deck)
    interactables.push(deck)

    // Thin parquet top surface on mezzanine deck
    const topCap = new THREE.Mesh(
      trackGeo(new THREE.PlaneGeometry(side.deckSize[0] - 0.04, side.deckSize[2] - 0.04)),
      floorMat
    )
    topCap.rotation.x = -Math.PI / 2
    topCap.position.set(side.pos[0], galleryY + 0.005, side.pos[2])
    topCap.receiveShadow = true
    topCap.userData.walkableFloor = true
    topCap.userData.walkLevel = 2
    group.add(topCap)
    interactables.push(topCap)

    const railLen = Math.abs(side.railEnd - side.railStart)
    const fascia = new THREE.Mesh(
      trackGeo(
        new THREE.BoxGeometry(
          side.axis === 'x' ? railLen : 0.03,
          0.035,
          side.axis === 'z' ? railLen : 0.03
        )
      ),
      brassMat
    )
    fascia.position.set(side.railPos[0], galleryY - 0.02, side.railPos[2])
    group.add(fascia)

    const rail = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(...side.railSize)), brassMat)
    rail.position.set(...side.railPos)
    group.add(rail)

    const count = Math.max(2, Math.floor(railLen / 0.36))
    for (let i = 0; i <= count; i += 1) {
      const t = side.railStart + (i / count) * railLen
      if (side.axis === 'x') {
        balusterPositions.push([t, galleryY + 0.46, side.railPos[2]])
      } else {
        balusterPositions.push([side.railPos[0], galleryY + 0.46, t])
      }
    }
  }

  // Return end-railing at the South-West balcony edge overlooking the Grand Staircase
  const swReturnRail = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.08, 0.06, walkwayDepth - 0.08)),
    brassMat
  )
  swReturnRail.position.set(STAIR_SPEC.southBalconyMaxX, galleryY + 0.92, ROOM_DEPTH / 2 - walkwayDepth / 2)
  group.add(swReturnRail)
  for (let i = 0; i <= 4; i += 1) {
    balusterPositions.push([
      STAIR_SPEC.southBalconyMaxX,
      galleryY + 0.46,
      ROOM_DEPTH / 2 - walkwayDepth + 0.12 + (i / 4) * (walkwayDepth - 0.24)
    ])
  }

  // 4b. Grand Twin-Flight Walnut & Brass Staircase (South-East corner -> East Mezzanine)
  const stairStepsF1 = 12
  const f1Len = STAIR_SPEC.f1EndX - STAIR_SPEC.f1StartX
  const f1Width = STAIR_SPEC.f1MaxZ - STAIR_SPEC.f1MinZ
  const f1CenterZ = (STAIR_SPEC.f1MinZ + STAIR_SPEC.f1MaxZ) / 2
  const stepRun1 = f1Len / stairStepsF1
  const stepRise1 = STAIR_SPEC.midY / stairStepsF1

  for (let i = 0; i < stairStepsF1; i += 1) {
    const sx = STAIR_SPEC.f1StartX + (i + 0.5) * stepRun1
    const sy = (i + 1) * stepRise1
    // Solid step block
    const tread = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(stepRun1 + 0.03, sy, f1Width)),
      woodDarkMat
    )
    tread.position.set(sx, sy / 2, f1CenterZ)
    tread.castShadow = true
    tread.receiveShadow = true
    tread.userData.walkableFloor = true
    tread.userData.walkLevel = 1
    group.add(tread)
    interactables.push(tread)

    // Carpeted center runner on each tread + brass stair rod
    const stepRug = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(stepRun1 + 0.01, 0.016, f1Width * 0.64)),
      rugMat
    )
    stepRug.position.set(sx, sy + 0.008, f1CenterZ)
    group.add(stepRug)

    const nosing = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.025, 0.018, f1Width * 0.72)),
      brassMat
    )
    nosing.position.set(sx - stepRun1 / 2 + 0.012, sy + 0.012, f1CenterZ)
    group.add(nosing)

    // Inner nave-side baluster along Flight 1
    balusterPositions.push([sx, sy + 0.45, STAIR_SPEC.f1MinZ + 0.05])
  }

  // Flight 1 sloped brass handrail + ornate starting newel post
  const f1SlopeLen = Math.hypot(f1Len, STAIR_SPEC.midY)
  const f1Rail = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(f1SlopeLen, 0.06, 0.075)),
    brassMat
  )
  f1Rail.position.set(
    (STAIR_SPEC.f1StartX + STAIR_SPEC.f1EndX) / 2,
    STAIR_SPEC.midY / 2 + 0.9,
    STAIR_SPEC.f1MinZ + 0.05
  )
  f1Rail.rotation.z = Math.atan2(STAIR_SPEC.midY, f1Len)
  group.add(f1Rail)

  const newelPost = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.18, 1.05, 0.18)), woodMat)
  newelPost.position.set(STAIR_SPEC.f1StartX - 0.04, 0.525, STAIR_SPEC.f1MinZ + 0.05)
  group.add(newelPost)
  const newelFinial = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.085, 14, 14)), brassMat)
  newelFinial.position.set(STAIR_SPEC.f1StartX - 0.04, 1.12, STAIR_SPEC.f1MinZ + 0.05)
  group.add(newelFinial)

  // Mid-Landing platform
  const landW = STAIR_SPEC.landingMaxX - STAIR_SPEC.landingMinX
  const landD = STAIR_SPEC.landingMaxZ - STAIR_SPEC.landingMinZ
  const landCenterX = (STAIR_SPEC.landingMinX + STAIR_SPEC.landingMaxX) / 2
  const landCenterZ = (STAIR_SPEC.landingMinZ + STAIR_SPEC.landingMaxZ) / 2
  const midLanding = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(landW, STAIR_SPEC.midY, landD)),
    woodDarkMat
  )
  midLanding.position.set(landCenterX, STAIR_SPEC.midY / 2, landCenterZ)
  midLanding.receiveShadow = true
  midLanding.userData.walkableFloor = true
  midLanding.userData.walkLevel = 2
  group.add(midLanding)
  interactables.push(midLanding)

  // Flight 2 (Mid-Landing -> East Mezzanine, climbing North)
  const stairStepsF2 = 12
  const f2Len = STAIR_SPEC.f2StartZ - STAIR_SPEC.f2EndZ
  const f2Width = STAIR_SPEC.f2MaxX - STAIR_SPEC.f2MinX
  const f2CenterX = (STAIR_SPEC.f2MinX + STAIR_SPEC.f2MaxX) / 2
  const stepRun2 = f2Len / stairStepsF2
  const stepRise2 = (galleryY - STAIR_SPEC.midY) / stairStepsF2

  for (let i = 0; i < stairStepsF2; i += 1) {
    const sz = STAIR_SPEC.f2StartZ - (i + 0.5) * stepRun2
    const sy = STAIR_SPEC.midY + (i + 1) * stepRise2
    const tread = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(f2Width, sy, stepRun2 + 0.03)),
      woodDarkMat
    )
    tread.position.set(f2CenterX, sy / 2, sz)
    tread.castShadow = true
    tread.receiveShadow = true
    tread.userData.walkableFloor = true
    tread.userData.walkLevel = 2
    group.add(tread)
    interactables.push(tread)

    const stepRug = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(f2Width * 0.64, 0.016, stepRun2 + 0.01)),
      rugMat
    )
    stepRug.position.set(f2CenterX, sy + 0.008, sz)
    group.add(stepRug)

    const nosing = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(f2Width * 0.72, 0.018, 0.025)),
      brassMat
    )
    nosing.position.set(f2CenterX, sy + 0.012, sz + stepRun2 / 2 - 0.012)
    group.add(nosing)

    balusterPositions.push([STAIR_SPEC.f2MinX + 0.05, sy + 0.45, sz])
  }

  const f2SlopeLen = Math.hypot(f2Len, galleryY - STAIR_SPEC.midY)
  const f2Rail = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.075, 0.06, f2SlopeLen)),
    brassMat
  )
  f2Rail.position.set(
    STAIR_SPEC.f2MinX + 0.05,
    (STAIR_SPEC.midY + galleryY) / 2 + 0.9,
    (STAIR_SPEC.f2StartZ + STAIR_SPEC.f2EndZ) / 2
  )
  f2Rail.rotation.x = Math.atan2(galleryY - STAIR_SPEC.midY, f2Len)
  group.add(f2Rail)

  // Instanced balusters for mezzanine + both staircase flights (1 draw call!)
  const balusterGeo = trackGeo(new THREE.CylinderGeometry(0.02, 0.028, 0.82, 8))
  const balusterInst = new THREE.InstancedMesh(balusterGeo, trimMat, balusterPositions.length)
  const dummy = new THREE.Object3D()
  balusterPositions.forEach(([bx, by, bz], idx) => {
    dummy.position.set(bx, by, bz)
    dummy.updateMatrix()
    balusterInst.setMatrixAt(idx, dummy.matrix)
  })
  balusterInst.instanceMatrix.needsUpdate = true
  balusterInst.computeBoundingSphere()
  group.add(balusterInst)

  // Upper Mezzanine Antique Brass Observatory Telescope (NW Corner)
  const scope = new THREE.Group()
  scope.position.set(-6.35, galleryY, -6.15)
  scope.rotation.y = Math.PI * 0.24
  for (let leg = 0; leg < 3; leg += 1) {
    const a = (leg / 3) * Math.PI * 2
    const strut = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.018, 0.024, 1.25, 8)), woodMat)
    strut.position.set(Math.cos(a) * 0.22, 0.58, Math.sin(a) * 0.22)
    strut.rotation.z = -Math.cos(a) * 0.28
    strut.rotation.x = Math.sin(a) * 0.28
    scope.add(strut)
  }
  const tube = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.055, 0.08, 1.05, 16)), brassMat)
  tube.position.set(0, 1.32, 0)
  tube.rotation.z = Math.PI / 2 - 0.52
  tube.userData.interactiveKind = 'balcony'
  tube.userData.interactLabel = 'Upper Mezzanine Telescope'
  scope.add(tube)
  interactables.push(tube)
  group.add(scope)

  // 5. Towering Fluted Colonnade Columns
  const colPositions: Array<[number, number]> = [
    [-ROOM_WIDTH / 2 + 1.45, -ROOM_DEPTH / 2 + 1.45],
    [ROOM_WIDTH / 2 - 1.45, -ROOM_DEPTH / 2 + 1.45],
    [-ROOM_WIDTH / 2 + 1.45, ROOM_DEPTH / 2 - 1.45],
    [-ROOM_WIDTH / 2 + 1.45, -1.9],
    [-ROOM_WIDTH / 2 + 1.45, 1.9],
    [ROOM_WIDTH / 2 - 1.45, -2.2],
    [-3.1, -ROOM_DEPTH / 2 + 1.45],
    [3.1, -ROOM_DEPTH / 2 + 1.45],
    [-3.1, ROOM_DEPTH / 2 - 1.45]
  ]

  const colPlinthGeo = trackGeo(new THREE.BoxGeometry(0.54, 0.4, 0.54))
  const colShaftGeo = trackGeo(new THREE.CylinderGeometry(0.18, 0.21, WALL_HEIGHT - 0.85, 20))
  const colRingGeo = trackGeo(new THREE.TorusGeometry(0.21, 0.028, 10, 20))
  const colCapGeo = trackGeo(new THREE.BoxGeometry(0.58, 0.26, 0.58))

  for (const [cx, cz] of colPositions) {
    const col = new THREE.Group()
    col.position.set(cx, 0, cz)

    const plinth = new THREE.Mesh(colPlinthGeo, woodDarkMat)
    plinth.position.y = 0.2
    col.add(plinth)

    const shaft = new THREE.Mesh(colShaftGeo, limestoneMat)
    shaft.position.y = WALL_HEIGHT / 2 + 0.05
    shaft.castShadow = true
    shaft.receiveShadow = true
    col.add(shaft)

    for (const ry of [0.44, galleryY, WALL_HEIGHT - 0.42]) {
      const ring = new THREE.Mesh(colRingGeo, brassMat)
      ring.rotation.x = Math.PI / 2
      ring.position.y = ry
      col.add(ring)
    }

    const cap = new THREE.Mesh(colCapGeo, stoneTrimMat)
    cap.position.y = WALL_HEIGHT - 0.15
    col.add(cap)

    group.add(col)
  }

  // 6. Tall Arched Clerestory Windows (Dynamic Mood Sky + Optional Storm Rain Streaks)
  const rainPositions: number[] = []

  const addArchedWindow = (x: number, y: number, z: number, rotY: number, withShaft: boolean): void => {
    const win = new THREE.Group()
    win.position.set(x, y, z)
    win.rotation.y = rotY

    const frameRect = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.75, 2.05, 0.14)), stoneTrimMat)
    win.add(frameRect)

    const glassRect = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(1.48, 1.85)), windowGlassMat)
    glassRect.position.z = 0.08
    win.add(glassRect)

    const archGlass = new THREE.Mesh(
      trackGeo(new THREE.CircleGeometry(0.74, 24, 0, Math.PI)),
      windowGlassMat
    )
    archGlass.position.set(0, 0.92, 0.08)
    win.add(archGlass)

    const archFrame = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(0.78, 0.08, 10, 24, Math.PI)),
      stoneTrimMat
    )
    archFrame.position.set(0, 0.92, 0.04)
    win.add(archFrame)

    for (const mx of [-0.38, 0, 0.38]) {
      const m = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.045, 2.52, 0.05)), trimMat)
      m.position.set(mx, 0.28, 0.095)
      win.add(m)
    }
    for (const my of [-0.35, 0.35, 0.92]) {
      const bar = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.52, 0.045, 0.05)), trimMat)
      bar.position.set(0, my, 0.095)
      win.add(bar)
    }

    const halo = new THREE.Sprite(
      trackMat(
        new THREE.SpriteMaterial({
          map: glowTex,
          color: moodRig.windowHaloColor,
          transparent: true,
          opacity: moodRig.windowHaloOpacity,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      )
    )
    halo.position.set(0, 0.25, 0.45)
    halo.scale.set(3.4, 3.2, 1)
    win.add(halo)
    windowHalos.push(halo)

    if (withShaft && quality !== 'low') {
      const shaft = new THREE.Mesh(
        trackGeo(new THREE.ConeGeometry(1.65, 5.4, 16, 1, true)),
        trackMat(
          new THREE.MeshBasicMaterial({
            color: moodRig.shaftColor,
            transparent: true,
            opacity: moodRig.shaftOpacity,
            side: THREE.DoubleSide,
            depthWrite: false,
            blending: THREE.AdditiveBlending
          })
        )
      )
      shaft.position.set(0, -1.75, 2.0)
      shaft.rotation.x = 0.62
      win.add(shaft)
    }

    // Collect rain streaks tightly in front of each window pane for Stormy Night mood
    if (moodRig.hasRain) {
      const mat = new THREE.Matrix4().makeRotationY(rotY)
      mat.setPosition(x, y, z)
      const count = isSoftwareGl ? 10 : 22
      for (let i = 0; i < count; i += 1) {
        const rx = (Math.random() - 0.5) * 1.38
        const ry = (Math.random() - 0.5) * 2.1 + 0.15
        const p0 = new THREE.Vector3(rx, ry, 0.12).applyMatrix4(mat)
        const p1 = new THREE.Vector3(rx - 0.06, ry - 0.26, 0.12).applyMatrix4(mat)
        rainPositions.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z)
      }
    }

    group.add(win)
  }

  for (const wx of [-4.6, 0, 4.6]) {
    addArchedWindow(wx, 5.25, -ROOM_DEPTH / 2 + 0.05, 0, true)
  }
  for (const wz of [-3.4, 3.4]) {
    addArchedWindow(-ROOM_WIDTH / 2 + 0.05, 5.25, wz, Math.PI / 2, false)
    addArchedWindow(ROOM_WIDTH / 2 - 0.05, 5.25, wz, -Math.PI / 2, false)
  }

  let rainLines: THREE.LineSegments | null = null
  if (moodRig.hasRain && rainPositions.length > 0) {
    const rainGeo = trackGeo(new THREE.BufferGeometry())
    rainGeo.setAttribute('position', new THREE.Float32BufferAttribute(rainPositions, 3))
    rainLines = new THREE.LineSegments(
      rainGeo,
      trackMat(
        new THREE.LineBasicMaterial({
          color: '#a8c6f0',
          transparent: true,
          opacity: 0.45
        })
      )
    )
    group.add(rainLines)
  }

  // 7. Grand Arched Oak Double Entrance Doors (South Wall center)
  const entrance = new THREE.Group()
  entrance.position.set(0, 0, ROOM_DEPTH / 2 - 0.06)
  entrance.rotation.y = Math.PI

  const doorSurround = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.95, 3.45, 0.18)), stoneTrimMat)
  doorSurround.position.set(0, 1.725, 0)
  entrance.add(doorSurround)

  for (const dx of [-0.62, 0.62]) {
    const leaf = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.18, 3.2, 0.12)), woodDarkMat)
    leaf.position.set(dx, 1.6, 0.05)
    entrance.add(leaf)

    const panel = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.82, 1.15, 0.04)), woodMat)
    panel.position.set(dx, 2.35, 0.12)
    entrance.add(panel)

    const lowerPanel = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.82, 1.0, 0.04)), woodMat)
    lowerPanel.position.set(dx, 0.92, 0.12)
    entrance.add(lowerPanel)

    const handle = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.08, 0.018, 10, 18)), brassMat)
    handle.position.set(dx * 0.25, 1.38, 0.15)
    entrance.add(handle)
  }

  const transom = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(1.36, 0.09, 10, 26, Math.PI)),
    brassMat
  )
  transom.position.set(0, 3.35, 0.08)
  entrance.add(transom)
  group.add(entrance)

  // 7b. Cozy Carved Limestone & Walnut Fireplace Hearth (South-West Wall)
  const hearth = new THREE.Group()
  hearth.position.set(-4.55, 0, ROOM_DEPTH / 2 - 0.36)
  hearth.rotation.y = Math.PI

  const chimney = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.15, galleryY - 0.1, 0.68)), limestoneMat)
  chimney.position.set(0, (galleryY - 0.1) / 2, 0)
  chimney.castShadow = true
  chimney.receiveShadow = true
  hearth.add(chimney)

  const mantel = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.42, 0.18, 0.84)), woodDarkMat)
  mantel.position.set(0, 1.52, 0.08)
  mantel.userData.interactiveKind = 'fireplace'
  mantel.userData.interactLabel = 'Hall Fireplace Hearth'
  hearth.add(mantel)
  interactables.push(mantel)

  const firebox = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(1.24, 1.02, 0.42)),
    trackMat(new THREE.MeshStandardMaterial({ color: '#140f0c', roughness: 0.96 }))
  )
  firebox.position.set(0, 0.6, 0.18)
  firebox.userData.interactiveKind = 'fireplace'
  firebox.userData.interactLabel = 'Hall Fireplace Hearth'
  hearth.add(firebox)
  interactables.push(firebox)

  const hearthStone = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.45, 0.1, 1.15)), stoneTrimMat)
  hearthStone.position.set(0, 0.05, 0.24)
  hearth.add(hearthStone)

  const brassFender = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.52, 0.14, 0.04)), brassMat)
  brassFender.position.set(0, 0.16, 0.68)
  hearth.add(brassFender)

  // Charred logs & glowing ember core
  const logMat = trackMat(new THREE.MeshStandardMaterial({ color: '#261710', roughness: 0.92 }))
  for (const [lx, lz, rz] of [
    [-0.14, 0.24, 0.28],
    [0.14, 0.26, -0.32],
    [0, 0.28, 0.04]
  ]) {
    const log = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.075, 0.085, 0.68, 10)), logMat)
    log.position.set(lx, 0.24, lz)
    log.rotation.z = Math.PI / 2 + rz
    hearth.add(log)
  }

  const hearthFlame = new THREE.Mesh(
    trackGeo(new THREE.ConeGeometry(0.28, 0.48, 8)),
    trackMat(
      new THREE.MeshBasicMaterial({
        color: '#ff9b42',
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    )
  )
  hearthFlame.position.set(0, 0.44, 0.28)
  hearth.add(hearthFlame)

  const hearthLight = new THREE.PointLight('#ff8c3a', moodRig.fireplaceIntensity, 10.5, 1.5)
  hearthLight.position.set(0, 0.68, 0.62)
  hearth.add(hearthLight)

  group.add(hearth)

  // 8. Twin Two-Tier Grand Wrought-Brass Chandeliers
  const bulbGeo = trackGeo(new THREE.SphereGeometry(0.08, 12, 12))
  for (const cz of [-2.85, 2.85]) {
    const chandelier = new THREE.Group()
    chandelier.position.set(0, WALL_HEIGHT - 1.65, cz)

    const chain = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.024, 0.024, 1.75, 8)), brassMat)
    chain.position.y = 0.88
    chandelier.add(chain)

    const finial = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.11, 14, 14)), brassMat)
    finial.position.y = -0.18
    chandelier.add(finial)

    const lowerRing = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(1.05, 0.032, 10, 36)), brassMat)
    lowerRing.rotation.x = Math.PI / 2
    chandelier.add(lowerRing)

    const upperRing = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.58, 0.025, 10, 28)), brassMat)
    upperRing.rotation.x = Math.PI / 2
    upperRing.position.y = 0.42
    chandelier.add(upperRing)

    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2
      const bulb = new THREE.Mesh(bulbGeo, bulbMat)
      bulb.position.set(Math.cos(a) * 1.05, 0.1, Math.sin(a) * 1.05)
      chandelier.add(bulb)
    }
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2 + 0.3
      const bulb = new THREE.Mesh(bulbGeo, bulbMat)
      bulb.position.set(Math.cos(a) * 0.58, 0.52, Math.sin(a) * 0.58)
      chandelier.add(bulb)
    }

    const chLight = new THREE.PointLight('#ffd599', moodRig.chandelierIntensity, 20, 1.35)
    chLight.position.set(0, -0.2, 0)
    chandelier.add(chLight)

    const chHalo = new THREE.Sprite(
      trackMat(
        new THREE.SpriteMaterial({
          map: glowTex,
          color: '#ffd08a',
          transparent: true,
          opacity: moodRig.chandelierHaloOpacity,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      )
    )
    chHalo.position.set(0, 0.12, 0)
    chHalo.scale.set(2.9, 2.4, 1)
    chandelier.add(chHalo)
    lampGlows.push(chHalo)

    group.add(chandelier)
  }

  // Overview Entrance Anchor first
  anchors.push({
    id: 'overview',
    label: 'Grand Hall Entrance',
    meta: 'Center nave vista',
    kind: 'overview',
    level: 1,
    position: new THREE.Vector3(0, EYE_HEIGHT, 5.15),
    lookAt: new THREE.Vector3(0, 1.55, -5.2)
  })

  // 9. Dynamic Book-Scaled Bookcases with Engraved Brass Nameplates & Custom Spines
  const { texture: spineTexture, cells } = buildSpineAtlas(books, anisotropy)
  trackTex(spineTexture)

  const visibleBays = computeScaledBays(room, books)
  const baysByWall = new Map<Wall, VisibleBaySpec[]>()
  for (const spec of visibleBays) {
    const list = baysByWall.get(spec.wall) ?? []
    list.push(spec)
    baysByWall.set(spec.wall, list)
  }

  const wallRot: Record<Wall, number> = {
    north: 0,
    east: -Math.PI / 2,
    south: Math.PI,
    west: Math.PI / 2
  }
  const wallPos = (wall: Wall, offset: number, baseY: number): [number, number, number] => {
    switch (wall) {
      case 'north':
        return [offset, baseY, -ROOM_DEPTH / 2 + 0.28]
      case 'east':
        return [ROOM_WIDTH / 2 - 0.28, baseY, offset]
      case 'south':
        return [offset, baseY, ROOM_DEPTH / 2 - 0.28]
      case 'west':
        return [-ROOM_WIDTH / 2 + 0.28, baseY, offset]
    }
  }

  let maxVisibleShelves = 0
  const bookmarkRibbonMatrices: THREE.Matrix4[] = []

  for (const [wall, specs] of baysByWall) {
    const bayWidth = 2.24

    specs.forEach((spec, idx) => {
      // Determine ground vs. upper mezzanine placement so stairs/fireplace/doors stay completely clear!
      let level: 1 | 2 = 1
      let offset: number

      if (wall === 'north') {
        const groundCap = 4
        if (idx >= groundCap) {
          level = 2
          const uIdx = idx - groundCap
          const uCount = specs.length - groundCap
          const step = Math.min(2.5, (ROOM_WIDTH - 4.4) / Math.max(1, uCount))
          offset = -((step * (uCount - 1)) / 2) + uIdx * step
        } else {
          const gCount = Math.min(specs.length, groundCap)
          const step = Math.min(2.55, (ROOM_WIDTH - 4.2) / Math.max(1, gCount))
          offset = -((step * (gCount - 1)) / 2) + idx * step
        }
      } else if (wall === 'west') {
        const groundCap = 3
        if (idx >= groundCap) {
          level = 2
          const uIdx = idx - groundCap
          const uCount = specs.length - groundCap
          const step = Math.min(2.5, (ROOM_DEPTH - 4.8) / Math.max(1, uCount))
          offset = -((step * (uCount - 1)) / 2) + uIdx * step
        } else {
          const gCount = Math.min(specs.length, groundCap)
          const step = Math.min(2.55, (ROOM_DEPTH - 4.4) / Math.max(1, gCount))
          offset = -((step * (gCount - 1)) / 2) + idx * step
        }
      } else if (wall === 'east') {
        // Ground East wall stays north of Flight 2 (z <= 0.1); overflow bays ascend to East Mezzanine
        const groundCap = 2
        if (idx >= groundCap) {
          level = 2
          const uIdx = idx - groundCap
          offset = -4.2 + uIdx * 2.5
        } else {
          offset = -3.8 + idx * 2.65
        }
      } else {
        // South wall has Entrance Doors (x=0), Fireplace (x=-4.55), and Stairs (x>=1.95) -> place on South-West Mezzanine!
        level = 2
        offset = -4.8 + idx * 2.55
      }

      const baseY = level === 2 ? galleryY : 0
      const shelfCount = spec.shelves.length
      if (level === 1) maxVisibleShelves = Math.max(maxVisibleShelves, shelfCount)

      const rowHeight = 0.48
      const plinthHeight = 0.26
      const caseHeight = Math.max(1.28, plinthHeight + shelfCount * rowHeight + 0.22)
      const depth = 0.46
      const bayGroup = new THREE.Group()
      const pos = wallPos(wall, offset, baseY)
      bayGroup.position.set(...pos)
      bayGroup.rotation.y = wallRot[wall]

      const bayMatrix = new THREE.Matrix4().makeRotationY(wallRot[wall])
      bayMatrix.setPosition(...pos)
      const normal = new THREE.Vector3(0, 0, 1).transformDirection(bayMatrix)

      // Recessed wood back panel
      const back = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(bayWidth - 0.08, caseHeight, 0.045)),
        woodDarkMat
      )
      back.position.set(0, caseHeight / 2, -depth / 2 + 0.025)
      back.receiveShadow = true
      bayGroup.add(back)

      // Stepped Plinth base
      const plinth = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(bayWidth + 0.06, plinthHeight, depth + 0.06)),
        woodDarkMat
      )
      plinth.position.set(0, plinthHeight / 2, 0.02)
      bayGroup.add(plinth)

      // Fluted Side Pilasters
      const sideGeo = trackGeo(new THREE.BoxGeometry(0.11, caseHeight, depth + 0.02))
      for (const sx of [-bayWidth / 2 + 0.055, bayWidth / 2 - 0.055]) {
        const side = new THREE.Mesh(sideGeo, woodMat)
        side.position.set(sx, caseHeight / 2, 0)
        side.castShadow = true
        side.receiveShadow = true
        bayGroup.add(side)

        const trimBar = new THREE.Mesh(
          trackGeo(new THREE.BoxGeometry(0.024, caseHeight - 0.22, 0.018)),
          brassMat
        )
        trimBar.position.set(sx, caseHeight / 2, depth / 2 + 0.015)
        bayGroup.add(trimBar)
      }

      // Stepped Crown Cornice
      const crown = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(bayWidth + 0.18, 0.13, depth + 0.14)),
        trimMat
      )
      crown.position.set(0, caseHeight + 0.065, 0.04)
      crown.castShadow = true
      bayGroup.add(crown)

      // Engraved Brass Section Crown Plaque above the bookcase
      const sectionPlaqueTex = trackTex(
        createBrassPlaqueTexture(spec.section.name, anisotropy, palette, true)
      )
      const sectionPlaqueMat = trackMat(
        new THREE.MeshStandardMaterial({
          map: sectionPlaqueTex,
          roughness: 0.34,
          metalness: 0.65
        })
      )
      const sectionPlaque = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(1.12, 0.2, 0.025)),
        sectionPlaqueMat
      )
      sectionPlaque.position.set(0, caseHeight + 0.23, depth / 2 - 0.02)
      if (spec.shelves[0]) {
        sectionPlaque.userData.shelfId = spec.shelves[0].id
        sectionPlaque.userData.interactLabel = `${spec.section.name} · ${shelfDisplayName(spec.shelves[0])}`
      }
      bayGroup.add(sectionPlaque)
      interactables.push(sectionPlaque)

      // Brass Gallery Picture Light Sconce atop bookcase
      const sconceBar = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.02, 0.02, 0.66, 10)),
        brassMat
      )
      sconceBar.rotation.z = Math.PI / 2
      sconceBar.position.set(0, caseHeight + 0.38, depth / 2 + 0.16)
      bayGroup.add(sconceBar)

      const sconceArm = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.045, 0.045, 0.24)),
        brassMat
      )
      sconceArm.position.set(0, caseHeight + 0.36, depth / 2 + 0.02)
      bayGroup.add(sconceArm)

      if (idx < 2) {
        const shelfLight = new THREE.PointLight('#ffce8f', mood === 'afternoon' ? 2.5 : 6.5, 6.2, 1.55)
        shelfLight.position.set(0, caseHeight + 0.24, depth / 2 + 0.28)
        bayGroup.add(shelfLight)
      }

      if (level === 1) {
        const contact = new THREE.Mesh(
          trackGeo(new THREE.PlaneGeometry(bayWidth + 0.7, 1.25)),
          trackMat(
            new THREE.MeshBasicMaterial({
              map: shadowTex,
              transparent: true,
              opacity: 0.54,
              depthWrite: false
            })
          )
        )
        contact.rotation.x = -Math.PI / 2
        contact.position.set(0, 0.008, depth / 2 + 0.26)
        bayGroup.add(contact)
      }

      const bayWorldCenter = new THREE.Vector3(0, 0, 0.25).applyMatrix4(bayMatrix)
      let bayMarkerAdded = false

      spec.shelves.forEach((shelf, row) => {
        const shelfY = plinthHeight + row * rowHeight
        const displayName = shelfDisplayName(shelf)
        const shelved = (spec.booksByShelf.get(shelf.id) ?? []).slice(0, 24)

        const board = new THREE.Mesh(
          trackGeo(new THREE.BoxGeometry(bayWidth - 0.14, 0.05, depth - 0.04)),
          woodMat
        )
        board.position.set(0, shelfY, 0)
        board.receiveShadow = true
        board.userData.shelfId = shelf.id
        board.userData.interactLabel = displayName
        board.userData.interactMeta = `${shelved.length} ${shelved.length === 1 ? 'book' : 'books'} · Click to open, reorder or rename`
        bayGroup.add(board)
        interactables.push(board)

        const lip = new THREE.Mesh(
          trackGeo(new THREE.BoxGeometry(bayWidth - 0.16, 0.012, 0.014)),
          brassMat
        )
        lip.position.set(0, shelfY - 0.02, depth / 2 - 0.015)
        bayGroup.add(lip)

        const plaqueTex = trackTex(
          createBrassPlaqueTexture(displayName, anisotropy, palette, false)
        )
        const plaqueMat = trackMat(
          new THREE.MeshStandardMaterial({
            map: plaqueTex,
            roughness: 0.34,
            metalness: 0.62
          })
        )
        const nameplate = new THREE.Mesh(
          trackGeo(new THREE.BoxGeometry(0.56, 0.092, 0.018)),
          plaqueMat
        )
        nameplate.position.set(0, shelfY - 0.004, depth / 2 - 0.006)
        nameplate.userData.shelfId = shelf.id
        nameplate.userData.interactLabel = displayName
        nameplate.userData.interactMeta = `${shelved.length} ${shelved.length === 1 ? 'book' : 'books'} · Click to open or rename`
        bayGroup.add(nameplate)
        interactables.push(nameplate)

        const lookTarget = new THREE.Vector3(0, Math.min(2.15, shelfY + 0.24), 0).applyMatrix4(
          bayMatrix
        )
        const standDist = level === 2 ? 0.92 : 2.2
        const standPos = lookTarget.clone().addScaledVector(normal, standDist)
        standPos.y = baseY + EYE_HEIGHT
        const anchor: RoomAnchor = {
          id: `shelf-${shelf.id}`,
          label: displayName,
          meta: `${spec.section.name}${level === 2 ? ' (Mezzanine)' : ''} · ${shelved.length} ${shelved.length === 1 ? 'book' : 'books'}`,
          kind: 'shelf',
          shelfId: shelf.id,
          level,
          position: standPos,
          lookAt: lookTarget
        }
        shelfAnchors.set(shelf.id, anchor)
        anchors.push(anchor)

        if (!bayMarkerAdded) {
          bayMarkerAdded = true
          miniMapMarkers.push({
            id: `bay-${spec.bay.id}`,
            anchorId: anchor.id,
            label: `${spec.section.name} · ${displayName}`,
            kind: 'shelf',
            x: bayWorldCenter.x,
            z: bayWorldCenter.z,
            level,
            shelfId: shelf.id,
            count: shelved.length
          })
        }

        const usableWidth = bayWidth - 0.32
        let cursorX = -usableWidth / 2 + 0.04

        shelved.forEach((book) => {
          const cell = cells.get(book.id)
          if (!cell) return

          // Proportional spine thickness based on page count!
          const pages = book.pageCount ?? 180
          const pageScale = Math.max(0.036, Math.min(0.072, 0.036 + (Math.min(pages, 700) / 700) * 0.036))
          const maxStep = usableWidth / Math.max(shelved.length, 1)
          const thickness = Math.min(pageScale, Math.max(0.032, maxStep * 0.88))
          const bookHeight = 0.245 + ((book.id * 31) % 7) * 0.017
          const bookDepth = 0.235 + ((book.id * 13) % 4) * 0.012

          const cx = cursorX + thickness / 2
          cursorX += thickness + 0.009

          const local = new THREE.Matrix4().compose(
            new THREE.Vector3(cx, shelfY + 0.026 + bookHeight / 2, 0.025),
            new THREE.Quaternion().setFromEuler(
              new THREE.Euler(0, 0, ((book.id % 5) - 2) * 0.004)
            ),
            new THREE.Vector3(thickness, bookHeight, bookDepth)
          )
          const matrix = bayMatrix.clone().multiply(local)

          placements.push({
            book,
            shelfId: shelf.id,
            matrix,
            position: new THREE.Vector3().setFromMatrixPosition(matrix),
            normal: normal.clone(),
            size: new THREE.Vector3(thickness, bookHeight, bookDepth),
            cell
          })

          // Delicate 3D woven gold silk bookmark ribbon peeking over currently-reading volumes
          if (book.readingState === 'reading') {
            const ribbonLocal = new THREE.Matrix4().compose(
              new THREE.Vector3(cx, shelfY + 0.026 + bookHeight + 0.014, 0.025 + bookDepth / 2 - 0.015),
              new THREE.Quaternion().setFromEuler(new THREE.Euler(0.18, 0, 0)),
              new THREE.Vector3(0.012, 0.045, 0.005)
            )
            bookmarkRibbonMatrices.push(bayMatrix.clone().multiply(ribbonLocal))
          }
        })

        if (shelved.length > 0 && shelved.length < 18) {
          const endX = Math.min(usableWidth / 2 - 0.04, cursorX + 0.028)
          const bookend = new THREE.Mesh(
            trackGeo(new THREE.BoxGeometry(0.024, 0.18, 0.16)),
            brassMat
          )
          bookend.position.set(endX, shelfY + 0.026 + 0.09, 0.015)
          bayGroup.add(bookend)
        }
      })

      group.add(bayGroup)
    })
  }

  // Instanced silk bookmark ribbons (1 draw call for all currently-reading books!)
  if (bookmarkRibbonMatrices.length > 0) {
    const ribbonGeo = trackGeo(new THREE.BoxGeometry(1, 1, 1))
    const ribbonInst = new THREE.InstancedMesh(ribbonGeo, ribbonMat, bookmarkRibbonMatrices.length)
    bookmarkRibbonMatrices.forEach((m, idx) => ribbonInst.setMatrixAt(idx, m))
    ribbonInst.instanceMatrix.needsUpdate = true
    ribbonInst.computeBoundingSphere()
    group.add(ribbonInst)
  }

  const bookMesh = buildSpineBatch(placements, spineTexture)

  // Rolling Library Ladder once shelving grows tall (4+ rows)
  if (maxVisibleShelves >= 4) {
    const ladder = new THREE.Group()
    for (const lx of [-0.26, 0.26]) {
      const rail = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.055, 3.1, 0.055)), woodMat)
      rail.position.set(lx, 1.55, 0)
      ladder.add(rail)
    }
    for (let r = 0; r < 9; r += 1) {
      const rung = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.52, 0.032, 0.035)), woodMat)
      rung.position.set(0, 0.28 + r * 0.32, 0)
      ladder.add(rung)
    }
    const hook = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(0.09, 0.018, 8, 14, Math.PI)),
      brassMat
    )
    hook.position.set(0, 3.08, 0)
    ladder.add(hook)
    ladder.position.set(4.1, 0, -ROOM_DEPTH / 2 + 0.56)
    ladder.rotation.x = -0.12
    group.add(ladder)
  }

  // 10. Grand Architect's Reading Desk (Centerpiece of the Nave)
  const desk = new THREE.Group()
  desk.position.set(0, 0, 0.35)

  const deskTop = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.9, 0.1, 1.32)), woodMat)
  deskTop.position.y = 0.8
  deskTop.castShadow = true
  deskTop.receiveShadow = true
  deskTop.userData.interactiveKind = 'desk'
  deskTop.userData.interactLabel = 'Reading Desk & Study Tracker'
  desk.add(deskTop)
  interactables.push(deskTop)

  const deskTrim = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.96, 0.025, 1.38)), brassMat)
  deskTrim.position.y = 0.76
  desk.add(deskTrim)

  const blotter = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(1.38, 0.016, 0.76)),
    trackMat(new THREE.MeshStandardMaterial({ color: palette.blotter, roughness: 0.7 }))
  )
  blotter.position.set(0, 0.858, 0.06)
  blotter.userData.interactiveKind = 'desk'
  blotter.userData.interactLabel = 'Reading Desk & Study Tracker'
  desk.add(blotter)
  interactables.push(blotter)

  for (const px of [-1.05, 1.05]) {
    const ped = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.58, 0.75, 1.08)), woodDarkMat)
    ped.position.set(px, 0.375, 0)
    ped.castShadow = true
    ped.receiveShadow = true
    ped.userData.interactiveKind = 'desk'
    ped.userData.interactLabel = 'Reading Desk & Study Tracker'
    desk.add(ped)
    interactables.push(ped)

    for (const dy of [0.22, 0.45, 0.64]) {
      const pull = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.16, 0.024, 0.032)), brassMat)
      pull.position.set(px, dy, 0.55)
      desk.add(pull)
    }
  }

  for (const lx of [-1.08, 1.08]) {
    const lampBase = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.11, 0.145, 0.048, 20)),
      brassMat
    )
    lampBase.position.set(lx, 0.875, -0.32)
    desk.add(lampBase)

    const lampStem = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.016, 0.022, 0.44, 12)),
      brassMat
    )
    lampStem.position.set(lx, 1.11, -0.32)
    desk.add(lampStem)

    const bankerShade = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.095, 0.125, 0.32, 14, 1, true, 0, Math.PI)),
      emeraldGlassMat
    )
    bankerShade.rotation.z = Math.PI / 2
    bankerShade.rotation.y = lx > 0 ? 0.38 : -0.38
    bankerShade.position.set(lx * 0.96, 1.32, -0.29)
    desk.add(bankerShade)

    const lampLight = new THREE.PointLight('#ffbe70', moodRig.lampIntensity, 7.5, 1.45)
    lampLight.position.set(lx * 0.96, 1.2, -0.26)
    desk.add(lampLight)

    const glow = new THREE.Sprite(
      trackMat(
        new THREE.SpriteMaterial({
          map: glowTex,
          color: '#ffc67d',
          transparent: true,
          opacity: mood === 'afternoon' ? 0.22 : 0.52,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      )
    )
    glow.position.set(lx * 0.96, 1.28, -0.26)
    glow.scale.set(1.25, 1.25, 1)
    desk.add(glow)
    lampGlows.push(glow)
  }

  const folioLeft = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.28, 0.022, 0.36)),
    trackMat(new THREE.MeshStandardMaterial({ color: '#e4d6b7', roughness: 0.88 }))
  )
  folioLeft.position.set(-0.15, 0.875, 0.08)
  folioLeft.rotation.z = 0.05
  folioLeft.userData.interactiveKind = 'desk'
  folioLeft.userData.interactLabel = 'Reading Desk & Study Tracker'
  desk.add(folioLeft)
  interactables.push(folioLeft)

  const folioRight = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.28, 0.022, 0.36)),
    trackMat(new THREE.MeshStandardMaterial({ color: '#eadec2', roughness: 0.88 }))
  )
  folioRight.position.set(0.13, 0.875, 0.08)
  folioRight.rotation.z = -0.05
  folioRight.userData.interactiveKind = 'desk'
  folioRight.userData.interactLabel = 'Reading Desk & Study Tracker'
  desk.add(folioRight)
  interactables.push(folioRight)

  const inkwell = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.036, 0.044, 0.05, 14)), brassMat)
  inkwell.position.set(0.46, 0.88, -0.08)
  desk.add(inkwell)

  const inboxStack = books.filter((b) => b.shelfId === null).slice(0, 6)
  inboxStack.forEach((book, i) => {
    const slab = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.34, 0.05, 0.25)),
      trackMat(
        new THREE.MeshStandardMaterial({
          color: bookSpineColor(book),
          roughness: 0.66
        })
      )
    )
    slab.position.set(-0.92, 0.875 + i * 0.052, 0.16)
    slab.rotation.y = (i % 2 === 0 ? 1 : -1) * 0.09
    slab.userData.bookId = book.id
    slab.userData.interactLabel = book.title
    desk.add(slab)
    interactables.push(slab)
  })

  group.add(desk)

  const deskShadow = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(3.8, 2.2)),
    trackMat(
      new THREE.MeshBasicMaterial({
        map: shadowTex,
        transparent: true,
        opacity: 0.56,
        depthWrite: false
      })
    )
  )
  deskShadow.rotation.x = -Math.PI / 2
  deskShadow.position.set(0, 0.024, 0.35)
  group.add(deskShadow)

  anchors.push({
    id: 'desk',
    label: 'Reading Desk',
    meta: 'Inbox, pinned & study stats',
    kind: 'desk',
    level: 1,
    position: new THREE.Vector3(0, EYE_HEIGHT, 2.65),
    lookAt: new THREE.Vector3(0, 0.96, 0.35)
  })
  miniMapMarkers.push({
    id: 'mm-desk',
    anchorId: 'desk',
    label: 'Reading Desk',
    kind: 'desk',
    x: 0,
    z: 0.35,
    level: 1
  })

  // 11. Interactive Antique Brass Armillary Globe (East Flank)
  const globeGroup = new THREE.Group()
  globeGroup.position.set(4.1, 0, 1.25)

  const gPedBase = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.36, 0.44, 0.18, 20)), woodDarkMat)
  gPedBase.position.y = 0.09
  globeGroup.add(gPedBase)

  const gPedCol = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.14, 0.19, 0.78, 16)), woodMat)
  gPedCol.position.y = 0.56
  gPedCol.castShadow = true
  globeGroup.add(gPedCol)

  const gPedTop = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.32, 0.24, 0.1, 20)), trimMat)
  gPedTop.position.y = 0.98
  gPedTop.userData.interactiveKind = 'globe'
  gPedTop.userData.interactLabel = 'Hall Atlas Globe'
  globeGroup.add(gPedTop)
  interactables.push(gPedTop)

  const meridian = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.38, 0.02, 10, 32)), brassMat)
  meridian.position.y = 1.44
  meridian.rotation.z = 0.41
  globeGroup.add(meridian)

  const horizonRing = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.41, 0.024, 10, 32)), brassMat)
  horizonRing.position.y = 1.44
  horizonRing.rotation.x = Math.PI / 2
  globeGroup.add(horizonRing)

  const globeSphere = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.33, 28, 20)),
    trackMat(
      new THREE.MeshStandardMaterial({
        map: globeTex,
        roughness: 0.42,
        metalness: 0.12
      })
    )
  )
  globeSphere.position.y = 1.44
  globeSphere.rotation.z = 0.41
  globeSphere.castShadow = true
  globeSphere.userData.interactiveKind = 'globe'
  globeSphere.userData.interactLabel = 'Hall Atlas Globe'
  globeGroup.add(globeSphere)
  interactables.push(globeSphere)

  group.add(globeGroup)

  anchors.push({
    id: 'globe',
    label: 'Atlas Globe',
    meta: 'Open Library Map',
    kind: 'globe',
    level: 1,
    position: new THREE.Vector3(2.6, EYE_HEIGHT, 2.25),
    lookAt: new THREE.Vector3(4.1, 1.35, 1.25)
  })
  miniMapMarkers.push({
    id: 'mm-globe',
    anchorId: 'globe',
    label: 'Atlas Globe',
    kind: 'globe',
    x: 4.1,
    z: 1.25,
    level: 1
  })

  // 12. Interactive Brass Gramophone (West Flank)
  const gramophone = new THREE.Group()
  gramophone.position.set(-4.4, 0, 1.4)
  gramophone.rotation.y = 0.62

  const gTable = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.84, 0.07, 0.64)), woodMat)
  gTable.position.y = 0.76
  gTable.castShadow = true
  gTable.userData.interactiveKind = 'gramophone'
  gTable.userData.interactLabel = 'Brass Gramophone'
  gramophone.add(gTable)
  interactables.push(gTable)

  for (const gx of [-0.34, 0.34]) {
    for (const gz of [-0.24, 0.24]) {
      const leg = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.055, 0.76, 0.055)), woodDarkMat)
      leg.position.set(gx, 0.38, gz)
      gramophone.add(leg)
    }
  }
  const gBox = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.42, 0.14, 0.38)), woodDarkMat)
  gBox.position.y = 0.865
  gBox.userData.interactiveKind = 'gramophone'
  gBox.userData.interactLabel = 'Brass Gramophone'
  gramophone.add(gBox)
  interactables.push(gBox)

  const platter = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.16, 0.16, 0.02, 28)),
    trackMat(new THREE.MeshStandardMaterial({ color: '#141210', roughness: 0.32, metalness: 0.28 }))
  )
  platter.position.y = 0.945
  gramophone.add(platter)

  const labelDot = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.048, 0.048, 0.022, 16)),
    trackMat(new THREE.MeshStandardMaterial({ color: '#a8412f', roughness: 0.48 }))
  )
  platter.add(labelDot)

  const hornPoints = [
    new THREE.Vector2(0.024, 0),
    new THREE.Vector2(0.04, 0.15),
    new THREE.Vector2(0.085, 0.3),
    new THREE.Vector2(0.18, 0.44),
    new THREE.Vector2(0.28, 0.54)
  ]
  const hornMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: palette.brass,
      roughness: 0.24,
      metalness: 0.88,
      side: THREE.DoubleSide
    })
  )
  const horn = new THREE.Mesh(trackGeo(new THREE.LatheGeometry(hornPoints, 24)), hornMat)
  horn.position.set(-0.08, 1.02, -0.08)
  horn.rotation.set(0.68, 0, -0.35)
  horn.userData.interactiveKind = 'gramophone'
  horn.userData.interactLabel = 'Brass Gramophone'
  gramophone.add(horn)
  interactables.push(horn)

  const crank = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.014, 0.014, 0.2, 8)), brassMat)
  crank.position.set(0.26, 0.87, 0)
  crank.rotation.z = Math.PI / 2
  gramophone.add(crank)

  group.add(gramophone)

  anchors.push({
    id: 'gramophone',
    label: 'Gramophone',
    meta: 'Ambient music & soundscape',
    kind: 'gramophone',
    level: 1,
    position: new THREE.Vector3(-2.75, EYE_HEIGHT, 2.35),
    lookAt: new THREE.Vector3(-4.4, 1.05, 1.4)
  })
  miniMapMarkers.push({
    id: 'mm-gramophone',
    anchorId: 'gramophone',
    label: 'Brass Gramophone',
    kind: 'gramophone',
    x: -4.4,
    z: 1.4,
    level: 1
  })

  // Fireplace Hearth, Grand Staircase & Upper Mezzanine Landmarks
  anchors.push({
    id: 'fireplace',
    label: 'Fireplace Hearth',
    meta: 'South-West fireside',
    kind: 'fireplace',
    level: 1,
    position: new THREE.Vector3(-4.45, EYE_HEIGHT, 4.15),
    lookAt: new THREE.Vector3(-4.55, 0.9, ROOM_DEPTH / 2 - 0.36)
  })
  miniMapMarkers.push({
    id: 'mm-fireplace',
    anchorId: 'fireplace',
    label: 'Fireplace Hearth',
    kind: 'fireplace',
    x: -4.55,
    z: ROOM_DEPTH / 2 - 0.65,
    level: 1
  })

  anchors.push({
    id: 'stairs',
    label: 'Grand Staircase',
    meta: 'Ascend to Upper Mezzanine',
    kind: 'stairs',
    level: 1,
    position: new THREE.Vector3(1.4, EYE_HEIGHT, 5.65),
    lookAt: new THREE.Vector3(5.6, 2.1, 5.65)
  })
  miniMapMarkers.push({
    id: 'mm-stairs',
    anchorId: 'stairs',
    label: 'Grand Staircase',
    kind: 'stairs',
    x: 2.3,
    z: 5.65,
    level: 1
  })

  anchors.push({
    id: 'balcony',
    label: 'Upper Balcony Overlook',
    meta: 'Mezzanine level · Telescope',
    kind: 'balcony',
    level: 2,
    position: new THREE.Vector3(-3.8, GALLERY_Y + EYE_HEIGHT, -6.15),
    lookAt: new THREE.Vector3(0, 1.9, 0.5)
  })
  miniMapMarkers.push({
    id: 'mm-balcony',
    anchorId: 'balcony',
    label: 'Upper Balcony Overlook',
    kind: 'balcony',
    x: -3.8,
    z: -6.15,
    level: 2
  })

  // 13. Tufted Leather Reading Armchairs flanking the nave
  for (const [cx, cz, ry] of [
    [-3.55, -2.2, 0.65],
    [3.55, -2.2, -0.65]
  ] as Array<[number, number, number]>) {
    const chair = new THREE.Group()
    chair.position.set(cx, 0, cz)
    chair.rotation.y = ry

    const seat = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.84, 0.24, 0.78)), leatherChairMat)
    seat.position.set(0, 0.44, 0)
    seat.castShadow = true
    chair.add(seat)

    const backrest = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.84, 0.74, 0.2)), leatherChairMat)
    backrest.position.set(0, 0.86, -0.3)
    backrest.rotation.x = -0.1
    backrest.castShadow = true
    chair.add(backrest)

    for (const ax of [-0.36, 0.36]) {
      const arm = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.16, 0.26, 0.72)), leatherChairMat)
      arm.position.set(ax, 0.62, -0.02)
      chair.add(arm)
    }

    for (const lx of [-0.34, 0.34]) {
      for (const lz of [-0.3, 0.3]) {
        const leg = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.032, 0.022, 0.32, 8)), woodDarkMat)
        leg.position.set(lx, 0.16, lz)
        chair.add(leg)
      }
    }

    const cShadow = new THREE.Mesh(
      trackGeo(new THREE.PlaneGeometry(1.45, 1.45)),
      trackMat(
        new THREE.MeshBasicMaterial({
          map: shadowTex,
          transparent: true,
          opacity: 0.44,
          depthWrite: false
        })
      )
    )
    cShadow.rotation.x = -Math.PI / 2
    cShadow.position.y = 0.01
    chair.add(cShadow)

    group.add(chair)
  }

  // 14. Atmospheric Floating Dust Motes across the Grand Hall
  let dust: THREE.Points | null = null
  if (quality !== 'low') {
    const count = quality === 'high' ? 320 : 180
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = (Math.random() - 0.5) * (ROOM_WIDTH - 1.8)
      positions[i * 3 + 1] = Math.random() * (WALL_HEIGHT - 0.9) + 0.35
      positions[i * 3 + 2] = (Math.random() - 0.5) * (ROOM_DEPTH - 1.8)
    }
    const dustGeo = trackGeo(new THREE.BufferGeometry())
    dustGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    dust = new THREE.Points(
      dustGeo,
      trackMat(
        new THREE.PointsMaterial({
          color: moodRig.dustColor,
          size: quality === 'high' ? 0.026 : 0.02,
          transparent: true,
          opacity: moodRig.dustOpacity,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          sizeAttenuation: true
        })
      )
    )
    group.add(dust)
  }

  return {
    group,
    interactables,
    floorMesh,
    anchors,
    shelfAnchors,
    miniMapMarkers,
    placements,
    bookMesh,
    dust,
    rainLines,
    platter,
    globeSphere,
    lampGlows,
    windowHalos,
    hearthLight,
    hearthFlame,
    disposables
  }
}
