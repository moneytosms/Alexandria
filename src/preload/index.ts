import { contextBridge, ipcRenderer } from 'electron'
import type { AlexandriaApi } from '../shared/api'
import { IPC } from '../shared/ipc'

const api: AlexandriaApi = {
  ping: () => ipcRenderer.invoke(IPC.appPing)
}

contextBridge.exposeInMainWorld('alexandria', api)
