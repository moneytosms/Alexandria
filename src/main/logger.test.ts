import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createLogger } from './logger'

let dirs: string[] = []

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'alexandria-log-'))
  dirs.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
  dirs = []
})

describe('logger', () => {
  it('writes level, message, and detail', () => {
    const file = join(tempDir(), 'main.log')
    const logger = createLogger(file, { maxBytes: 10_000 })

    logger.info('opened library', '/tmp/library')
    logger.error('boom', 'stack line')

    const text = readFileSync(file, 'utf8')
    expect(text).toMatch(/INFO opened library\n\/tmp\/library\n/)
    expect(text).toMatch(/ERROR boom\nstack line\n/)
  })

  it('rotates once the file exceeds the size limit and keeps one previous file', () => {
    const dir = tempDir()
    const file = join(dir, 'main.log')
    writeFileSync(file, 'x'.repeat(200), 'utf8')

    const logger = createLogger(file, { maxBytes: 100 })
    logger.info('after rotation')

    expect(readFileSync(`${file}.1`, 'utf8')).toBe('x'.repeat(200))
    expect(readFileSync(file, 'utf8')).toContain('after rotation')
  })
})
