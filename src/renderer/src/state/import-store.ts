import type { ImportCandidate, ImportRejection, ImportScanResult } from '@shared/types'
import { create } from 'zustand'

interface ImportState {
  candidates: ImportCandidate[]
  rejected: ImportRejection[]
  error: string | null
  addScan: (result: ImportScanResult) => void
  setError: (message: string | null) => void
  clear: () => void
}

function mergeCandidates(current: ImportCandidate[], incoming: ImportCandidate[]): ImportCandidate[] {
  const byPath = new Map(current.map((file) => [file.path, file]))
  for (const file of incoming) byPath.set(file.path, file)
  return [...byPath.values()].sort((a, b) => a.name.localeCompare(b.name))
}

function mergeRejections(current: ImportRejection[], incoming: ImportRejection[]): ImportRejection[] {
  const byPath = new Map(current.map((file) => [file.path, file]))
  for (const file of incoming) byPath.set(file.path, file)
  return [...byPath.values()].sort((a, b) => a.name.localeCompare(b.name))
}

export const useImportStore = create<ImportState>((set) => ({
  candidates: [],
  rejected: [],
  error: null,
  addScan: (result) =>
    set((state) => ({
      candidates: mergeCandidates(state.candidates, result.candidates),
      rejected: mergeRejections(state.rejected, result.rejected),
      error: null
    })),
  setError: (message) => set({ error: message }),
  clear: () => set({ candidates: [], rejected: [], error: null })
}))
