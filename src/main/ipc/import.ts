import { dialog, ipcMain } from 'electron'
import type { ImportScanResult } from '../../shared/types'
import { IPC } from '../../shared/ipc'
import { acceptedExtensions } from '../importer/formats'
import { scanImportPaths } from '../importer/scan'

const emptyResult = (): ImportScanResult => ({ candidates: [], rejected: [] })

const filters = [{ name: 'Documents', extensions: acceptedExtensions }]

async function pickFiles(): Promise<ImportScanResult> {
  const result = await dialog.showOpenDialog({
    title: 'Import files',
    properties: ['openFile', 'multiSelections'],
    filters
  })

  if (result.canceled) return emptyResult()

  return scanImportPaths(result.filePaths)
}

async function pickFolder(): Promise<ImportScanResult> {
  const result = await dialog.showOpenDialog({
    title: 'Scan a folder',
    properties: ['openDirectory']
  })

  if (result.canceled) return emptyResult()

  return scanImportPaths(result.filePaths)
}

export function registerImportHandlers(): void {
  ipcMain.handle(IPC.importPickFiles, () => pickFiles())
  ipcMain.handle(IPC.importPickFolder, () => pickFolder())

  ipcMain.handle(IPC.importScanPaths, (_event, paths: unknown) => {
    if (!Array.isArray(paths) || paths.length > 10_000) {
      throw new Error('Invalid import paths')
    }

    if (!paths.every((path): path is string => typeof path === 'string' && path.length > 0)) {
      throw new Error('Invalid import paths')
    }

    return scanImportPaths(paths)
  })
}
