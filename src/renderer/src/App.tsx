import { useEffect, useRef, useState, type DragEvent } from 'react'
import { QueueTray } from './components/QueueTray'
import { queueDroppedFiles } from './import-actions'
import { navigate, useView, viewIds, viewMeta } from './router'
import { useLibraryStore, type LibraryStatus } from './state/library-store'
import { IndexView } from './views/IndexView'
import { LibrarianView } from './views/LibrarianView'
import { MapView } from './views/MapView'
import { ReaderView } from './views/ReaderView'
import { RoomView } from './views/RoomView'

const numerals = ['I', 'II', 'III', 'IV', 'V']

const statusLabel: Record<LibraryStatus, string> = {
  connecting: 'Opening library',
  ready: 'Library ready',
  offline: 'Main process offline'
}

export default function App() {
  const view = useView()
  const library = useLibraryStore((state) => state.info)
  const books = useLibraryStore((state) => state.books)
  const status = useLibraryStore((state) => state.status)
  const loadLibrary = useLibraryStore((state) => state.load)
  const [dragging, setDragging] = useState(false)
  const dragDepth = useRef(0)
  const meta = viewMeta[view]

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
  }, [loadLibrary])

  useEffect(() => {
    document.title = `${meta.title} · Alexandria`
  }, [meta.title])

  return (
    <div
      className="app"
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <aside className="rail">
        <div className="brand">
          <span className="brand__mark" aria-hidden="true">
            A
          </span>
          <span className="brand__text">
            <span className="brand__name">Alexandria</span>
            <span className="brand__sub">Bibliotheca</span>
          </span>
        </div>

        <nav className="nav" aria-label="Library views">
          {viewIds.map((id, index) => (
            <button
              key={id}
              type="button"
              className="nav__item"
              aria-label={viewMeta[id].label}
              title={viewMeta[id].label}
              aria-current={view === id ? 'page' : undefined}
              onClick={() => navigate(id)}
            >
              <span className="nav__numeral" aria-hidden="true">
                {numerals[index]}
              </span>
              <span>{viewMeta[id].label}</span>
            </button>
          ))}
        </nav>

        <div className="rail__foot">
          <span className="rail__count">{library?.books ?? 0} volumes</span>
          <span className="rail__path" title={library?.root ?? undefined}>
            {library?.root ?? 'Locating library…'}
          </span>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">{meta.label}</p>
            <h1>{meta.title}</h1>
          </div>
          <div className="topbar__meta">
            <span className="topbar__context">{meta.context}</span>
            <span className={`status status--${status}`}>
              <span className="status__dot" aria-hidden="true" />
              {statusLabel[status]}
            </span>
          </div>
        </header>

        <section className={`view view--${view}`} aria-label={meta.label}>
          {view === 'room' ? <RoomView library={library} /> : null}
          {view === 'reader' ? <ReaderView /> : null}
          {view === 'map' ? <MapView library={library} /> : null}
          {view === 'librarian' ? <LibrarianView library={library} /> : null}
          {view === 'index' ? <IndexView library={library} books={books} /> : null}
        </section>
      </main>

      <QueueTray />

      {dragging ? (
        <div className="drop-overlay" aria-hidden="true">
          <div className="drop-overlay__card">
            <p className="eyebrow">Drop to queue</p>
            <p className="drop-overlay__title">Add to the library</p>
            <p className="drop-overlay__hint">
              PDF, PPTX, PPT, DOCX, DOC, ODP, ODT · folders are scanned
            </p>
          </div>
        </div>
      ) : null}
    </div>
  )
}
