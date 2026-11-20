import type { Book } from '@shared/types'
import { useEffect, useMemo, useState } from 'react'
import { BookCover } from './BookCover'
import { navigate } from '../router'
import { useLibraryStore } from '../state/library-store'
import { useReaderStore } from '../state/reader-store'

type Tab = 'desk' | 'inbox'

export function DeskDrawer({ onClose }: { onClose: () => void }) {
  const books = useLibraryStore((state) => state.books)
  const layout = useLibraryStore((state) => state.layout)
  const refresh = useLibraryStore((state) => state.refresh)
  const openBook = useReaderStore((state) => state.open)
  const [tab, setTab] = useState<Tab>('desk')
  const [desk, setDesk] = useState<{ reading: Book[]; pinned: Book[]; finished: Book[] }>({
    reading: [],
    pinned: [],
    finished: []
  })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void window.alexandria.deskBooks().then(setDesk)
  }, [])

  const inbox = useMemo(
    () => books.filter((book) => book.shelfId === null).sort((a, b) => b.addedAt.localeCompare(a.addedAt)),
    [books]
  )

  const open = (book: Book): void => {
    openBook(book.id, book.lastPage)
    navigate('reader')
    onClose()
  }

  const shelve = async (book: Book): Promise<void> => {
    setBusy(true)
    try {
      let target = layout
        .flatMap((floor) => floor.rooms)
        .flatMap((room) => room.sections)
        .flatMap((section) => section.bays)
        .flatMap((bay) => bay.shelves)
        .find((shelf) => shelf.bookCount < shelf.capacity)

      if (!target) {
        const room = layout[0]?.rooms[0]
        const sectionId = room?.sections[0]?.id
        if (sectionId) {
          const bayId = await window.alexandria.createContainer({ kind: 'bay', parentId: sectionId })
          void bayId
          await refresh()
          target = useLibraryStore
            .getState()
            .layout.flatMap((floor) => floor.rooms)
            .flatMap((room) => room.sections)
            .flatMap((section) => section.bays)
            .flatMap((bay) => bay.shelves)
            .find((shelf) => shelf.bookCount < shelf.capacity)
        }
      }

      if (target) {
        await window.alexandria.moveBook(book.id, target.id)
        await refresh()
        setDesk(await window.alexandria.deskBooks())
      }
    } finally {
      setBusy(false)
    }
  }

  const pin = async (book: Book): Promise<void> => {
    await window.alexandria.setBookPinned(book.id, !book.deskPinned)
    await refresh()
    setDesk(await window.alexandria.deskBooks())
  }

  const groups: Array<{ key: keyof typeof desk; title: string }> = [
    { key: 'pinned', title: 'Pinned' },
    { key: 'reading', title: 'Currently reading' },
    { key: 'finished', title: 'Finished in the last 30 days' }
  ]

  return (
    <aside className="shelf-drawer desk-drawer" aria-label="Reading desk and inbox">
      <header className="shelf-drawer__head">
        <div>
          <p className="eyebrow">Near the entrance</p>
          <h2>{tab === 'desk' ? 'The reading desk' : 'Inbox cart'}</h2>
        </div>
        <button className="icon-button" type="button" onClick={onClose} aria-label="Close desk">
          ×
        </button>
      </header>

      <div className="desk-drawer__tabs">
        <button type="button" className="chip" aria-current={tab === 'desk' ? 'true' : undefined} onClick={() => setTab('desk')}>
          Desk
        </button>
        <button type="button" className="chip" aria-current={tab === 'inbox' ? 'true' : undefined} onClick={() => setTab('inbox')}>
          Inbox · {inbox.length}
        </button>
      </div>

      {tab === 'desk' ? (
        <div className="desk-drawer__scroll">
          {groups.map((group) => {
            const entries = desk[group.key].slice(0, 5)
            if (entries.length === 0) return null
            return (
              <section key={group.key} className="desk-group">
                <h3>{group.title}</h3>
                <ul>
                  {entries.map((book) => (
                    <li key={book.id}>
                      <button type="button" className="shelf-drawer__open" onClick={() => open(book)}>
                        <BookCover book={book} className="cover--mini" />
                        <span>
                          <span className="shelf-drawer__title">{book.title}</span>
                          <span className="shelf-drawer__author">
                            {book.author ?? 'Unknown author'} · p. {book.lastPage}
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        className="shelf-drawer__action"
                        onClick={() => void pin(book)}
                        title={book.deskPinned ? 'Unpin' : 'Pin to the desk'}
                      >
                        {book.deskPinned ? 'Unpin' : 'Pin'}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}

          {desk.pinned.length + desk.reading.length + desk.finished.length === 0 ? (
            <p className="reader__muted">
              Nothing on the desk yet. Start reading a volume, or pin one from the index.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="desk-drawer__scroll">
          {inbox.length === 0 ? (
            <p className="reader__muted">The cart is empty. Every volume has a shelf.</p>
          ) : (
            <ul className="shelf-drawer__list">
              {inbox.map((book) => (
                <li key={book.id} className="shelf-drawer__book">
                  <button type="button" className="shelf-drawer__open" onClick={() => open(book)}>
                    <BookCover book={book} className="cover--mini" />
                    <span>
                      <span className="shelf-drawer__title">{book.title}</span>
                      <span className="shelf-drawer__author">
                        {(book.originalFormat ?? book.format).toUpperCase()}
                        {book.pageCount ? ` · ${book.pageCount} pages` : ''}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="shelf-drawer__action"
                    disabled={busy}
                    onClick={() => void shelve(book)}
                  >
                    Shelve
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </aside>
  )
}
