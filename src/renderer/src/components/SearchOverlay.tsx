import type { SearchHit } from '@shared/types'
import { useEffect, useRef, useState } from 'react'
import { navigate } from '../router'
import { useReaderStore } from '../state/reader-store'
import { useUiStore } from '../state/ui-store'

const kindLabel: Record<SearchHit['kind'], string> = {
  title: 'Volume',
  text: 'Page',
  annotation: 'Note'
}

export function SearchOverlay() {
  const open = useUiStore((state) => state.searchOpen)
  const setOpen = useUiStore((state) => state.setSearchOpen)
  const openBook = useReaderStore((state) => state.open)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<SearchHit[]>([])
  const [took, setTook] = useState(0)
  const [truncated, setTruncated] = useState(false)
  const [active, setActive] = useState(0)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => inputRef.current?.focus(), 30)
    return () => window.clearTimeout(timer)
  }, [open])

  useEffect(() => {
    if (!open) {
      setQuery('')
      setHits([])
      return
    }

    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setHits([])
      setTook(0)
      setTruncated(false)
      return
    }

    let cancelled = false
    const timer = window.setTimeout(() => {
      setBusy(true)
      void window.alexandria
        .search(trimmed)
        .then((result) => {
          if (cancelled) return
          setHits(result.hits)
          setTook(result.tookMs)
          setTruncated(result.truncated)
          setActive(0)
        })
        .catch(() => undefined)
        .finally(() => {
          if (!cancelled) setBusy(false)
        })
    }, 180)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [query, open])

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setOpen(!useUiStore.getState().searchOpen)
        return
      }

      if (!open) return

      if (event.key === 'Escape') {
        event.preventDefault()
        setOpen(false)
        return
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setActive((current) => Math.min(hits.length - 1, current + 1))
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        setActive((current) => Math.max(0, current - 1))
      } else if (event.key === 'Enter' && hits[active]) {
        event.preventDefault()
        choose(hits[active])
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, hits, active, setOpen])

  const choose = (hit: SearchHit): void => {
    openBook(hit.bookId, hit.page)
    navigate('reader')
    setOpen(false)
  }

  if (!open) return null

  return (
    <div className="search-overlay" role="presentation" onClick={() => setOpen(false)}>
      <div
        className="search-palette"
        role="dialog"
        aria-modal="true"
        aria-label="Search the library"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="search-palette__field">
          <span aria-hidden="true">⌕</span>
          <input
            ref={inputRef}
            type="search"
            value={query}
            placeholder="Search titles, full text, and notes…"
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search query"
          />
          <kbd>esc</kbd>
        </div>

        <div className="search-palette__body">
          {query.trim().length < 2 ? (
            <div className="search-palette__hint">
              <p>Search across every indexed page, title, author, and note.</p>
              <p className="search-palette__keys">
                <kbd>↑</kbd> <kbd>↓</kbd> to move · <kbd>↵</kbd> to open · <kbd>⌘K</kbd> anywhere
              </p>
            </div>
          ) : hits.length === 0 ? (
            <p className="search-palette__empty">
              {busy ? 'Searching the shelves…' : `Nothing found for “${query.trim()}”.`}
            </p>
          ) : (
            <>
              <ul className="search-palette__list">
                {hits.map((hit, index) => (
                  <li key={`${hit.bookId}-${hit.page}-${hit.kind}-${index}`}>
                    <button
                      type="button"
                      className={`search-hit ${index === active ? 'search-hit--active' : ''}`}
                      onMouseEnter={() => setActive(index)}
                      onClick={() => choose(hit)}
                    >
                      <span className="search-hit__kind">{kindLabel[hit.kind]}</span>
                      <span className="search-hit__body">
                        <span className="search-hit__title">
                          {hit.title}
                          <span className="search-hit__page">p. {hit.page}</span>
                        </span>
                        <span className="search-hit__snippet">{hit.snippet}</span>
                        {hit.author ? <span className="search-hit__author">{hit.author}</span> : null}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <p className="search-palette__meta">
                {hits.length} {hits.length === 1 ? 'result' : 'results'}
                {truncated ? ' (refine to see more)' : ''} · {took} ms
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
