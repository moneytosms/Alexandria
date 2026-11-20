import type { LibraryInfo } from '@shared/api'
import { useEffect, useState } from 'react'
import { navigate, useView, viewIds, viewMeta } from './router'
import { IndexView } from './views/IndexView'
import { LibrarianView } from './views/LibrarianView'
import { MapView } from './views/MapView'
import { ReaderView } from './views/ReaderView'
import { RoomView } from './views/RoomView'

type Status = 'connecting' | 'ready' | 'offline'

const numerals = ['I', 'II', 'III', 'IV', 'V']

const statusLabel: Record<Status, string> = {
  connecting: 'Opening library',
  ready: 'Library ready',
  offline: 'Main process offline'
}

export default function App() {
  const view = useView()
  const [status, setStatus] = useState<Status>('connecting')
  const [library, setLibrary] = useState<LibraryInfo | null>(null)
  const meta = viewMeta[view]

  useEffect(() => {
    let alive = true

    Promise.all([window.alexandria.ping(), window.alexandria.libraryInfo()])
      .then(([, info]) => {
        if (!alive) return
        setLibrary(info)
        setStatus('ready')
      })
      .catch(() => {
        if (alive) setStatus('offline')
      })

    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    document.title = `${meta.title} · Alexandria`
  }, [meta.title])

  return (
    <div className="app">
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
          {view === 'index' ? <IndexView library={library} /> : null}
        </section>
      </main>
    </div>
  )
}
