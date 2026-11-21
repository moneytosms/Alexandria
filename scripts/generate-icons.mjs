import { createCanvas } from '@napi-rs/canvas'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

function drawAlexandriaIcon(size) {
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')
  const s = size

  // Deep obsidian-walnut background with rounded app tile silhouette
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

  const bgGrad = ctx.createRadialGradient(s * 0.5, s * 0.34, s * 0.05, s * 0.5, s * 0.5, s * 0.72)
  bgGrad.addColorStop(0, '#2a1f16')
  bgGrad.addColorStop(0.55, '#17120e')
  bgGrad.addColorStop(1, '#0b0907')
  ctx.fillStyle = bgGrad
  ctx.fillRect(0, 0, s, s)

  // Outer gilded border frame
  const inset = s * 0.075
  ctx.strokeStyle = 'rgba(210, 174, 118, 0.55)'
  ctx.lineWidth = Math.max(2, s * 0.014)
  ctx.strokeRect(inset, inset, s - inset * 2, s - inset * 2)

  // Inner filigree frame
  const inset2 = s * 0.105
  ctx.strokeStyle = 'rgba(176, 141, 87, 0.28)'
  ctx.lineWidth = Math.max(1, s * 0.006)
  ctx.strokeRect(inset2, inset2, s - inset2 * 2, s - inset2 * 2)

  // Subtle celestial armillary ring behind the monogram
  const cx = s * 0.5
  const cy = s * 0.49
  ctx.save()
  ctx.strokeStyle = 'rgba(210, 174, 118, 0.24)'
  ctx.lineWidth = Math.max(1.5, s * 0.011)
  ctx.beginPath()
  ctx.arc(cx, cy, s * 0.31, 0, Math.PI * 2)
  ctx.stroke()

  ctx.strokeStyle = 'rgba(210, 174, 118, 0.16)'
  ctx.lineWidth = Math.max(1, s * 0.007)
  ctx.beginPath()
  ctx.ellipse(cx, cy, s * 0.34, s * 0.13, -0.35, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()

  // Classical architectural pediment & columned arch accent
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

  // Left leg (tapered classical stroke)
  ctx.beginPath()
  ctx.moveTo(cx - legW * 0.22, topY)
  ctx.lineTo(cx + legW * 0.22, topY)
  ctx.lineTo(cx - halfSpan + legW * 0.72, botY)
  ctx.lineTo(cx - halfSpan - legW * 0.25, botY)
  ctx.closePath()
  ctx.fill()

  // Right leg (heavier downstroke)
  ctx.beginPath()
  ctx.moveTo(cx - legW * 0.18, topY)
  ctx.lineTo(cx + legW * 0.48, topY)
  ctx.lineTo(cx + halfSpan + legW * 0.35, botY)
  ctx.lineTo(cx + halfSpan - legW * 0.92, botY)
  ctx.closePath()
  ctx.fill()

  // Crossbar
  const barY = s * 0.56
  ctx.fillRect(cx - s * 0.125, barY, s * 0.25, s * 0.036)

  // Classical serif feet
  const footH = s * 0.028
  ctx.fillRect(cx - halfSpan - legW * 0.65, botY - footH * 0.35, legW * 1.9, footH)
  ctx.fillRect(cx + halfSpan - legW * 1.25, botY - footH * 0.35, legW * 2.0, footH)

  // Glowing oculus star above apex
  ctx.beginPath()
  ctx.arc(cx, s * 0.155, s * 0.022, 0, Math.PI * 2)
  ctx.fillStyle = '#f6dfb0'
  ctx.fill()

  // Bottom decorative scroll bar
  ctx.fillStyle = 'rgba(210, 174, 118, 0.5)'
  ctx.fillRect(cx - s * 0.18, s * 0.825, s * 0.36, Math.max(1.5, s * 0.012))

  return canvas.toBuffer('image/png')
}

/**
 * Encodes an array of PNG buffers into a valid Windows .ico container
 * (modern Vista+ ICO format supports embedded PNG frames directly).
 */
function buildIcoFromPngs(entries) {
  const count = entries.length
  const headerSize = 6 + count * 16
  let offset = headerSize
  const header = Buffer.alloc(headerSize)

  header.writeUInt16LE(0, 0) // Reserved
  header.writeUInt16LE(1, 2) // Type: 1 = ICO
  header.writeUInt16LE(count, 4)

  entries.forEach(({ size, buffer }, index) => {
    const entryOffset = 6 + index * 16
    header.writeUInt8(size >= 256 ? 0 : size, entryOffset) // width (0 = 256)
    header.writeUInt8(size >= 256 ? 0 : size, entryOffset + 1) // height (0 = 256)
    header.writeUInt8(0, entryOffset + 2) // color palette
    header.writeUInt8(0, entryOffset + 3) // reserved
    header.writeUInt16LE(1, entryOffset + 4) // color planes
    header.writeUInt16LE(32, entryOffset + 6) // bits per pixel
    header.writeUInt32LE(buffer.length, entryOffset + 8) // image bytes
    header.writeUInt32LE(offset, entryOffset + 12) // file offset
    offset += buffer.length
  })

  return Buffer.concat([header, ...entries.map((entry) => entry.buffer)])
}

const outDir = resolve('build')
mkdirSync(outDir, { recursive: true })

// 1024x1024 master PNG (used by Linux AppImage/deb and macOS icon generation)
const png1024 = drawAlexandriaIcon(1024)
writeFileSync(resolve(outDir, 'icon.png'), png1024)

// Multi-resolution Windows .ico (16, 32, 48, 64, 128, 256)
const icoSizes = [16, 32, 48, 64, 128, 256]
const icoFrames = icoSizes.map((size) => ({ size, buffer: drawAlexandriaIcon(size) }))
writeFileSync(resolve(outDir, 'icon.ico'), buildIcoFromPngs(icoFrames))

console.log('Generated build/icon.png (1024x1024) and build/icon.ico (multi-res)')
