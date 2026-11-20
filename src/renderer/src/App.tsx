import type { LibraryInfo } from '@shared/api'
import { useEffect, useState } from 'react'

type Status = 'connecting' | 'ready' | 'offline'

export default function App() {
  const [status, setStatus] = useState<Status>('connecting')
  const [library, setLibrary] = useState<LibraryInfo | null>(null)

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

  return (
    <main className="shell">
      <section className="card">
        <p className="eyebrow">Alexandria</p>
        <h1>The library is being built.</h1>
        <p className="lede">A quiet place for the PDFs you actually read.</p>

        {library ? (
          <>
            <dl className="stats">
              <div className="stat">
                <dt>Floors</dt>
                <dd>{library.floors}</dd>
              </div>
              <div className="stat">
                <dt>Shelves</dt>
                <dd>{library.shelves}</dd>
              </div>
              <div className="stat">
                <dt>Books</dt>
                <dd>{library.books}</dd>
              </div>
            </dl>
            <p className="path" title={library.root}>
              {library.root}
            </p>
          </>
        ) : null}

        <p className={`status status--${status}`}>
          <span className="status__dot" aria-hidden="true" />
          {status}
        </p>
      </section>
    </main>
  )
}
