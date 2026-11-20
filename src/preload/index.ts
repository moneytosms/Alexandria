import { contextBridge, ipcRenderer } from 'electron'
import type { AlexandriaApi } from '../shared/api'
import { IPC } from '../shared/ipc'

const api: AlexandriaApi = {
  ping: () => ipcRenderer.invoke(IPC.appPing),
  libraryInfo: () => ipcRenderer.invoke(IPC.libraryInfo),
  getSettings: () => ipcRenderer.invoke(IPC.settingsGet),
  setSetting: (key, value) => ipcRenderer.invoke(IPC.settingsSet, key, value)
}

contextBridge.exposeInMainWorld('alexandria', api)
