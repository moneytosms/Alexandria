import { useImportStore } from './state/import-store'
import { useLibraryStore } from './state/library-store'

function describe(error: unknown): string {
  return error instanceof Error ? error.message : 'Could not read the selection.'
}

async function run(work: () => Promise<void>): Promise<void> {
  try {
    await work()
  } catch (error) {
    const message = describe(error)
    useImportStore.getState().setError(message)
    void window.alexandria.log('error', 'Import selection failed', message).catch(() => undefined)
  }
}

export async function pickImportFiles(): Promise<void> {
  await run(async () => {
    const result = await window.alexandria.pickImportFiles()
    useImportStore.getState().addScan(result)
  })
}

export async function pickImportFolder(): Promise<void> {
  await run(async () => {
    const result = await window.alexandria.pickImportFolder()
    useImportStore.getState().addScan(result)
  })
}

export async function queueDroppedFiles(files: FileList): Promise<void> {
  type FileWithPath = File & { path?: string }

  const paths = Array.from(files)
    .map(
      (file) =>
        window.alexandria.pathForFile(file) || (file as FileWithPath).path || ''
    )
    .filter((path) => path.length > 0)

  if (paths.length === 0) {
    useImportStore.getState().setError('No readable files were dropped.')
    return
  }

  await run(async () => {
    const result = await window.alexandria.scanImportPaths(paths)
    useImportStore.getState().addScan(result)
  })
}

export async function runQueuedImports(): Promise<void> {
  const state = useImportStore.getState()
  if (state.importing || state.candidates.length === 0) return

  state.beginImport()
  const unsubscribe = window.alexandria.onImportProgress((progress) => {
    useImportStore.getState().setProgress(progress)
  })

  try {
    const result = await window.alexandria.importBooks(state.candidates.map((file) => file.path))
    useImportStore.getState().finishImport(result)
    await useLibraryStore.getState().refresh()
  } catch (error) {
    const message = describe(error)
    useImportStore.getState().failImport(message)
    void window.alexandria.log('error', 'Import run failed', message).catch(() => undefined)
  } finally {
    unsubscribe()
  }
}

export async function cancelImports(): Promise<void> {
  await window.alexandria.cancelImport()
}
