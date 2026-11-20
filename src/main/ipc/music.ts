import { dialog, ipcMain } from 'electron'
import { IPC } from '../../shared/ipc'
import type { MusicScanResult } from '../../shared/types'
import { musicFolders, scanMusic } from '../music/scan'
import { artUrl } from '../media/protocol'
import { getLibrary } from '../library/service'
import { setSetting } from '../library/settings'

export function registerMusicHandlers(): void {
  ipcMain.handle(IPC.musicFolders, () => musicFolders())

  ipcMain.handle(IPC.musicPickFolders, async () => {
    const result = await dialog.showOpenDialog({
      title: 'Choose music folders',
      properties: ['openDirectory', 'multiSelections']
    })

    if (result.canceled) return musicFolders()

    const folders = [...new Set([...musicFolders(), ...result.filePaths])]
    setSetting(getLibrary().db, 'music.folders', JSON.stringify(folders))
    return folders
  })

  ipcMain.handle(IPC.musicScan, async (): Promise<MusicScanResult> => {
    const result = await scanMusic()
    return {
      ...result,
      tracks: result.tracks.map((track) => ({
        ...track,
        artPath: track.artPath ? artUrl(track.artPath) : null
      }))
    }
  })
}
