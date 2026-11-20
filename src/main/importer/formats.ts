import { extname } from 'node:path'
import type { ImportFormat } from '../../shared/types'

const extensions: Record<string, ImportFormat> = {
  '.pdf': 'pdf',
  '.pptx': 'pptx',
  '.ppt': 'ppt',
  '.docx': 'docx',
  '.doc': 'doc',
  '.odp': 'odp',
  '.odt': 'odt'
}

export const acceptedExtensions = Object.keys(extensions).map((ext) => ext.slice(1))

export function detectFormat(filePath: string): ImportFormat | null {
  return extensions[extname(filePath).toLowerCase()] ?? null
}
