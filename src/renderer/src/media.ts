export function coverUrl(bookId: number): string {
  return `alexandria://cover/${bookId}`
}

export function thumbUrl(bookId: number, page: number): string {
  return `alexandria://thumb/${bookId}/${page}`
}

export function audioUrl(path: string): string {
  const bytes = new TextEncoder().encode(path)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  const encoded = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `alexandria://audio/${encoded}`
}
