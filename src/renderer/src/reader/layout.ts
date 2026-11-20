import type { Annotation, AnnotationType, InkPoint, NormalizedRect } from '@shared/types'

export interface Rect {
  left: number
  top: number
  right: number
  bottom: number
  width: number
  height: number
}

/** Clamp a page number into the document. */
export function clampPage(page: number, pageCount: number): number {
  return Math.min(Math.max(1, Math.round(page)), Math.max(1, pageCount))
}

/**
 * The left-hand page of a spread. Odd pages open on the right in a printed
 * book, so an even page pairs with the odd page before it.
 */
export function spreadStart(page: number, pageCount: number): number {
  if (page <= 1) return 1
  const start = page % 2 === 1 ? page : page - 1
  return Math.min(start, Math.max(1, pageCount - 1))
}

export function spreadPages(page: number, pageCount: number, enabled: boolean): number[] {
  if (!enabled) return [clampPage(page, pageCount)]
  const start = spreadStart(page, pageCount)
  return [start, start + 1].filter((number) => number >= 1 && number <= pageCount)
}

/** Smooth a pointer trail into a quadratic path in the 0–100 viewBox. */
export function inkPath(points: InkPoint[]): string {
  if (points.length === 0) return ''
  const at = (point: InkPoint): string => `${point.x * 100} ${point.y * 100}`
  if (points.length < 3) {
    return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${at(point)}`).join(' ')
  }

  let path = `M ${at(points[0])}`
  for (let index = 1; index < points.length - 1; index += 1) {
    const current = points[index]
    const next = points[index + 1]
    if (!current || !next) continue
    const midX = ((current.x + next.x) / 2) * 100
    const midY = ((current.y + next.y) / 2) * 100
    path += ` Q ${at(current)} ${midX} ${midY}`
  }
  return `${path} L ${at(points[points.length - 1] as InkPoint)}`
}

/** Wider, softer strokes when the pen reports pressure; a steady line otherwise. */
export function inkWidth(points: InkPoint[]): number {
  if (points.length === 0) return 0.7
  const sum = points.reduce((total, point) => total + (point.pressure || 0.5), 0)
  const average = sum / points.length
  return Math.min(1.15, 0.4 + average * 0.75)
}

/** Clip a selection rectangle to the page and express it as 0–1 fractions. */
export function normalizedRect(rect: Rect, frame: Rect): NormalizedRect | null {
  const left = Math.max(rect.left, frame.left)
  const top = Math.max(rect.top, frame.top)
  const right = Math.min(rect.right, frame.right)
  const bottom = Math.min(rect.bottom, frame.bottom)
  if (right - left < 1 || bottom - top < 1) return null
  return {
    x: (left - frame.left) / frame.width,
    y: (top - frame.top) / frame.height,
    w: (right - left) / frame.width,
    h: (bottom - top) / frame.height
  }
}

export function annotationPages(
  annotations: Annotation[],
  filter: 'all' | AnnotationType = 'all'
): number[] {
  const pages = new Set<number>()
  for (const annotation of annotations) {
    if (filter !== 'all' && annotation.type !== filter) continue
    pages.add(annotation.page)
  }
  return [...pages].sort((a, b) => a - b)
}

/** Step through search results, wrapping at both ends. */
export function stepMatch(index: number, count: number, direction: 1 | -1): number {
  if (count === 0) return 0
  return (index + direction + count) % count
}
