import { lstat, readdir, stat } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import type { ImportCandidate, ImportScanResult } from '../../shared/types'
import { detectFormat } from './formats'

const maxDepth = 16

function isHidden(name: string): boolean {
  return name.startsWith('.')
}

async function visit(
  target: string,
  depth: number,
  seen: Set<string>,
  result: ImportScanResult
): Promise<void> {
  const path = resolve(target)

  if (seen.has(path)) return
  seen.add(path)

  if (isHidden(basename(path))) return

  let stats
  try {
    stats = await lstat(path)
  } catch {
    result.rejected.push({ path, name: basename(path), reason: 'unreadable' })
    return
  }

  if (stats.isSymbolicLink()) {
    try {
      stats = await stat(path)
    } catch {
      result.rejected.push({ path, name: basename(path), reason: 'unreadable' })
      return
    }
  }

  if (stats.isDirectory()) {
    if (depth >= maxDepth) return

    let entries
    try {
      entries = await readdir(path, { withFileTypes: true })
    } catch {
      result.rejected.push({ path, name: basename(path), reason: 'unreadable' })
      return
    }

    for (const entry of entries) {
      if (isHidden(entry.name) || entry.isSymbolicLink()) continue
      await visit(resolve(path, entry.name), depth + 1, seen, result)
    }

    return
  }

  if (!stats.isFile()) return

  const format = detectFormat(path)

  if (!format) {
    result.rejected.push({ path, name: basename(path), reason: 'unsupported' })
    return
  }

  const candidate: ImportCandidate = {
    path,
    name: basename(path),
    format,
    size: stats.size,
    modifiedAt: stats.mtime.toISOString()
  }

  result.candidates.push(candidate)
}

export async function scanImportPaths(paths: string[]): Promise<ImportScanResult> {
  const result: ImportScanResult = { candidates: [], rejected: [] }
  const seen = new Set<string>()

  for (const path of paths) {
    await visit(path, 0, seen, result)
  }

  result.candidates.sort((a, b) => a.name.localeCompare(b.name))
  result.rejected.sort((a, b) => a.name.localeCompare(b.name))

  return result
}
