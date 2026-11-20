import { useEffect } from 'react'
import { pickImportFiles } from '../import-actions'
import { useUiStore } from '../state/ui-store'

const key = 'alexandria.welcome'

interface Tip {
  title: string
  body: string
}

const tips: Tip[] = [
  {
    title: 'Import a volume',
    body: 'Use Import files in the room, or drop PDFs and office documents anywhere on the window.'
  },
  {
    title: 'Walk the room',
    body: 'Drag to look around. Click a spine to read it, a shelf board to browse it, and use ← → to travel between shelves.'
  },
  {
    title: 'Mark the page',
    body: 'Select text to highlight it, press H or I to draw, E to erase, B to bookmark, and ? for the full shortcut list.'
  },
  {
    title: 'Play something',
    body: 'Choose music folders in settings, then the dock at the bottom plays local files and remembers your place.'
  }
]

export function WelcomeCard() {
  const open = useUiStore((state) => state.tipsOpen)
  const setOpen = useUiStore((state) => state.setTipsOpen)

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setOpen])

  if (!open) return null

  const dismiss = (): void => {
    try {
      localStorage.setItem(key, '1')
    } catch {
      // A missing flag only means the card returns next time.
    }
    setOpen(false)
  }

  return (
    <div
      className="dialog-scrim"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) dismiss()
      }}
    >
      <aside
        className="welcome"
        role="dialog"
        aria-modal="true"
        aria-label="Getting started"
      >
        <header className="welcome__head">
          <div>
            <p className="eyebrow">Getting started</p>
            <h2 className="display">A short tour</h2>
          </div>
          <button className="icon-button" type="button" aria-label="Close tips" onClick={dismiss}>
            ×
          </button>
        </header>

        <ol className="welcome__list">
          {tips.map((tip) => (
            <li key={tip.title}>
              <strong>{tip.title}</strong>
              <span>{tip.body}</span>
            </li>
          ))}
        </ol>

        <div className="welcome__actions">
          <button
            className="button"
            type="button"
            onClick={() => {
              dismiss()
              void pickImportFiles()
            }}
          >
            Import books
          </button>
          <button className="button button--quiet" type="button" onClick={dismiss}>
            Start reading
          </button>
        </div>
      </aside>
    </div>
  )
}

export function shouldShowWelcome(): boolean {
  try {
    return localStorage.getItem(key) === null
  } catch {
    return false
  }
}
