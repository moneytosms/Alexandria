import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'node:path'
import { IPC } from '../shared/ipc'
import { getLibraryInfo } from './library/info'
import { rememberLibraryRoot, resolveLibraryRoot } from './library/location'
import { closeLibrary, getLibrary, openLibrary } from './library/service'
import { getAllSettings, setSetting } from './library/settings'

app.setName('Alexandria')
app.commandLine.appendSwitch('ozone-platform-hint', 'auto')

ipcMain.handle(IPC.appPing, () => 'pong')

ipcMain.handle(IPC.libraryInfo, () => getLibraryInfo())

ipcMain.handle(IPC.settingsGet, () => getAllSettings(getLibrary().db))

ipcMain.handle(IPC.settingsSet, (_event, key: unknown, value: unknown) => {
  if (typeof key !== 'string' || typeof value !== 'string') {
    throw new Error('Invalid settings payload')
  }
  setSetting(getLibrary().db, key, value)
})

function openExternal(url: string): void {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    void shell.openExternal(url)
  }
}

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#12100e',
    title: 'Alexandria',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true
    }
  })

  window.once('ready-to-show', () => {
    window.show()
  })

  window.webContents.setWindowOpenHandler(({ url }) => {
    openExternal(url)
    return { action: 'deny' }
  })

  window.webContents.on('will-navigate', (event, url) => {
    const devUrl = process.env['ELECTRON_RENDERER_URL']
    const isDev = Boolean(devUrl && url.startsWith(devUrl))
    const isLocal = url.startsWith('file://')

    if (isDev || isLocal) return

    event.preventDefault()
    openExternal(url)
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    void window.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return window
}

void app.whenReady().then(() => {
  const root = resolveLibraryRoot()
  rememberLibraryRoot(root)
  openLibrary(root)

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => {
  closeLibrary()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
