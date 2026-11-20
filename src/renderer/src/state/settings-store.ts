import { create } from 'zustand'

interface SettingsState {
  values: Record<string, string>
  loaded: boolean
  load: () => Promise<void>
  setValue: (key: string, value: string) => Promise<void>
}

export const useSettingsStore = create<SettingsState>((set) => ({
  values: {},
  loaded: false,
  load: async () => {
    try {
      const values = await window.alexandria.getSettings()
      set({ values, loaded: true })
    } catch {
      set({ loaded: true })
    }
  },
  setValue: async (key, value) => {
    set((state) => ({ values: { ...state.values, [key]: value } }))
    try {
      await window.alexandria.setSetting(key, value)
    } catch {
      // The in-memory value stays for this session; the next launch reloads.
    }
  }
}))

export function getSettingValue(key: string, fallback: string): string {
  return useSettingsStore.getState().values[key] ?? fallback
}

export function useSetting(key: string, fallback: string): string {
  return useSettingsStore((state) => state.values[key] ?? fallback)
}
