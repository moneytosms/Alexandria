import type { MutableRefObject } from 'react'
import {
  lerp,
  sampleChoreography,
  smoothstep01,
  type HallMoodPreview
} from './choreography'

interface Vec3 {
  x: number
  y: number
  z: number
}

interface ProjectedPoint {
  x: number
  y: number
  z: number // camera-space depth (> 0 in front of camera)
  scale: number
}

interface DrawItem {
  depth: number
  draw: (ctx: CanvasRenderingContext2D) => void
}

interface Rgb {
  r: number
  g: number
  b: number
}

interface MoodPalette {
  brassLight: Rgb
  brassMid: Rgb
  brassDark: Rgb
  goldSpec: Rgb
  rimGlow: Rgb
  halo: Rgb
  mote: Rgb
}

const MOOD_PALETTES: Record<HallMoodPreview, MoodPalette> = {
  'dark-academia': {
    brassLight: { r: 236, g: 204, b: 138 },
    brassMid: { r: 186, g: 146, b: 80 },
    brassDark: { r: 84, g: 60, b: 28 },
    goldSpec: { r: 255, g: 232, b: 180 },
    rimGlow: { r: 138, g: 164, b: 210 },
    halo: { r: 210, g: 162, b: 84 },
    mote: { r: 245, g: 208, b: 132 }
  },
  'sunlit-marble': {
    brassLight: { r: 252, g: 234, b: 192 },
    brassMid: { r: 208, g: 174, b: 112 },
    brassDark: { r: 108, g: 84, b: 48 },
    goldSpec: { r: 255, g: 248, b: 226 },
    rimGlow: { r: 226, g: 206, b: 172 },
    halo: { r: 238, g: 208, b: 152 },
    mote: { r: 255, g: 238, b: 198 }
  },
  observatory: {
    brassLight: { r: 214, g: 206, b: 186 },
    brassMid: { r: 154, g: 142, b: 114 },
    brassDark: { r: 58, g: 58, b: 74 },
    goldSpec: { r: 218, g: 230, b: 255 },
    rimGlow: { r: 116, g: 158, b: 238 },
    halo: { r: 112, g: 150, b: 224 },
    mote: { r: 176, g: 204, b: 255 }
  }
}

function lerpRgb(out: Rgb, target: Rgb, t: number): void {
  out.r = lerp(out.r, target.r, t)
  out.g = lerp(out.g, target.g, t)
  out.b = lerp(out.b, target.b, t)
}

function mixRgb(a: Rgb, b: Rgb, t: number, alpha = 1): string {
  const c = Math.max(0, Math.min(1, t))
  const r = Math.round(a.r + (b.r - a.r) * c)
  const g = Math.round(a.g + (b.g - a.g) * c)
  const bl = Math.round(a.b + (b.b - a.b) * c)
  return alpha >= 0.999 ? `rgb(${r},${g},${bl})` : `rgba(${r},${g},${bl},${alpha.toFixed(3)})`
}

function clonePalette(p: MoodPalette): MoodPalette {
  return {
    brassLight: { ...p.brassLight },
    brassMid: { ...p.brassMid },
    brassDark: { ...p.brassDark },
    goldSpec: { ...p.goldSpec },
    rimGlow: { ...p.rimGlow },
    halo: { ...p.halo },
    mote: { ...p.mote }
  }
}

function rotX(v: Vec3, a: number): Vec3 {
  const c = Math.cos(a)
  const s = Math.sin(a)
  return { x: v.x, y: v.y * c - v.z * s, z: v.y * s + v.z * c }
}

function rotY(v: Vec3, a: number): Vec3 {
  const c = Math.cos(a)
  const s = Math.sin(a)
  return { x: v.x * c + v.z * s, y: v.y, z: -v.x * s + v.z * c }
}

function rotZ(v: Vec3, a: number): Vec3 {
  const c = Math.cos(a)
  const s = Math.sin(a)
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c, z: v.z }
}

function rotEulerXYZ(v: Vec3, rx: number, ry: number, rz: number): Vec3 {
  return rotZ(rotY(rotX(v, rx), ry), rz)
}

function normalize(v: Vec3): Vec3 {
  const len = Math.hypot(v.x, v.y, v.z) || 1
  return { x: v.x / len, y: v.y / len, z: v.z / len }
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
  }
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z
}

interface CameraBasis {
  pos: Vec3
  right: Vec3
  up: Vec3
  forward: Vec3
  focal: number
  cx: number
  cy: number
}

function buildCameraBasis(
  camX: number,
  camY: number,
  camZ: number,
  lookX: number,
  lookY: number,
  width: number,
  height: number
): CameraBasis {
  const pos = { x: camX, y: camY, z: camZ }
  const forward = normalize({ x: lookX - camX, y: lookY - camY, z: -camZ })
  const right = normalize(cross(forward, { x: 0, y: 1, z: 0 }))
  const up = cross(right, forward)
  const fovRad = (34 * Math.PI) / 180
  const focal = (height * 0.5) / Math.tan(fovRad * 0.5)
  return { pos, right, up, forward, focal, cx: width * 0.5, cy: height * 0.5 }
}

function project(cam: CameraBasis, p: Vec3): ProjectedPoint | null {
  const rx = p.x - cam.pos.x
  const ry = p.y - cam.pos.y
  const rz = p.z - cam.pos.z
  const z = rx * cam.forward.x + ry * cam.forward.y + rz * cam.forward.z
  if (z <= 0.15) return null
  const vx = rx * cam.right.x + ry * cam.right.y + rz * cam.right.z
  const vy = rx * cam.up.x + ry * cam.up.y + rz * cam.up.z
  const scale = cam.focal / z
  return {
    x: cam.cx + vx * scale,
    y: cam.cy - vy * scale,
    z,
    scale
  }
}

// Draw an affine-mapped image triangle onto a 2D canvas
function drawTexturedTriangle(
  ctx: CanvasRenderingContext2D,
  img: HTMLCanvasElement,
  sx0: number,
  sy0: number,
  sx1: number,
  sy1: number,
  sx2: number,
  sy2: number,
  u0: number,
  v0: number,
  u1: number,
  v1: number,
  u2: number,
  v2: number
): void {
  const denom = u0 * (v1 - v2) + u1 * (v2 - v0) + u2 * (v0 - v1)
  if (Math.abs(denom) < 1e-4) return

  const a = (sx0 * (v1 - v2) + sx1 * (v2 - v0) + sx2 * (v0 - v1)) / denom
  const b = (sy0 * (v1 - v2) + sy1 * (v2 - v0) + sy2 * (v0 - v1)) / denom
  const c = (sx0 * (u2 - u1) + sx1 * (u0 - u2) + sx2 * (u1 - u0)) / denom
  const d = (sy0 * (u2 - u1) + sy1 * (u0 - u2) + sy2 * (u1 - u0)) / denom
  const e =
    (sx0 * (u1 * v2 - u2 * v1) + sx1 * (u2 * v0 - u0 * v2) + sx2 * (u0 * v1 - u1 * v0)) / denom
  const f =
    (sy0 * (u1 * v2 - u2 * v1) + sy1 * (u2 * v0 - u0 * v2) + sy2 * (u0 * v1 - u1 * v0)) / denom

  ctx.save()
  ctx.beginPath()
  ctx.moveTo(sx0, sy0)
  ctx.lineTo(sx1, sy1)
  ctx.lineTo(sx2, sy2)
  ctx.closePath()
  ctx.clip()
  ctx.transform(a, b, c, d, e, f)
  ctx.drawImage(img, 0, 0)
  ctx.restore()
}

function drawTexturedQuad(
  ctx: CanvasRenderingContext2D,
  img: HTMLCanvasElement,
  tl: ProjectedPoint,
  tr: ProjectedPoint,
  br: ProjectedPoint,
  bl: ProjectedPoint,
  shadeAlpha: number
): void {
  const w = img.width
  const h = img.height
  // Slight 2x2 subdivision reduces affine perspective skew cleanly
  const lerpP = (p0: ProjectedPoint, p1: ProjectedPoint, t: number): ProjectedPoint => ({
    x: p0.x + (p1.x - p0.x) * t,
    y: p0.y + (p1.y - p0.y) * t,
    z: p0.z + (p1.z - p0.z) * t,
    scale: p0.scale + (p1.scale - p0.scale) * t
  })

  const grid: ProjectedPoint[][] = []
  for (let row = 0; row <= 2; row++) {
    const v = row / 2
    const left = lerpP(tl, bl, v)
    const right = lerpP(tr, br, v)
    const pts: ProjectedPoint[] = []
    for (let col = 0; col <= 2; col++) {
      pts.push(lerpP(left, right, col / 2))
    }
    grid.push(pts)
  }

  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 2; col++) {
      const p00 = grid[row][col]
      const p10 = grid[row][col + 1]
      const p11 = grid[row + 1][col + 1]
      const p01 = grid[row + 1][col]
      const u0 = (col / 2) * w
      const u1 = ((col + 1) / 2) * w
      const v0 = (row / 2) * h
      const v1 = ((row + 1) / 2) * h
      drawTexturedTriangle(ctx, img, p00.x, p00.y, p10.x, p10.y, p11.x, p11.y, u0, v0, u1, v0, u1, v1)
      drawTexturedTriangle(ctx, img, p00.x, p00.y, p11.x, p11.y, p01.x, p01.y, u0, v0, u1, v1, u0, v1)
    }
  }

  if (shadeAlpha > 0.01) {
    ctx.fillStyle = `rgba(8, 5, 3, ${Math.min(0.65, shadeAlpha).toFixed(3)})`
    ctx.beginPath()
    ctx.moveTo(tl.x, tl.y)
    ctx.lineTo(tr.x, tr.y)
    ctx.lineTo(br.x, br.y)
    ctx.lineTo(bl.x, bl.y)
    ctx.closePath()
    ctx.fill()
  }
}

function buildCoverCanvas(): HTMLCanvasElement {
  const width = 320
  const height = 430
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  const grad = ctx.createLinearGradient(0, 0, width, height)
  grad.addColorStop(0, '#301714')
  grad.addColorStop(0.5, '#22100e')
  grad.addColorStop(1, '#140908')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, width, height)

  // Gold-tooled frames
  ctx.strokeStyle = '#caa259'
  ctx.lineWidth = 2.2
  ctx.strokeRect(18, 18, width - 36, height - 36)
  ctx.strokeStyle = 'rgba(216, 180, 108, 0.58)'
  ctx.lineWidth = 1
  ctx.strokeRect(27, 27, width - 54, height - 54)

  // Corner brass clasps
  ctx.fillStyle = '#d8b468'
  const cSize = 18
  ctx.fillRect(0, 0, cSize, cSize)
  ctx.fillRect(width - cSize, 0, cSize, cSize)
  ctx.fillRect(0, height - cSize, cSize, cSize)
  ctx.fillRect(width - cSize, height - cSize, cSize, cSize)

  // Central gilded armillary emblem
  const cx = width / 2
  const cy = height * 0.53
  ctx.strokeStyle = '#dcba72'
  ctx.lineWidth = 1.8
  ctx.beginPath()
  ctx.arc(cx, cy, 52, 0, Math.PI * 2)
  ctx.stroke()

  ctx.lineWidth = 1.1
  ctx.beginPath()
  ctx.ellipse(cx, cy, 52, 18, -0.35, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.ellipse(cx, cy, 19, 52, 0.25, 0, Math.PI * 2)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(cx - 66, cy)
  ctx.lineTo(cx + 66, cy)
  ctx.moveTo(cx, cy - 66)
  ctx.lineTo(cx, cy + 66)
  ctx.stroke()

  ctx.fillStyle = '#e7c986'
  ctx.beginPath()
  ctx.arc(cx, cy, 4, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = '#f0d28b'
  ctx.font = '700 28px Georgia, serif'
  ctx.textAlign = 'center'
  ctx.fillText('ALEXANDRIA', cx, 84)

  ctx.fillStyle = 'rgba(232, 198, 126, 0.8)'
  ctx.font = '600 10px Georgia, serif'
  ctx.fillText('BIBLIOTHECA · CODEX I', cx, height - 48)

  return canvas
}

function buildParchmentCanvas(side: 'left' | 'right'): HTMLCanvasElement {
  const width = 320
  const height = 430
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  const grad = ctx.createLinearGradient(
    side === 'left' ? width : 0,
    0,
    side === 'left' ? 0 : width,
    0
  )
  grad.addColorStop(0, '#cfc1a6')
  grad.addColorStop(0.16, '#ede2cc')
  grad.addColorStop(0.86, '#f4eddd')
  grad.addColorStop(1, '#e5d8bf')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, width, height)

  ctx.strokeStyle = 'rgba(154, 120, 64, 0.45)'
  ctx.lineWidth = 1
  ctx.strokeRect(22, 24, width - 44, height - 48)

  ctx.fillStyle = '#6c5a42'
  ctx.font = '600 8px Georgia, serif'
  ctx.textAlign = side === 'left' ? 'left' : 'right'
  ctx.fillText(
    side === 'left' ? 'DE SPHERA CELESTI · IV' : 'MARGINALIA · V',
    side === 'left' ? 32 : width - 32,
    42
  )

  ctx.strokeStyle = 'rgba(154, 120, 64, 0.35)'
  ctx.beginPath()
  ctx.moveTo(32, 50)
  ctx.lineTo(width - 32, 50)
  ctx.stroke()

  if (side === 'left') {
    ctx.fillStyle = '#251d14'
    ctx.font = '600 15px Georgia, serif'
    ctx.textAlign = 'left'
    ctx.fillText('On the Celestial Meridian', 32, 76)

    // Drop cap
    ctx.fillStyle = '#231610'
    ctx.fillRect(32, 90, 34, 34)
    ctx.strokeStyle = '#c8a25b'
    ctx.strokeRect(32, 90, 34, 34)
    ctx.fillStyle = '#e3c27f'
    ctx.font = '700 24px Georgia, serif'
    ctx.textAlign = 'center'
    ctx.fillText('A', 49, 115)

    // Crisp text lines
    ctx.fillStyle = '#3a2e22'
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(74, 96 + i * 11, 198 - (i % 2) * 24, 3)
    }
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(32, 138 + i * 12, 246 - (i === 3 ? 65 : 0), 3)
    }

    // Engraved astronomical diagram
    const cx = width / 2
    const cy = 285
    ctx.strokeStyle = '#7c5d2c'
    ctx.lineWidth = 1.2
    ctx.beginPath()
    ctx.arc(cx, cy, 68, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(cx, cy, 48, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.ellipse(cx, cy, 68, 24, -0.32, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.ellipse(cx, cy, 26, 68, 0.22, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(cx - 80, cy)
    ctx.lineTo(cx + 80, cy)
    ctx.moveTo(cx, cy - 80)
    ctx.lineTo(cx, cy + 80)
    ctx.stroke()
  } else {
    ctx.fillStyle = '#251d14'
    ctx.font = '600 14px Georgia, serif'
    ctx.textAlign = 'left'
    ctx.fillText('Non-Destructive Marginalia', 32, 76)

    // Archival highlights
    ctx.fillStyle = 'rgba(224, 178, 72, 0.48)'
    ctx.fillRect(30, 94, 232, 12)
    ctx.fillRect(30, 110, 176, 12)

    ctx.fillStyle = 'rgba(116, 178, 134, 0.38)'
    ctx.fillRect(30, 196, 240, 12)
    ctx.fillRect(30, 212, 138, 12)

    ctx.fillStyle = 'rgba(214, 148, 86, 0.40)'
    ctx.fillRect(30, 298, 214, 12)

    ctx.fillStyle = '#33281c'
    for (let block = 0; block < 3; block++) {
      const by = 98 + block * 102
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(32, by + i * 16, 242 - (i === 3 ? 52 : (i % 2) * 18), 3)
      }
    }

    // Freehand sepia ink flourish
    ctx.strokeStyle = '#9c4328'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(32, 126)
    ctx.bezierCurveTo(96, 130, 155, 122, 224, 128)
    ctx.stroke()

    ctx.strokeStyle = '#7e5a23'
    ctx.lineWidth = 1.8
    ctx.beginPath()
    ctx.moveTo(276, 190)
    ctx.quadraticCurveTo(288, 208, 276, 228)
    ctx.stroke()
  }

  return canvas
}

const ROMAN_NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']

/**
 * Starts a full 3D-projected Canvas 2D software renderer for the Armillary Sphere
 * and Hinged Leather Folio when WebGL2 is unavailable (e.g., GPU sandboxed or disabled).
 * Uses the exact same scroll choreography, pointer parallax, and HallMoodPreview lighting.
 */
export function mountArmillaryCanvas2D(
  container: HTMLDivElement,
  scrollProgressRef: MutableRefObject<number>,
  moodRef: MutableRefObject<HallMoodPreview>,
  reducedMotion: boolean
): () => void {
  const canvas = document.createElement('canvas')
  canvas.style.width = '100%'
  canvas.style.height = '100%'
  canvas.style.display = 'block'
  container.appendChild(canvas)

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    if (canvas.parentElement === container) container.removeChild(canvas)
    return () => {}
  }

  const coverImg = buildCoverCanvas()
  const parchmentLeftImg = buildParchmentCanvas('left')
  const parchmentRightImg = buildParchmentCanvas('right')

  let viewportW = window.innerWidth
  let viewportH = Math.max(1, window.innerHeight)

  const resize = (): void => {
    viewportW = window.innerWidth
    viewportH = Math.max(1, window.innerHeight)
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(viewportW * dpr)
    canvas.height = Math.round(viewportH * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }
  resize()
  window.addEventListener('resize', resize)

  const pointerTarget = { x: 0, y: 0 }
  const pointerCurrent = { x: 0, y: 0 }
  const onPointerMove = (e: PointerEvent): void => {
    if (reducedMotion) return
    pointerTarget.x = (e.clientX / Math.max(1, window.innerWidth) - 0.5) * 2
    pointerTarget.y = (e.clientY / Math.max(1, window.innerHeight) - 0.5) * 2
  }
  window.addEventListener('pointermove', onPointerMove, { passive: true })

  // Deterministic dust motes orbiting in 3D space
  const motes: Array<{ x: number; y: number; z: number; speed: number; size: number; phase: number }> = []
  let seed = 1337
  const rand = (): number => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
  for (let i = 0; i < 64; i++) {
    const r = 1.35 + rand() * 4.2
    const theta = rand() * Math.PI * 2
    motes.push({
      x: Math.cos(theta) * r,
      y: (rand() - 0.5) * 5.2,
      z: Math.sin(theta) * r - 0.5,
      speed: 0.06 + rand() * 0.14,
      size: 1.2 + rand() * 2.1,
      phase: rand() * Math.PI * 2
    })
  }

  const state = { ...sampleChoreography(scrollProgressRef.current, viewportW, viewportH) }
  const palette = clonePalette(MOOD_PALETTES[moodRef.current])
  const keyDir = normalize({ x: 0.62, y: 0.68, z: 0.55 })
  const rimDir = normalize({ x: -0.7, y: 0.35, z: -0.45 })

  let rafId = 0
  let disposed = false
  let lastTs = performance.now()
  let elapsed = 0

  const renderFrame = (now: number): void => {
    if (disposed || document.hidden) {
      rafId = 0
      return
    }
    rafId = window.requestAnimationFrame(renderFrame)

    const dt = Math.min(0.05, Math.max(0.001, (now - lastTs) / 1000))
    lastTs = now
    elapsed += dt

    const target = sampleChoreography(scrollProgressRef.current, viewportW, viewportH)
    const damp = reducedMotion ? 1 : 1 - Math.exp(-5.0 * dt)
    state.camX = lerp(state.camX, target.camX, damp)
    state.camY = lerp(state.camY, target.camY, damp)
    state.camZ = lerp(state.camZ, target.camZ, damp)
    state.lookX = lerp(state.lookX, target.lookX, damp)
    state.lookY = lerp(state.lookY, target.lookY, damp)
    state.rigX = lerp(state.rigX, target.rigX, damp)
    state.rigY = lerp(state.rigY, target.rigY, damp)
    state.rigScale = lerp(state.rigScale, target.rigScale, damp)
    state.rigRotX = lerp(state.rigRotX, target.rigRotX, damp)
    state.rigRotY = lerp(state.rigRotY, target.rigRotY, damp)
    state.ringSpread = lerp(state.ringSpread, target.ringSpread, damp)
    state.folioOpen = lerp(state.folioOpen, target.folioOpen, damp)
    state.folioZ = lerp(state.folioZ, target.folioZ, damp)
    state.folioTiltX = lerp(state.folioTiltX, target.folioTiltX, damp)
    state.folioScale = lerp(state.folioScale, target.folioScale, damp)

    const lightDamp = reducedMotion ? 1 : 1 - Math.exp(-3.5 * dt)
    const targetPal = MOOD_PALETTES[moodRef.current]
    lerpRgb(palette.brassLight, targetPal.brassLight, lightDamp)
    lerpRgb(palette.brassMid, targetPal.brassMid, lightDamp)
    lerpRgb(palette.brassDark, targetPal.brassDark, lightDamp)
    lerpRgb(palette.goldSpec, targetPal.goldSpec, lightDamp)
    lerpRgb(palette.rimGlow, targetPal.rimGlow, lightDamp)
    lerpRgb(palette.halo, targetPal.halo, lightDamp)
    lerpRgb(palette.mote, targetPal.mote, lightDamp)

    const pDamp = 1 - Math.exp(-3.0 * dt)
    pointerCurrent.x = lerp(pointerCurrent.x, pointerTarget.x, pDamp)
    pointerCurrent.y = lerp(pointerCurrent.y, pointerTarget.y, pDamp)

    const cam = buildCameraBasis(
      state.camX + pointerCurrent.x * 0.16,
      state.camY - pointerCurrent.y * 0.12,
      state.camZ,
      state.lookX,
      state.lookY,
      viewportW,
      viewportH
    )

    ctx.clearRect(0, 0, viewportW, viewportH)

    const floatY = reducedMotion ? 0 : Math.sin(elapsed * 0.8) * 0.055
    const rigOrigin: Vec3 = { x: state.rigX, y: state.rigY + floatY, z: 0 }
    const rigScale = state.rigScale
    const idleSpin = reducedMotion ? 0 : elapsed

    // Soft atmospheric studio halo behind the armillary centerpiece
    const centerProj = project(cam, rigOrigin)
    if (centerProj) {
      const haloR = Math.max(120, centerProj.scale * 2.4 * rigScale)
      const haloGrad = ctx.createRadialGradient(
        centerProj.x,
        centerProj.y,
        haloR * 0.05,
        centerProj.x,
        centerProj.y,
        haloR
      )
      haloGrad.addColorStop(0, mixRgb(palette.halo, palette.goldSpec, 0.25, 0.16))
      haloGrad.addColorStop(0.55, mixRgb(palette.halo, palette.rimGlow, 0.35, 0.055))
      haloGrad.addColorStop(1, 'rgba(12, 10, 9, 0)')
      ctx.fillStyle = haloGrad
      ctx.fillRect(0, 0, viewportW, viewportH)
    }

    const drawList: DrawItem[] = []

    const armRotX = state.rigRotX + pointerCurrent.y * 0.06
    const armRotY = state.rigRotY + pointerCurrent.x * 0.09 + idleSpin * 0.075
    const armSpreadScale = 1 + state.ringSpread * 0.08
    const armOffsetZ = -state.ringSpread * 0.45

    const toWorldFromArmillary = (local: Vec3): Vec3 => {
      const s = {
        x: local.x * armSpreadScale,
        y: local.y * armSpreadScale,
        z: local.z * armSpreadScale
      }
      const r = rotEulerXYZ(s, armRotX, armRotY, 0)
      return {
        x: rigOrigin.x + r.x * rigScale,
        y: rigOrigin.y + r.y * rigScale,
        z: rigOrigin.z + (r.z + armOffsetZ) * rigScale
      }
    }

    const normalToWorldArm = (n: Vec3): Vec3 => normalize(rotEulerXYZ(n, armRotX, armRotY, 0))

    // Helper: shade metallic brass by world normal
    const brassStrokeColor = (worldNorm: Vec3, variant: 'brass' | 'gold' | 'bronze'): string => {
      const ndl = Math.max(0, dot(worldNorm, keyDir))
      const ndr = Math.max(0, dot(worldNorm, rimDir))
      if (variant === 'bronze') {
        return mixRgb(palette.brassDark, palette.brassMid, 0.22 + ndl * 0.55)
      }
      if (variant === 'gold') {
        const base = mixRgb(palette.brassMid, palette.goldSpec, 0.3 + ndl * 0.7)
        return ndr > 0.55 ? mixRgb(palette.brassLight, palette.rimGlow, 0.28) : base
      }
      const t = 0.18 + ndl * 0.78
      if (t > 0.78) {
        return mixRgb(palette.brassLight, palette.goldSpec, (t - 0.78) / 0.22)
      }
      return mixRgb(palette.brassDark, palette.brassLight, t / 0.78)
    }

    // Helper: push a 3D ring as depth-sorted curved segments with metallic sheen
    const pushRing = (
      tubeWorld: number,
      segments: number,
      variant: 'brass' | 'gold' | 'bronze',
      pointAt: (theta: number) => Vec3
    ): void => {
      const worldPts: Vec3[] = []
      const projPts: Array<ProjectedPoint | null> = []
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2
        const wp = toWorldFromArmillary(pointAt(theta))
        worldPts.push(wp)
        projPts.push(project(cam, wp))
      }

      for (let i = 0; i < segments; i++) {
        const p0 = projPts[i]
        const p1 = projPts[i + 1]
        if (!p0 || !p1) continue
        const w0 = worldPts[i]
        const w1 = worldPts[i + 1]
        const midW = {
          x: (w0.x + w1.x) * 0.5 - rigOrigin.x,
          y: (w0.y + w1.y) * 0.5 - rigOrigin.y,
          z: (w0.z + w1.z) * 0.5 - rigOrigin.z
        }
        const nrm = normalize(midW)
        const depth = (p0.z + p1.z) * 0.5
        const lineW = Math.max(1.1, tubeWorld * 2 * ((p0.scale + p1.scale) * 0.5) * rigScale)
        const mainColor = brassStrokeColor(nrm, variant)
        const highlight = mixRgb(palette.goldSpec, palette.brassLight, 0.35, 0.55)
        const innerShade = mixRgb(palette.brassDark, { r: 24, g: 16, b: 8 }, 0.45, 0.5)

        drawList.push({
          depth,
          draw: (c) => {
            c.lineCap = 'round'
            // Continuous brushed brass body (no dark cap seams between adjacent segments)
            c.strokeStyle = mainColor
            c.lineWidth = lineW
            c.beginPath()
            c.moveTo(p0.x, p0.y)
            c.lineTo(p1.x, p1.y)
            c.stroke()

            // Lower beveled bronze shadow along bottom edge for cylindrical 3D depth
            if (lineW >= 2.0) {
              c.strokeStyle = innerShade
              c.lineWidth = Math.max(0.8, lineW * 0.24)
              c.beginPath()
              c.moveTo(p0.x, p0.y + lineW * 0.26)
              c.lineTo(p1.x, p1.y + lineW * 0.26)
              c.stroke()

              // Fine specular metallic ridge along upper key-lit edge
              c.strokeStyle = highlight
              c.lineWidth = Math.max(0.7, lineW * 0.24)
              c.beginPath()
              c.moveTo(p0.x, p0.y - lineW * 0.22)
              c.lineTo(p1.x, p1.y - lineW * 0.22)
              c.stroke()
            }
          }
        })
      }
    }

    // 1. Outer Meridian Ring (radius 1.62) + Dark Bronze Inner Track (1.56)
    pushRing(0.036, 72, 'brass', (t) => ({ x: Math.cos(t) * 1.62, y: Math.sin(t) * 1.62, z: 0 }))
    pushRing(0.014, 60, 'bronze', (t) => ({ x: Math.cos(t) * 1.56, y: Math.sin(t) * 1.56, z: 0 }))

    // 4 Cardinal Brackets + Gold Studs
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2
      const wp = toWorldFromArmillary({ x: Math.cos(a) * 1.62, y: Math.sin(a) * 1.62, z: 0 })
      const proj = project(cam, wp)
      if (proj) {
        const r = Math.max(3, 0.055 * proj.scale * rigScale)
        const studCol = mixRgb(palette.brassLight, palette.goldSpec, 0.65)
        const collarCol = mixRgb(palette.brassDark, palette.brassMid, 0.25)
        drawList.push({
          depth: proj.z - 0.02,
          draw: (c) => {
            c.fillStyle = collarCol
            c.beginPath()
            c.arc(proj.x, proj.y, r * 1.3, 0, Math.PI * 2)
            c.fill()
            c.fillStyle = studCol
            c.beginPath()
            c.arc(proj.x, proj.y, r * 0.72, 0, Math.PI * 2)
            c.fill()
          }
        })
      }
    }

    // Polar Axis Spindle + North & South Diamond Finials
    const axisSegments = 16
    for (let i = 0; i < axisSegments; i++) {
      const y0 = -1.72 + (i / axisSegments) * 3.44
      const y1 = -1.72 + ((i + 1) / axisSegments) * 3.44
      const p0 = project(cam, toWorldFromArmillary({ x: 0, y: y0, z: 0 }))
      const p1 = project(cam, toWorldFromArmillary({ x: 0, y: y1, z: 0 }))
      if (!p0 || !p1) continue
      const depth = (p0.z + p1.z) * 0.5
      const lw = Math.max(1.2, 0.024 * ((p0.scale + p1.scale) * 0.5) * rigScale)
      const col = mixRgb(palette.brassDark, palette.brassMid, 0.45)
      drawList.push({
        depth,
        draw: (c) => {
          c.strokeStyle = col
          c.lineWidth = lw
          c.beginPath()
          c.moveTo(p0.x, p0.y)
          c.lineTo(p1.x, p1.y)
          c.stroke()
        }
      })
    }

    for (const ySign of [-1, 1]) {
      const tip = project(cam, toWorldFromArmillary({ x: 0, y: ySign * 1.94, z: 0 }))
      const base = project(cam, toWorldFromArmillary({ x: 0, y: ySign * 1.7, z: 0 }))
      const mid = project(cam, toWorldFromArmillary({ x: 0, y: ySign * 1.82, z: 0 }))
      if (tip && base && mid) {
        const halfW = Math.max(4, 0.055 * mid.scale * rigScale)
        const dx = tip.x - base.x
        const dy = tip.y - base.y
        const len = Math.hypot(dx, dy) || 1
        const px = (-dy / len) * halfW
        const py = (dx / len) * halfW
        const lightCol = mixRgb(palette.brassLight, palette.goldSpec, 0.65)
        const darkCol = mixRgb(palette.brassDark, palette.brassMid, 0.45)
        drawList.push({
          depth: mid.z,
          draw: (c) => {
            c.fillStyle = lightCol
            c.beginPath()
            c.moveTo(tip.x, tip.y)
            c.lineTo(mid.x + px, mid.y + py)
            c.lineTo(base.x, base.y)
            c.closePath()
            c.fill()

            c.fillStyle = darkCol
            c.beginPath()
            c.moveTo(tip.x, tip.y)
            c.lineTo(mid.x - px, mid.y - py)
            c.lineTo(base.x, base.y)
            c.closePath()
            c.fill()
          }
        })
      }
    }

    // 2. Engraved Ecliptic Zodiac Ribbon Band (radius 1.38, tilted 23.4°)
    const eclipticTilt = (23.4 * Math.PI) / 180
    const eclipticSpin = idleSpin * 0.16 + state.ringSpread * 0.72
    const eclipticTransform = (v: Vec3): Vec3 => rotZ(rotY(v, eclipticSpin), eclipticTilt)

    const bandSegs = 60
    const bandR = 1.38
    const bandHalfH = 0.1
    for (let i = 0; i < bandSegs; i++) {
      const t0 = (i / bandSegs) * Math.PI * 2
      const t1 = ((i + 1) / bandSegs) * Math.PI * 2
      const tMid = (t0 + t1) * 0.5

      const pTop0 = project(
        cam,
        toWorldFromArmillary(
          eclipticTransform({ x: Math.cos(t0) * bandR, y: bandHalfH, z: Math.sin(t0) * bandR })
        )
      )
      const pTop1 = project(
        cam,
        toWorldFromArmillary(
          eclipticTransform({ x: Math.cos(t1) * bandR, y: bandHalfH, z: Math.sin(t1) * bandR })
        )
      )
      const pBot1 = project(
        cam,
        toWorldFromArmillary(
          eclipticTransform({ x: Math.cos(t1) * bandR, y: -bandHalfH, z: Math.sin(t1) * bandR })
        )
      )
      const pBot0 = project(
        cam,
        toWorldFromArmillary(
          eclipticTransform({ x: Math.cos(t0) * bandR, y: -bandHalfH, z: Math.sin(t0) * bandR })
        )
      )

      if (!pTop0 || !pTop1 || !pBot1 || !pBot0) continue

      const localNorm = eclipticTransform({ x: Math.cos(tMid), y: 0, z: Math.sin(tMid) })
      const worldNorm = normalToWorldArm(localNorm)
      const ndl = Math.abs(dot(worldNorm, keyDir))
      const ndr = Math.max(0, dot(worldNorm, rimDir))
      const fillCol =
        ndl > 0.72
          ? mixRgb(palette.brassLight, palette.goldSpec, (ndl - 0.72) / 0.28)
          : mixRgb(palette.brassDark, palette.brassLight, 0.22 + ndl * 0.75 + ndr * 0.12)
      const rimCol = mixRgb(palette.brassLight, palette.goldSpec, 0.65)
      const tickCol = 'rgba(28, 18, 8, 0.62)'
      const depth = (pTop0.z + pTop1.z + pBot1.z + pBot0.z) * 0.25
      const showNumeral = i % 5 === 2
      const numeral = ROMAN_NUMERALS[Math.floor((i / bandSegs) * 12) % 12]

      drawList.push({
        depth,
        draw: (c) => {
          c.fillStyle = fillCol
          c.beginPath()
          c.moveTo(pTop0.x, pTop0.y)
          c.lineTo(pTop1.x, pTop1.y)
          c.lineTo(pBot1.x, pBot1.y)
          c.lineTo(pBot0.x, pBot0.y)
          c.closePath()
          c.fill()

          // Top and bottom gold rim wires
          c.strokeStyle = rimCol
          c.lineWidth = Math.max(1, 0.018 * pTop0.scale * rigScale)
          c.beginPath()
          c.moveTo(pTop0.x, pTop0.y)
          c.lineTo(pTop1.x, pTop1.y)
          c.moveTo(pBot0.x, pBot0.y)
          c.lineTo(pBot1.x, pBot1.y)
          c.stroke()

          // Engraved degree tick marks
          const mx0 = (pTop0.x + pBot0.x) * 0.5
          const my0 = (pTop0.y + pBot0.y) * 0.5
          c.strokeStyle = tickCol
          c.lineWidth = 1
          c.beginPath()
          c.moveTo(pTop0.x, pTop0.y)
          c.lineTo(pTop0.x + (mx0 - pTop0.x) * 0.32, pTop0.y + (my0 - pTop0.y) * 0.32)
          c.moveTo(pBot0.x, pBot0.y)
          c.lineTo(pBot0.x + (mx0 - pBot0.x) * 0.32, pBot0.y + (my0 - pBot0.y) * 0.32)
          c.stroke()

          if (showNumeral) {
            const cx = (pTop0.x + pTop1.x + pBot1.x + pBot0.x) * 0.25
            const cy = (pTop0.y + pTop1.y + pBot1.y + pBot0.y) * 0.25
            const segW = Math.hypot(pTop1.x - pTop0.x, pTop1.y - pTop0.y)
            const segH = Math.hypot(pBot0.x - pTop0.x, pBot0.y - pTop0.y)
            if (segW > 4.5 && segH > 7) {
              let angle = Math.atan2(pTop1.y - pTop0.y, pTop1.x - pTop0.x)
              if (angle > Math.PI * 0.5) angle -= Math.PI
              else if (angle < -Math.PI * 0.5) angle += Math.PI
              c.save()
              c.translate(cx, cy)
              c.rotate(angle)
              c.fillStyle = 'rgba(26, 16, 6, 0.78)'
              c.font = `600 ${Math.max(7, Math.min(13, segH * 0.48)).toFixed(1)}px Georgia, serif`
              c.textAlign = 'center'
              c.textBaseline = 'middle'
              c.fillText(numeral, 0, 0)
              c.restore()
            }
          }
        }
      })
    }

    // 3. Equatorial Ring (radius 1.24) + 12 Gold Studs
    const eqSpinY = -idleSpin * 0.11
    const eqTiltZ = state.ringSpread * 0.36
    const eqPoint = (t: number): Vec3 =>
      rotZ(rotY({ x: Math.cos(t) * 1.24, y: 0, z: Math.sin(t) * 1.24 }, eqSpinY), eqTiltZ)
    pushRing(0.024, 60, 'brass', eqPoint)

    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      const proj = project(cam, toWorldFromArmillary(eqPoint(a)))
      if (proj) {
        const r = Math.max(2, 0.028 * proj.scale * rigScale)
        const col = mixRgb(palette.brassLight, palette.goldSpec, 0.75)
        drawList.push({
          depth: proj.z - 0.01,
          draw: (c) => {
            c.fillStyle = col
            c.beginPath()
            c.arc(proj.x, proj.y, r, 0, Math.PI * 2)
            c.fill()
          }
        })
      }
    }

    // 4. Inner Solstitial Colure Ring (radius 1.04)
    const colRotY = idleSpin * 0.22 + state.ringSpread * 0.9
    const colRotX = state.ringSpread * 0.28
    pushRing(0.017, 52, 'brass', (t) =>
      rotX(rotY({ x: 0, y: Math.sin(t) * 1.04, z: Math.cos(t) * 1.04 }, colRotY), colRotX)
    )

    // 5. Delicate Outer Horizon Astrolabe Ring (radius 1.84)
    const horSpinY = -idleSpin * 0.055
    const horScale = 1 + state.ringSpread * 0.06
    pushRing(0.012, 72, 'gold', (t) => {
      const base = rotX(
        { x: Math.cos(t) * 1.84 * horScale, y: Math.sin(t) * 1.84 * horScale, z: 0 },
        Math.PI / 2 + 0.18
      )
      return rotY(base, horSpinY)
    })

    // =========================================================================
    // 6. HINGED LEATHER-BOUND ILLUMINATED FOLIO (3D DEPTH-SORTED WITH RINGS!)
    // =========================================================================
    const bookW = 0.86
    const bookH = 1.18
    const coverT = 0.028
    const pageBlockT = 0.056
    const spineHalfSpan = pageBlockT + coverT * 0.5
    const openT = smoothstep01(state.folioOpen)
    const hingeAngle = lerp(Math.PI * 0.5, 0.22, openT)
    const hingeOffset = lerp(spineHalfSpan, 0.01, openT)
    const closedYaw = -0.82 + (reducedMotion ? 0 : Math.sin(elapsed * 0.52) * 0.12)
    const openYaw = -0.18 + pointerCurrent.x * 0.08
    const folioRx = state.folioTiltX + pointerCurrent.y * 0.04
    const folioRy = lerp(closedYaw, openYaw, openT)
    const folioRz = lerp(-0.06, 0.0, openT)

    const toWorldFromFolio = (local: Vec3): Vec3 => {
      const s = {
        x: local.x * state.folioScale,
        y: local.y * state.folioScale,
        z: local.z * state.folioScale
      }
      const r = rotEulerXYZ(s, folioRx, folioRy, folioRz)
      return {
        x: rigOrigin.x + r.x * rigScale,
        y: rigOrigin.y + r.y * rigScale,
        z: rigOrigin.z + (r.z + state.folioZ) * rigScale
      }
    }

    const toWorldFromHinge = (side: 'left' | 'right', p: Vec3): Vec3 => {
      const sign = side === 'left' ? -1 : 1
      const angle = side === 'left' ? hingeAngle : -hingeAngle
      const r = rotY(p, angle)
      return toWorldFromFolio({ x: r.x + sign * hingeOffset, y: r.y, z: r.z })
    }

    const pushFlatQuad = (
      cornersWorld: [Vec3, Vec3, Vec3, Vec3],
      fillStyle: string,
      strokeStyle?: string,
      depthBias = 0
    ): void => {
      const p0 = project(cam, cornersWorld[0])
      const p1 = project(cam, cornersWorld[1])
      const p2 = project(cam, cornersWorld[2])
      const p3 = project(cam, cornersWorld[3])
      if (!p0 || !p1 || !p2 || !p3) return
      const depth = (p0.z + p1.z + p2.z + p3.z) * 0.25 + depthBias
      drawList.push({
        depth,
        draw: (c) => {
          c.fillStyle = fillStyle
          c.beginPath()
          c.moveTo(p0.x, p0.y)
          c.lineTo(p1.x, p1.y)
          c.lineTo(p2.x, p2.y)
          c.lineTo(p3.x, p3.y)
          c.closePath()
          c.fill()
          if (strokeStyle) {
            c.strokeStyle = strokeStyle
            c.lineWidth = 1
            c.stroke()
          }
        }
      })
    }

    const pushTexturedFolioFace = (
      cornersWorld: [Vec3, Vec3, Vec3, Vec3],
      img: HTMLCanvasElement,
      depthBias = 0
    ): void => {
      const p0 = project(cam, cornersWorld[0])
      const p1 = project(cam, cornersWorld[1])
      const p2 = project(cam, cornersWorld[2])
      const p3 = project(cam, cornersWorld[3])
      if (!p0 || !p1 || !p2 || !p3) return

      // Face normal in world space for subtle lighting & backface culling
      const e1 = {
        x: cornersWorld[1].x - cornersWorld[0].x,
        y: cornersWorld[1].y - cornersWorld[0].y,
        z: cornersWorld[1].z - cornersWorld[0].z
      }
      const e2 = {
        x: cornersWorld[3].x - cornersWorld[0].x,
        y: cornersWorld[3].y - cornersWorld[0].y,
        z: cornersWorld[3].z - cornersWorld[0].z
      }
      const area = (p1.x - p0.x) * (p3.y - p0.y) - (p1.y - p0.y) * (p3.x - p0.x)
      if (Math.abs(area) <= 1) return
      // Backface cull unless quad is front-facing (clockwise in screen space)
      if (area < 0) return

      const worldNorm = normalize(cross(e2, e1))
      const ndl = Math.max(0, dot(worldNorm, keyDir))
      const shade = Math.max(0, 0.38 - ndl * 0.42)
      const depth = (p0.z + p1.z + p2.z + p3.z) * 0.25 + depthBias

      drawList.push({
        depth,
        draw: (c) => {
          drawTexturedQuad(c, img, p0, p1, p2, p3, shade)
        }
      })
    }

    // Build Left & Right Hinged Book Covers + Gilded Page Blocks + Parchment Leaves
    for (const side of ['left', 'right'] as const) {
      const xOuter = side === 'left' ? -bookW : bookW
      const xPageOuter = side === 'left' ? -bookW + 0.042 : bookW - 0.042
      const xPageInner = side === 'left' ? -0.018 : 0.018
      const hy = bookH * 0.5
      const pHy = (bookH - 0.08) * 0.5

      const pt = (x: number, y: number, z: number): Vec3 => toWorldFromHinge(side, { x, y, z })

      // Outer leather cover (facing -Z in hinge local space)
      // Order TL, TR, BR, BL as viewed from outside (-Z)
      const coverOuter: [Vec3, Vec3, Vec3, Vec3] =
        side === 'left'
          ? [pt(0, hy, -coverT), pt(xOuter, hy, -coverT), pt(xOuter, -hy, -coverT), pt(0, -hy, -coverT)]
          : [pt(xOuter, hy, -coverT), pt(0, hy, -coverT), pt(0, -hy, -coverT), pt(xOuter, -hy, -coverT)]
      pushTexturedFolioFace(coverOuter, coverImg, 0)

      // Inner dark cover backing (facing +Z)
      const coverInner: [Vec3, Vec3, Vec3, Vec3] =
        side === 'left'
          ? [pt(xOuter, hy, 0), pt(0, hy, 0), pt(0, -hy, 0), pt(xOuter, -hy, 0)]
          : [pt(0, hy, 0), pt(xOuter, hy, 0), pt(xOuter, -hy, 0), pt(0, -hy, 0)]
      pushFlatQuad(coverInner, '#1a0e0c', 'rgba(176,141,87,0.28)', 0.004)

      // Gilded fore-edge of page block (visible when closed & angled)
      const foreEdge: [Vec3, Vec3, Vec3, Vec3] = [
        pt(xPageOuter, pHy, 0),
        pt(xPageOuter, pHy, pageBlockT),
        pt(xPageOuter, -pHy, pageBlockT),
        pt(xPageOuter, -pHy, 0)
      ]
      pushFlatQuad(foreEdge, '#d8c59e', 'rgba(146,112,56,0.45)', 0.002)

      // Top & bottom page edges
      const topEdge: [Vec3, Vec3, Vec3, Vec3] = [
        pt(xPageInner, pHy, 0),
        pt(xPageOuter, pHy, 0),
        pt(xPageOuter, pHy, pageBlockT),
        pt(xPageInner, pHy, pageBlockT)
      ]
      pushFlatQuad(topEdge, '#cbb589', 'rgba(128,96,46,0.35)', 0.002)

      // Illuminated parchment spread (visible as folio opens in Chapter III)
      if (openT > 0.04) {
        const zLeaf = pageBlockT + 0.004
        const leafCorners: [Vec3, Vec3, Vec3, Vec3] =
          side === 'left'
            ? [pt(xPageOuter, pHy, zLeaf), pt(xPageInner, pHy, zLeaf), pt(xPageInner, -pHy, zLeaf), pt(xPageOuter, -pHy, zLeaf)]
            : [pt(xPageInner, pHy, zLeaf), pt(xPageOuter, pHy, zLeaf), pt(xPageOuter, -pHy, zLeaf), pt(xPageInner, -pHy, zLeaf)]
        pushTexturedFolioFace(
          leafCorners,
          side === 'left' ? parchmentLeftImg : parchmentRightImg,
          -0.005
        )
      }
    }

    // Sculpted Leather Spine + 5 Raised Gilded Binding Ribs
    const spineR = spineHalfSpan + 0.02
    const spineSegs = 6
    for (let i = 0; i < spineSegs; i++) {
      const a0 = Math.PI * 0.5 + (i / spineSegs) * Math.PI
      const a1 = Math.PI * 0.5 + ((i + 1) / spineSegs) * Math.PI
      const x0 = Math.sin(a0) * spineR
      const z0 = Math.cos(a0) * spineR - 0.008
      const x1 = Math.sin(a1) * spineR
      const z1 = Math.cos(a1) * spineR - 0.008
      const hy = bookH * 0.5 + 0.006
      pushFlatQuad(
        [
          toWorldFromFolio({ x: x0, y: hy, z: z0 }),
          toWorldFromFolio({ x: x1, y: hy, z: z1 }),
          toWorldFromFolio({ x: x1, y: -hy, z: z1 }),
          toWorldFromFolio({ x: x0, y: -hy, z: z0 })
        ],
        '#231210',
        undefined,
        0.001
      )
    }

    for (let rib = -2; rib <= 2; rib++) {
      const ry = rib * 0.21
      const pts: ProjectedPoint[] = []
      let avgZ = 0
      for (let s = 0; s <= 6; s++) {
        const a = Math.PI * 0.5 + (s / 6) * Math.PI
        const p = project(
          cam,
          toWorldFromFolio({
            x: Math.sin(a) * (spineR + 0.012),
            y: ry,
            z: Math.cos(a) * (spineR + 0.012) - 0.008
          })
        )
        if (p) {
          pts.push(p)
          avgZ += p.z
        }
      }
      if (pts.length >= 2) {
        const ribCol = mixRgb(palette.brassLight, palette.goldSpec, 0.5)
        drawList.push({
          depth: avgZ / pts.length - 0.015,
          draw: (c) => {
            c.strokeStyle = ribCol
            c.lineWidth = Math.max(1.5, 0.016 * pts[0].scale * rigScale)
            c.lineCap = 'round'
            c.beginPath()
            c.moveTo(pts[0].x, pts[0].y)
            for (let k = 1; k < pts.length; k++) c.lineTo(pts[k].x, pts[k].y)
            c.stroke()
          }
        })
      }
    }

    // 7. Floating Golden Library Dust Motes
    for (let i = 0; i < motes.length; i++) {
      const m = motes[i]
      if (!reducedMotion) {
        m.y += m.speed * dt
        if (m.y > 2.8) m.y = -2.8
      }
      const rotM = rotY({ x: m.x, y: m.y, z: m.z }, elapsed * 0.025)
      const proj = project(cam, rotM)
      if (!proj) continue
      const flicker = 0.42 + 0.35 * Math.sin(elapsed * 1.4 + m.phase)
      const rad = Math.max(0.8, m.size * (proj.scale / 140))
      const col = mixRgb(palette.mote, palette.goldSpec, 0.35, flicker * 0.65)
      drawList.push({
        depth: proj.z,
        draw: (c) => {
          c.fillStyle = col
          c.beginPath()
          c.arc(proj.x, proj.y, rad, 0, Math.PI * 2)
          c.fill()
        }
      })
    }

    // Painter's algorithm sort: back-to-front (largest depth drawn first)
    drawList.sort((a, b) => b.depth - a.depth)
    for (let i = 0; i < drawList.length; i++) {
      drawList[i].draw(ctx)
    }
  }

  const onVisibilityChange = (): void => {
    if (document.hidden) {
      window.cancelAnimationFrame(rafId)
      rafId = 0
    } else if (!disposed && rafId === 0) {
      lastTs = performance.now()
      rafId = window.requestAnimationFrame(renderFrame)
    }
  }
  document.addEventListener('visibilitychange', onVisibilityChange)

  if (!document.hidden) {
    rafId = window.requestAnimationFrame(renderFrame)
  }

  return () => {
    disposed = true
    window.cancelAnimationFrame(rafId)
    document.removeEventListener('visibilitychange', onVisibilityChange)
    window.removeEventListener('resize', resize)
    window.removeEventListener('pointermove', onPointerMove)
    if (canvas.parentElement === container) {
      container.removeChild(canvas)
    }
  }
}
