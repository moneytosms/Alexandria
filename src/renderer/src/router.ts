import { useEffect, useState } from 'react'

export const viewIds = ['room', 'reader', 'map', 'librarian', 'index'] as const

export type ViewId = (typeof viewIds)[number]

interface ViewMeta {
  label: string
  title: string
  context: string
}

export const viewMeta: Record<ViewId, ViewMeta> = {
  room: {
    label: 'Room',
    title: 'The reading room',
    context: 'Ground Floor · Main Hall'
  },
  reader: {
    label: 'Reader',
    title: 'No volume open',
    context: 'Full-screen reading'
  },
  map: {
    label: 'Map',
    title: 'Ground floor',
    context: 'Four walls · one hall'
  },
  librarian: {
    label: 'Librarian',
    title: 'Maintenance',
    context: 'Imports, shelves, repairs'
  },
  index: {
    label: 'Index',
    title: 'The index',
    context: 'Every volume, listed'
  }
}

function parseHash(hash: string): ViewId {
  const value = hash.replace(/^#\/?/, '').split('/')[0]
  return (viewIds as readonly string[]).includes(value) ? (value as ViewId) : 'room'
}

export function navigate(view: ViewId): void {
  window.location.hash = `/${view}`
}

export function useView(): ViewId {
  const [view, setView] = useState<ViewId>(() => parseHash(window.location.hash))

  useEffect(() => {
    const onChange = (): void => setView(parseHash(window.location.hash))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  return view
}
