import { create } from 'zustand'
import { playSound } from '../sound'
import { localDateKey } from './date-key'
import { useScholarStore } from './scholar-store'
import { getSettingValue, useSettingsStore } from './settings-store'

export { localDateKey }

export type TimerMode = 'pomodoro25' | 'deep50' | 'stopwatch'

export interface StudySessionRecord {
  id: string
  date: string // YYYY-MM-DD
  startedAt: string
  durationSec: number
  pagesRead: number
  bookId: number | null
  bookTitle: string | null
}

export interface ReadingStatsSummary {
  todayMinutes: number
  dailyGoalMin: number
  goalPercent: number
  streakDays: number
  totalMinutes: number
  totalPages: number
  sessionsCount: number
  recentSessions: StudySessionRecord[]
}

export function modeDurationSeconds(mode: TimerMode): number {
  if (mode === 'pomodoro25') return 25 * 60
  if (mode === 'deep50') return 50 * 60
  return 0
}

export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(safe / 3600)
  const mins = Math.floor((safe % 3600) / 60)
  const secs = safe % 60
  const mm = String(mins).padStart(2, '0')
  const ss = String(secs).padStart(2, '0')
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`
}

export function computeReadingStats(
  sessions: StudySessionRecord[],
  todayKey: string,
  dailyGoalMin: number
): ReadingStatsSummary {
  const goal = Math.max(5, Math.min(480, Math.round(dailyGoalMin || 30)))
  let todaySec = 0
  let totalSec = 0
  let totalPages = 0
  const activeDates = new Set<string>()

  for (const s of sessions) {
    totalSec += Math.max(0, s.durationSec)
    totalPages += Math.max(0, s.pagesRead)
    if (s.durationSec >= 30) activeDates.add(s.date)
    if (s.date === todayKey) todaySec += Math.max(0, s.durationSec)
  }

  // Compute consecutive day streak ending today (or yesterday if not read today yet)
  let streakDays = 0
  const cursor = new Date(`${todayKey}T12:00:00`)
  if (!activeDates.has(todayKey)) {
    cursor.setDate(cursor.getDate() - 1)
  }
  while (activeDates.has(localDateKey(cursor))) {
    streakDays += 1
    cursor.setDate(cursor.getDate() - 1)
  }

  const todayMinutes = Math.round(todaySec / 60)
  const totalMinutes = Math.round(totalSec / 60)
  const goalPercent = Math.min(100, Math.round((todaySec / (goal * 60)) * 100))

  return {
    todayMinutes,
    dailyGoalMin: goal,
    goalPercent,
    streakDays,
    totalMinutes,
    totalPages,
    sessionsCount: sessions.length,
    recentSessions: sessions.slice(0, 12)
  }
}

interface StudyState {
  mode: TimerMode
  running: boolean
  elapsedSec: number
  pagesTurned: number
  bookId: number | null
  bookTitle: string | null
  studyMode: boolean
  dailyGoalMin: number
  sessions: StudySessionRecord[]
  hydrated: boolean
  lastCompletedNotice: string | null

  hydrate: () => void
  setMode: (mode: TimerMode) => void
  start: (book?: { id: number; title: string } | null) => void
  pause: () => void
  toggleRunning: (book?: { id: number; title: string } | null) => void
  reset: () => void
  finishAndLog: () => Promise<void>
  tickSecond: () => void
  recordPageTurn: (bookId?: number | null, bookTitle?: string | null) => void
  setStudyMode: (active: boolean) => void
  setDailyGoal: (minutes: number) => Promise<void>
  clearNotice: () => void
}

const SESSIONS_KEY = 'reading.sessionsJson'
const GOAL_KEY = 'reading.dailyGoalMin'

let tickerHandle: number | null = null

function ensureTicker(start: boolean): void {
  if (start && tickerHandle === null && typeof window !== 'undefined') {
    tickerHandle = window.setInterval(() => {
      useStudyStore.getState().tickSecond()
    }, 1000)
  } else if (!start && tickerHandle !== null && typeof window !== 'undefined') {
    window.clearInterval(tickerHandle)
    tickerHandle = null
  }
}

export const useStudyStore = create<StudyState>((set, get) => ({
  mode: 'pomodoro25',
  running: false,
  elapsedSec: 0,
  pagesTurned: 0,
  bookId: null,
  bookTitle: null,
  studyMode: false,
  dailyGoalMin: 30,
  sessions: [],
  hydrated: false,
  lastCompletedNotice: null,

  hydrate: () => {
    const rawGoal = Number(getSettingValue(GOAL_KEY, '30'))
    const dailyGoalMin = Number.isFinite(rawGoal) && rawGoal >= 5 ? rawGoal : 30
    let sessions: StudySessionRecord[] = []
    try {
      const parsed = JSON.parse(getSettingValue(SESSIONS_KEY, '[]')) as StudySessionRecord[]
      if (Array.isArray(parsed)) sessions = parsed.slice(0, 60)
    } catch {
      sessions = []
    }
    set({ dailyGoalMin, sessions, hydrated: true })
  },

  setMode: (mode) => {
    ensureTicker(false)
    set({ mode, running: false, elapsedSec: 0, pagesTurned: 0, lastCompletedNotice: null })
  },

  start: (book) => {
    set((state) => ({
      running: true,
      lastCompletedNotice: null,
      bookId: book ? book.id : state.bookId,
      bookTitle: book ? book.title : state.bookTitle
    }))
    ensureTicker(true)
  },

  pause: () => {
    ensureTicker(false)
    set({ running: false })
  },

  toggleRunning: (book) => {
    if (get().running) get().pause()
    else get().start(book)
  },

  reset: () => {
    ensureTicker(false)
    set({ running: false, elapsedSec: 0, pagesTurned: 0, lastCompletedNotice: null })
  },

  finishAndLog: async () => {
    const state = get()
    ensureTicker(false)
    const elapsed = state.elapsedSec
    if (elapsed < 15) {
      set({ running: false, elapsedSec: 0, pagesTurned: 0 })
      return
    }
    const record: StudySessionRecord = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      date: localDateKey(),
      startedAt: new Date(Date.now() - elapsed * 1000).toISOString(),
      durationSec: elapsed,
      pagesRead: state.pagesTurned,
      bookId: state.bookId,
      bookTitle: state.bookTitle
    }
    const nextSessions = [record, ...state.sessions].slice(0, 60)
    const mins = Math.max(1, Math.round(elapsed / 60))
    set({
      running: false,
      elapsedSec: 0,
      pagesTurned: 0,
      sessions: nextSessions,
      lastCompletedNotice: `Logged ${mins} min${state.pagesTurned > 0 ? ` · ${state.pagesTurned} pages` : ''}`
    })
    playSound('chime')
    await useSettingsStore.getState().setValue(SESSIONS_KEY, JSON.stringify(nextSessions))
    useScholarStore.getState().recordStudySession(elapsed)
  },

  tickSecond: () => {
    const state = get()
    if (!state.running) {
      ensureTicker(false)
      return
    }
    const nextElapsed = state.elapsedSec + 1
    const target = modeDurationSeconds(state.mode)
    if (target > 0 && nextElapsed >= target) {
      set({ elapsedSec: target })
      void get().finishAndLog()
      return
    }
    set({ elapsedSec: nextElapsed })
  },

  recordPageTurn: (bookId, bookTitle) => {
    const state = get()
    if (!state.running) return
    set({
      pagesTurned: state.pagesTurned + 1,
      bookId: bookId ?? state.bookId,
      bookTitle: bookTitle ?? state.bookTitle
    })
  },

  setStudyMode: (studyMode) => set({ studyMode }),

  setDailyGoal: async (minutes) => {
    const clamped = Math.max(5, Math.min(480, Math.round(minutes)))
    set({ dailyGoalMin: clamped })
    await useSettingsStore.getState().setValue(GOAL_KEY, String(clamped))
  },

  clearNotice: () => set({ lastCompletedNotice: null })
}))
