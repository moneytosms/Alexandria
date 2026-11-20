import { ipcMain } from 'electron'
import { IPC } from '../../shared/ipc'
import { listBooks } from '../db/queries/books'
import { getLibrary } from '../library/service'

export function registerBooksHandlers(): void {
  ipcMain.handle(IPC.booksList, () => listBooks(getLibrary().db, 5000))
}
