import type { InkPoint } from '@shared/types'

export interface CachedPdfBitmap {
  canvas: HTMLCanvasElement
  cssWidth: number
  cssHeight: number
  pixelWidth: number
  pixelHeight: number
  scale: number
}

export function pageCacheKey(
  pageNumber: number,
  cssWidth: number,
  cssHeight: number,
  rotation: number,
  dpr: number
): string {
  return `${pageNumber}:${cssWidth}x${cssHeight}:r${rotation}:d${Math.round(dpr * 100)}`
}

/**
 * Bounded LRU cache for rendered PDF page canvases.
 * Releases evicted canvas backing buffers explicitly so large volumes stay memory-bounded.
 */
export class PdfPageLruCache {
  private readonly maxEntries: number
  private readonly entries = new Map<string, CachedPdfBitmap>()

  constructor(maxEntries = 10) {
    this.maxEntries = Math.max(2, maxEntries)
  }

  public get(key: string): CachedPdfBitmap | null {
    const found = this.entries.get(key)
    if (!found) return null
    // Refresh recency
    this.entries.delete(key)
    this.entries.set(key, found)
    return found
  }

  public has(key: string): boolean {
    return this.entries.has(key)
  }

  public set(key: string, entry: CachedPdfBitmap): void {
    const existing = this.entries.get(key)
    if (existing) {
      if (existing.canvas !== entry.canvas) {
        releaseCanvas(existing.canvas)
      }
      this.entries.delete(key)
    }
    this.entries.set(key, entry)

    while (this.entries.size > this.maxEntries) {
      const oldestKey = this.entries.keys().next().value
      if (oldestKey === undefined) break
      const oldest = this.entries.get(oldestKey)
      if (oldest) releaseCanvas(oldest.canvas)
      this.entries.delete(oldestKey)
    }
  }

  public get size(): number {
    return this.entries.size
  }

  public clear(): void {
    for (const entry of this.entries.values()) {
      releaseCanvas(entry.canvas)
    }
    this.entries.clear()
  }
}

function releaseCanvas(canvas: HTMLCanvasElement): void {
  canvas.width = 0
  canvas.height = 0
}

function perpendicularDistance(point: InkPoint, start: InkPoint, end: InkPoint): number {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lenSq = dx * dx + dy * dy
  if (lenSq < 1e-12) {
    return Math.hypot(point.x - start.x, point.y - start.y)
  }
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lenSq))
  const projX = start.x + t * dx
  const projY = start.y + t * dy
  return Math.hypot(point.x - projX, point.y - projY)
}

/**
 * Ramer-Douglas-Peucker polyline simplification for normalized [0..1] ink strokes.
 * Preserves endpoints, pressure metadata, and visual curve fidelity while cutting JSON bloat.
 */
export function simplifyInkStroke(points: InkPoint[], epsilon = 0.0014): InkPoint[] {
  if (points.length <= 2) return points

  let maxDist = 0
  let maxIndex = 0
  const first = points[0]
  const last = points[points.length - 1]

  for (let i = 1; i < points.length - 1; i += 1) {
    const dist = perpendicularDistance(points[i], first, last)
    if (dist > maxDist) {
      maxDist = dist
      maxIndex = i
    }
  }

  if (maxDist > epsilon) {
    const left = simplifyInkStroke(points.slice(0, maxIndex + 1), epsilon)
    const right = simplifyInkStroke(points.slice(maxIndex), epsilon)
    return [...left.slice(0, -1), ...right]
  }

  return [first, last]
}
