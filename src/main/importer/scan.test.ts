import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { scanImportPaths } from './scan'

let dirs: string[] = []

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'alexandria-import-'))
  dirs.push(dir)
  return dir
}

function touch(path: string, content = 'x'): void {
  writeFileSync(path, content)
}

afterEach(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
  dirs = []
})

describe('scanImportPaths', () => {
  it('scans folders recursively and accepts every supported format', async () => {
    const root = tempDir()
    mkdirSync(join(root, 'papers', 'nested'), { recursive: true })
    mkdirSync(join(root, 'office'), { recursive: true })

    touch(join(root, 'papers', 'alpha.pdf'))
    touch(join(root, 'papers', 'nested', 'beta.PDF'))
    touch(join(root, 'office', 'deck.pptx'))
    touch(join(root, 'office', 'old.ppt'))
    touch(join(root, 'office', 'brief.docx'))
    touch(join(root, 'office', 'old.doc'))
    touch(join(root, 'office', 'slides.odp'))
    touch(join(root, 'office', 'letter.odt'))
    touch(join(root, 'notes.txt'))

    const result = await scanImportPaths([root])

    expect(result.candidates.map((file) => file.name)).toEqual([
      'alpha.pdf',
      'beta.PDF',
      'brief.docx',
      'deck.pptx',
      'letter.odt',
      'old.doc',
      'old.ppt',
      'slides.odp'
    ])
    expect(result.rejected).toEqual([
      { path: join(root, 'notes.txt'), name: 'notes.txt', reason: 'unsupported' }
    ])

    const pdf = result.candidates[0]
    expect(pdf.format).toBe('pdf')
    expect(pdf.size).toBe(1)
    expect(pdf.modifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('accepts individual files and deduplicates repeated paths', async () => {
    const root = tempDir()
    const first = join(root, 'first.pdf')
    const second = join(root, 'second.pdf')
    touch(first)
    touch(second)

    const result = await scanImportPaths([first, first, second, root])

    expect(result.candidates.map((file) => file.name)).toEqual(['first.pdf', 'second.pdf'])
  })

  it('reports unsupported files by name and skips hidden files', async () => {
    const root = tempDir()
    touch(join(root, '.hidden.pdf'))
    touch(join(root, 'cover.png'))

    const result = await scanImportPaths([root])

    expect(result.candidates).toEqual([])
    expect(result.rejected.map((file) => file.name)).toEqual(['cover.png'])
  })

  it('reports missing paths as unreadable', async () => {
    const root = tempDir()
    const missing = join(root, 'gone.pdf')

    const result = await scanImportPaths([missing])

    expect(result.candidates).toEqual([])
    expect(result.rejected).toEqual([{ path: missing, name: 'gone.pdf', reason: 'unreadable' }])
  })

  it('ignores directory symlinks while scanning', async () => {
    const root = tempDir()
    const outside = tempDir()
    touch(join(outside, 'outside.pdf'))
    symlinkSync(outside, join(root, 'linked-folder'))

    const result = await scanImportPaths([root])

    expect(result.candidates).toEqual([])
  })
})
