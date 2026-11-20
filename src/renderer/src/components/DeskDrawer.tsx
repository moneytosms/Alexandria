import type { Book, Shelf } from '@shared/types'
import { useEffect, useMemo, useState } from 'react'
import { BookCover } from './BookCover'
import { navigate } from '../router'
import { shelfDisplayName } from '../room/scene-builders'
import { playSound } from '../sound'
import { useLibraryStore } from '../state/library-store'
import { useReaderStore } from '../state/reader-store'
import {
  computeReadingStats,
  formatClock,
  localDateKey,
  modeDurationSeconds,
  useStudyStore,
  type TimerMode
} from '../state/study-store'

type Tab = 'desk' | 'inbox' | 'study'

interface Props {
  onInspectBook?: (book: Book) => void
  onClose: () => void
}

export function DeskDrawer({ onInspectBook, onClose }: Props) {
  const books = useLibraryStore((state) => state.books)
  const layout = useLibraryStore((state) => state.layout)
  const refresh = useLibraryStore((state) => state.refresh)
  const openBook = useReaderStore((state) => state.open)

  const studyModeType = useStudyStore((s) => s.mode)
  const studyRunning = useStudyStore((s) => s.running)
  const studyElapsed = useStudyStore((s) => s.elapsedSec)
  const studyPages = useStudyStore((s) => s.pagesTurned)
  const dailyGoalMin = useStudyStore((s) => s.dailyGoalMin)
  const sessions = useStudyStore((s) => s.sessions)
  const lastNotice = useStudyStore((s) => s.lastCompletedNotice)
  const setTimerMode = useStudyStore((s) => s.setMode)
  const toggleRunning = useStudyStore((s) => s.toggleRunning)
  const resetTimer = useStudyStore((s) => s.reset)
  const finishAndLog = useStudyStore((s) => s.finishAndLog)
  const setDailyGoal = useStudyStore((s) => s.setDailyGoal)

  const [tab, setTab] = useState<Tab>('desk')
  const [desk, setDesk] = useState<{ reading: Book[]; pinned: Book[]; finished: Book[] }>({
    reading: [],
    pinned: [],
    finished: []
  })
  const [targetShelfId, setTargetShelfId] = useState<string>('auto')
  const [goalDraft, setGoalDraft] = useState<string>(String(dailyGoalMin))
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void window.alexandria.deskBooks().then(setDesk)
  }, [])

  useEffect(() => {
    setGoalDraft(String(dailyGoalMin))
  }, [dailyGoalMin])

  const allShelves = useMemo(() => {
    const out: Array<{ shelf: Shelf; label: string }> = []
    for (const floor of layout) {
      for (const room of floor.rooms) {
        for (const section of room.sections) {
          for (const bay of section.bays) {
            for (const shelf of bay.shelves) {
              out.push({ shelf, label: `${section.name} · ${shelfDisplayName(shelf)}` })
            }
          }
        }
      }
    }
    return out
  }, [layout])

  const inbox = useMemo(
    () => books.filter((book) => book.shelfId === null).sort((a, b) => b.addedAt.localeCompare(a.addedAt)),
    [books]
  )

  const finishedCount = useMemo(
    () => books.filter((b) => b.readingState === 'finished').length,
    [books]
  )

  const stats = useMemo(
    () => computeReadingStats(sessions, localDateKey(), dailyGoalMin),
    [sessions, dailyGoalMin]
  )

  const open = (book: Book): void => {
    playSound('pull')
    openBook(book.id, book.lastPage)
    navigate('reader')
    onClose()
  }

  const shelve = async (book: Book): Promise<void> => {
    setBusy(true)
    try {
      let target: Shelf | undefined
      if (targetShelfId !== 'auto') {
        target = allShelves.find((s) => String(s.shelf.id) === targetShelfId)?.shelf
      }
      if (!target) {
        target = allShelves.find((s) => s.shelf.bookCount < s.shelf.capacity)?.shelf
      }

      if (!target) {
        const room = layout[0]?.rooms[0]
        const sectionId = room?.sections[0]?.id
        if (sectionId) {
          await window.alexandria.createContainer({ kind: 'bay', parentId: sectionId })
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
        playSound('thud')
        await refresh()
        setDesk(await window.alexandria.deskBooks())
      }
    } finally {
      setBusy(false)
    }
  }

  const pin = async (book: Book): Promise<void> => {
    await window.alexandria.setBookPinned(book.id, !book.deskPinned)
    playSound('tick')
    await refresh()
    setDesk(await window.alexandria.deskBooks())
  }

  const groups: Array<{ key: keyof typeof desk; title: string }> = [
    { key: 'pinned', title: 'Pinned' },
    { key: 'reading', title: 'Currently reading' },
    { key: 'finished', title: 'Finished recently' }
  ]

  const targetSec = modeDurationSeconds(studyModeType)
  const displayTime =
    targetSec > 0 ? formatClock(Math.max(0, targetSec - studyElapsed)) : formatClock(studyElapsed)

  return (
    <aside className="shelf-drawer desk-drawer" aria-label="Reading desk, inbox and study tracker">
      <header className="shelf-drawer__head">
        <div>
          <p className="eyebrow">Center Nave</p>
          <h2>
            {tab === 'desk'
              ? 'The Reading Desk'
              : tab === 'inbox'
                ? 'Inbox Cart'
                : 'Study & Reading Stats'}
          </h2>
        </div>
        <button className="icon-button" type="button" onClick={onClose} aria-label="Close desk">
          ×
        </button>
      </header>

      <div className="desk-drawer__tabs">
        <button
          type="button"
          className="chip"
          aria-current={tab === 'desk' ? 'true' : undefined}
          onClick={() => setTab('desk')}
        >
          Desk
        </button>
        <button
          type="button"
          className="chip"
          aria-current={tab === 'inbox' ? 'true' : undefined}
          onClick={() => setTab('inbox')}
        >
          Inbox · {inbox.length}
        </button>
        <button
          type="button"
          className="chip"
          aria-current={tab === 'study' ? 'true' : undefined}
          onClick={() => setTab('study')}
        >
          Study {studyRunning ? `· ${displayTime}` : ''}
        </button>
      </div>

      {tab === 'desk' ? (
        <div className="desk-drawer__scroll">
          {groups.map((group) => {
            const entries = desk[group.key].slice(0, 6)
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
                            {book.author ?? 'Unknown author'} · p. {Math.max(1, book.lastPage)}
                          </span>
                        </span>
                      </button>
                      <div className="shelf-drawer__row-actions">
                        {onInspectBook ? (
                          <button
                            type="button"
                            className="shelf-drawer__action"
                            onClick={() => onInspectBook(book)}
                          >
                            Info
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="shelf-drawer__action"
                          onClick={() => void pin(book)}
                          title={book.deskPinned ? 'Unpin' : 'Pin to the desk'}
                        >
                          {book.deskPinned ? 'Unpin' : 'Pin'}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}

          {desk.pinned.length + desk.reading.length + desk.finished.length === 0 ? (
            <p className="reader__muted">
              Nothing on the desk yet. Start reading a volume, or right-click any book spine to pin it.
            </p>
          ) : null}
        </div>
      ) : tab === 'inbox' ? (
        <div className="desk-drawer__scroll">
          {inbox.length > 0 ? (
            <label className="desk-inbox__dest">
              <span>Shelve into</span>
              <select
                value={targetShelfId}
                onChange={(e) => setTargetShelfId(e.target.value)}
              >
                <option value="auto">First open shelf</option>
                {allShelves.map(({ shelf, label }) => (
                  <option key={shelf.id} value={String(shelf.id)}>
                    {label} ({shelf.bookCount}/{shelf.capacity})
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {inbox.length === 0 ? (
            <p className="reader__muted">The cart is empty. Every volume has a home on the shelves.</p>
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
      ) : (
        <div className="desk-drawer__scroll study-panel">
          <section className="study-timer-card">
            <div className="study-timer-card__modes">
              {(
                [
                  ['pomodoro25', '25m'],
                  ['deep50', '50m'],
                  ['stopwatch', 'Free']
                ] as Array<[TimerMode, string]>
              ).map(([m, label]) => (
                <button
                  key={m}
                  type="button"
                  className={`chip ${studyModeType === m ? 'chip--active' : ''}`}
                  aria-current={studyModeType === m ? 'true' : undefined}
                  onClick={() => setTimerMode(m)}
                >
                  {label}
                </button>
              ))}
            </div>

            <p className="study-timer-card__clock">{displayTime}</p>
            <p className="study-timer-card__sub">
              {studyRunning
                ? `Active session${studyPages > 0 ? ` · ${studyPages} pages turned` : ''}`
                : studyElapsed > 0
                  ? 'Paused'
                  : 'Ready to begin'}
            </p>

            <div className="study-timer-card__actions">
              <button
                type="button"
                className="button"
                onClick={() => {
                  playSound('tick')
                  toggleRunning()
                }}
              >
                {studyRunning ? 'Pause' : studyElapsed > 0 ? 'Resume' : 'Start Session'}
              </button>
              {studyElapsed >= 15 ? (
                <button
                  type="button"
                  className="button button--quiet"
                  onClick={() => void finishAndLog()}
                >
                  Log
                </button>
              ) : null}
              {studyElapsed > 0 ? (
                <button type="button" className="button button--quiet" onClick={resetTimer}>
                  Reset
                </button>
              ) : null}
            </div>
            {lastNotice ? <p className="shelf-drawer__notice">{lastNotice}</p> : null}
          </section>

          <section className="study-stats-grid">
            <div className="study-stat">
              <span className="study-stat__val">{stats.todayMinutes}m</span>
              <span className="study-stat__lbl">Today</span>
            </div>
            <div className="study-stat">
              <span className="study-stat__val">{stats.streakDays}d</span>
              <span className="study-stat__lbl">Streak</span>
            </div>
            <div className="study-stat">
              <span className="study-stat__val">{stats.totalPages}</span>
              <span className="study-stat__lbl">Pages</span>
            </div>
            <div className="study-stat">
              <span className="study-stat__val">{finishedCount}</span>
              <span className="study-stat__lbl">Finished</span>
            </div>
          </section>

          <section className="study-goal">
            <div className="study-goal__head">
              <span>Daily goal ({stats.todayMinutes}/{stats.dailyGoalMin} min)</span>
              <span>{stats.goalPercent}%</span>
            </div>
            <div className="book-preview__bar">
              <span style={{ width: `${stats.goalPercent}%` }} />
            </div>
            <form
              className="study-goal__form"
              onSubmit={(e) => {
                e.preventDefault()
                const val = Number(goalDraft)
                if (Number.isFinite(val)) void setDailyGoal(val)
              }}
            >
              <label htmlFor="daily-goal-input">Target (min/day)</label>
              <input
                id="daily-goal-input"
                type="number"
                min={5}
                max={480}
                value={goalDraft}
                onChange={(e) => setGoalDraft(e.target.value)}
              />
              <button type="submit" className="shelf-drawer__mini-btn">
                Set
              </button>
            </form>
          </section>

          {stats.recentSessions.length > 0 ? (
            <section className="desk-group">
              <h3>Recent Study Sessions</h3>
              <ul className="study-history">
                {stats.recentSessions.slice(0, 6).map((s) => (
                  <li key={s.id}>
                    <span>{s.bookTitle ?? 'Reading session'}</span>
                    <span>
                      {Math.max(1, Math.round(s.durationSec / 60))}m
                      {s.pagesRead > 0 ? ` · ${s.pagesRead}p` : ''} · {s.date}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}
    </aside>
  )
}
