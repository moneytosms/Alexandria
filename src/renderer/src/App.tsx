import { useEffect, useState } from 'react'

type Status = 'connecting' | 'ready' | 'offline'

export default function App() {
  const [status, setStatus] = useState<Status>('connecting')

  useEffect(() => {
    let alive = true

    window.alexandria
      .ping()
      .then(() => {
        if (alive) setStatus('ready')
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
        <p className={`status status--${status}`}>
          <span className="status__dot" aria-hidden="true" />
          {status}
        </p>
      </section>
    </main>
  )
}
