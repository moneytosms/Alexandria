import { useEffect, useRef, useState, type DragEvent } from 'react'
import { MusicDock } from './components/MusicDock'
import { QueueTray } from './components/QueueTray'
import { SearchOverlay } from './components/SearchOverlay'
import { SettingsDialog } from './components/SettingsDialog'
import { WelcomeCard } from './components/WelcomeCard'
import { queueDroppedFiles } from './import-actions'
import { navigate, useView, viewIds, viewMeta } from './router'
import { applyThemeToDocument, normalizeHallTheme } from './room/atmosphere'
import { useAmbientStore } from './sound'
import { useLibraryStore } from './state/library-store'
import { restorePlayer, wirePlayerPersistence } from './state/player-persistence'
import { useSettingsStore } from './state/settings-store'
import { useStudyStore } from './state/study-store'
import { useUiStore } from './state/ui-store'
import { IndexView } from './views/IndexView'
import { LibrarianView } from './views/LibrarianView'
import { MapView } from './views/MapView'
import { ReaderView } from './views/ReaderView'
import { RoomView } from './views/RoomView'

const navLabels: Record<(typeof viewIds)[number], string> = {
  room: 'Room',
  reader: 'Reader',
  map: 'Map',
  librarian: 'Manage',
  index: 'Index'
}

export default function App() {
  const view = useView()
  const library = useLibraryStore((state) => state.info)
  const books = useLibraryStore((state) => state.books)
  const status = useLibraryStore((state) => state.status)
  const loadLibrary = useLibraryStore((state) => state.load)
  const setSearchOpen = useUiStore((state) => state.setSearchOpen)
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

  useEffect(() => {
    if (!settingsLoaded) return
    useStudyStore.getState().hydrate()
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

  return (
    <div
      className={`app ${isImmersiveRoom ? 'app--immersive' : ''} ${view === 'reader' ? 'app--reader' : ''} ${isStudyFocus ? 'app--study' : ''}`}
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
              <button
                type="button"
                className="slimbar__action"
                onClick={() => setSearchOpen(true)}
                aria-label="Search library"
              >
                Search <kbd>⌘K</kbd>
              </button>
              <button
                type="button"
                className="slimbar__icon"
                onClick={() => setSettingsOpen(true)}
                aria-label="Open settings"
                title="Settings (Ctrl/Cmd + ,)"
              >
                ⚙
              </button>
            </div>
          </header>
        ) : null}

        {status === 'offline' ? (
          <div className="offline-banner" role="alert">
            Library backend is unreachable. Try refreshing the page.
          </div>
        ) : null}

        <section className={`view view--${view}`} aria-label={meta.label}>
          {view === 'room' ? <RoomView library={library} /> : null}
          {view === 'reader' ? <ReaderView /> : null}
          {view === 'map' ? <MapView library={library} /> : null}
          {view === 'librarian' ? <LibrarianView library={library} /> : null}
          {view === 'index' ? <IndexView library={library} books={books} /> : null}
        </section>
      </main>

      <QueueTray />
      <MusicDock />
      <SearchOverlay />
      <SettingsDialog library={library} />
      <WelcomeCard />

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
