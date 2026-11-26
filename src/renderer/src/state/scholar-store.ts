import { create } from 'zustand'
import { playSound } from '../sound'
import { getSettingValue, useSettingsStore } from './settings-store'
import { localDateKey } from './date-key'

export interface ScholarRank {
  id: string
  title: string
  minXp: number
  crest: string
}

export const SCHOLAR_RANKS: readonly ScholarRank[] = [
  { id: 'initiate', title: 'Initiate', minXp: 0, crest: 'I' },
  { id: 'scribe', title: 'Scribe', minXp: 120, crest: 'II' },
  { id: 'archivist', title: 'Archivist', minXp: 320, crest: 'III' },
  { id: 'curator', title: 'Curator', minXp: 650, crest: 'IV' },
  { id: 'fellow', title: 'Fellow', minXp: 1100, crest: 'V' },
  { id: 'chief-librarian', title: 'Chief Librarian', minXp: 1750, crest: 'VI' }
] as const

export type DiscoveryId =
  | 'mezzanine'
  | 'telescope'
  | 'hearth'
  | 'globe'
  | 'ladder'
  | 'secret-nook'
  | 'grand-tour'

export interface ScholarQuest {
  id: string
  title: string
  detail: string
  category: 'daily' | 'discovery'
  xpReward: number
  current: number
  target: number
  completed: boolean
}

export interface PersistedScholarLedger {
  xp: number
  totalPagesTurned: number
  totalAnnotations: number
  totalSessionsLogged: number
  discoveries: DiscoveryId[]
  dailyDate: string
  dailyPages: number
  dailyAnnotations: number
  dailyMinutes: number
  claimedQuestIds: string[]
}

const LEDGER_SETTING_KEY = 'scholar.ledgerJson'

function defaultLedger(today = localDateKey()): PersistedScholarLedger {
  return {
    xp: 40,
    totalPagesTurned: 0,
    totalAnnotations: 0,
    totalSessionsLogged: 0,
    discoveries: [],
    dailyDate: today,
    dailyPages: 0,
    dailyAnnotations: 0,
    dailyMinutes: 0,
    claimedQuestIds: []
  }
}

export function getRankForXp(xp: number): {
  current: ScholarRank
  next: ScholarRank | null
  progressPercent: number
  xpToNext: number
} {
  let current = SCHOLAR_RANKS[0]
  let next: ScholarRank | null = SCHOLAR_RANKS[1] ?? null

  for (let i = 0; i < SCHOLAR_RANKS.length; i += 1) {
    if (xp >= SCHOLAR_RANKS[i].minXp) {
      current = SCHOLAR_RANKS[i]
      next = SCHOLAR_RANKS[i + 1] ?? null
    }
  }

  if (!next) {
    return { current, next: null, progressPercent: 100, xpToNext: 0 }
  }

  const span = Math.max(1, next.minXp - current.minXp)
  const gained = Math.max(0, xp - current.minXp)
  return {
    current,
    next,
    progressPercent: Math.min(100, Math.round((gained / span) * 100)),
    xpToNext: Math.max(0, next.minXp - xp)
  }
}

export function computeScholarQuests(ledger: PersistedScholarLedger): ScholarQuest[] {
  const has = (id: DiscoveryId): boolean => ledger.discoveries.includes(id)
  const dayKey = ledger.dailyDate

  return [
    {
      id: `daily-pages-${dayKey}`,
      title: 'Turn 6 Pages in Any Volume',
      detail: 'Open a folio and read through six pages today.',
      category: 'daily',
      xpReward: 45,
      current: Math.min(6, ledger.dailyPages),
      target: 6,
      completed: ledger.dailyPages >= 6
    },
    {
      id: `daily-note-${dayKey}`,
      title: 'Record Marginalia',
      detail: 'Add a highlight, ink mark, bookmark, or note inside the Reader.',
      category: 'daily',
      xpReward: 35,
      current: Math.min(1, ledger.dailyAnnotations),
      target: 1,
      completed: ledger.dailyAnnotations >= 1
    },
    {
      id: `daily-focus-${dayKey}`,
      title: 'Complete a Study Session',
      detail: 'Log at least 1 minute of focused study from the Reading Desk or Reader.',
      category: 'daily',
      xpReward: 50,
      current: Math.min(1, ledger.dailyMinutes),
      target: 1,
      completed: ledger.dailyMinutes >= 1
    },
    {
      id: 'discovery-mezzanine',
      title: 'Ascend the Corner Staircase',
      detail: 'Walk up the South-East staircase onto the wide upper gallery.',
      category: 'discovery',
      xpReward: 40,
      current: has('mezzanine') ? 1 : 0,
      target: 1,
      completed: has('mezzanine')
    },
    {
      id: 'discovery-telescope',
      title: 'Chart the Observatory Sky',
      detail: 'Peer through the brass refractor on the North-West balcony.',
      category: 'discovery',
      xpReward: 45,
      current: has('telescope') ? 1 : 0,
      target: 1,
      completed: has('telescope')
    },
    {
      id: 'discovery-ladder',
      title: 'Climb a Rolling Bookshelf Ladder',
      detail: 'Glide a wooden ladder along the brass rail to inspect upper shelves.',
      category: 'discovery',
      xpReward: 40,
      current: has('ladder') ? 1 : 0,
      target: 1,
      completed: has('ladder')
    },
    {
      id: 'discovery-nook',
      title: 'Uncover the Secret Study Nook',
      detail: 'Find the candlelit alcove tucked at the far South-West upper gallery.',
      category: 'discovery',
      xpReward: 75,
      current: has('secret-nook') ? 1 : 0,
      target: 1,
      completed: has('secret-nook')
    },
    {
      id: 'discovery-hearth',
      title: 'Tend the Hall Fireplace',
      detail: 'Stoke the limestone hearth in the South-West nave.',
      category: 'discovery',
      xpReward: 30,
      current: has('hearth') ? 1 : 0,
      target: 1,
      completed: has('hearth')
    },
    {
      id: 'discovery-tour',
      title: 'Walk the Guided Hall Tour',
      detail: 'Begin the cinematic Grand Hall tour from the bottom dock.',
      category: 'discovery',
      xpReward: 35,
      current: has('grand-tour') ? 1 : 0,
      target: 1,
      completed: has('grand-tour')
    }
  ]
}

function normalizeForToday(ledger: PersistedScholarLedger, today = localDateKey()): PersistedScholarLedger {
  if (ledger.dailyDate === today) return ledger
  return {
    ...ledger,
    dailyDate: today,
    dailyPages: 0,
    dailyAnnotations: 0,
    dailyMinutes: 0,
    claimedQuestIds: ledger.claimedQuestIds.filter((id) => !id.startsWith('daily-'))
  }
}

function applyQuestRewards(
  ledger: PersistedScholarLedger
): { next: PersistedScholarLedger; newlyCompleted: ScholarQuest[] } {
  const quests = computeScholarQuests(ledger)
  const claimed = new Set(ledger.claimedQuestIds)
  const newlyCompleted: ScholarQuest[] = []
  let bonusXp = 0

  for (const quest of quests) {
    if (quest.completed && !claimed.has(quest.id)) {
      claimed.add(quest.id)
      bonusXp += quest.xpReward
      newlyCompleted.push(quest)
    }
  }

  if (newlyCompleted.length === 0) {
    return { next: ledger, newlyCompleted: [] }
  }

  return {
    next: {
      ...ledger,
      xp: ledger.xp + bonusXp,
      claimedQuestIds: Array.from(claimed)
    },
    newlyCompleted
  }
}

interface ScholarStoreState {
  ledger: PersistedScholarLedger
  hydrated: boolean
  toast: { title: string; subtitle: string; xp: number } | null
  hydrate: () => void
  recordPageTurn: () => void
  recordAnnotation: () => void
  recordStudySession: (durationSec: number) => void
  recordDiscovery: (id: DiscoveryId, label?: string) => void
  clearToast: () => void
  resetLedger: () => Promise<void>
}

let toastTimer: number | null = null

function persistLedger(next: PersistedScholarLedger): void {
  void useSettingsStore.getState().setValue(LEDGER_SETTING_KEY, JSON.stringify(next))
}

export const useScholarStore = create<ScholarStoreState>((set, get) => {
  const commit = (
    updater: (current: PersistedScholarLedger) => PersistedScholarLedger,
    fallbackToast?: { title: string; subtitle: string; xp: number } | null
  ): void => {
    const normalized = normalizeForToday(get().ledger)
    const updated = updater(normalized)
    const { next, newlyCompleted } = applyQuestRewards(updated)
    const toast =
      newlyCompleted.length > 0
        ? {
            title: newlyCompleted[0].title,
            subtitle:
              newlyCompleted.length > 1
                ? `+${newlyCompleted.reduce((acc, q) => acc + q.xpReward, 0)} XP · ${newlyCompleted.length} quests completed`
                : 'Quest completed',
            xp: newlyCompleted.reduce((acc, q) => acc + q.xpReward, 0)
          }
        : fallbackToast ?? null

    set({ ledger: next, ...(toast ? { toast } : {}) })
    persistLedger(next)

    if (toast) {
      playSound('chime')
      if (toastTimer !== null) globalThis.clearTimeout(toastTimer)
      toastTimer = globalThis.setTimeout(() => {
        set({ toast: null })
        toastTimer = null
      }, 4200) as unknown as number
    }
  }

  return {
    ledger: defaultLedger(),
    hydrated: false,
    toast: null,

    hydrate: () => {
      const today = localDateKey()
      let parsed: Partial<PersistedScholarLedger> | null = null
      try {
        const raw = getSettingValue(LEDGER_SETTING_KEY, '')
        if (raw) parsed = JSON.parse(raw) as Partial<PersistedScholarLedger>
      } catch {
        parsed = null
      }
      const base = defaultLedger(today)
      const merged: PersistedScholarLedger = normalizeForToday(
        {
          xp: typeof parsed?.xp === 'number' && Number.isFinite(parsed.xp) ? parsed.xp : base.xp,
          totalPagesTurned: parsed?.totalPagesTurned ?? 0,
          totalAnnotations: parsed?.totalAnnotations ?? 0,
          totalSessionsLogged: parsed?.totalSessionsLogged ?? 0,
          discoveries: Array.isArray(parsed?.discoveries) ? parsed.discoveries : [],
          dailyDate: typeof parsed?.dailyDate === 'string' ? parsed.dailyDate : today,
          dailyPages: parsed?.dailyPages ?? 0,
          dailyAnnotations: parsed?.dailyAnnotations ?? 0,
          dailyMinutes: parsed?.dailyMinutes ?? 0,
          claimedQuestIds: Array.isArray(parsed?.claimedQuestIds) ? parsed.claimedQuestIds : []
        },
        today
      )
      set({ ledger: merged, hydrated: true })
    },

    recordPageTurn: () => {
      commit((cur) => ({
        ...cur,
        xp: cur.xp + 4,
        totalPagesTurned: cur.totalPagesTurned + 1,
        dailyPages: cur.dailyPages + 1
      }))
    },

    recordAnnotation: () => {
      commit((cur) => ({
        ...cur,
        xp: cur.xp + 12,
        totalAnnotations: cur.totalAnnotations + 1,
        dailyAnnotations: cur.dailyAnnotations + 1
      }))
    },

    recordStudySession: (durationSec) => {
      const mins = Math.max(1, Math.round(durationSec / 60))
      commit((cur) => ({
        ...cur,
        xp: cur.xp + Math.min(120, mins * 6),
        totalSessionsLogged: cur.totalSessionsLogged + 1,
        dailyMinutes: cur.dailyMinutes + mins
      }))
    },

    recordDiscovery: (id, label) => {
      const current = get().ledger
      if (current.discoveries.includes(id)) return
      commit(
        (cur) => ({
          ...cur,
          xp: cur.xp + 15,
          discoveries: [...cur.discoveries, id]
        }),
        label
          ? {
              title: label,
              subtitle: 'Hall landmark discovered',
              xp: 15
            }
          : null
      )
    },

    clearToast: () => set({ toast: null }),

    resetLedger: async () => {
      const fresh = defaultLedger()
      set({ ledger: fresh, toast: null })
      await useSettingsStore.getState().setValue(LEDGER_SETTING_KEY, JSON.stringify(fresh))
    }
  }
})
