import { app, BrowserWindow, dialog, ipcMain, Menu, screen, shell } from 'electron'
import type { MenuItemConstructorOptions } from 'electron'
import { join } from 'node:path'
import { IPC } from '../shared/ipc'
import { registerBooksHandlers } from './ipc/books'
import { registerImportHandlers } from './ipc/import'
import { registerLibraryHandlers } from './ipc/library'
import { registerMusicHandlers } from './ipc/music'
import { getLibraryInfo } from './library/info'
import {
  defaultLibraryRoot,
  hasStoredLibraryRoot,
  rememberLibraryRoot,
  resolveLibraryRoot
} from './library/location'
import { closeLibrary, getLibrary, openLibrary } from './library/service'
import { getAllSettings, getSetting, setSetting } from './library/settings'
import { createLogger, getLogger, setLogger } from './logger'
import { installMediaProtocol, registerMediaScheme } from './media/protocol'

app.setName('Alexandria')
app.commandLine.appendSwitch('ozone-platform-hint', 'auto')

// Enforce single instance so two processes never contend on the same SQLite library
const hasSingleInstanceLock = app.requestSingleInstanceLock()
if (!hasSingleInstanceLock) {
  app.quit()
}

registerMediaScheme()

registerImportHandlers()
registerBooksHandlers()
registerLibraryHandlers()
registerMusicHandlers()

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

ipcMain.handle(IPC.appInfo, () => ({
  name: app.getName(),
  version: app.getVersion(),
  electron: process.versions.electron ?? '',
  chrome: process.versions.chrome ?? '',
  node: process.versions.node,
  platform: `${process.platform} ${process.arch}`
}))

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

ipcMain.handle(IPC.openExternal, (_event, url: unknown) => {
  if (typeof url === 'string') openExternal(url)
})

interface StoredWindowBounds {
  x?: number
  y?: number
  width: number
  height: number
  maximized?: boolean
}

const WINDOW_BOUNDS_KEY = 'window.bounds'

function loadSafeWindowBounds(): StoredWindowBounds {
  const fallback: StoredWindowBounds = { width: 1440, height: 900, maximized: false }
  try {
    const raw = getSetting(getLibrary().db, WINDOW_BOUNDS_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<StoredWindowBounds>
    const width = Math.max(960, Math.min(3840, Number(parsed.width) || fallback.width))
    const height = Math.max(640, Math.min(2160, Number(parsed.height) || fallback.height))
    const maximized = Boolean(parsed.maximized)

    if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
      const visibleOnDisplay = screen.getAllDisplays().some((display) => {
        const wa = display.workArea
        return (
          parsed.x! + 120 > wa.x &&
          parsed.x! < wa.x + wa.width - 120 &&
          parsed.y! + 80 > wa.y &&
          parsed.y! < wa.y + wa.height - 80
        )
      })
      if (visibleOnDisplay) {
        return { x: Math.round(parsed.x), y: Math.round(parsed.y), width, height, maximized }
      }
    }
    return { width, height, maximized }
  } catch {
    return fallback
  }
}

function saveWindowBounds(win: BrowserWindow): void {
  if (win.isDestroyed()) return
  try {
    const maximized = win.isMaximized()
    const bounds = maximized ? win.getNormalBounds() : win.getBounds()
    const payload: StoredWindowBounds = {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      maximized
    }
    setSetting(getLibrary().db, WINDOW_BOUNDS_KEY, JSON.stringify(payload))
  } catch {
    // Ignore persistence errors during teardown
  }
}

function installNativeMenu(): void {
  const isMac = process.platform === 'darwin'
  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.getName(),
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const }
            ]
          }
        ]
      : []),
    {
      label: 'File',
      submenu: [isMac ? { role: 'close' as const } : { role: 'quit' as const }]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' as const },
        { role: 'redo' as const },
        { type: 'separator' as const },
        { role: 'cut' as const },
        { role: 'copy' as const },
        { role: 'paste' as const },
        { role: 'selectAll' as const }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' as const },
        { role: 'forceReload' as const },
        { type: 'separator' as const },
        { role: 'resetZoom' as const },
        { role: 'zoomIn' as const },
        { role: 'zoomOut' as const },
        { type: 'separator' as const },
        { role: 'togglefullscreen' as const }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' as const },
        { role: 'zoom' as const },
        ...(isMac ? [{ type: 'separator' as const }, { role: 'front' as const }] : [])
      ]
    }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
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

let mainWindow: BrowserWindow | null = null

function createWindow(): BrowserWindow {
  const initialBounds = loadSafeWindowBounds()
  const isMac = process.platform === 'darwin'

  const window = new BrowserWindow({
    width: initialBounds.width,
    height: initialBounds.height,
    x: initialBounds.x,
    y: initialBounds.y,
    minWidth: 960,
    minHeight: 640,
    show: false,
    autoHideMenuBar: !isMac,
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
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

  mainWindow = window

  let boundsTimer: ReturnType<typeof setTimeout> | null = null
  const scheduleBoundsSave = (): void => {
    if (boundsTimer) clearTimeout(boundsTimer)
    boundsTimer = setTimeout(() => {
      boundsTimer = null
      saveWindowBounds(window)
    }, 350)
  }

  window.on('resize', scheduleBoundsSave)
  window.on('move', scheduleBoundsSave)
  window.on('maximize', scheduleBoundsSave)
  window.on('unmaximize', scheduleBoundsSave)
  window.on('close', () => {
    if (boundsTimer) clearTimeout(boundsTimer)
    saveWindowBounds(window)
  })
  window.on('closed', () => {
    if (mainWindow === window) mainWindow = null
  })

  window.once('ready-to-show', () => {
    if (initialBounds.maximized) window.maximize()
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
    if (details.reason === 'clean-exit') return
    void dialog
      .showMessageBox(window, {
        type: 'error',
        title: 'Alexandria interrupted',
        message: 'The reading room renderer stopped unexpectedly.',
        detail: `Reason: ${details.reason}. Your library database is safe on disk.`,
        buttons: ['Reload Alexandria', 'Close'],
        defaultId: 0,
        cancelId: 1
      })
      .then((res) => {
        if (res.response === 0 && !window.isDestroyed()) {
          window.reload()
        }
      })
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

app.on('second-instance', () => {
  const target = mainWindow ?? BrowserWindow.getAllWindows()[0]
  if (!target) return
  if (target.isMinimized()) target.restore()
  target.focus()
})

if (hasSingleInstanceLock) {
  void app.whenReady().then(async () => {
    const root = await resolveRootForFirstRun()
    if (!root) return

    openLibrary(root)
    installMediaProtocol()
    installNativeMenu()
    setLogger(createLogger(join(getLibrary().paths.logs, 'main.log')))
    getLogger().info(`Opened library at ${root}`)

    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })
}

app.on('before-quit', () => {
  closeLibrary()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
