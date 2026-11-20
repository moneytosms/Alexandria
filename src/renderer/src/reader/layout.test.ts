import type { Annotation, InkPoint } from '@shared/types'
import { describe, expect, it } from 'vitest'
import {
  annotationPages,
  clampPage,
  inkPath,
  inkWidth,
  normalizedRect,
  spreadPages,
  spreadStart,
  stepMatch
} from './layout'

const annotation = (id: number, page: number, type: Annotation['type']): Annotation => ({
  id,
  bookId: 1,
  page,
  type,
  color: null,
  rects: [],
  strokes: [],
  note: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: null
})

const point = (x: number, y: number, pressure = 0.5): InkPoint => ({ x, y, pressure })

describe('page and spread math', () => {
  it('clamps pages to the document', () => {
    expect(clampPage(0, 10)).toBe(1)
    expect(clampPage(11, 10)).toBe(10)
    expect(clampPage(4.6, 10)).toBe(5)
    expect(clampPage(3, 0)).toBe(1)
  })

  it('pairs an even page with the odd page before it', () => {
    expect(spreadStart(1, 20)).toBe(1)
    expect(spreadStart(2, 20)).toBe(1)
    expect(spreadStart(7, 20)).toBe(7)
    expect(spreadStart(8, 20)).toBe(7)
  })

  it('never starts a spread past the last pair', () => {
    expect(spreadStart(20, 20)).toBe(19)
    expect(spreadStart(19, 20)).toBe(19)
  })

  it('returns one or two pages, and drops the blank leaf', () => {
    expect(spreadPages(5, 20, false)).toEqual([5])
    expect(spreadPages(6, 20, true)).toEqual([5, 6])
    expect(spreadPages(20, 20, true)).toEqual([19, 20])
    expect(spreadPages(1, 1, true)).toEqual([1])
  })
})

describe('selection geometry', () => {
  const frame = { left: 100, top: 50, right: 500, bottom: 450, width: 400, height: 400 }

  it('normalises a rect inside the page', () => {
    const rect = { left: 200, top: 150, right: 300, bottom: 250, width: 100, height: 100 }
    expect(normalizedRect(rect, frame)).toEqual({ x: 0.25, y: 0.25, w: 0.25, h: 0.25 })
  })

  it('clips a rect that overhangs the page', () => {
    const rect = { left: 60, top: 30, right: 160, bottom: 130, width: 100, height: 100 }
    expect(normalizedRect(rect, frame)).toEqual({ x: 0, y: 0, w: 0.15, h: 0.2 })
  })

  it('rejects a rect that only grazes the page', () => {
    const rect = { left: 10, top: 10, right: 100.5, bottom: 60, width: 90, height: 50 }
    expect(normalizedRect(rect, frame)).toBeNull()
  })
})

describe('ink strokes', () => {
  it('renders a single point as a move command', () => {
    expect(inkPath([point(0.5, 0.5)])).toBe('M 50 50')
  })

  it('renders a short stroke as a line', () => {
    expect(inkPath([point(0, 0), point(0.1, 0.2)])).toBe('M 0 0 L 10 20')
  })

  it('smooths longer strokes with quadratic curves', () => {
    const path = inkPath([point(0, 0), point(0.1, 0.1), point(0.2, 0.15), point(0.3, 0.3)])
    expect(path.startsWith('M 0 0')).toBe(true)
    expect(path).toContain('Q')
    expect(path.endsWith('L 30 30')).toBe(true)
  })

  it('grows stroke width with pressure but never past the cap', () => {
    expect(inkWidth([])).toBeCloseTo(0.7)
    expect(inkWidth([point(0, 0, 0.1)])).toBeLessThan(inkWidth([point(0, 0, 0.9)]))
    expect(inkWidth([point(0, 0, 3)])).toBeLessThanOrEqual(1.15)
  })
})

describe('annotation grouping and search stepping', () => {
  const list = [
    annotation(1, 4, 'highlight'),
    annotation(2, 2, 'note'),
    annotation(3, 4, 'ink'),
    annotation(4, 2, 'bookmark')
  ]

  it('groups pages in order for every annotation', () => {
    expect(annotationPages(list)).toEqual([2, 4])
  })

  it('filters by type before grouping', () => {
    expect(annotationPages(list, 'highlight')).toEqual([4])
    expect(annotationPages(list, 'bookmark')).toEqual([2])
    expect(annotationPages(list, 'note')).toEqual([2])
  })

  it('wraps search stepping at both ends', () => {
    expect(stepMatch(0, 3, 1)).toBe(1)
    expect(stepMatch(2, 3, 1)).toBe(0)
    expect(stepMatch(0, 3, -1)).toBe(2)
    expect(stepMatch(0, 0, 1)).toBe(0)
  })
})
