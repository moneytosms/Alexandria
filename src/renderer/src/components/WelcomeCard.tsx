import { useEffect } from 'react'
import { pickImportFiles } from '../import-actions'
import { useUiStore } from '../state/ui-store'

const key = 'alexandria.welcome'

interface ControlItem {
  keys: string[]
  label: string
  detail: string
}

interface ControlSection {
  heading: string
  items: ControlItem[]
}

const sections: ControlSection[] = [
  {
    heading: 'Movement & Camera',
    items: [
      {
        keys: ['W', 'A', 'S', 'D'],
        label: 'Walk & Strafe',
        detail: 'Move freely on the ground floor, climb the South-East stairs, and walk the upper mezzanine (Arrow keys also work).'
      },
      {
        keys: ['Shift'],
        label: 'Sprint',
        detail: 'Hold while walking to move faster across the Grand Hall.'
      },
      {
        keys: ['Drag', 'Q / E'],
        label: 'Look Around',
        detail: 'Click and drag anywhere in the hall to pan your view, or turn left/right with Q and E.'
      },
      {
        keys: ['Tab'],
        label: 'First-Person Walk',
        detail: 'Lock the mouse for true first-person camera look. Press E to interact, Esc to exit.'
      },
      {
        keys: ['Double-Click'],
        label: 'Glide to Floor',
        detail: 'Double-click any open floor tile or stair step to glide smoothly there. Any movement key cancels glide immediately.'
      },
      {
        keys: ['Scroll', '+ / −'],
        label: 'Step & Zoom',
        detail: 'Scroll forward/back to step along your gaze; press + / − (or Alt + Scroll) to adjust camera zoom.'
      },
      {
        keys: ['R'],
        label: 'Reset to Entrance',
        detail: 'Return smoothly to the Grand Hall entrance facing the central nave.'
      }
    ]
  },
  {
    heading: 'Books, Shelves & Landmarks',
    items: [
      {
        keys: ['Click Book'],
        label: 'Pull & Read',
        detail: 'Click any 3D book spine to pull it from the shelf and open it in the Reader.'
      },
      {
        keys: ['Right-Click'],
        label: 'Quick Book Preview',
        detail: 'Right-click any book spine to view cover art, reading progress, tags, and quick shelf actions.'
      },
      {
        keys: ['Click Shelf'],
        label: 'Curate & Rename',
        detail: 'Click a shelf or brass plaque to rename it, add rows, sort, or drag-and-drop books across shelves.'
      },
      {
        keys: ['1 – 9', '[ / ]'],
        label: 'Quick-Jump Waypoints',
        detail: 'Jump directly between named shelves, the Reading Desk, Fireplace, and Upper Observatory Balcony.'
      },
      {
        keys: ['P'],
        label: 'Shelves & Wing Builder',
        detail: 'Open the Shelves popover to jump to any wing or build new wall sections directly inside the hall.'
      },
      {
        keys: ['Click Prop'],
        label: 'Interactive Landmarks',
        detail: 'Click the Desk (study stats & inbox), Globe (Map), Fireplace or Gramophone (audio), or Telescope (balcony).'
      }
    ]
  },
  {
    heading: 'Atmosphere, Map & Navigation',
    items: [
      {
        keys: ['T'],
        label: 'Atmosphere & Soundscape',
        detail: 'Switch hall themes (Dark Academia, Sunlit Marble, Observatory), weather moods, and live Rain, Fire & Chimes.'
      },
      {
        keys: ['N'],
        label: 'Toggle Mini-Map',
        detail: 'Show or hide the live top-right architectural mini-map. Click any marker on the map to glide there.'
      },
      {
        keys: ['H'],
        label: 'Hide / Show HUD',
        detail: 'Collapse the bottom dock for an unobstructed view of the Great Library.'
      },
      {
        keys: ['Ctrl / ⌘', 'K'],
        label: 'Global Search',
        detail: 'Search books, authors, tags, notes, and full PDF text from anywhere.'
      },
      {
        keys: ['M', 'I', 'L'],
        label: 'Views',
        detail: 'Jump to the Atlas Map (M), Catalogue Index (I), or Librarian Manager (L).'
      }
    ]
  },
  {
    heading: 'PDF Reader & Precision Marking',
    items: [
      {
        keys: ['Select'],
        label: 'Text Selection',
        detail: 'Drag across text in Select mode to copy or highlight exact passages.'
      },
      {
        keys: ['H'],
        label: 'Precision Highlighter',
        detail: 'Click and drag directly on the page to place a highlight exactly where you draw.'
      },
      {
        keys: ['I'],
        label: 'Ink Pen',
        detail: 'Click and drag to draw freehand ink strokes directly on the page. Ctrl/⌘+Z undoes.'
      },
      {
        keys: ['E'],
        label: 'Eraser',
        detail: 'Click any highlight or ink stroke to remove it cleanly.'
      },
      {
        keys: ['D', 'B', 'Esc'],
        label: 'Study Mode & Bookmarks',
        detail: 'Press D for distraction-free Study Mode with session timer, B to bookmark, and Esc to return to Select tool.'
      }
    ]
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
        className="welcome welcome--guide"
        role="dialog"
        aria-modal="true"
        aria-label="Controls and navigation guide"
      >
        <header className="welcome__head">
          <div>
            <p className="eyebrow">Alexandria · Grand Hall &amp; Reader</p>
            <h2 className="display welcome__title">Controls &amp; Navigation Guide</h2>
          </div>
          <button className="icon-button" type="button" aria-label="Close guide" onClick={dismiss}>
            ×
          </button>
        </header>

        <div className="controls-grid">
          {sections.map((section) => (
            <section key={section.heading} className="controls-group">
              <h3 className="controls-group__heading">{section.heading}</h3>
              <ul className="controls-group__list">
                {section.items.map((item) => (
                  <li key={item.label} className="controls-row">
                    <div className="controls-row__keys">
                      {item.keys.map((cap) => (
                        <kbd key={cap}>{cap}</kbd>
                      ))}
                    </div>
                    <div className="controls-row__body">
                      <strong>{item.label}</strong>
                      <span>{item.detail}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="welcome__actions">
          <button
            className="button"
            type="button"
            onClick={() => {
              dismiss()
              void pickImportFiles()
            }}
          >
            Import PDFs
          </button>
          <button className="button button--quiet" type="button" onClick={dismiss}>
            Return to Hall
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
