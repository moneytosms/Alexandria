import { lazy, Suspense, useEffect, useRef, useState, type DragEvent } from 'react'
import { MusicDock } from './components/MusicDock'
import { OfflineIndicator, PWAInstallButton } from './components/PWAInstallButton'
import { QueueTray } from './components/QueueTray'
import { SearchOverlay } from './components/SearchOverlay'
import { WelcomeCard } from './components/WelcomeCard'
import { queueDroppedFiles } from './import-actions'
import { formatShortcut, usePlatformCapabilities } from './platform'
import { navigate, useView, viewIds, viewMeta } from './router'
import { applyThemeToDocument, normalizeHallTheme } from './room/atmosphere'
import { useAmbientStore } from './sound'
import { useLibraryStore } from './state/library-store'
import { restorePlayer, wirePlayerPersistence } from './state/player-persistence'
import { useScholarStore } from './state/scholar-store'
import { useSettingsStore } from './state/settings-store'
import { useStudyStore } from './state/study-store'
import { useUiStore } from './state/ui-store'

const loadRoomView = () => import('./views/RoomView').then((m) => ({ default: m.RoomView }))
const loadReaderView = () => import('./views/ReaderView').then((m) => ({ default: m.ReaderView }))
const loadMapView = () => import('./views/MapView').then((m) => ({ default: m.MapView }))
const loadLibrarianView = () =>
  import('./views/LibrarianView').then((m) => ({ default: m.LibrarianView }))
const loadIndexView = () => import('./views/IndexView').then((m) => ({ default: m.IndexView }))
const loadSettingsDialog = () =>
  import('./components/SettingsDialog').then((m) => ({ default: m.SettingsDialog }))

const RoomView = lazy(loadRoomView)
const ReaderView = lazy(loadReaderView)
const MapView = lazy(loadMapView)
const LibrarianView = lazy(loadLibrarianView)
const IndexView = lazy(loadIndexView)
const SettingsDialog = lazy(loadSettingsDialog)

const navLabels: Record<(typeof viewIds)[number], string> = {
  room: 'Room',
  reader: 'Reader',
  map: 'Map',
  librarian: 'Manage',
  index: 'Index'
}

function ViewLoadingFallback({ label }: { label: string }) {
  return (
    <div className="view-loading" role="status" aria-live="polite">
      <span className="view-loading__crest" aria-hidden="true">
        A
      </span>
      <span className="view-loading__text">Preparing {label}…</span>
    </div>
  )
}

export default function App() {
  const view = useView()
  const platform = usePlatformCapabilities()
  const library = useLibraryStore((state) => state.info)
  const books = useLibraryStore((state) => state.books)
  const status = useLibraryStore((state) => state.status)
  const loadLibrary = useLibraryStore((state) => state.load)
  const setSearchOpen = useUiStore((state) => state.setSearchOpen)
  const settingsOpen = useUiStore((state) => state.settingsOpen)
  const setSettingsOpen = useUiStore((state) => state.setSettingsOpen)
  const loadSettings = useSettingsStore((state) => state.load)
  const settingsLoaded = useSettingsStore((state) => state.loaded)
  const hallThemeSetting = useSettingsStore((state) => state.values['hall.theme'])
  const studyMode = useStudyStore((state) => state.studyMode)
  const setStudyMode = useStudyStore((state) => state.setStudyMode)
  const selectedBook = useUiStore((state) => state.selectedBook)
  const [dragging, setDragging] = useState(false)
  const dragDepth = useRef(0)
  const meta = viewMeta[view]
  const isImmersiveRoom = view === 'room'
  const isStudyFocus = view === 'reader' && studyMode

  const onDragEnter = (event: DragEvent<HTMLDivElement>): void => {
    if (!event.dataTransfer.types.includes('Files')) return
    event.preventDefault()
    dragDepth.current += 1
    setDragging(true)
  }

  const onDragLeave = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault()
    dragDepth.current = Math.max(0, dragDepth.current - 1)
    if (dragDepth.current === 0) setDragging(false)
  }

  const onDragOver = (event: DragEvent<HTMLDivElement>): void => {
    if (!event.dataTransfer.types.includes('Files')) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }

  const onDrop = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault()
    dragDepth.current = 0
    setDragging(false)

    if (event.dataTransfer.files.length > 0) {
      void queueDroppedFiles(event.dataTransfer.files)
    }
  }

  useEffect(() => {
    void loadLibrary()
    void loadSettings()
  }, [loadLibrary, loadSettings])

  // Idle-prefetch common secondary views after initial frame settles so transitions feel instant
  useEffect(() => {
    const win = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
      cancelIdleCallback?: (id: number) => void
    }
    const prefetch = (): void => {
      void loadIndexView()
      void loadMapView()
      if (view !== 'reader') {
        void loadReaderView()
      }
    }
    if (typeof win.requestIdleCallback === 'function') {
      const id = win.requestIdleCallback(prefetch, { timeout: 2200 })
      return () => win.cancelIdleCallback?.(id)
    }
    const timer = window.setTimeout(prefetch, 1400)
    return () => window.clearTimeout(timer)
  }, [view])

  useEffect(() => {
    if (!settingsLoaded) return
    useStudyStore.getState().hydrate()
    useScholarStore.getState().hydrate()
    useAmbientStore.getState().hydrate()
  }, [settingsLoaded])

  useEffect(() => {
    applyThemeToDocument(normalizeHallTheme(hallThemeSetting))
  }, [hallThemeSetting])

  useEffect(() => {
    if (view !== 'reader' && studyMode) {
      setStudyMode(false)
    }
  }, [view, studyMode, setStudyMode])

  useEffect(() => {
    restorePlayer()
    return wirePlayerPersistence()
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key === ',') {
        event.preventDefault()
        setSettingsOpen(true)
        return
      }
      if (event.key === 'Escape' && view !== 'room' && view !== 'reader') {
        const el = event.target as HTMLElement | null
        if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return
        navigate('room')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setSettingsOpen, view])

  useEffect(() => {
    document.title =
      view === 'reader' && selectedBook ? `${selectedBook.title} · Alexandria` : `${meta.title} · Alexandria`
  }, [meta.title, selectedBook, view])

  const searchShortcut = formatShortcut('K', platform)
  const settingsShortcut = formatShortcut(',', platform)

  return (
    <div
      className={`app ${isImmersiveRoom ? 'app--immersive' : ''} ${view === 'reader' ? 'app--reader' : ''} ${isStudyFocus ? 'app--study' : ''} ${platform.isTouchPrimary ? 'app--touch' : ''}`}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <main className="workspace">
        {!isImmersiveRoom && !isStudyFocus ? (
          <header className="slimbar">
            <button
              type="button"
              className="slimbar__brand"
              onClick={() => navigate('room')}
              title="Return to reading room"
            >
              Alexandria
            </button>

            <nav className="slimbar__nav" aria-label="Library views">
              {viewIds.map((id) => (
                <button
                  key={id}
                  type="button"
                  className="slimbar__link"
                  aria-current={view === id ? 'page' : undefined}
                  onClick={() => navigate(id)}
                >
                  {navLabels[id]}
                </button>
              ))}
            </nav>

            <div className="slimbar__actions">
              <PWAInstallButton compact />
              <button
                type="button"
                className="slimbar__action"
                onClick={() => setSearchOpen(true)}
                aria-label="Search library"
              >
                Search {!platform.isTouchPrimary ? <kbd>{searchShortcut}</kbd> : null}
              </button>
              <button
                type="button"
                className="slimbar__icon"
                onClick={() => setSettingsOpen(true)}
                aria-label="Open settings"
                title={`Settings (${settingsShortcut})`}
              >
                ⚙
              </button>
            </div>
          </header>
        ) : null}

        {isImmersiveRoom ? (
          <div className="pwa-room-install">
            <PWAInstallButton />
          </div>
        ) : null}

        {status === 'offline' ? (
          <div className="offline-banner" role="alert">
            Library backend is unreachable. Try refreshing the page.
          </div>
        ) : null}

        <section className={`view view--${view}`} aria-label={meta.label}>
          <Suspense fallback={<ViewLoadingFallback label={meta.title} />}>
            {view === 'room' ? <RoomView library={library} /> : null}
            {view === 'reader' ? <ReaderView /> : null}
            {view === 'map' ? <MapView library={library} /> : null}
            {view === 'librarian' ? <LibrarianView library={library} /> : null}
            {view === 'index' ? <IndexView library={library} books={books} /> : null}
          </Suspense>
        </section>
      </main>

      <QueueTray />
      <MusicDock />
      <SearchOverlay />
      {settingsOpen ? (
        <Suspense fallback={null}>
          <SettingsDialog library={library} />
        </Suspense>
      ) : null}
      <WelcomeCard />
      <OfflineIndicator />

      {dragging ? (
        <div className="drop-overlay" aria-hidden="true">
          <div className="drop-overlay__card">
            <p className="eyebrow">Drop to add</p>
            <p className="drop-overlay__title">Shelve in Alexandria</p>
            <p className="drop-overlay__hint">
              PDF, PPTX, PPT, DOCX, DOC, ODP, ODT · folders are scanned
            </p>
          </div>
        </div>
      ) : null}
    </div>
  )
}
