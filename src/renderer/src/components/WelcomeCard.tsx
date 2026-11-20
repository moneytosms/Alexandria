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
    title: 'Walk the Grand Hall & Mezzanine',
    body: 'Move with WASD or arrow keys (Shift to sprint), drag to look, or click any floor or staircase step to glide there. Climb the South-East grand staircase to explore the upper mezzanine balcony and Observatory telescope. Press Tab for first-person walk mode and N to toggle the corner mini-map.'
  },
  {
    title: 'Shape Atmosphere & Soundscape',
    body: 'Press T (or open Atmosphere) to switch architectural themes (Dark Academia, Sunlit Marble, Observatory), shift lighting & weather moods (Dawn to Stormy Night), and mix procedural Rain, Fireplace, and Brass Chimes.'
  },
  {
    title: 'Curate Shelves, Wings & Books',
    body: 'Click any shelf to rename its brass nameplate, add shelves, or drag-and-drop books to reorder or move them across shelves. Right-click any 3D book spine for a Quick Preview card, or press P to build new wall wings.'
  },
  {
    title: 'Focus with Study Mode & Tracker',
    body: 'Open the Reading Desk for your study session timer, daily goal, and reading streak. Inside the Reader, press D for distraction-free Study Mode, H or I to annotate, B to bookmark, and ? for all shortcuts.'
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
