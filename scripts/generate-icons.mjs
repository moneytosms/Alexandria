import { createCanvas } from '@napi-rs/canvas'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

function drawAlexandriaArtwork(ctx, s, { rounded = true, insetScale = 1, transparentBg = false } = {}) {
  ctx.save()

  if (!transparentBg) {
    if (rounded) {
      const radius = Math.round(s * 0.21)
      ctx.beginPath()
      ctx.moveTo(radius, 0)
      ctx.lineTo(s - radius, 0)
      ctx.quadraticCurveTo(s, 0, s, radius)
      ctx.lineTo(s, s - radius)
      ctx.quadraticCurveTo(s, s, s - radius, s)
      ctx.lineTo(radius, s)
      ctx.quadraticCurveTo(0, s, 0, s - radius)
      ctx.lineTo(0, radius)
      ctx.quadraticCurveTo(0, 0, radius, 0)
      ctx.closePath()
      ctx.clip()
    }

    const bgGrad = ctx.createRadialGradient(s * 0.5, s * 0.34, s * 0.05, s * 0.5, s * 0.5, s * 0.72)
    bgGrad.addColorStop(0, '#2a1f16')
    bgGrad.addColorStop(0.55, '#17120e')
    bgGrad.addColorStop(1, '#0b0907')
    ctx.fillStyle = bgGrad
    ctx.fillRect(0, 0, s, s)
  }

  // Scale artwork around center when generating maskable / adaptive foreground icons
  if (insetScale !== 1) {
    const offset = (s * (1 - insetScale)) / 2
    ctx.translate(offset, offset)
    ctx.scale(insetScale, insetScale)
  }

  // Outer gilded border frame (skip when drawing transparent adaptive foreground so mask shape shines)
  if (!transparentBg) {
    const inset = s * 0.075
    ctx.strokeStyle = 'rgba(210, 174, 118, 0.55)'
    ctx.lineWidth = Math.max(2, s * 0.014)
    ctx.strokeRect(inset, inset, s - inset * 2, s - inset * 2)

    const inset2 = s * 0.105
    ctx.strokeStyle = 'rgba(176, 141, 87, 0.28)'
    ctx.lineWidth = Math.max(1, s * 0.006)
    ctx.strokeRect(inset2, inset2, s - inset2 * 2, s - inset2 * 2)
  }

  // Subtle celestial armillary ring behind the monogram
  const cx = s * 0.5
  const cy = s * 0.49
  ctx.save()
  ctx.strokeStyle = 'rgba(210, 174, 118, 0.28)'
  ctx.lineWidth = Math.max(1.5, s * 0.012)
  ctx.beginPath()
  ctx.arc(cx, cy, s * 0.31, 0, Math.PI * 2)
  ctx.stroke()

  ctx.strokeStyle = 'rgba(210, 174, 118, 0.19)'
  ctx.lineWidth = Math.max(1, s * 0.008)
  ctx.beginPath()
  ctx.ellipse(cx, cy, s * 0.34, s * 0.13, -0.35, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()

  // Classical architectural gold gradient
  const goldGrad = ctx.createLinearGradient(0, s * 0.2, 0, s * 0.82)
  goldGrad.addColorStop(0, '#f3d9a4')
  goldGrad.addColorStop(0.5, '#c99f5d')
  goldGrad.addColorStop(1, '#8c6731')

  // Stylized Classical "A" monogram
  ctx.fillStyle = goldGrad
  ctx.strokeStyle = goldGrad
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  const topY = s * 0.22
  const botY = s * 0.74
  const halfSpan = s * 0.21
  const legW = s * 0.056

  ctx.beginPath()
  ctx.moveTo(cx - legW * 0.22, topY)
  ctx.lineTo(cx + legW * 0.22, topY)
  ctx.lineTo(cx - halfSpan + legW * 0.72, botY)
  ctx.lineTo(cx - halfSpan - legW * 0.25, botY)
  ctx.closePath()
  ctx.fill()

  ctx.beginPath()
  ctx.moveTo(cx - legW * 0.18, topY)
  ctx.lineTo(cx + legW * 0.48, topY)
  ctx.lineTo(cx + halfSpan + legW * 0.35, botY)
  ctx.lineTo(cx + halfSpan - legW * 0.92, botY)
  ctx.closePath()
  ctx.fill()

  const barY = s * 0.56
  ctx.fillRect(cx - s * 0.125, barY, s * 0.25, s * 0.036)

  const footH = s * 0.028
  ctx.fillRect(cx - halfSpan - legW * 0.65, botY - footH * 0.35, legW * 1.9, footH)
  ctx.fillRect(cx + halfSpan - legW * 1.25, botY - footH * 0.35, legW * 2.0, footH)

  ctx.beginPath()
  ctx.arc(cx, s * 0.155, s * 0.022, 0, Math.PI * 2)
  ctx.fillStyle = '#f6dfb0'
  ctx.fill()

  ctx.fillStyle = 'rgba(210, 174, 118, 0.55)'
  ctx.fillRect(cx - s * 0.18, s * 0.825, s * 0.36, Math.max(1.5, s * 0.012))

  ctx.restore()
}

function drawAlexandriaIcon(size, opts = {}) {
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')
  drawAlexandriaArtwork(ctx, size, opts)
  return canvas.toBuffer('image/png')
}

function drawAlexandriaRoundIcon(size) {
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
  ctx.closePath()
  ctx.clip()
  drawAlexandriaArtwork(ctx, size, { rounded: false, insetScale: 0.86 })
  return canvas.toBuffer('image/png')
}

function drawSplashScreen(width, height) {
  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')

  const bgGrad = ctx.createRadialGradient(
    width * 0.5,
    height * 0.44,
    width * 0.04,
    width * 0.5,
    height * 0.5,
    Math.max(width, height) * 0.65
  )
  bgGrad.addColorStop(0, '#221912')
  bgGrad.addColorStop(0.55, '#120e0b')
  bgGrad.addColorStop(1, '#0c0a09')
  ctx.fillStyle = bgGrad
  ctx.fillRect(0, 0, width, height)

  const emblemSize = Math.round(Math.min(width, height) * 0.36)
  ctx.save()
  ctx.translate((width - emblemSize) / 2, (height - emblemSize) / 2 - Math.round(height * 0.03))
  drawAlexandriaArtwork(ctx, emblemSize, { rounded: false, insetScale: 1, transparentBg: true })
  ctx.restore()

  return canvas.toBuffer('image/png')
}

const BRAND_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="bg" cx="50%" cy="34%" r="72%">
      <stop offset="0%" stop-color="#2a1f16"/>
      <stop offset="55%" stop-color="#17120e"/>
      <stop offset="100%" stop-color="#0b0907"/>
    </radialGradient>
    <linearGradient id="gold" x1="0%" y1="20%" x2="0%" y2="82%">
      <stop offset="0%" stop-color="#f3d9a4"/>
      <stop offset="50%" stop-color="#c99f5d"/>
      <stop offset="100%" stop-color="#8c6731"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="108" fill="url(#bg)"/>
  <rect x="38" y="38" width="436" height="436" fill="none" stroke="#d2ae76" stroke-opacity="0.55" stroke-width="7"/>
  <rect x="54" y="54" width="404" height="404" fill="none" stroke="#b08d57" stroke-opacity="0.28" stroke-width="3"/>
  <circle cx="256" cy="251" r="158" fill="none" stroke="#d2ae76" stroke-opacity="0.24" stroke-width="6"/>
  <ellipse cx="256" cy="251" rx="174" ry="66" fill="none" stroke="#d2ae76" stroke-opacity="0.16" stroke-width="4" transform="rotate(-20 256 251)"/>
  <path d="M250 112 L262 112 L169 379 L142 379 Z" fill="url(#gold)"/>
  <path d="M251 112 L270 112 L374 379 L337 379 Z" fill="url(#gold)"/>
  <rect x="192" y="287" width="128" height="18" fill="url(#gold)"/>
  <rect x="130" y="374" width="54" height="14" fill="url(#gold)"/>
  <rect x="328" y="374" width="58" height="14" fill="url(#gold)"/>
  <circle cx="256" cy="79" r="11" fill="#f6dfb0"/>
  <rect x="164" y="422" width="184" height="6" fill="#d2ae76" fill-opacity="0.52"/>
</svg>
`

/**
 * Encodes an array of PNG buffers into a valid Windows .ico container
 * (modern Vista+ ICO format supports embedded PNG frames directly).
 */
function buildIcoFromPngs(entries) {
  const count = entries.length
  const headerSize = 6 + count * 16
  let offset = headerSize
  const header = Buffer.alloc(headerSize)

  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(count, 4)

  entries.forEach(({ size, buffer }, index) => {
    const entryOffset = 6 + index * 16
    header.writeUInt8(size >= 256 ? 0 : size, entryOffset)
    header.writeUInt8(size >= 256 ? 0 : size, entryOffset + 1)
    header.writeUInt8(0, entryOffset + 2)
    header.writeUInt8(0, entryOffset + 3)
    header.writeUInt16LE(1, entryOffset + 4)
    header.writeUInt16LE(32, entryOffset + 6)
    header.writeUInt32LE(buffer.length, entryOffset + 8)
    header.writeUInt32LE(offset, entryOffset + 12)
    offset += buffer.length
  })

  return Buffer.concat([header, ...entries.map((entry) => entry.buffer)])
}

// 1. Desktop Electron assets
const outDir = resolve('build')
mkdirSync(outDir, { recursive: true })
writeFileSync(resolve(outDir, 'icon.png'), drawAlexandriaIcon(1024))
const icoSizes = [16, 32, 48, 64, 128, 256]
const icoFrames = icoSizes.map((size) => ({ size, buffer: drawAlexandriaIcon(size) }))
writeFileSync(resolve(outDir, 'icon.ico'), buildIcoFromPngs(icoFrames))

// 2. PWA & Safari assets (shared across renderer and landing site)
const pwa192 = drawAlexandriaIcon(192)
const pwa512 = drawAlexandriaIcon(512)
// Maskable icon keeps full-bleed dark obsidian background and scales emblem into central 74% safe zone
const pwaMaskable512 = drawAlexandriaIcon(512, { rounded: false, insetScale: 0.74 })
const appleTouch180 = drawAlexandriaIcon(180, { rounded: false })

for (const publicDir of [resolve('src/renderer/public'), resolve('site/public')]) {
  mkdirSync(publicDir, { recursive: true })
  writeFileSync(resolve(publicDir, 'pwa-192x192.png'), pwa192)
  writeFileSync(resolve(publicDir, 'pwa-512x512.png'), pwa512)
  writeFileSync(resolve(publicDir, 'pwa-maskable-512x512.png'), pwaMaskable512)
  writeFileSync(resolve(publicDir, 'apple-touch-icon.png'), appleTouch180)
  writeFileSync(resolve(publicDir, 'icon.svg'), BRAND_ICON_SVG, 'utf8')
}

// 3. Capacitor Android mipmap launcher icons & splash screen (when android/ is present)
const androidResDir = resolve('android/app/src/main/res')
if (existsSync(androidResDir)) {
  const androidDensities = [
    { dir: 'mipmap-mdpi', launcher: 48, foreground: 108 },
    { dir: 'mipmap-hdpi', launcher: 72, foreground: 162 },
    { dir: 'mipmap-xhdpi', launcher: 96, foreground: 216 },
    { dir: 'mipmap-xxhdpi', launcher: 144, foreground: 324 },
    { dir: 'mipmap-xxxhdpi', launcher: 192, foreground: 432 }
  ]

  for (const { dir, launcher, foreground } of androidDensities) {
    const targetDir = resolve(androidResDir, dir)
    mkdirSync(targetDir, { recursive: true })
    writeFileSync(resolve(targetDir, 'ic_launcher.png'), drawAlexandriaIcon(launcher))
    writeFileSync(resolve(targetDir, 'ic_launcher_round.png'), drawAlexandriaRoundIcon(launcher))
    writeFileSync(
      resolve(targetDir, 'ic_launcher_foreground.png'),
      drawAlexandriaIcon(foreground, { rounded: false, insetScale: 0.62, transparentBg: true })
    )
  }

  const splashPort = drawSplashScreen(1080, 1920)
  const splashLand = drawSplashScreen(1920, 1080)
  const splashDirs = [
    { dir: 'drawable', buf: splashPort },
    { dir: 'drawable-port-mdpi', buf: drawSplashScreen(320, 480) },
    { dir: 'drawable-port-hdpi', buf: drawSplashScreen(480, 800) },
    { dir: 'drawable-port-xhdpi', buf: drawSplashScreen(720, 1280) },
    { dir: 'drawable-port-xxhdpi', buf: drawSplashScreen(960, 1600) },
    { dir: 'drawable-port-xxxhdpi', buf: splashPort },
    { dir: 'drawable-land-mdpi', buf: drawSplashScreen(480, 320) },
    { dir: 'drawable-land-hdpi', buf: drawSplashScreen(800, 480) },
    { dir: 'drawable-land-xhdpi', buf: drawSplashScreen(1280, 720) },
    { dir: 'drawable-land-xxhdpi', buf: drawSplashScreen(1600, 960) },
    { dir: 'drawable-land-xxxhdpi', buf: splashLand }
  ]
  for (const { dir, buf } of splashDirs) {
    const targetDir = resolve(androidResDir, dir)
    mkdirSync(targetDir, { recursive: true })
    writeFileSync(resolve(targetDir, 'splash.png'), buf)
  }

  const valuesDir = resolve(androidResDir, 'values')
  mkdirSync(valuesDir, { recursive: true })
  writeFileSync(
    resolve(valuesDir, 'ic_launcher_background.xml'),
    `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n  <color name="ic_launcher_background">#0C0A09</color>\n</resources>\n`,
    'utf8'
  )

  console.log('Generated desktop, PWA, and Capacitor Android icons + splash assets')
} else {
  console.log('Generated desktop (build/) and PWA (public/) icons')
}
