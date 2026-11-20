import type { Book, Shelf } from '@shared/types'
import { useEffect, useMemo, useState } from 'react'
import { BookCover } from './BookCover'
import { navigate } from '../router'
import { shelfDisplayName } from '../room/scene-builders'
import { playSound } from '../sound'
import { useLibraryStore } from '../state/library-store'
import { useReaderStore } from '../state/reader-store'

interface Props {
  book: Book
  onClose: () => void
}

export function BookPreviewCard({ book, onClose }: Props) {
  const layout = useLibraryStore((s) => s.layout)
  const books = useLibraryStore((s) => s.books)
  const refresh = useLibraryStore((s) => s.refresh)
  const openBook = useReaderStore((s) => s.open)

  const liveBook = useMemo(() => books.find((b) => b.id === book.id) ?? book, [books, book])

  const [tagDraft, setTagDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [annotationCount, setAnnotationCount] = useState<number | null>(null)

  useEffect(() => {
    let active = true
    void window.alexandria
      .bookDetails(liveBook.id)
      .then((details) => {
        if (active) setAnnotationCount(details.annotationCount)
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [liveBook.id])

  const allShelves = useMemo(() => {
    const out: Array<{ shelf: Shelf; pathLabel: string }> = []
    for (const floor of layout) {
      for (const room of floor.rooms) {
        for (const section of room.sections) {
          for (const bay of section.bays) {
            for (const shelf of bay.shelves) {
              out.push({
                shelf,
                pathLabel: `${section.name} · ${shelfDisplayName(shelf)}`
              })
            }
          }
        }
      }
    }
    return out
  }, [layout])

  const pageTotal = liveBook.pageCount ?? 0
  const currentPage = Math.max(0, liveBook.lastPage)
  const progressPct =
    liveBook.readingState === 'finished'
      ? 100
      : pageTotal > 0
        ? Math.min(100, Math.round((currentPage / pageTotal) * 100))
        : 0

  const handleOpen = (): void => {
    playSound('pull')
    openBook(liveBook.id, liveBook.lastPage)
    onClose()
    navigate('reader')
  }

  const handleMoveShelf = async (target: string): Promise<void> => {
    setBusy(true)
    try {
      if (target === 'inbox') {
        await window.alexandria.unshelveBook(liveBook.id)
      } else {
        await window.alexandria.moveBook(liveBook.id, Number(target))
      }
      playSound('thud')
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  const handleTogglePin = async (): Promise<void> => {
    setBusy(true)
    try {
      await window.alexandria.setBookPinned(liveBook.id, !liveBook.deskPinned)
      playSound('tick')
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  const handleToggleFinished = async (): Promise<void> => {
    setBusy(true)
    try {
      await window.alexandria.setBookFinished(liveBook.id, liveBook.readingState !== 'finished')
      playSound('tick')
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  const handleAddTag = async (): Promise<void> => {
    const cleaned = tagDraft.trim()
    if (!cleaned) return
    const next = Array.from(new Set([...liveBook.tags, cleaned]))
    setBusy(true)
    try {
      await window.alexandria.setBookTags(liveBook.id, next)
      setTagDraft('')
      playSound('tick')
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  const handleRemoveTag = async (tag: string): Promise<void> => {
    setBusy(true)
    try {
      await window.alexandria.setBookTags(
        liveBook.id,
        liveBook.tags.filter((t) => t !== tag)
      )
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="preview-scrim" role="presentation" onClick={onClose}>
      <div
        className="book-preview"
        role="dialog"
        aria-modal="true"
        aria-label={`Book preview: ${liveBook.title}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="icon-button book-preview__close"
          onClick={onClose}
          aria-label="Close preview"
        >
          ×
        </button>

        <div className="book-preview__top">
          <BookCover book={liveBook} className="book-preview__cover" />
          <div className="book-preview__meta">
            <p className="eyebrow">
              {liveBook.readingState === 'finished'
                ? 'Finished Volume'
                : liveBook.readingState === 'reading'
                  ? 'Currently Reading'
                  : 'Unread Volume'}
            </p>
            <h2 className="book-preview__title">{liveBook.title}</h2>
            <p className="book-preview__author">{liveBook.author ?? 'Unknown author'}</p>

            <div className="book-preview__progress">
              <div className="book-preview__progress-head">
                <span>
                  {pageTotal > 0 ? `Page ${Math.max(1, currentPage)} of ${pageTotal}` : 'Reading progress'}
                </span>
                <span>{progressPct}%</span>
              </div>
              <div className="book-preview__bar">
                <span style={{ width: `${progressPct}%` }} />
              </div>
            </div>

            {annotationCount !== null && annotationCount > 0 ? (
              <p className="book-preview__notes">
                {annotationCount} {annotationCount === 1 ? 'annotation' : 'annotations'} saved
              </p>
            ) : null}
          </div>
        </div>

        <div className="book-preview__shelf-row">
          <label htmlFor="preview-shelf-select">Shelf location</label>
          <select
            id="preview-shelf-select"
            value={liveBook.shelfId === null ? 'inbox' : String(liveBook.shelfId)}
            disabled={busy}
            onChange={(e) => void handleMoveShelf(e.target.value)}
          >
            <option value="inbox">Reading Desk Inbox</option>
            {allShelves.map(({ shelf, pathLabel }) => (
              <option key={shelf.id} value={String(shelf.id)}>
                {pathLabel} ({shelf.bookCount}/{shelf.capacity})
              </option>
            ))}
          </select>
        </div>

        <div className="book-preview__tags">
          <div className="book-preview__tag-list">
            {liveBook.tags.length === 0 ? (
              <span className="book-preview__muted">No tags yet</span>
            ) : (
              liveBook.tags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className="book-preview__tag"
                  onClick={() => void handleRemoveTag(tag)}
                  title={`Remove tag "${tag}"`}
                >
                  {tag} ×
                </button>
              ))
            )}
          </div>
          <form
            className="book-preview__tag-form"
            onSubmit={(e) => {
              e.preventDefault()
              void handleAddTag()
            }}
          >
            <input
              type="text"
              value={tagDraft}
              maxLength={32}
              placeholder="Add tag (e.g. philosophy, favorites)"
              onChange={(e) => setTagDraft(e.target.value)}
            />
            <button type="submit" className="button button--quiet" disabled={busy || !tagDraft.trim()}>
              Tag
            </button>
          </form>
        </div>

        <div className="book-preview__actions">
          <button type="button" className="button" onClick={handleOpen}>
            Open in Reader
          </button>
          <button
            type="button"
            className="button button--quiet"
            disabled={busy}
            onClick={() => void handleTogglePin()}
          >
            {liveBook.deskPinned ? 'Unpin Desk' : 'Pin to Desk'}
          </button>
          <button
            type="button"
            className="button button--quiet"
            disabled={busy}
            onClick={() => void handleToggleFinished()}
          >
            {liveBook.readingState === 'finished' ? 'Mark Reading' : 'Mark Finished'}
          </button>
        </div>
      </div>
    </div>
  )
}
