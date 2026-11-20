const isElectron =
  typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('electron')

export function coverUrl(bookId: number): string {
  return isElectron ? `alexandria://cover/${bookId}` : `/api/media/cover/${bookId}`
}

export function thumbUrl(bookId: number, page: number): string {
  return isElectron ? `alexandria://thumb/${bookId}/${page}` : `/api/media/thumb/${bookId}/${page}`
}

export function audioUrl(path: string): string {
  const bytes = new TextEncoder().encode(path)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  const encoded = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return isElectron ? `alexandria://audio/${encoded}` : `/api/media/audio/${encoded}`
}
