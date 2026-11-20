import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { AlexandriaApi } from '../shared/api'
import { IPC } from '../shared/ipc'

const api: AlexandriaApi = {
  ping: () => ipcRenderer.invoke(IPC.appPing),
  libraryInfo: () => ipcRenderer.invoke(IPC.libraryInfo),
  getSettings: () => ipcRenderer.invoke(IPC.settingsGet),
  setSetting: (key, value) => ipcRenderer.invoke(IPC.settingsSet, key, value),
  log: (level, message, detail) => ipcRenderer.invoke(IPC.logWrite, level, message, detail),
  pickImportFiles: () => ipcRenderer.invoke(IPC.importPickFiles),
  pickImportFolder: () => ipcRenderer.invoke(IPC.importPickFolder),
  scanImportPaths: (paths) => ipcRenderer.invoke(IPC.importScanPaths, paths),
  pathForFile: (file) => webUtils.getPathForFile(file)
}

contextBridge.exposeInMainWorld('alexandria', api)
