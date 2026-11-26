import { beforeEach, describe, expect, it } from 'vitest'
import {
  SCHOLAR_RANKS,
  computeScholarQuests,
  getRankForXp,
  useScholarStore
} from './scholar-store'

describe('Scholar Ledger store, ranks & quests', () => {
  beforeEach(async () => {
    // Provide minimal settings store bridge stub for Node test environment
    ;(globalThis as unknown as { window?: unknown }).window = {
      alexandria: {
        getSettings: async () => ({}),
        setSetting: async () => undefined
      }
    }
    await useScholarStore.getState().resetLedger()
  })

  it('computes scholar rank thresholds and progress accurately', () => {
    expect(getRankForXp(0).current.id).toBe('initiate')
    expect(getRankForXp(120).current.id).toBe('scribe')
    expect(getRankForXp(320).current.id).toBe('archivist')
    const maxRank = SCHOLAR_RANKS[SCHOLAR_RANKS.length - 1]
    const top = getRankForXp(maxRank.minXp + 500)
    expect(top.current.id).toBe(maxRank.id)
    expect(top.next).toBeNull()
    expect(top.progressPercent).toBe(100)
  })

  it('records hall discoveries idempotently and awards quest XP once', () => {
    const store = useScholarStore.getState()
    const startXp = store.ledger.xp

    store.recordDiscovery('secret-nook', 'Secret Upper Study Nook')
    const afterFirst = useScholarStore.getState().ledger
    expect(afterFirst.discoveries).toContain('secret-nook')
    // 15 XP base discovery + 75 XP Secret Study Nook quest completion
    expect(afterFirst.xp).toBe(startXp + 15 + 75)

    // Recording the same discovery a second time does not double-award XP
    store.recordDiscovery('secret-nook', 'Secret Upper Study Nook')
    expect(useScholarStore.getState().ledger.xp).toBe(afterFirst.xp)
  })

  it('tracks daily reading quests for page turns, annotations, and study sessions', () => {
    const store = useScholarStore.getState()
    for (let i = 0; i < 6; i += 1) {
      store.recordPageTurn()
    }
    store.recordAnnotation()
    store.recordStudySession(120)

    const ledger = useScholarStore.getState().ledger
    const quests = computeScholarQuests(ledger).filter((q) => q.category === 'daily')
    expect(quests.length).toBe(3)
    expect(quests.every((q) => q.completed)).toBe(true)
    expect(ledger.xp).toBeGreaterThan(180)
  })
})
