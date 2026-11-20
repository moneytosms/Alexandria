export const IPC = {
  appPing: 'app:ping',
  libraryInfo: 'library:info',
  settingsGet: 'settings:get',
  settingsSet: 'settings:set',
  logWrite: 'log:write',
  importPickFiles: 'import:pickFiles',
  importPickFolder: 'import:pickFolder',
  importScanPaths: 'import:scanPaths',
  importRun: 'import:run',
  booksList: 'books:list'
} as const
