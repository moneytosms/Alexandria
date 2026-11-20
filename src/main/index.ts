import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { join } from 'node:path'
import { IPC } from '../shared/ipc'
import { getLibraryInfo } from './library/info'
import { registerBooksHandlers } from './ipc/books'
import { registerImportHandlers } from './ipc/import'
import {
  defaultLibraryRoot,
  hasStoredLibraryRoot,
  rememberLibraryRoot,
  resolveLibraryRoot
} from './library/location'
import { closeLibrary, getLibrary, openLibrary } from './library/service'
import { getAllSettings, setSetting } from './library/settings'
import { createLogger, getLogger, setLogger } from './logger'

app.setName('Alexandria')
app.commandLine.appendSwitch('ozone-platform-hint', 'auto')

registerImportHandlers()
registerBooksHandlers()

process.on('uncaughtException', (error) => {
  getLogger().error('Uncaught exception in main', error.stack ?? String(error))
})

process.on('unhandledRejection', (reason) => {
  getLogger().error(
    'Unhandled rejection in main',
    reason instanceof Error ? (reason.stack ?? reason.message) : String(reason)
  )
})

ipcMain.handle(IPC.appPing, () => 'pong')

ipcMain.handle(IPC.libraryInfo, () => getLibraryInfo())

ipcMain.handle(IPC.settingsGet, () => getAllSettings(getLibrary().db))

ipcMain.handle(IPC.settingsSet, (_event, key: unknown, value: unknown) => {
  if (typeof key !== 'string' || typeof value !== 'string') {
    throw new Error('Invalid settings payload')
  }
  setSetting(getLibrary().db, key, value)
})

ipcMain.handle(
  IPC.logWrite,
  (_event, level: unknown, message: unknown, detail: unknown): void => {
    if (level !== 'info' && level !== 'warn' && level !== 'error') {
      throw new Error('Invalid log level')
    }
    if (typeof message !== 'string') {
      throw new Error('Invalid log message')
    }

    getLogger().log(
      level,
      message.slice(0, 2_000),
      typeof detail === 'string' ? detail.slice(0, 16_000) : undefined
    )
  }
)

function openExternal(url: string): void {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    void shell.openExternal(url)
  }
}

async function resolveRootForFirstRun(): Promise<string | null> {
  if (hasStoredLibraryRoot()) return resolveLibraryRoot()

  const fallback = defaultLibraryRoot()
  const choice = await dialog.showMessageBox({
    type: 'question',
    title: 'Library location',
    message: 'Where should Alexandria keep your library?',
    detail: `The library is a folder holding the database, imported books, covers, and logs.\n\nDefault: ${fallback}`,
    buttons: ['Use default', 'Choose folder…', 'Quit'],
    defaultId: 0,
    cancelId: 2,
    noLink: true
  })

  if (choice.response === 2) {
    app.quit()
    return null
  }

  let root = fallback

  if (choice.response === 1) {
    const picked = await dialog.showOpenDialog({
      title: 'Choose library folder',
      properties: ['openDirectory', 'createDirectory']
    })

    if (!picked.canceled && picked.filePaths[0]) {
      root = picked.filePaths[0]
    }
  }

  rememberLibraryRoot(root)
  return root
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

  window.webContents.on('preload-error', (_event, path, error) => {
    getLogger().error(`Preload failed: ${path}`, error.stack ?? error.message)
  })

  window.webContents.on('render-process-gone', (_event, details) => {
    getLogger().error(
      `Renderer process gone: ${details.reason} (exit ${details.exitCode})`,
      details.reason === 'crashed' ? 'The renderer crashed.' : undefined
    )
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

void app.whenReady().then(async () => {
  const root = await resolveRootForFirstRun()
  if (!root) return

  openLibrary(root)
  setLogger(createLogger(join(getLibrary().paths.logs, 'main.log')))
  getLogger().info(`Opened library at ${root}`)

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
