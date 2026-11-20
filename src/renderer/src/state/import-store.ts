import type { ImportBatchResult, ImportCandidate, ImportRejection, ImportScanResult } from '@shared/types'
import { create } from 'zustand'

interface ImportState {
  candidates: ImportCandidate[]
  rejected: ImportRejection[]
  error: string | null
  importing: boolean
  lastRun: ImportBatchResult | null
  addScan: (result: ImportScanResult) => void
  setError: (message: string | null) => void
  beginImport: () => void
  finishImport: (result: ImportBatchResult) => void
  failImport: (message: string) => void
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
  importing: false,
  lastRun: null,
  addScan: (result) =>
    set((state) => ({
      candidates: mergeCandidates(state.candidates, result.candidates),
      rejected: mergeRejections(state.rejected, result.rejected),
      error: null,
      lastRun: null
    })),
  setError: (message) => set({ error: message }),
  beginImport: () => set({ importing: true, error: null, lastRun: null }),
  finishImport: (result) =>
    set((state) => {
      const completed = new Set(
        result.outcomes
          .filter((outcome) => outcome.status !== 'failed')
          .map((outcome) => outcome.path)
      )

      return {
        importing: false,
        lastRun: result,
        candidates: state.candidates.filter((candidate) => !completed.has(candidate.path))
      }
    }),
  failImport: (message) => set({ importing: false, error: message }),
  clear: () => set({ candidates: [], rejected: [], error: null, lastRun: null })
}))
