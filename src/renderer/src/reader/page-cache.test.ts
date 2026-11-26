import { describe, expect, it } from 'vitest'
import { PdfPageLruCache, pageCacheKey, simplifyInkStroke } from './page-cache'

function fakeCanvas(width = 800, height = 1100): HTMLCanvasElement {
  return { width, height } as unknown as HTMLCanvasElement
}

describe('PdfPageLruCache', () => {
  it('builds deterministic keys including page, dimensions, rotation, and dpr', () => {
    expect(pageCacheKey(4, 800, 1100, 90, 1.5)).toBe('4:800x1100:r90:d150')
    expect(pageCacheKey(4, 800, 1100, 0, 2)).toBe('4:800x1100:r0:d200')
  })

  it('evicts the least recently used entry and releases its canvas buffer', () => {
    const cache = new PdfPageLruCache(3)
    const c1 = fakeCanvas()
    const c2 = fakeCanvas()
    const c3 = fakeCanvas()
    const c4 = fakeCanvas()

    cache.set('p1', { canvas: c1, cssWidth: 800, cssHeight: 1100, pixelWidth: 800, pixelHeight: 1100, scale: 1 })
    cache.set('p2', { canvas: c2, cssWidth: 800, cssHeight: 1100, pixelWidth: 800, pixelHeight: 1100, scale: 1 })
    cache.set('p3', { canvas: c3, cssWidth: 800, cssHeight: 1100, pixelWidth: 800, pixelHeight: 1100, scale: 1 })

    // Touch p1 so p2 becomes least recently used
    expect(cache.get('p1')?.canvas).toBe(c1)

    cache.set('p4', { canvas: c4, cssWidth: 800, cssHeight: 1100, pixelWidth: 800, pixelHeight: 1100, scale: 1 })

    expect(cache.size).toBe(3)
    expect(cache.has('p2')).toBe(false)
    expect(cache.has('p1')).toBe(true)
    expect(cache.has('p3')).toBe(true)
    expect(cache.has('p4')).toBe(true)
    // Evicted canvas backing buffer must be cleared to 0x0
    expect(c2.width).toBe(0)
    expect(c2.height).toBe(0)
    expect(c1.width).toBe(800)
  })

  it('clears all cached entries and zeros every canvas buffer', () => {
    const cache = new PdfPageLruCache(4)
    const canvases = [fakeCanvas(), fakeCanvas()]
    cache.set('a', { canvas: canvases[0], cssWidth: 100, cssHeight: 100, pixelWidth: 100, pixelHeight: 100, scale: 1 })
    cache.set('b', { canvas: canvases[1], cssWidth: 100, cssHeight: 100, pixelWidth: 100, pixelHeight: 100, scale: 1 })

    cache.clear()
    expect(cache.size).toBe(0)
    expect(canvases[0].width).toBe(0)
    expect(canvases[1].height).toBe(0)
  })
})

describe('simplifyInkStroke', () => {
  it('collapses collinear intermediate points while preserving endpoints', () => {
    const straightLine = Array.from({ length: 50 }, (_, i) => ({
      x: i / 49,
      y: 0.25 + (i / 49) * 0.5,
      pressure: 0.6
    }))
    const simplified = simplifyInkStroke(straightLine)
    expect(simplified.length).toBe(2)
    expect(simplified[0]).toEqual(straightLine[0])
    expect(simplified[1]).toEqual(straightLine[49])
  })

  it('preserves sharp corners and curved inflections', () => {
    const vShape = [
      { x: 0.1, y: 0.1, pressure: 0.5 },
      { x: 0.25, y: 0.3, pressure: 0.5 },
      { x: 0.4, y: 0.5, pressure: 0.5 },
      { x: 0.5, y: 0.9, pressure: 0.7 },
      { x: 0.7, y: 0.5, pressure: 0.5 },
      { x: 0.9, y: 0.1, pressure: 0.5 }
    ]
    const simplified = simplifyInkStroke(vShape, 0.002)
    expect(simplified[0]).toEqual(vShape[0])
    expect(simplified[simplified.length - 1]).toEqual(vShape[vShape.length - 1])
    // Corner at (0.5, 0.9) must survive simplification
    expect(simplified.some((pt) => pt.x === 0.5 && pt.y === 0.9)).toBe(true)
  })
})
