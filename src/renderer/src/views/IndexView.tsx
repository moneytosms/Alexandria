import type { LibraryInfo } from '@shared/api'
import type { Book } from '@shared/types'
import { useMemo, useState } from 'react'
import { BookCover } from '../components/BookCover'
import { BookDetailsDialog } from '../components/BookDetailsDialog'
import { navigate } from '../router'
import { useLibraryStore } from '../state/library-store'
import { useReaderStore } from '../state/reader-store'

interface Props {
  library: LibraryInfo | null
  books: Book[]
}

type SortKey = 'title' | 'author' | 'pages' | 'added' | 'state'
type StateFilter = 'all' | 'unread' | 'reading' | 'finished' | 'missing'

const stateLabels: Record<string, string> = {
  unread: 'Unread',
  reading: 'Reading',
  finished: 'Finished'
}

export function IndexView({ library, books }: Props) {
  const openBook = useReaderStore((state) => state.open)
  const refreshBooks = useLibraryStore((state) => state.refreshBooks)
  const [query, setQuery] = useState('')
  const [tag, setTag] = useState<string>('')
  const [stateFilter, setStateFilter] = useState<StateFilter>('all')
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({
    key: 'added',
    dir: 'desc'
  })
  const [relinking, setRelinking] = useState<number | null>(null)
  const [detailsId, setDetailsId] = useState<number | null>(null)

  const tags = useMemo(() => {
    const set = new Set<string>()
    for (const book of books) for (const name of book.tags) set.add(name)
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [books])

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const filtered = books.filter((book) => {
      if (tag && !book.tags.includes(tag)) return false
      if (stateFilter === 'missing' && !book.missing) return false
      if (stateFilter !== 'all' && stateFilter !== 'missing' && book.readingState !== stateFilter) {
        return false
      }
      if (!needle) return true
      return [book.title, book.author ?? '', book.filePath, ...book.tags]
        .join(' ')
        .toLowerCase()
        .includes(needle)
    })

    const direction = sort.dir === 'asc' ? 1 : -1
    const value = (book: (typeof books)[number]): string | number => {
      switch (sort.key) {
        case 'title':
          return book.title.toLowerCase()
        case 'author':
          return (book.author ?? '').toLowerCase()
        case 'pages':
          return book.pageCount ?? 0
        case 'state':
          return book.readingState
        case 'added':
        default:
          return book.addedAt
      }
    }

    return [...filtered].sort((a, b) => {
      const left = value(a)
      const right = value(b)
      if (typeof left === 'number' && typeof right === 'number') return (left - right) * direction
      return String(left).localeCompare(String(right)) * direction
    })
  }, [books, query, sort, stateFilter, tag])

  const open = (id: number): void => {
    const book = books.find((entry) => entry.id === id)
    openBook(id, book?.lastPage ?? 1)
    navigate('reader')
  }

  const relink = async (id: number): Promise<void> => {
    setRelinking(id)
    try {
      await window.alexandria.relinkBook(id)
      await refreshBooks()
    } catch (error) {
      void window.alexandria
        .log('error', 'Relink failed', error instanceof Error ? error.message : String(error))
        .catch(() => undefined)
    } finally {
      setRelinking(null)
    }
  }

  const toggleSort = (key: SortKey): void => {
    setSort((current) =>
      current.key === key
        ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: key === 'added' ? 'desc' : 'asc' }
    )
  }

  return (
    <div className="index">
      <div className="index__toolbar">
        <label className="field index__search">
          <span className="sr-only">Filter the index</span>
          <input
            type="search"
            value={query}
            placeholder="Filter by title, author, tag, or path…"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>

        <div className="index__filters" role="group" aria-label="Reading status">
          {(['all', 'unread', 'reading', 'finished', 'missing'] as StateFilter[]).map((value) => (
            <button
              key={value}
              type="button"
              className="chip"
              aria-current={stateFilter === value ? 'true' : undefined}
              onClick={() => setStateFilter(value)}
            >
              {value === 'all' ? 'All' : value === 'missing' ? 'Missing' : stateLabels[value]}
            </button>
          ))}
        </div>

        {tags.length > 0 ? (
          <label className="field index__tag">
            <span className="sr-only">Tag</span>
            <select value={tag} onChange={(event) => setTag(event.target.value)}>
              <option value="">All tags</option>
              {tags.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <div className="index__bar">
        <p className="index__count">
          {visible.length} of {books.length} {books.length === 1 ? 'volume' : 'volumes'}
        </p>
        <span className="index__hint">
          Click a column to sort · click a row to read · ↑ ↓ to move between rows
        </span>
      </div>

      <div className="index__table-wrap">
        <table className="index__table">
          <thead>
            <tr>
              <th scope="col" aria-sort={sort.key === 'title' ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                <button type="button" className="index__sort" onClick={() => toggleSort('title')}>
                  Title {sort.key === 'title' ? (sort.dir === 'asc' ? '↑' : '↓') : ''}
                </button>
              </th>
              <th scope="col">
                <button type="button" className="index__sort" onClick={() => toggleSort('author')}>
                  Author {sort.key === 'author' ? (sort.dir === 'asc' ? '↑' : '↓') : ''}
                </button>
              </th>
              <th scope="col">
                <button type="button" className="index__sort" onClick={() => toggleSort('pages')}>
                  Pages {sort.key === 'pages' ? (sort.dir === 'asc' ? '↑' : '↓') : ''}
                </button>
              </th>
              <th scope="col">Shelf</th>
              <th scope="col">
                <button type="button" className="index__sort" onClick={() => toggleSort('state')}>
                  Status {sort.key === 'state' ? (sort.dir === 'asc' ? '↑' : '↓') : ''}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <div className="index__empty">
                    <p className="eyebrow">{books.length === 0 ? 'Empty catalogue' : 'Nothing matches'}</p>
                    <p>
                      {books.length === 0
                        ? 'No volumes yet. The first import will appear here and on a shelf.'
                        : 'Try a different filter, or clear the search.'}
                    </p>
                    <button
                      className="button button--quiet"
                      type="button"
                      onClick={() => {
                        setQuery('')
                        setTag('')
                        setStateFilter('all')
                      }}
                    >
                      Clear filters
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              visible.map((book) => (
                <tr
                  key={book.id}
                  className={book.missing ? 'index__row index__row--missing' : 'index__row'}
                  tabIndex={0}
                  onClick={() => open(book.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      open(book.id)
                      return
                    }
                    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                      event.preventDefault()
                      const row = event.currentTarget as HTMLTableRowElement
                      const next =
                        event.key === 'ArrowDown'
                          ? row.nextElementSibling
                          : row.previousElementSibling
                      if (next instanceof HTMLElement) next.focus()
                    }
                  }}
                >
                  <td>
                    <div className="index__book">
                      <BookCover book={book} className="cover--row" />
                      <div className="index__book-copy">
                        <span className="index__book-title">{book.title}</span>
                        <span className="index__book-format">
                          {(book.originalFormat ?? book.format).toUpperCase()}
                          {book.encrypted ? ' · locked' : ''}
                          {book.missing ? ' · missing' : ''}
                        </span>
                        {book.tags.length > 0 ? (
                          <span className="index__tags">
                            {book.tags.map((name) => (
                              <span key={name} className="tag">
                                {name}
                              </span>
                            ))}
                          </span>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        className="index__details"
                        aria-label={`Details for ${book.title}`}
                        onClick={(event) => {
                          event.stopPropagation()
                          setDetailsId(book.id)
                        }}
                      >
                        ⋯
                      </button>
                    </div>
                  </td>
                  <td>{book.author ?? '—'}</td>
                  <td>{book.pageCount ?? '—'}</td>
                  <td>{book.shelfId === null ? 'Inbox' : `Shelf ${book.shelfId}`}</td>
                  <td>
                    <span className={`index__state index__state--${book.readingState}`}>
                      {stateLabels[book.readingState] ?? book.readingState}
                    </span>
                    {book.missing ? (
                      <button
                        type="button"
                        className="index__relink"
                        disabled={relinking === book.id}
                        onClick={(event) => {
                          event.stopPropagation()
                          void relink(book.id)
                        }}
                      >
                        {relinking === book.id ? 'Locating…' : 'Locate file'}
                      </button>
                    ) : null}
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

      {detailsId !== null ? (
        <BookDetailsDialog bookId={detailsId} onClose={() => setDetailsId(null)} />
      ) : null}
    </div>
  )
}
