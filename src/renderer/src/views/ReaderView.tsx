import type { Annotation, Book, InkPoint, NormalizedRect, ReaderSettings } from '@shared/types'
import * as pdfjs from 'pdfjs-dist'
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
import { navigate } from '../router'
import { recallLastBook, useReaderStore } from '../state/reader-store'
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

function normalizedRect(rect: DOMRect, frame: DOMRect): NormalizedRect | null {
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

interface PageProps {
  pdf: PDFDocumentProxy
  number: number
  containerWidth: number
  fit: 'width' | 'page' | 'custom'
  containerHeight: number
  zoom: number
  rotation: number
  annotations: Annotation[]
  tool: 'select' | 'highlight' | 'ink'
  onHighlight: (page: number, rects: NormalizedRect[]) => void
  onInk: (page: number, stroke: InkPoint[]) => void
  onOpenAnnotation: (annotation: Annotation) => void
  settings: ReaderSettings
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
  onHighlight,
  onInk,
  onOpenAnnotation,
  settings,
  searchQuery
}: PageProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const hostRef = useRef<HTMLDivElement | null>(null)
  const textRef = useRef<HTMLDivElement | null>(null)
  const [scale, setScale] = useState(1)
  const [draftStroke, setDraftStroke] = useState<InkPoint[] | null>(null)

  useEffect(() => {
    let cancelled = false
    let textLayer: pdfjs.TextLayer | null = null

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
      setScale(nextScale)

      const canvas = canvasRef.current
      if (!canvas) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.floor(viewport.width * dpr)
      canvas.height = Math.floor(viewport.height * dpr)
      canvas.style.width = `${Math.floor(viewport.width)}px`
      canvas.style.height = `${Math.floor(viewport.height)}px`

      const context = canvas.getContext('2d')
      if (!context) return
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, viewport.width, viewport.height)

      await page.render({ canvasContext: context, viewport, canvas }).promise
      if (cancelled) return

      const textContainer = textRef.current
      if (textContainer) {
        textContainer.replaceChildren()
        textContainer.style.width = `${viewport.width}px`
        textContainer.style.height = `${viewport.height}px`
        textContainer.style.setProperty('--total-scale-factor', String(viewport.scale))
        textContainer.style.setProperty('--scale-factor', String(viewport.scale))
        textLayer = new pdfjs.TextLayer({
          textContentSource: page.streamTextContent(),
          container: textContainer,
          viewport
        })
        await textLayer.render()

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
      textLayer?.cancel()
      const canvas = canvasRef.current
      if (canvas) {
        canvas.width = 0
        canvas.height = 0
      }
    }
  }, [pdf, number, containerWidth, containerHeight, fit, zoom, rotation, settings.theme, searchQuery])

  const finishSelection = useCallback(() => {
    if (tool !== 'highlight') return
    const host = hostRef.current
    const canvas = canvasRef.current
    if (!host || !canvas) return

    const selection = window.getSelection()
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return

    const frame = canvas.getBoundingClientRect()
    const rects: NormalizedRect[] = []

    for (let index = 0; index < selection.rangeCount; index += 1) {
      const range = selection.getRangeAt(index)
      for (const rect of Array.from(range.getClientRects())) {
        const normalized = normalizedRect(rect, frame)
        if (normalized) rects.push(normalized)
      }
    }

    if (rects.length > 0) onHighlight(number, rects)
    selection.removeAllRanges()
  }, [tool, number, onHighlight])

  const inkPoint = (event: ReactPointerEvent<SVGSVGElement>): InkPoint | null => {
    const host = hostRef.current
    if (!host) return null
    const rect = host.getBoundingClientRect()
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
      pressure: event.pressure || 0.5
    }
  }

  const startStroke = (event: ReactPointerEvent<SVGSVGElement>): void => {
    if (tool !== 'ink') return
    const point = inkPoint(event)
    if (!point) return
    event.currentTarget.setPointerCapture(event.pointerId)
    setDraftStroke([point])
  }

  const moveStroke = (event: ReactPointerEvent<SVGSVGElement>): void => {
    if (tool !== 'ink' || !draftStroke) return
    const point = inkPoint(event)
    if (!point) return
    setDraftStroke((current) => (current ? [...current, point] : current))
  }

  const endStroke = (): void => {
    if (tool !== 'ink' || !draftStroke) return
    const stroke = draftStroke
    setDraftStroke(null)
    onInk(number, stroke)
  }

  const path = (points: InkPoint[]): string =>
    points
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x * 100} ${point.y * 100}`)
      .join(' ')

  return (
    <div
      className="pdf-page"
      ref={hostRef}
      data-page={number}
      onMouseUp={finishSelection}
      style={{ width: 'fit-content' }}
    >
      <canvas ref={canvasRef} className="pdf-page__canvas" />
      <div ref={textRef} className={`textLayer ${tool === 'highlight' ? 'textLayer--selecting' : ''}`} />
      <div className="pdf-page__annotations" aria-hidden={annotations.length === 0}>
        {annotations
          .filter((annotation) => annotation.type === 'highlight')
          .flatMap((annotation) =>
            annotation.rects.map((rect, index) => (
              <span
                key={`${annotation.id}-${index}`}
                className="pdf-page__highlight"
                style={{
                  left: `${rect.x * 100}%`,
                  top: `${rect.y * 100}%`,
                  width: `${rect.w * 100}%`,
                  height: `${rect.h * 100}%`,
                  background: annotation.color ?? '#e3c26b'
                }}
                onClick={() => onOpenAnnotation(annotation)}
              />
            ))
          )}
      </div>

      {annotations.some((annotation) => annotation.type === 'ink') || draftStroke ? (
        <svg
          className={`pdf-page__ink ${tool === 'ink' ? 'pdf-page__ink--active' : ''}`}
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
                  d={path(stroke)}
                  fill="none"
                  stroke={annotation.color ?? '#c9a227'}
                  strokeWidth={0.7}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))
            )}
          {draftStroke ? (
            <path
              d={path(draftStroke)}
              fill="none"
              stroke="#c9a227"
              strokeWidth={0.7}
              strokeLinecap="round"
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

export function ReaderView() {
  const storeBookId = useReaderStore((state) => state.bookId)
  const requestedPage = useReaderStore((state) => state.page)
  const openBook = useReaderStore((state) => state.open)
  const storePage = useReaderStore((state) => state.setPage)
  const setSelectedBook = useUiStore((state) => state.setSelectedBook)

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
  const [tool, setTool] = useState<'select' | 'highlight' | 'ink'>('select')
  const [color, setColor] = useState(highlightColors[0])
  const [tab, setTab] = useState<'outline' | 'search' | 'notes'>('outline')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<Array<{ page: number; snippet: string }>>([])
  const [searching, setSearching] = useState(false)
  const [noteDraft, setNoteDraft] = useState<{ annotation: Annotation | null; text: string } | null>(
    null
  )
  const [containerSize, setContainerSize] = useState({ width: 900, height: 700 })
  const [pinned, setPinned] = useState(false)
  const [inFullscreen, setInFullscreen] = useState(false)

  const viewportRef = useRef<HTMLDivElement | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const programmaticScroll = useRef(false)

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
        setSettings(readSettings(loaded))

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

  const nextPage = useCallback(() => goToPage(page + 1), [goToPage, page])
  const previousPage = useCallback(() => goToPage(page - 1), [goToPage, page])

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

  const addHighlight = async (targetPage: number, rects: NormalizedRect[]): Promise<void> => {
    if (!book) return
    await window.alexandria.createAnnotation({
      bookId: book.id,
      page: targetPage,
      type: 'highlight',
      color,
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

  const openAnnotation = (annotation: Annotation): void => {
    setTab('notes')
    setSidebarOpen(true)
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
      setResults(hits.map((hit) => ({ page: hit.page, snippet: hit.snippet })))
    } finally {
      setSearching(false)
    }
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
        case 'Escape':
          setSidebarOpen(false)
          setNoteDraft(null)
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

  return (
    <div className={`reader reader--${settings.theme} ${sidebarOpen ? 'reader--sidebar' : ''}`}>
      <header className="reader__bar">
        <div className="reader__identity">
          <button
            className="icon-button"
            type="button"
            aria-label="Back to the room"
            onClick={() => navigate('room')}
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
            className={`tool ${tool === 'highlight' ? 'tool--on' : ''}`}
            type="button"
            title="Highlight text (H)"
            onClick={() => setTool(tool === 'highlight' ? 'select' : 'highlight')}
          >
            ✎
          </button>
          <button
            className={`tool ${tool === 'ink' ? 'tool--on' : ''}`}
            type="button"
            title="Draw with ink (I)"
            onClick={() => setTool(tool === 'ink' ? 'select' : 'ink')}
          >
            ✒
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
              setSidebarOpen(true)
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
              setSidebarOpen(!sidebarOpen || tab !== 'outline')
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
          <button className="tool" type="button" title="Full screen (F)" onClick={() => void toggleFullscreen()}>
            {inFullscreen ? '⤡' : '⛶'}
          </button>
        </div>
      </header>

      <div className="reader__body">
        <div className="reader__viewport" ref={viewportRef}>
          {loading ? <div className="reader__loading">Opening the volume…</div> : null}

          {pdf && settings.mode === 'page' ? (
            <PdfPage
              pdf={pdf}
              number={page}
              containerWidth={containerSize.width}
              containerHeight={containerSize.height}
              fit={settings.fit}
              zoom={settings.zoom}
              rotation={settings.rotation}
              annotations={pageAnnotations(page)}
              tool={tool}
              onHighlight={(target, rects) => void addHighlight(target, rects)}
              onInk={(target, strokes) => void addInk(target, strokes)}
              onOpenAnnotation={openAnnotation}
              settings={settings}
              searchQuery={search}
            />
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
                  onHighlight={(target, rects) => void addHighlight(target, rects)}
                  onInk={(target, strokes) => void addInk(target, strokes)}
                  onOpenAnnotation={openAnnotation}
                  settings={settings}
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

        {sidebarOpen ? (
          <aside className="reader__sidebar">
            <div className="reader__tabs" role="tablist" aria-label="Reader panels">
              {(['outline', 'search', 'notes'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={tab === value}
                  className="reader__tab"
                  onClick={() => setTab(value)}
                >
                  {value === 'outline' ? 'Contents' : value === 'search' ? 'Search' : 'Notes'}
                </button>
              ))}
              <button
                className="icon-button reader__sidebar-close"
                type="button"
                aria-label="Close panel"
                onClick={() => setSidebarOpen(false)}
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
                    void runSearch()
                  }}
                >
                  <input
                    type="search"
                    value={search}
                    placeholder="Search this volume…"
                    onChange={(event) => setSearch(event.target.value)}
                  />
                  <button className="button button--quiet" type="submit" disabled={searching}>
                    {searching ? '…' : 'Find'}
                  </button>
                </form>
                <p className="reader__muted">
                  {search.trim().length < 2
                    ? 'Type at least two characters.'
                    : `${results.length} ${results.length === 1 ? 'match' : 'matches'}`}
                </p>
                <ul className="search-results">
                  {results.map((result) => (
                    <li key={`${result.page}-${result.snippet.slice(0, 12)}`}>
                      <button type="button" onClick={() => goToPage(result.page, true)}>
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

                {annotations.length === 0 ? (
                  <p className="reader__muted">No notes, highlights, or bookmarks yet.</p>
                ) : (
                  <ul className="annotation-list">
                    {annotations.map((annotation) => (
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

      {loading ? <div className="reader__scrim" aria-hidden="true" /> : null}

      <footer className="reader__status">
        <span>{settings.mode === 'page' ? 'Single page' : 'Continuous'}</span>
        <span>{tool === 'select' ? 'Select text' : tool === 'highlight' ? 'Highlight tool' : 'Ink tool'}</span>
        <span>{book?.pageCount ?? pageCount} pages</span>
      </footer>
    </div>
  )
}
