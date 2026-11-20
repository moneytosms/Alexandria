import { describe, expect, it } from 'vitest'
import { computeReadingStats, formatClock, type StudySessionRecord } from './study-store'

describe('Study tracker stats & clock formatting', () => {
  it('formats minutes:seconds and hours:minutes:seconds cleanly', () => {
    expect(formatClock(0)).toBe('00:00')
    expect(formatClock(125)).toBe('02:05')
    expect(formatClock(3665)).toBe('1:01:05')
  })

  it('computes today minutes, goal percent, total pages, and consecutive day streak', () => {
    const sessions: StudySessionRecord[] = [
      {
        id: '1',
        date: '2026-11-20',
        startedAt: '2026-11-20T10:00:00.000Z',
        durationSec: 1500, // 25 min
        pagesRead: 18,
        bookId: 1,
        bookTitle: 'Meditations'
      },
      {
        id: '2',
        date: '2026-11-19',
        startedAt: '2026-11-19T09:00:00.000Z',
        durationSec: 1800, // 30 min
        pagesRead: 22,
        bookId: 1,
        bookTitle: 'Meditations'
      },
      {
        id: '3',
        date: '2026-11-18',
        startedAt: '2026-11-18T20:00:00.000Z',
        durationSec: 900, // 15 min
        pagesRead: 10,
        bookId: 2,
        bookTitle: 'Republic'
      },
      {
        id: '4',
        date: '2026-11-16', // gap on 2026-11-17 breaks streak
        startedAt: '2026-11-16T20:00:00.000Z',
        durationSec: 1200,
        pagesRead: 12,
        bookId: 2,
        bookTitle: 'Republic'
      }
    ]

    const stats = computeReadingStats(sessions, '2026-11-20', 50)
    expect(stats.todayMinutes).toBe(25)
    expect(stats.dailyGoalMin).toBe(50)
    expect(stats.goalPercent).toBe(50)
    expect(stats.streakDays).toBe(3)
    expect(stats.totalMinutes).toBe(90)
    expect(stats.totalPages).toBe(62)
    expect(stats.sessionsCount).toBe(4)
  })

  it('preserves active streak if user read yesterday but has not started today yet', () => {
    const sessions: StudySessionRecord[] = [
      {
        id: '1',
        date: '2026-11-19',
        startedAt: '2026-11-19T19:00:00.000Z',
        durationSec: 1200,
        pagesRead: 14,
        bookId: 1,
        bookTitle: 'Ethics'
      },
      {
        id: '2',
        date: '2026-11-18',
        startedAt: '2026-11-18T19:00:00.000Z',
        durationSec: 600,
        pagesRead: 6,
        bookId: 1,
        bookTitle: 'Ethics'
      }
    ]

    const stats = computeReadingStats(sessions, '2026-11-20', 30)
    expect(stats.todayMinutes).toBe(0)
    expect(stats.streakDays).toBe(2)
  })
})
