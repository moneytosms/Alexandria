import type { BookDetails, Shelf } from '@shared/types'
import { useEffect, useMemo, useState } from 'react'
import { BookCover } from './BookCover'
import { navigate } from '../router'
import { useLibraryStore } from '../state/library-store'
import { useReaderStore } from '../state/reader-store'

interface Props {
  bookId: number
  onClose: () => void
}

export function BookDetailsDialog({ bookId, onClose }: Props) {
  const layout = useLibraryStore((state) => state.layout)
  const refresh = useLibraryStore((state) => state.refresh)
  const refreshBooks = useLibraryStore((state) => state.refreshBooks)
  const openBook = useReaderStore((state) => state.open)

  const [details, setDetails] = useState<BookDetails | null>(null)
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [tags, setTags] = useState('')
  const [shelfId, setShelfId] = useState<string>('')
  const [deleteFile, setDeleteFile] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void window.alexandria.bookDetails(bookId).then((loaded) => {
      if (cancelled) return
      setDetails(loaded)
      setTitle(loaded.book.title)
      setAuthor(loaded.book.author ?? '')
      setTags(loaded.book.tags.join(', '))
      setShelfId(loaded.book.shelfId === null ? '' : String(loaded.book.shelfId))
    })
    return () => {
      cancelled = true
    }
  }, [bookId])

  const shelves = useMemo(() => {
    const flat: Array<{ shelf: Shelf; label: string }> = []
    for (const floor of layout) {
      for (const room of floor.rooms) {
        for (const section of room.sections) {
          for (const bay of section.bays) {
            for (const shelf of bay.shelves) {
              flat.push({
                shelf,
                label: `${floor.name} · ${room.name} · ${section.name} · Shelf ${shelf.id}`
              })
            }
          }
        }
      }
    }
    return flat
  }, [layout])

  if (!details) {
    return (
      <div className="dialog-scrim" role="presentation" onClick={onClose}>
        <div className="dialog dialog--wide" role="dialog" aria-modal="true">
          <p className="reader__muted">Opening the catalogue entry…</p>
        </div>
      </div>
    )
  }

  const book = details.book

  const save = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      const updated = await window.alexandria.updateBook(book.id, {
        title: title.trim() || book.title,
        author: author.trim() || null
      })
      await window.alexandria.setBookTags(
        book.id,
        tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean)
      )
      if (shelfId !== (book.shelfId === null ? '' : String(book.shelfId))) {
        if (shelfId === '') await window.alexandria.unshelveBook(book.id)
        else await window.alexandria.moveBook(book.id, Number(shelfId))
      }
      setDetails({ ...details, book: updated })
      await refresh()
      await refreshBooks()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save the entry')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (): Promise<void> => {
    const owned = book.storageMode === 'copy'
    const message = owned
      ? `Remove “${book.title}” from the library?${deleteFile ? ' The copied file will be deleted.' : ''}`
      : `Forget “${book.title}”? The linked file stays where it is.`
    if (!window.confirm(message)) return

    setBusy(true)
    try {
      await window.alexandria.removeBook(book.id, deleteFile && owned)
      await refresh()
      await refreshBooks()
      onClose()
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Could not remove the book')
      setBusy(false)
    }
  }

  const relink = async (): Promise<void> => {
    setBusy(true)
    try {
      const updated = await window.alexandria.relinkBook(book.id)
      setDetails({ ...details, book: updated, fileExists: true })
      await refreshBooks()
    } catch (relinkError) {
      setError(relinkError instanceof Error ? relinkError.message : 'Could not relink the file')
    } finally {
      setBusy(false)
    }
  }

  const toggle = async (action: 'pin' | 'finished'): Promise<void> => {
    setBusy(true)
    try {
      if (action === 'pin') await window.alexandria.setBookPinned(book.id, !book.deskPinned)
      else await window.alexandria.setBookFinished(book.id, book.readingState !== 'finished')
      const updated = await window.alexandria.bookDetails(book.id)
      setDetails(updated)
      await refreshBooks()
    } finally {
      setBusy(false)
    }
  }

  const read = (): void => {
    openBook(book.id, book.lastPage)
    onClose()
    navigate('reader')
  }

  return (
    <div className="dialog-scrim" role="presentation" onClick={onClose}>
      <div
        className="dialog dialog--wide"
        role="dialog"
        aria-modal="true"
        aria-label={`Details for ${book.title}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="details">
          <div className="details__cover">
            <BookCover book={book} className="cover--detail" />
            <p className="details__format">{(book.originalFormat ?? book.format).toUpperCase()}</p>
            {book.encrypted ? <p className="details__flag">Locked PDF</p> : null}
            {book.missing ? <p className="details__flag details__flag--warn">File missing</p> : null}
          </div>

          <div className="details__body">
            <p className="eyebrow">Catalogue entry</p>
            <h2 className="details__title">{book.title}</h2>
            <p className="details__author">{book.author ?? 'Unknown author'}</p>

            <dl className="details__stats">
              <div>
                <dt>Pages</dt>
                <dd>{book.pageCount ?? '—'}</dd>
              </div>
              <div>
                <dt>Annotations</dt>
                <dd>{details.annotationCount}</dd>
              </div>
              <div>
                <dt>Added</dt>
                <dd>{book.addedAt.slice(0, 10)}</dd>
              </div>
              <div>
                <dt>Size</dt>
                <dd>{book.fileSize ? `${(book.fileSize / 1024 / 1024).toFixed(1)} MB` : '—'}</dd>
              </div>
            </dl>

            <div className="details__grid">
              <label className="field">
                <span>Title</span>
                <input value={title} onChange={(event) => setTitle(event.target.value)} />
              </label>
              <label className="field">
                <span>Author</span>
                <input value={author} onChange={(event) => setAuthor(event.target.value)} />
              </label>
              <label className="field">
                <span>Tags (comma separated)</span>
                <input value={tags} onChange={(event) => setTags(event.target.value)} />
              </label>
              <label className="field">
                <span>Shelf</span>
                <select value={shelfId} onChange={(event) => setShelfId(event.target.value)}>
                  <option value="">Inbox (no shelf)</option>
                  {shelves.map((entry) => (
                    <option key={entry.shelf.id} value={entry.shelf.id}>
                      {entry.label} ({entry.shelf.bookCount}/{entry.shelf.capacity})
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <p className="details__path" title={book.filePath}>
              {book.filePath}
            </p>
            {!details.fileExists ? (
              <p className="form-error">The file is not at this path anymore.</p>
            ) : null}
            {error ? <p className="form-error">{error}</p> : null}

            <div className="details__actions">
              <button className="button" type="button" onClick={read}>
                Read
              </button>
              <button className="button button--quiet" type="button" onClick={() => void save()} disabled={busy}>
                Save changes
              </button>
              <button className="button button--quiet" type="button" onClick={() => void toggle('pin')} disabled={busy}>
                {book.deskPinned ? 'Unpin from desk' : 'Pin to desk'}
              </button>
              <button className="button button--quiet" type="button" onClick={() => void toggle('finished')} disabled={busy}>
                {book.readingState === 'finished' ? 'Mark unread' : 'Mark finished'}
              </button>
              {!details.fileExists || book.missing ? (
                <button className="button button--quiet" type="button" onClick={() => void relink()} disabled={busy}>
                  Locate file
                </button>
              ) : null}
              <button className="link-button details__remove" type="button" onClick={() => void remove()} disabled={busy}>
                Remove from library
              </button>
              {book.storageMode === 'copy' ? (
                <label className="details__delete">
                  <input
                    type="checkbox"
                    checked={deleteFile}
                    onChange={(event) => setDeleteFile(event.target.checked)}
                  />
                  Also delete the copied file
                </label>
              ) : null}
            </div>
          </div>
        </div>

        <button className="icon-button details__close" type="button" onClick={onClose} aria-label="Close details">
          ×
        </button>
      </div>
    </div>
  )
}
