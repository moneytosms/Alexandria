import type { LibraryInfo } from '@shared/api'
import type { Book } from '@shared/types'
import { navigate } from '../router'

interface Props {
  library: LibraryInfo | null
  books: Book[]
}

const stateLabels: Record<Book['readingState'], string> = {
  unread: 'Unread',
  reading: 'Reading',
  finished: 'Finished'
}

export function IndexView({ library, books }: Props) {
  const empty = books.length === 0

  return (
    <div className="index">
      <div className="index__bar">
        <p className="index__count">
          {books.length} {books.length === 1 ? 'volume' : 'volumes'}
        </p>
        <span className="index__hint">Sorted by date added</span>
      </div>

      <div className="index__table-wrap">
        <table className="index__table">
          <thead>
            <tr>
              <th scope="col">Title</th>
              <th scope="col">Author</th>
              <th scope="col">Pages</th>
              <th scope="col">Shelf</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {empty ? (
              <tr>
                <td colSpan={5}>
                  <div className="index__empty">
                    <p className="eyebrow">Empty catalogue</p>
                    <p>No volumes yet. The first import will appear here and on a shelf.</p>
                    <button
                      className="button button--quiet"
                      type="button"
                      onClick={() => navigate('room')}
                    >
                      Return to the room
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              books.map((book) => (
                <tr key={book.id}>
                  <td>
                    <span className="index__book-title">{book.title}</span>
                    <span className="index__book-format">{book.format.toUpperCase()}</span>
                  </td>
                  <td>{book.author ?? '—'}</td>
                  <td>{book.pageCount ?? '—'}</td>
                  <td>{book.shelfId === null ? 'Inbox' : `Shelf ${book.shelfId}`}</td>
                  <td>
                    <span className={`index__state index__state--${book.readingState}`}>
                      {stateLabels[book.readingState]}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="index__footnote">
        {library ? library.root : 'The library folder is being prepared.'}
      </p>
    </div>
  )
}
