import type { Annotation, Book, InkPoint, NormalizedRect, ReaderSettings } from '@shared/types'
import * as pdfjs from 'pdfjs-dist'
import { createPortal } from 'react-dom'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent
} from 'react'
import {
  annotationPages as groupAnnotationPages,
  inkPath,
  inkWidth,
  normalizedRect,
  spreadStart,
  stepMatch
} from '../reader/layout'
import { navigate } from '../router'
import { playSound, useAmbientStore } from '../sound'
import { recallLastBook, useReaderStore } from '../state/reader-store'
import {
  formatClock,
  modeDurationSeconds,
  useStudyStore,
  type TimerMode
} from '../state/study-store'
import { useUiStore } from '../state/ui-store'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

const highlightColors = ['#e3c26b', '#d98d6a', '#8fb3a0', '#9aa9cf', '#c78fa6']

const defaultSettings: ReaderSettings = {
  mode: 'page',
  spread: false,
  fit: 'width',
  zoom: 1,
  rotation: 0,
  theme: 'paper',
  dim: 0,
  sidebar: true,
  sidebarWidth: 300
}

interface OutlineItem {
  title: string
  page: number | null
  depth: number
}

function readSettings(book: Book | null): ReaderSettings {
  if (!book?.readerJson) return defaultSettings
  try {
    return { ...defaultSettings, ...(JSON.parse(book.readerJson) as Partial<ReaderSettings>) }
  } catch {
    return defaultSettings
  }
}

interface PageProps {
  pdf: PDFDocumentProxy
  number: number
  containerWidth: number
  fit: 'width' | 'page' | 'custom'
  containerHeight: number
  zoom: number
  rotation: number
  annotations: Annotation[]
  tool: 'select' | 'highlight' | 'ink' | 'erase'
  color: string
  onHighlight: (page: number, rects: NormalizedRect[], color: string) => void
  onInk: (page: number, stroke: InkPoint[]) => void
  onErase: (annotation: Annotation) => void
  onOpenAnnotation: (annotation: Annotation) => void
  searchQuery: string
}

function PdfPage({
  pdf,
  number,
  containerWidth,
  containerHeight,
  fit,
  zoom,
  rotation,
  annotations,
  tool,
  color,
  onHighlight,
  onInk,
  onErase,
  onOpenAnnotation,
  searchQuery
}: PageProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const hostRef = useRef<HTMLDivElement | null>(null)
  const textRef = useRef<HTMLDivElement | null>(null)
  const highlightAnchorRef = useRef<{
    x: number
    y: number
    clientX: number
    clientY: number
  } | null>(null)
  const inkStartRef = useRef<{
    lastClientX: number
    lastClientY: number
    totalDist: number
  } | null>(null)
  const [scale, setScale] = useState(1)
  const [pageSize, setPageSize] = useState<{ width: number; height: number } | null>(null)
  const [draftStroke, setDraftStroke] = useState<InkPoint[] | null>(null)
  const [draftHighlight, setDraftHighlight] = useState<NormalizedRect | null>(null)
  const [menu, setMenu] = useState<{
    left: number
    top: number
    text: string
    rects: NormalizedRect[]
  } | null>(null)

  useEffect(() => {
    window.getSelection()?.removeAllRanges()
    setMenu(null)
    setDraftStroke(null)
    setDraftHighlight(null)
    highlightAnchorRef.current = null
    inkStartRef.current = null
  }, [tool, number])

  useEffect(() => {
    let cancelled = false
    let textLayer: pdfjs.TextLayer | null = null
    let renderTask: ReturnType<PDFPageProxy['render']> | null = null

    const render = async (): Promise<void> => {
      const page: PDFPageProxy = await pdf.getPage(number)
      if (cancelled) return

      const base = page.getViewport({ scale: 1, rotation })
      const width = Math.max(280, containerWidth - 48)
      let nextScale = zoom

      if (fit === 'width') nextScale = (width - 2) / base.width
      else if (fit === 'page') {
        const height = Math.max(320, containerHeight - 48)
        nextScale = Math.min((width - 2) / base.width, (height - 2) / base.height)
      }

      nextScale = Math.max(0.1, Math.min(6, nextScale))
      const viewport = page.getViewport({ scale: nextScale, rotation })
      const cssWidth = Math.max(1, Math.round(viewport.width))
      const cssHeight = Math.max(1, Math.round(viewport.height))
      setScale(nextScale)
      setPageSize((prev) =>
        prev && prev.width === cssWidth && prev.height === cssHeight
          ? prev
          : { width: cssWidth, height: cssHeight }
      )

      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const pixelWidth = Math.max(1, Math.round(cssWidth * dpr))
      const pixelHeight = Math.max(1, Math.round(cssHeight * dpr))

      // Render into an offscreen buffer first, then blit atomically to prevent blank flashes
      const offscreen = document.createElement('canvas')
      offscreen.width = pixelWidth
      offscreen.height = pixelHeight
      const offCtx = offscreen.getContext('2d')
      if (!offCtx) return
      offCtx.setTransform(pixelWidth / viewport.width, 0, 0, pixelHeight / viewport.height, 0, 0)
      offCtx.fillStyle = '#ffffff'
      offCtx.fillRect(0, 0, viewport.width, viewport.height)

      renderTask = page.render({ canvasContext: offCtx, viewport, canvas: offscreen })
      await renderTask.promise
      if (cancelled) return

      const canvas = canvasRef.current
      if (!canvas) return
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth
        canvas.height = pixelHeight
      }
      canvas.style.width = `${cssWidth}px`
      canvas.style.height = `${cssHeight}px`
      const displayCtx = canvas.getContext('2d')
      if (displayCtx) {
        displayCtx.setTransform(1, 0, 0, 1, 0, 0)
        displayCtx.drawImage(offscreen, 0, 0)
      }

      const textContainer = textRef.current
      if (textContainer) {
        textContainer.replaceChildren()
        textContainer.style.width = `${cssWidth}px`
        textContainer.style.height = `${cssHeight}px`
        textContainer.style.setProperty('--total-scale-factor', String(viewport.scale))
        textContainer.style.setProperty('--scale-factor', String(viewport.scale))
        textContainer.style.setProperty('--scale-round-x', '1px')
        textContainer.style.setProperty('--scale-round-y', '1px')
        textLayer = new pdfjs.TextLayer({
          textContentSource: page.streamTextContent(),
          container: textContainer,
          viewport
        })
        await textLayer.render()
        if (cancelled) return

        const needle = searchQuery.trim().toLowerCase()
        if (needle.length > 1) {
          for (const span of Array.from(textContainer.querySelectorAll('span'))) {
            if (span.textContent?.toLowerCase().includes(needle)) {
              span.classList.add('textLayer__match')
            }
          }
        }
      }
    }

    void render().catch(() => undefined)

    return () => {
      cancelled = true
      renderTask?.cancel()
      textLayer?.cancel()
    }
  }, [pdf, number, containerWidth, containerHeight, fit, zoom, rotation, searchQuery])

  const selectionRects = useCallback((): NormalizedRect[] => {
    const canvas = canvasRef.current
    const textLayerEl = textRef.current
    if (!canvas || !textLayerEl) return []
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return []
    if (selection.toString().trim().length === 0) return []

    const frame = canvas.getBoundingClientRect()
    if (frame.width < 10 || frame.height < 10) return []

    const rects: NormalizedRect[] = []
    for (let index = 0; index < selection.rangeCount; index += 1) {
      const range = selection.getRangeAt(index)
      // Strictly scope to selections inside this page's textLayer
      if (
        !textLayerEl.contains(range.startContainer) &&
        !textLayerEl.contains(range.endContainer)
      ) {
        continue
      }
      for (const rect of Array.from(range.getClientRects())) {
        const normalized = normalizedRect(rect, frame)
        if (!normalized) continue
        // Reject accidental container-wide rects that span a large chunk of the page
        if ((normalized.w > 0.94 && normalized.h > 0.14) || normalized.h > 0.22) continue
        rects.push(normalized)
      }
    }
    return rects
  }, [])

  const clearSelection = (): void => {
    window.getSelection()?.removeAllRanges()
    setMenu(null)
  }

  const openSelectionMenu = (): void => {
    if (tool !== 'select') {
      setMenu(null)
      return
    }
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed || selection.toString().trim().length === 0) {
      setMenu(null)
      return
    }
    const rects = selectionRects()
    if (rects.length === 0) {
      setMenu(null)
      return
    }
    const rect = selection.getRangeAt(0).getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0) {
      setMenu(null)
      return
    }
    setMenu({
      left: Math.max(24, Math.min(window.innerWidth - 24, rect.left + rect.width / 2)),
      top: Math.max(16, rect.top - 6),
      text: selection.toString().trim(),
      rects
    })
  }

  const normalizedCanvasPoint = (
    clientX: number,
    clientY: number
  ): { x: number; y: number; width: number; height: number } | null => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    if (rect.width < 4 || rect.height < 4) return null
    return {
      x: Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (clientY - rect.top) / rect.height)),
      width: rect.width,
      height: rect.height
    }
  }

  const buildHighlightRect = (
    anchor: { x: number; y: number },
    current: { x: number; y: number; height: number }
  ): NormalizedRect => {
    const x = Math.min(anchor.x, current.x)
    const w = Math.abs(current.x - anchor.x)
    const minBandH = Math.min(0.06, 16 / Math.max(1, current.height))
    const rawH = Math.abs(current.y - anchor.y)
    if (rawH < minBandH) {
      const centerY = (anchor.y + current.y) / 2
      const y = Math.max(0, Math.min(1 - minBandH, centerY - minBandH / 2))
      return { x, y, w, h: minBandH }
    }
    return {
      x,
      y: Math.min(anchor.y, current.y),
      w,
      h: rawH
    }
  }

  const startHighlightDrag = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (tool !== 'highlight' || event.button !== 0) return
    event.preventDefault()
    window.getSelection()?.removeAllRanges()
    setMenu(null)
    const pt = normalizedCanvasPoint(event.clientX, event.clientY)
    if (!pt) return
    event.currentTarget.setPointerCapture(event.pointerId)
    highlightAnchorRef.current = {
      x: pt.x,
      y: pt.y,
      clientX: event.clientX,
      clientY: event.clientY
    }
    setDraftHighlight(null)
  }

  const moveHighlightDrag = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const anchor = highlightAnchorRef.current
    if (tool !== 'highlight' || !anchor) return
    event.preventDefault()
    const pt = normalizedCanvasPoint(event.clientX, event.clientY)
    if (!pt) return
    const dist = Math.hypot(event.clientX - anchor.clientX, event.clientY - anchor.clientY)
    if (dist < 6) {
      setDraftHighlight(null)
      return
    }
    setDraftHighlight(buildHighlightRect(anchor, pt))
  }

  const endHighlightDrag = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const anchor = highlightAnchorRef.current
    highlightAnchorRef.current = null
    if (tool !== 'highlight' || !anchor) {
      setDraftHighlight(null)
      return
    }
    const dist = Math.hypot(event.clientX - anchor.clientX, event.clientY - anchor.clientY)
    const pt = normalizedCanvasPoint(event.clientX, event.clientY)
    setDraftHighlight(null)
    // Only commit when user intentionally dragged at least 6px (never on accidental clicks)
    if (dist < 6 || !pt) return
    const rect = buildHighlightRect(anchor, pt)
    if (rect.w > 0.004 && rect.h > 0.004) {
      onHighlight(number, [rect], color)
    }
  }

  const inkPoint = (event: ReactPointerEvent<SVGSVGElement>): InkPoint | null => {
    const pt = normalizedCanvasPoint(event.clientX, event.clientY)
    if (!pt) return null
    return {
      x: pt.x,
      y: pt.y,
      pressure: event.pressure || 0.5
    }
  }

  const startStroke = (event: ReactPointerEvent<SVGSVGElement>): void => {
    if (tool !== 'ink' || event.button !== 0) return
    event.preventDefault()
    window.getSelection()?.removeAllRanges()
    setMenu(null)
    const point = inkPoint(event)
    if (!point) return
    event.currentTarget.setPointerCapture(event.pointerId)
    inkStartRef.current = {
      lastClientX: event.clientX,
      lastClientY: event.clientY,
      totalDist: 0
    }
    setDraftStroke([point])
  }

  const moveStroke = (event: ReactPointerEvent<SVGSVGElement>): void => {
    if (tool !== 'ink' || !draftStroke || !inkStartRef.current) return
    event.preventDefault()
    const dx = event.clientX - inkStartRef.current.lastClientX
    const dy = event.clientY - inkStartRef.current.lastClientY
    const seg = Math.hypot(dx, dy)
    if (seg < 1.5) return
    inkStartRef.current.lastClientX = event.clientX
    inkStartRef.current.lastClientY = event.clientY
    inkStartRef.current.totalDist += seg
    const point = inkPoint(event)
    if (!point) return
    setDraftStroke((current) => (current ? [...current, point] : current))
  }

  const endStroke = (): void => {
    const metrics = inkStartRef.current
    inkStartRef.current = null
    if (tool !== 'ink' || !draftStroke) {
      setDraftStroke(null)
      return
    }
    const stroke = draftStroke
    setDraftStroke(null)
    // Require genuine drag (>= 4px and >= 2 points) so single clicks never leave stray dots
    if (stroke.length >= 2 && (metrics?.totalDist ?? 0) >= 4) {
      onInk(number, stroke)
    }
  }

  const isMarkingTool = tool === 'highlight' || tool === 'ink' || tool === 'erase'

  return (
    <div
      className={`pdf-page ${isMarkingTool ? 'pdf-page--marking' : ''}`}
      ref={hostRef}
      data-page={number}
      onMouseUp={tool === 'select' ? openSelectionMenu : undefined}
      style={
        pageSize
          ? { width: `${pageSize.width}px`, height: `${pageSize.height}px` }
          : { width: 'fit-content' }
      }
    >
      <canvas ref={canvasRef} className="pdf-page__canvas" />
      <div
        ref={textRef}
        className={`textLayer ${isMarkingTool ? 'textLayer--disabled' : ''}`}
      />
      <div
        className={`pdf-page__annotations ${tool === 'erase' ? 'pdf-page__annotations--erasing' : ''}`}
        aria-hidden={annotations.length === 0}
      >
        {annotations
          .filter((annotation) => annotation.type === 'highlight')
          .flatMap((annotation) =>
            annotation.rects.map((rect, index) => (
              <span
                key={`${annotation.id}-${index}`}
                className={`pdf-page__highlight ${tool === 'erase' ? 'pdf-page__highlight--erasable' : ''}`}
                style={{
                  left: `${rect.x * 100}%`,
                  top: `${rect.y * 100}%`,
                  width: `${rect.w * 100}%`,
                  height: `${rect.h * 100}%`,
                  background: annotation.color ?? '#e3c26b'
                }}
                title={tool === 'erase' ? 'Click to erase highlight' : undefined}
                onClick={(event) => {
                  if (tool === 'erase') {
                    event.stopPropagation()
                    onErase(annotation)
                  } else if (tool === 'select') {
                    onOpenAnnotation(annotation)
                  }
                }}
              />
            ))
          )}
      </div>

      {tool === 'highlight' ? (
        <div
          className="pdf-page__highlight-layer"
          onPointerDown={startHighlightDrag}
          onPointerMove={moveHighlightDrag}
          onPointerUp={endHighlightDrag}
          onPointerCancel={() => {
            highlightAnchorRef.current = null
            setDraftHighlight(null)
          }}
        >
          {draftHighlight ? (
            <span
              className="pdf-page__highlight-draft"
              style={{
                left: `${draftHighlight.x * 100}%`,
                top: `${draftHighlight.y * 100}%`,
                width: `${draftHighlight.w * 100}%`,
                height: `${draftHighlight.h * 100}%`,
                background: color
              }}
            />
          ) : null}
        </div>
      ) : null}

      {annotations.some((annotation) => annotation.type === 'ink') ||
      draftStroke ||
      tool === 'ink' ||
      tool === 'erase' ? (
        <svg
          className={`pdf-page__ink ${tool === 'ink' ? 'pdf-page__ink--active' : ''} ${
            tool === 'erase' ? 'pdf-page__ink--erasing' : ''
          }`}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          onPointerDown={startStroke}
          onPointerMove={moveStroke}
          onPointerUp={endStroke}
          onPointerCancel={endStroke}
        >
          {annotations
            .filter((annotation) => annotation.type === 'ink')
            .flatMap((annotation) =>
              annotation.strokes.map((stroke, index) => (
                <path
                  key={`${annotation.id}-${index}`}
                  className="pdf-page__stroke"
                  d={inkPath(stroke)}
                  fill="none"
                  stroke={annotation.color ?? '#c9a227'}
                  strokeWidth={Math.max(2, inkWidth(stroke) * 5.2)}
                  vectorEffect="non-scaling-stroke"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  onClick={(event) => {
                    if (tool === 'erase') {
                      event.stopPropagation()
                      onErase(annotation)
                    } else if (tool === 'select') {
                      onOpenAnnotation(annotation)
                    }
                  }}
                />
              ))
            )}
          {draftStroke ? (
            <path
              d={inkPath(draftStroke)}
              fill="none"
              stroke={color}
              strokeWidth={2.5}
              vectorEffect="non-scaling-stroke"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
        </svg>
      ) : null}

      {annotations
        .filter((annotation) => annotation.type === 'note' || annotation.note)
        .map((annotation) => (
          <button
            key={`note-${annotation.id}`}
            type="button"
            className="pdf-page__note"
            title={annotation.note ?? 'Note'}
            onClick={() => onOpenAnnotation(annotation)}
          >
            ✎
          </button>
        ))}

      {annotations.some((annotation) => annotation.type === 'bookmark') ? (
        <span className="pdf-page__bookmark" aria-label="Bookmarked page" />
      ) : null}

      <span className="sr-only">Page {number}</span>
      <span className="pdf-page__scale" aria-hidden="true">
        {Math.round(scale * 100)}%
      </span>

      {menu
        ? createPortal(
            <div
              className="selection-toolbar"
              style={{ left: menu.left, top: menu.top }}
              role="toolbar"
              aria-label="Selection actions"
              onMouseUp={(event) => event.stopPropagation()}
            >
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              void navigator.clipboard.writeText(menu.text).catch(() => undefined)
              clearSelection()
            }}
          >
            Copy
          </button>
              <span className="selection-toolbar__label">Highlight</span>
              {highlightColors.map((swatch) => (
                <button
                  key={swatch}
                  type="button"
                  className="swatch"
                  style={{ background: swatch }}
                  aria-label={`Highlight in ${swatch}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    if (menu.rects.length > 0) onHighlight(number, menu.rects, swatch)
                    clearSelection()
                  }}
                />
              ))}
            </div>,
            document.body
          )
        : null}
    </div>
  )
}

function OutlineTree({
  items,
  onGo
}: {
  items: OutlineItem[]
  onGo: (page: number) => void
}) {
  return (
    <ul className="outline">
      {items.map((item, index) => (
        <li key={`${item.title}-${index}`}>
          <button
            type="button"
            className="outline__item"
            style={{ paddingLeft: `${0.65 + item.depth * 0.9}rem` }}
            disabled={item.page === null}
            onClick={() => item.page && onGo(item.page)}
          >
            {item.title}
            {item.page ? <span className="outline__page">{item.page}</span> : null}
          </button>
        </li>
      ))}
    </ul>
  )
}

function PageThumb({
  pdf,
  number,
  active,
  onGo
}: {
  pdf: PDFDocumentProxy
  number: number
  active: boolean
  onGo: (page: number) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    let cancelled = false
    const render = async (): Promise<void> => {
      const page = await pdf.getPage(number)
      if (cancelled) return
      const base = page.getViewport({ scale: 1 })
      const viewport = page.getViewport({ scale: 118 / base.width })
      const canvas = canvasRef.current
      if (!canvas) return
      canvas.width = Math.floor(viewport.width)
      canvas.height = Math.floor(viewport.height)
      const context = canvas.getContext('2d')
      if (!context) return
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, canvas.width, canvas.height)
      await page.render({ canvasContext: context, viewport, canvas }).promise
    }
    void render().catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [pdf, number])

  return (
    <button
      type="button"
      className={`thumb ${active ? 'thumb--on' : ''}`}
      aria-current={active ? 'page' : undefined}
      onClick={() => onGo(number)}
    >
      <canvas ref={canvasRef} />
      <span>p. {number}</span>
    </button>
  )
}

export function ReaderView() {
  const storeBookId = useReaderStore((state) => state.bookId)
  const requestedPage = useReaderStore((state) => state.page)
  const openBook = useReaderStore((state) => state.open)
  const storePage = useReaderStore((state) => state.setPage)
  const setSelectedBook = useUiStore((state) => state.setSelectedBook)
  const returnBook = useUiStore((state) => state.returnBook)

  const studyMode = useStudyStore((s) => s.studyMode)
  const setStudyMode = useStudyStore((s) => s.setStudyMode)
  const studyTimerMode = useStudyStore((s) => s.mode)
  const studyRunning = useStudyStore((s) => s.running)
  const studyElapsed = useStudyStore((s) => s.elapsedSec)
  const setTimerMode = useStudyStore((s) => s.setMode)
  const toggleTimerRunning = useStudyStore((s) => s.toggleRunning)
  const finishAndLogSession = useStudyStore((s) => s.finishAndLog)
  const recordPageTurn = useStudyStore((s) => s.recordPageTurn)

  const ambientEnabled = useAmbientStore((s) => s.enabled)
  const ambientRain = useAmbientStore((s) => s.rain)
  const ambientFire = useAmbientStore((s) => s.fire)
  const ambientChimes = useAmbientStore((s) => s.chimes)
  const setAmbientEnabled = useAmbientStore((s) => s.setEnabled)
  const setAmbientChannel = useAmbientStore((s) => s.setChannel)

  const [book, setBook] = useState<Book | null>(null)
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null)
  const [page, setPage] = useState(1)
  const [pageCount, setPageCount] = useState(0)
  const [pageRatio, setPageRatio] = useState(1.35)
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [outline, setOutline] = useState<OutlineItem[]>([])
  const [settings, setSettings] = useState<ReaderSettings>(defaultSettings)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [needsUnlock, setNeedsUnlock] = useState(false)
  const [password, setPassword] = useState('')
  const [unlocking, setUnlocking] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [tool, setTool] = useState<'select' | 'highlight' | 'ink' | 'erase'>('select')
  const [color, setColor] = useState(highlightColors[0])
  const [tab, setTab] = useState<'outline' | 'search' | 'notes' | 'thumbs'>('outline')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<Array<{ page: number; snippet: string }>>([])
  const [resultIndex, setResultIndex] = useState(0)
  const [searchedFor, setSearchedFor] = useState('')
  const [searching, setSearching] = useState(false)
  const [redoInk, setRedoInk] = useState<Annotation[]>([])
  const [annotationFilter, setAnnotationFilter] = useState<'all' | Annotation['type']>('all')
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [noteDraft, setNoteDraft] = useState<{ annotation: Annotation | null; text: string } | null>(
    null
  )
  const [containerSize, setContainerSize] = useState({ width: 900, height: 700 })
  const [pinned, setPinned] = useState(false)
  const [inFullscreen, setInFullscreen] = useState(false)

  const viewportRef = useRef<HTMLDivElement | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const programmaticScroll = useRef(false)
  const searchInputRef = useRef<HTMLInputElement | null>(null)

  const setSidebar = (open: boolean): void => {
    setSidebarOpen(open)
    setSettings((current) => ({ ...current, sidebar: open }))
  }

  useEffect(() => {
    if (storeBookId === null) {
      const remembered = recallLastBook()
      if (remembered) openBook(remembered)
    }
  }, [storeBookId, openBook])

  useEffect(() => {
    if (!storeBookId) {
      setBook(null)
      setPdf(null)
      return
    }

    let cancelled = false
    let doc: PDFDocumentProxy | null = null
    let task: ReturnType<typeof pdfjs.getDocument> | null = null

    const load = async (): Promise<void> => {
      setLoading(true)
      setError(null)
      setNeedsUnlock(false)
      setPdf(null)
      setResults([])
      setSearch('')

      try {
        const loaded = await window.alexandria.getBook(storeBookId)
        if (cancelled || !loaded) return
        setBook(loaded)
        setSelectedBook(loaded)
        setPinned(loaded.deskPinned)
        const nextSettings = readSettings(loaded)
        setSettings(nextSettings)
        setSidebarOpen(nextSettings.sidebar)

        if (loaded.encrypted && !loaded.unlockedAt) {
          setNeedsUnlock(true)
          setLoading(false)
          return
        }

        const data = await window.alexandria.bookData(storeBookId)
        if (cancelled) return

        task = pdfjs.getDocument({
          data: new Uint8Array(data),
          useSystemFonts: true
        })
        doc = await task.promise

        if (cancelled) return
        setPdf(doc)
        setPageCount(doc.numPages)

        try {
          const first = await doc.getPage(1)
          const viewport = first.getViewport({ scale: 1 })
          setPageRatio(viewport.height / viewport.width)
        } catch {
          // Keep the default ratio.
        }

        const start = Math.min(
          Math.max(1, requestedPage ?? loaded.lastPage ?? 1),
          doc.numPages
        )
        setPage(start)
        storePage(start)

        const list = await window.alexandria.listAnnotations(loaded.id)
        if (!cancelled) setAnnotations(list)

        const rawOutline = await doc.getOutline().catch(() => null)
        if (rawOutline) {
          const flat: OutlineItem[] = []
          const walk = async (
            items: Awaited<ReturnType<PDFDocumentProxy['getOutline']>>,
            depth: number
          ): Promise<void> => {
            for (const item of items ?? []) {
              let target: number | null = null
              try {
                const destination =
                  typeof item.dest === 'string' ? await doc?.getDestination(item.dest) : item.dest
                if (destination) {
                  const index = await doc?.getPageIndex(destination[0])
                  target = typeof index === 'number' ? index + 1 : null
                }
              } catch {
                target = null
              }
              flat.push({ title: item.title, page: target, depth })
              if (item.items.length > 0) await walk(item.items, depth + 1)
            }
          }
          await walk(rawOutline, 0)
          if (!cancelled) setOutline(flat)
        } else {
          setOutline([])
        }
      } catch (loadError) {
        if (cancelled) return
        const message = loadError instanceof Error ? loadError.message : String(loadError)
        setError(
          /missing|could not be read|ENOENT/i.test(message)
            ? 'The file for this volume is missing. Locate it to keep reading.'
            : message
        )
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()

    return () => {
      cancelled = true
      void task?.destroy()
    }
    // The requested page is read on load only; page turns must not reload the document.
  }, [storeBookId, reloadKey, setSelectedBook, storePage])

  useEffect(() => {
    if (book) document.title = `${book.title} · Alexandria`
  }, [book])

  useEffect(() => {
    const element = viewportRef.current
    if (!element) return

    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (rect) setContainerSize({ width: rect.width, height: rect.height })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [pdf])

  useEffect(() => {
    if (!book) return
    const timer = window.setTimeout(() => {
      void window.alexandria
        .updateBook(book.id, { readerJson: JSON.stringify(settings) })
        .catch(() => undefined)
    }, 600)
    return () => window.clearTimeout(timer)
  }, [book, settings])

  useEffect(() => {
    if (!book || pageCount === 0) return
    const timer = window.setTimeout(() => {
      void window.alexandria
        .saveProgress({ bookId: book.id, page, scroll: 0 })
        .catch(() => undefined)
    }, 800)
    return () => window.clearTimeout(timer)
  }, [book, page, pageCount])

  useEffect(() => {
    const onChange = (): void => setInFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const goToPage = useCallback(
    (target: number, smooth = false): void => {
      const clamped = Math.min(Math.max(1, Math.round(target)), pageCount || 1)
      setPage(clamped)
      storePage(clamped)

      if (settings.mode === 'continuous') {
        programmaticScroll.current = true
        requestAnimationFrame(() => {
          const element = scrollRef.current?.querySelector(`[data-page="${clamped}"]`)
          element?.scrollIntoView({ block: 'start', behavior: smooth ? 'smooth' : 'auto' })
          window.setTimeout(() => {
            programmaticScroll.current = false
          }, 400)
        })
      }
    },
    [pageCount, settings.mode, storePage]
  )

  const isSpread = settings.spread && settings.mode === 'page' && containerSize.width >= 760
  const spreadPage = isSpread ? spreadStart(page, pageCount) : page
  const spreadPagesToRender = isSpread
    ? [spreadPage, spreadPage + 1].filter((number) => number <= pageCount)
    : [page]

  const nextPage = useCallback(() => {
    playSound('page')
    const target = Math.min(pageCount || 1, page + (isSpread ? 2 : 1))
    if (target !== page) {
      recordPageTurn(book?.id ?? null, book?.title ?? null)
    }
    goToPage(target)
  }, [goToPage, page, pageCount, isSpread, recordPageTurn, book?.id, book?.title])
  const previousPage = useCallback(() => {
    playSound('page')
    const target = Math.max(1, page - (isSpread ? 2 : 1))
    if (target !== page) {
      recordPageTurn(book?.id ?? null, book?.title ?? null)
    }
    goToPage(target)
  }, [goToPage, page, isSpread, recordPageTurn, book?.id, book?.title])

  const onScroll = (): void => {
    if (settings.mode !== 'continuous' || programmaticScroll.current || !scrollRef.current) return
    const container = scrollRef.current
    const height = (containerSize.width - 48) * pageRatio + 28
    const estimate = Math.floor(container.scrollTop / Math.max(1, height)) + 1
    if (estimate !== page && estimate >= 1 && estimate <= pageCount) {
      setPage(estimate)
      storePage(estimate)
    }
  }

  const refreshAnnotations = async (): Promise<void> => {
    if (!book) return
    setAnnotations(await window.alexandria.listAnnotations(book.id))
  }

  const addHighlight = async (
    targetPage: number,
    rects: NormalizedRect[],
    highlight: string
  ): Promise<void> => {
    if (!book) return
    await window.alexandria.createAnnotation({
      bookId: book.id,
      page: targetPage,
      type: 'highlight',
      color: highlight,
      rects
    })
    await refreshAnnotations()
  }

  const addInk = async (targetPage: number, stroke: InkPoint[]): Promise<void> => {
    if (!book) return
    await window.alexandria.createAnnotation({
      bookId: book.id,
      page: targetPage,
      type: 'ink',
      color,
      strokes: [stroke]
    })
    await refreshAnnotations()
  }

  const toggleBookmark = async (): Promise<void> => {
    if (!book) return
    const existing = annotations.find(
      (annotation) => annotation.type === 'bookmark' && annotation.page === page
    )

    if (existing) await window.alexandria.deleteAnnotation(existing.id)
    else
      await window.alexandria.createAnnotation({
        bookId: book.id,
        page,
        type: 'bookmark',
        color: null
      })

    await refreshAnnotations()
  }

  const addNote = async (): Promise<void> => {
    if (!book || !noteDraft || noteDraft.text.trim().length === 0) return

    if (noteDraft.annotation) {
      await window.alexandria.updateAnnotation(noteDraft.annotation.id, {
        note: noteDraft.text.trim()
      })
    } else {
      await window.alexandria.createAnnotation({
        bookId: book.id,
        page,
        type: 'note',
        color,
        note: noteDraft.text.trim()
      })
    }

    setNoteDraft(null)
    await refreshAnnotations()
  }

  const deleteAnnotation = async (id: number): Promise<void> => {
    await window.alexandria.deleteAnnotation(id)
    await refreshAnnotations()
  }

  const undoInk = async (): Promise<void> => {
    if (!book) return
    const pageInk = annotations.filter(
      (annotation) => annotation.type === 'ink' && annotation.page === page
    )
    const last = pageInk[pageInk.length - 1]
    if (!last) return
    setRedoInk((current) => [...current, last])
    await deleteAnnotation(last.id)
  }

  const redoInkStroke = async (): Promise<void> => {
    if (!book || redoInk.length === 0) return
    const last = redoInk[redoInk.length - 1]
    if (!last) return
    setRedoInk((current) => current.slice(0, -1))
    await window.alexandria.createAnnotation({
      bookId: book.id,
      page: last.page,
      type: 'ink',
      color: last.color,
      strokes: last.strokes
    })
    await refreshAnnotations()
  }

  const goToResult = (index: number): void => {
    const hit = results[index]
    if (!hit) return
    setResultIndex(index)
    goToPage(hit.page, true)
  }

  const stepResult = (direction: 1 | -1): void => {
    if (results.length === 0) return
    goToResult(stepMatch(resultIndex, results.length, direction))
  }

  const openAnnotation = (annotation: Annotation): void => {
    setTab('notes')
    setSidebar(true)
    setNoteDraft({ annotation, text: annotation.note ?? '' })
  }

  const runSearch = async (): Promise<void> => {
    if (!book || search.trim().length < 2) {
      setResults([])
      return
    }
    setSearching(true)
    try {
      const hits = await window.alexandria.searchInBook(book.id, search.trim())
      const mapped = hits.map((hit) => ({ page: hit.page, snippet: hit.snippet }))
      setResults(mapped)
      setSearchedFor(search.trim())
      setResultIndex(0)
      const first = mapped[0]
      if (first) goToPage(first.page, true)
    } finally {
      setSearching(false)
    }
  }

  const resizeSidebar = (event: ReactPointerEvent<HTMLDivElement>): void => {
    event.preventDefault()
    const startX = event.clientX
    const startWidth = settings.sidebarWidth
    const onMove = (move: PointerEvent): void => {
      const width = Math.min(560, Math.max(240, startWidth + (startX - move.clientX)))
      setSettings((current) => ({ ...current, sidebarWidth: width }))
    }
    const onUp = (): void => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const unlock = async (): Promise<void> => {
    if (!book) return
    setUnlocking(true)
    setError(null)
    try {
      await window.alexandria.unlockBook(book.id, password)
      setPassword('')
      setReloadKey((key) => key + 1)
    } catch (unlockError) {
      setError(unlockError instanceof Error ? unlockError.message : 'Could not unlock this PDF')
    } finally {
      setUnlocking(false)
    }
  }

  const relink = async (): Promise<void> => {
    if (!book) return
    try {
      await window.alexandria.relinkBook(book.id)
      setReloadKey((key) => key + 1)
    } catch (relinkError) {
      setError(relinkError instanceof Error ? relinkError.message : 'Could not relink the file')
    }
  }

  const togglePin = async (): Promise<void> => {
    if (!book) return
    const updated = await window.alexandria.setBookPinned(book.id, !pinned)
    setPinned(updated.deskPinned)
    setBook(updated)
  }

  const toggleFullscreen = async (): Promise<void> => {
    if (document.fullscreenElement) await document.exitFullscreen()
    else await document.documentElement.requestFullscreen()
  }

  useEffect(() => {
    const handler = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return
      }

      const command = event.ctrlKey || event.metaKey
      if (command && event.key.toLowerCase() === 'f') {
        event.preventDefault()
        setTab('search')
        setSidebar(true)
        requestAnimationFrame(() => searchInputRef.current?.focus())
        return
      }
      if (command && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) void redoInkStroke()
        else void undoInk()
        return
      }
      if (event.key === '?') {
        event.preventDefault()
        setShortcutsOpen((current) => !current)
        return
      }

      switch (event.key) {
        case 'ArrowRight':
        case 'PageDown':
          event.preventDefault()
          nextPage()
          break
        case 'ArrowLeft':
        case 'PageUp':
          event.preventDefault()
          previousPage()
          break
        case ' ':
          event.preventDefault()
          nextPage()
          break
        case 'Home':
          event.preventDefault()
          goToPage(1)
          break
        case 'End':
          event.preventDefault()
          goToPage(pageCount)
          break
        case '+':
        case '=':
          setSettings((current) => ({ ...current, fit: 'custom', zoom: current.zoom * 1.15 }))
          break
        case '-':
          setSettings((current) => ({ ...current, fit: 'custom', zoom: current.zoom / 1.15 }))
          break
        case 'f':
          void toggleFullscreen()
          break
        case 'b':
          void toggleBookmark()
          break
        case 'h':
          setTool('highlight')
          break
        case 'i':
          setTool('ink')
          break
        case 'e':
          setTool('erase')
          break
        case 's':
          setSettings((current) => ({ ...current, mode: 'page', spread: !current.spread }))
          break
        case 'd':
          event.preventDefault()
          setStudyMode(!studyMode)
          break
        case 'Escape':
          if (studyMode) {
            setStudyMode(false)
            break
          }
          if (tool !== 'select') {
            setTool('select')
            window.getSelection()?.removeAllRanges()
            break
          }
          setSidebar(false)
          setNoteDraft(null)
          setShortcutsOpen(false)
          break
        default:
          break
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  const continuousWindow = useMemo(() => {
    if (settings.mode !== 'continuous') return []
    const start = Math.max(1, page - 2)
    const end = Math.min(pageCount, page + 2)
    return Array.from({ length: Math.max(0, end - start + 1) }, (_, index) => start + index)
  }, [settings.mode, page, pageCount])

  const pageAnnotations = (target: number): Annotation[] =>
    annotations.filter((annotation) => annotation.page === target)

  const annotationPages = groupAnnotationPages(annotations, annotationFilter)

  if (!storeBookId) {
    return (
      <div className="empty reader-empty">
        <p className="eyebrow">Reader</p>
        <h2 className="display">The room is quiet.</h2>
        <p className="lede">
          Open a volume from the shelves or the index and it will wait here where you left it.
        </p>
        <button className="button" type="button" onClick={() => navigate('index')}>
          Go to the index
        </button>
      </div>
    )
  }

  if (needsUnlock) {
    return (
      <div className="reader-gate">
        <div className="reader-gate__card">
          <p className="eyebrow">Locked volume</p>
          <h2 className="display">{book?.title ?? 'Password protected'}</h2>
          <p className="lede">
            This PDF needs a password before it can be indexed and read. The password is only used
            on this machine and is never stored.
          </p>
          <form
            className="reader-gate__form"
            onSubmit={(event) => {
              event.preventDefault()
              void unlock()
            }}
          >
            <label className="field">
              <span>Password</span>
              <input
                type="password"
                value={password}
                autoFocus
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <button className="button" type="submit" disabled={unlocking || password.length === 0}>
              {unlocking ? 'Unlocking…' : 'Unlock'}
            </button>
          </form>
          {error ? <p className="form-error">{error}</p> : null}
          <button className="reader-gate__back" type="button" onClick={() => navigate('index')}>
            Back to the index
          </button>
        </div>
      </div>
    )
  }

  if (error && !pdf) {
    return (
      <div className="reader-gate">
        <div className="reader-gate__card">
          <p className="eyebrow">Reader</p>
          <h2 className="display">{book?.title ?? 'This volume will not open'}</h2>
          <p className="lede">{error}</p>
          <div className="reader-gate__actions">
            {book?.missing ? (
              <button className="button" type="button" onClick={() => void relink()}>
                Locate the file
              </button>
            ) : null}
            <button className="button button--quiet" type="button" onClick={() => navigate('index')}>
              Back to the index
            </button>
          </div>
        </div>
      </div>
    )
  }

  const bookmarked = annotations.some(
    (annotation) => annotation.type === 'bookmark' && annotation.page === page
  )

  const studyTargetSec = modeDurationSeconds(studyTimerMode)
  const studyClockDisplay =
    studyTargetSec > 0
      ? formatClock(Math.max(0, studyTargetSec - studyElapsed))
      : formatClock(studyElapsed)
  const readPercent = pageCount > 0 ? Math.min(100, Math.round((page / pageCount) * 100)) : 0

  const toggleAmbientSound = (channel: 'rain' | 'fire' | 'chimes', currentVal: number): void => {
    playSound('tick')
    if (!ambientEnabled) {
      setAmbientChannel(channel, currentVal > 0.05 ? currentVal : 0.45)
      setAmbientEnabled(true)
    } else if (currentVal > 0.05) {
      setAmbientChannel(channel, 0)
    } else {
      setAmbientChannel(channel, 0.45)
    }
  }

  return (
    <div
      className={`reader reader--${settings.theme} ${sidebarOpen && !studyMode ? 'reader--sidebar' : ''} ${studyMode ? 'reader--study' : ''}`}
    >
      {!studyMode ? (
        <header className="reader__bar">
        <div className="reader__identity">
          <button
            className="icon-button"
            type="button"
            aria-label="Back to the room"
            onClick={() => {
              if (storeBookId !== null) returnBook(storeBookId)
              navigate('room')
            }}
          >
            ←
          </button>
          <div>
            <p className="reader__title">{book?.title ?? 'Loading…'}</p>
            <p className="reader__author">{book?.author ?? ''}</p>
          </div>
        </div>

        <div className="reader__pager">
          <button className="icon-button" type="button" aria-label="Previous page" onClick={previousPage} disabled={page <= 1}>
            ‹
          </button>
          <label className="reader__page-input">
            <span className="sr-only">Page</span>
            <input
              type="number"
              min={1}
              max={pageCount}
              value={page}
              onChange={(event) => goToPage(Number(event.target.value))}
            />
            <span>/ {pageCount || '—'}</span>
          </label>
          <button
            className="icon-button"
            type="button"
            aria-label="Next page"
            onClick={nextPage}
            disabled={pageCount === 0 || page >= pageCount}
          >
            ›
          </button>
        </div>

        <div className="reader__tools">
          <button
            className={`tool ${tool === 'select' ? 'tool--on' : ''}`}
            type="button"
            title="Select text (Esc)"
            aria-label="Select text"
            onClick={() => setTool('select')}
          >
            ↖
          </button>
          <button
            className={`tool ${tool === 'highlight' ? 'tool--on' : ''}`}
            type="button"
            title="Precision highlight — drag on page (H)"
            aria-label="Precision highlight"
            onClick={() => setTool(tool === 'highlight' ? 'select' : 'highlight')}
          >
            ✎
          </button>
          <button
            className={`tool ${tool === 'ink' ? 'tool--on' : ''}`}
            type="button"
            title="Draw with ink — drag on page (I)"
            aria-label="Draw with ink"
            onClick={() => setTool(tool === 'ink' ? 'select' : 'ink')}
          >
            ✒
          </button>
          <button
            className={`tool ${tool === 'erase' ? 'tool--on' : ''}`}
            type="button"
            title="Erase highlight or ink stroke (E)"
            aria-label="Erase highlight or ink stroke"
            onClick={() => setTool(tool === 'erase' ? 'select' : 'erase')}
          >
            ⌫
          </button>
          <button
            className="tool"
            type="button"
            title="Undo ink (Ctrl/Cmd + Z)"
            aria-label="Undo ink"
            onClick={() => void undoInk()}
          >
            ↺
          </button>
          <button
            className="tool"
            type="button"
            title="Redo ink (Ctrl/Cmd + Shift + Z)"
            aria-label="Redo ink"
            disabled={redoInk.length === 0}
            onClick={() => void redoInkStroke()}
          >
            ↻
          </button>
          <div className="reader__colors" aria-label="Annotation colour">
            {highlightColors.map((swatch) => (
              <button
                key={swatch}
                type="button"
                className={`swatch ${color === swatch ? 'swatch--on' : ''}`}
                style={{ background: swatch }}
                aria-label={`Use ${swatch}`}
                onClick={() => setColor(swatch)}
              />
            ))}
          </div>
          <button
            className={`tool ${bookmarked ? 'tool--on' : ''}`}
            type="button"
            title="Bookmark this page (B)"
            onClick={() => void toggleBookmark()}
          >
            {bookmarked ? '★' : '☆'}
          </button>
          <button
            className="tool"
            type="button"
            title="Search inside"
            onClick={() => {
              setTab('search')
              setSidebar(true)
            }}
          >
            ⌕
          </button>
          <button
            className="tool"
            type="button"
            title="Outline"
            onClick={() => {
              setTab('outline')
              setSidebar(!sidebarOpen || tab !== 'outline')
            }}
          >
            ☰
          </button>
		  
          <button
            className={`tool ${pinned ? 'tool--on' : ''}`}
            type="button"
            title="Pin to the desk"
            onClick={() => void togglePin()}
          >
            ⚑
          </button>

          <div className="reader__zoom">
            <button
              className="icon-button"
              type="button"
              aria-label="Zoom out"
              onClick={() =>
                setSettings((current) => ({
                  ...current,
                  fit: 'custom',
                  zoom: Math.max(0.25, current.zoom / 1.15)
                }))
              }
            >
              −
            </button>
            <span>{Math.round(settings.zoom * 100)}%</span>
            <button
              className="icon-button"
              type="button"
              aria-label="Zoom in"
              onClick={() =>
                setSettings((current) => ({
                  ...current,
                  fit: 'custom',
                  zoom: Math.min(5, current.zoom * 1.15)
                }))
              }
            >
              +
            </button>
          </div>

          <select
            className="reader__select"
            aria-label="Zoom mode"
            value={settings.fit}
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                fit: event.target.value as ReaderSettings['fit'],
                zoom: 1
              }))
            }
          >
            <option value="width">Fit width</option>
            <option value="page">Fit page</option>
            <option value="custom">Custom</option>
          </select>

          <button
            className="tool"
            type="button"
            title="Rotate clockwise"
            onClick={() =>
              setSettings((current) => ({
                ...current,
                rotation: (((current.rotation + 90) % 360) as ReaderSettings['rotation'])
              }))
            }
          >
            ⟳
          </button>
          <button
            className="tool"
            type="button"
            title={settings.mode === 'page' ? 'Continuous scrolling' : 'Single page'}
            onClick={() =>
              setSettings((current) => ({
                ...current,
                mode: current.mode === 'page' ? 'continuous' : 'page'
              }))
            }
          >
            {settings.mode === 'page' ? '⇕' : '▭'}
          </button>
          <button
            className={`tool ${settings.spread ? 'tool--on' : ''}`}
            type="button"
            title="Two-page spread (S)"
            aria-label="Two-page spread"
            aria-pressed={settings.spread}
            onClick={() =>
              setSettings((current) => ({
                ...current,
                spread: !current.spread,
                mode: 'page'
              }))
            }
          >
            ▥
          </button>
          <button
            className={`reader__timer-btn ${studyRunning ? 'reader__timer-btn--on' : ''}`}
            type="button"
            title={studyRunning ? 'Pause study timer' : 'Start study timer'}
            onClick={() => {
              playSound('tick')
              toggleTimerRunning(book ? { id: book.id, title: book.title } : null)
            }}
          >
            {studyRunning ? '❚❚' : '▶'} {studyClockDisplay}
          </button>
          <button
            className="reader__study-btn"
            type="button"
            title="Distraction-free Study Mode (D)"
            onClick={() => {
              playSound('tick')
              setStudyMode(!studyMode)
            }}
          >
            Study
          </button>
          <button
            className="tool"
            type="button"
            title="Keyboard shortcuts (?)"
            aria-label="Keyboard shortcuts"
            onClick={() => setShortcutsOpen(true)}
          >
            ?
          </button>
          <button className="tool" type="button" title="Full screen (F)" onClick={() => void toggleFullscreen()}>
            {inFullscreen ? '⤡' : '⛶'}
          </button>
        </div>
      </header>
      ) : null}

      {studyMode ? (
        <div className="study-pill" role="toolbar" aria-label="Study mode controls">
          <div className="study-pill__group">
            {(
              [
                ['pomodoro25', '25m'],
                ['deep50', '50m'],
                ['stopwatch', 'Free']
              ] as Array<[TimerMode, string]>
            ).map(([m, label]) => (
              <button
                key={m}
                type="button"
                className={`study-pill__btn ${studyTimerMode === m ? 'study-pill__btn--on' : ''}`}
                onClick={() => setTimerMode(m)}
              >
                {label}
              </button>
            ))}
            <span className="study-pill__clock">{studyClockDisplay}</span>
            <button
              type="button"
              className={`study-pill__btn ${studyRunning ? 'study-pill__btn--on' : ''}`}
              onClick={() => {
                playSound('tick')
                toggleTimerRunning(book ? { id: book.id, title: book.title } : null)
              }}
            >
              {studyRunning ? 'Pause' : 'Start'}
            </button>
            {studyElapsed >= 15 ? (
              <button
                type="button"
                className="study-pill__btn"
                onClick={() => void finishAndLogSession()}
              >
                Log
              </button>
            ) : null}
          </div>

          <span className="study-pill__sep" aria-hidden="true" />

          <div className="study-pill__group">
            <button
              type="button"
              className="study-pill__btn"
              onClick={previousPage}
              disabled={page <= 1}
              aria-label="Previous page"
            >
              ‹
            </button>
            <span className="study-pill__page">
              p. {page} / {pageCount || '—'} · {readPercent}%
            </span>
            <button
              type="button"
              className="study-pill__btn"
              onClick={nextPage}
              disabled={pageCount === 0 || page >= pageCount}
              aria-label="Next page"
            >
              ›
            </button>
          </div>

          <span className="study-pill__sep" aria-hidden="true" />

          <div className="study-pill__group">
            <button
              type="button"
              className={`study-pill__btn ${ambientEnabled && ambientRain > 0.05 ? 'study-pill__btn--on' : ''}`}
              onClick={() => toggleAmbientSound('rain', ambientRain)}
            >
              Rain
            </button>
            <button
              type="button"
              className={`study-pill__btn ${ambientEnabled && ambientFire > 0.05 ? 'study-pill__btn--on' : ''}`}
              onClick={() => toggleAmbientSound('fire', ambientFire)}
            >
              Fire
            </button>
            <button
              type="button"
              className={`study-pill__btn ${ambientEnabled && ambientChimes > 0.05 ? 'study-pill__btn--on' : ''}`}
              onClick={() => toggleAmbientSound('chimes', ambientChimes)}
            >
              Chimes
            </button>
          </div>

          <span className="study-pill__sep" aria-hidden="true" />

          <button
            type="button"
            className="study-pill__btn study-pill__exit"
            onClick={() => setStudyMode(false)}
          >
            Exit Study (Esc)
          </button>
        </div>
      ) : null}

      <div className="reader__body">
        <div className="reader__viewport" ref={viewportRef}>
          {loading ? <div className="reader__loading">Opening the volume…</div> : null}

          {pdf && settings.mode === 'page' ? (
            <div className={isSpread ? 'reader__spread' : undefined}>
              {spreadPagesToRender.map((number) => (
                <PdfPage
                  key={number}
                  pdf={pdf}
                  number={number}
                  containerWidth={isSpread ? containerSize.width / 2 : containerSize.width}
                  containerHeight={containerSize.height}
                  fit={settings.fit}
                  zoom={settings.zoom}
                  rotation={settings.rotation}
                  annotations={pageAnnotations(number)}
                  tool={tool}
                  color={color}
                  onHighlight={(target, rects, swatch) => void addHighlight(target, rects, swatch)}
                  onInk={(target, strokes) => void addInk(target, strokes)}
                  onErase={(annotation) => void deleteAnnotation(annotation.id)}
                  onOpenAnnotation={openAnnotation}
                  searchQuery={search}
                />
              ))}
            </div>
          ) : null}

          {pdf && settings.mode === 'continuous' ? (
            <div className="reader__scroll" ref={scrollRef} onScroll={onScroll}>
              <div
                style={{
                  height: `${Math.max(0, (page - 2 - 1) * ((containerSize.width - 48) * pageRatio + 28))}px`
                }}
              />
              {continuousWindow.map((number) => (
                <PdfPage
                  key={number}
                  pdf={pdf}
                  number={number}
                  containerWidth={containerSize.width}
                  containerHeight={containerSize.height}
                  fit="width"
                  zoom={1}
                  rotation={settings.rotation}
                  annotations={pageAnnotations(number)}
                  tool={tool}
                  color={color}
                  onHighlight={(target, rects, swatch) => void addHighlight(target, rects, swatch)}
                  onInk={(target, strokes) => void addInk(target, strokes)}
                  onErase={(annotation) => void deleteAnnotation(annotation.id)}
                  onOpenAnnotation={openAnnotation}
                  searchQuery={search}
                />
              ))}
              <div
                style={{
                  height: `${Math.max(
                    0,
                    (pageCount - (page + 2)) * ((containerSize.width - 48) * pageRatio + 28)
                  )}px`
                }}
              />
            </div>
          ) : null}

          {settings.dim > 0 ? (
            <div className="reader__dim" style={{ opacity: settings.dim }} aria-hidden="true" />
          ) : null}
        </div>

        {sidebarOpen && !studyMode ? (
          <aside className="reader__sidebar" style={{ width: settings.sidebarWidth }}>
            <div
              className="reader__resize"
              role="separator"
              aria-label="Resize panel"
              aria-orientation="vertical"
              onPointerDown={resizeSidebar}
            />
            <div className="reader__tabs" role="tablist" aria-label="Reader panels">
              {(['outline', 'search', 'notes', 'thumbs'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={tab === value}
                  className="reader__tab"
                  onClick={() => setTab(value)}
                >
                  {value === 'outline'
                    ? 'Contents'
                    : value === 'search'
                      ? 'Search'
                      : value === 'notes'
                        ? 'Notes'
                        : 'Pages'}
                </button>
              ))}
              <button
                className="icon-button reader__sidebar-close"
                type="button"
                aria-label="Close panel"
                onClick={() => setSidebar(false)}
              >
                ×
              </button>
            </div>

            {tab === 'outline' ? (
              <div className="reader__panel">
                {outline.length === 0 ? (
                  <p className="reader__muted">This volume has no outline.</p>
                ) : (
                  <OutlineTree items={outline} onGo={(target) => goToPage(target, true)} />
                )}
                <div className="reader__panel-foot">
                  <label className="field field--compact">
                    <span>Reading theme</span>
                    <select
                      value={settings.theme}
                      onChange={(event) =>
                        setSettings((current) => ({
                          ...current,
                          theme: event.target.value as ReaderSettings['theme']
                        }))
                      }
                    >
                      <option value="paper">Paper</option>
                      <option value="sepia">Sepia</option>
                      <option value="charcoal">Charcoal</option>
                    </select>
                  </label>
                  <label className="field field--compact">
                    <span>Dim</span>
                    <input
                      type="range"
                      min={0}
                      max={0.6}
                      step={0.05}
                      value={settings.dim}
                      onChange={(event) =>
                        setSettings((current) => ({ ...current, dim: Number(event.target.value) }))
                      }
                    />
                  </label>
                </div>
              </div>
            ) : null}

            {tab === 'search' ? (
              <div className="reader__panel">
                <form
                  className="reader__search"
                  onSubmit={(event) => {
                    event.preventDefault()
                    if (results.length > 0 && search.trim() === searchedFor) stepResult(1)
                    else void runSearch()
                  }}
                >
                  <input
                    ref={searchInputRef}
                    type="search"
                    value={search}
                    placeholder="Search this volume…"
                    onChange={(event) => setSearch(event.target.value)}
                  />
                  <button className="button button--quiet" type="submit" disabled={searching}>
                    {searching ? '…' : results.length > 0 && search.trim() === searchedFor ? 'Next' : 'Find'}
                  </button>
                </form>
                <div className="search-stepper">
                  <button
                    className="icon-button"
                    type="button"
                    aria-label="Previous match"
                    disabled={results.length === 0}
                    onClick={() => stepResult(-1)}
                  >
                    ‹
                  </button>
                  <span>
                    {search.trim().length < 2
                      ? 'Type at least two characters.'
                      : results.length === 0
                        ? 'No matches in this volume.'
                        : `${resultIndex + 1} of ${results.length} ${results.length === 1 ? 'match' : 'matches'}`}
                  </span>
                  <button
                    className="icon-button"
                    type="button"
                    aria-label="Next match"
                    disabled={results.length === 0}
                    onClick={() => stepResult(1)}
                  >
                    ›
                  </button>
                </div>
                <ul className="search-results">
                  {results.map((result, index) => (
                    <li key={`${result.page}-${result.snippet.slice(0, 12)}-${index}`}>
                      <button
                        type="button"
                        className={index === resultIndex ? 'search-results__hit--active' : undefined}
                        onClick={() => goToResult(index)}
                      >
                        <span className="search-results__page">p. {result.page}</span>
                        <span className="search-results__snippet">{result.snippet}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {tab === 'notes' ? (
              <div className="reader__panel">
                <div className="reader__note-compose">
                  <textarea
                    rows={3}
                    placeholder="Add a note on this page…"
                    value={noteDraft && !noteDraft.annotation ? noteDraft.text : ''}
                    onChange={(event) =>
                      setNoteDraft({ annotation: null, text: event.target.value })
                    }
                  />
                  <button
                    className="button"
                    type="button"
                    disabled={!noteDraft || noteDraft.annotation !== null || !noteDraft.text.trim()}
                    onClick={() => void addNote()}
                  >
                    Add note
                  </button>
                </div>

                <label className="field field--compact">
                  <span>Show</span>
                  <select
                    aria-label="Filter annotations"
                    value={annotationFilter}
                    onChange={(event) =>
                      setAnnotationFilter(event.target.value as 'all' | Annotation['type'])
                    }
                  >
                    <option value="all">Everything</option>
                    <option value="highlight">Highlights</option>
                    <option value="note">Notes</option>
                    <option value="ink">Ink</option>
                    <option value="bookmark">Bookmarks</option>
                  </select>
                </label>

                {annotations.length === 0 ? (
                  <p className="reader__muted">No notes, highlights, or bookmarks yet.</p>
                ) : (
                  annotationPages.map((groupPage) => {
                    const group = annotations.filter(
                      (annotation) =>
                        annotation.page === groupPage &&
                        (annotationFilter === 'all' || annotation.type === annotationFilter)
                    )
                    if (group.length === 0) return null
                    return (
                      <section key={groupPage} className="annotation-group">
                        <h3 className="annotation-group__head">Page {groupPage}</h3>
                        <ul className="annotation-list">
                          {group.map((annotation) => (
                            <li key={annotation.id} className="annotation-item">
                              <button
                                type="button"
                                className="annotation-item__main"
                                onClick={() => goToPage(annotation.page, true)}
                              >
                                <span className="annotation-item__kicker">
                                  p. {annotation.page} · {annotation.type}
                                </span>
                                <span className="annotation-item__text">
                                  {annotation.note ??
                                    (annotation.type === 'highlight'
                                      ? `${annotation.rects.length} highlighted ${annotation.rects.length === 1 ? 'passage' : 'passages'}`
                                      : annotation.type === 'ink'
                                        ? 'Handwritten annotation'
                                        : 'Bookmark')}
                                </span>
                              </button>
                              <div className="annotation-item__actions">
                                {annotation.type !== 'bookmark' ? (
                                  <button
                                    type="button"
                                    onClick={() => openAnnotation(annotation)}
                                    title="Edit note"
                                  >
                                    Edit
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={() => void deleteAnnotation(annotation.id)}
                                  title="Delete annotation"
                                >
                                  Delete
                                </button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </section>
                    )
                  })
                )}

                {annotations.length > 0 &&
                annotations.every(
                  (annotation) => annotationFilter !== 'all' && annotation.type !== annotationFilter
                ) ? (
                  <p className="reader__muted">Nothing of this kind yet.</p>
                ) : null}
              </div>
            ) : null}

            {tab === 'thumbs' ? (
              <div className="reader__panel">
                {pdf ? (
                  <div className="thumbs">
                    {Array.from({ length: pageCount }, (_, index) => index + 1).map((number) =>
                      Math.abs(number - page) <= 16 ? (
                        <PageThumb
                          key={number}
                          pdf={pdf}
                          number={number}
                          active={number === page}
                          onGo={(target) => goToPage(target, true)}
                        />
                      ) : (
                        <button
                          key={number}
                          type="button"
                          className="thumb thumb--placeholder"
                          onClick={() => goToPage(number, true)}
                        >
                          p. {number}
                        </button>
                      )
                    )}
                  </div>
                ) : (
                  <p className="reader__muted">The pages appear once the volume opens.</p>
                )}
              </div>
            ) : null}
          </aside>
        ) : null}
      </div>

      {noteDraft?.annotation ? (
        <div className="dialog-scrim" role="presentation" onClick={() => setNoteDraft(null)}>
          <div
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Edit annotation note"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="eyebrow">Note · page {noteDraft.annotation.page}</p>
            <textarea
              rows={5}
              autoFocus
              value={noteDraft.text}
              onChange={(event) => setNoteDraft({ ...noteDraft, text: event.target.value })}
            />
            <div className="dialog__actions">
              <button className="button button--quiet" type="button" onClick={() => setNoteDraft(null)}>
                Cancel
              </button>
              <button
                className="button"
                type="button"
                onClick={() => void addNote()}
                disabled={noteDraft.text.trim().length === 0}
              >
                Save note
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {shortcutsOpen ? (
        <div className="dialog-scrim" role="presentation" onClick={() => setShortcutsOpen(false)}>
          <div
            className="dialog dialog--wide shortcuts"
            role="dialog"
            aria-modal="true"
            aria-label="Reader shortcuts"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="settings__head">
              <div>
                <p className="eyebrow">Reader</p>
                <h2 className="display">Shortcuts</h2>
              </div>
              <button
                className="icon-button"
                type="button"
                aria-label="Close shortcuts"
                onClick={() => setShortcutsOpen(false)}
              >
                ×
              </button>
            </header>
            <dl className="settings__shortcuts">
              {[
                ['← / →, PgUp / PgDn, Space', 'Turn pages'],
                ['Home / End', 'First / last page'],
                ['+ / −', 'Zoom in / out'],
                ['F', 'Full screen'],
                ['B', 'Bookmark this page'],
                ['H', 'Highlight tool'],
                ['I', 'Ink tool'],
                ['E', 'Eraser'],
                ['S', 'Two-page spread'],
                ['D', 'Distraction-free study mode'],
                ['Ctrl / Cmd + Z', 'Undo ink'],
                ['Ctrl / Cmd + Shift + Z', 'Redo ink'],
                ['Ctrl / Cmd + F', 'Search inside'],
                ['?', 'This list'],
                ['Esc', 'Exit study mode / close panel']
              ].map(([keys, action]) => (
                <div key={keys}>
                  <dt>
                    <kbd>{keys}</kbd>
                  </dt>
                  <dd>{action}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      ) : null}

      {loading ? <div className="reader__scrim" aria-hidden="true" /> : null}

      {!studyMode ? (
        <footer className="reader__status">
          <span>{settings.mode === 'page' ? 'Single page' : 'Continuous'}</span>
          <span>
            {tool === 'select'
              ? 'Select text · Drag across words to copy or highlight'
              : tool === 'highlight'
                ? 'Precision Highlighter · Drag where you want to mark · Esc for Select'
                : tool === 'ink'
                  ? 'Ink Pen · Drag to draw · Esc for Select'
                  : 'Eraser · Click any highlight or ink stroke to remove · Esc for Select'}
          </span>
          <span>{book?.pageCount ?? pageCount} pages</span>
        </footer>
      ) : null}
    </div>
  )
}
