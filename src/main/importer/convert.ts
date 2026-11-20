import { execFile } from 'node:child_process'
import { mkdir, readdir, rm } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'

const run = promisify(execFile)

export class ConversionUnavailableError extends Error {
  constructor() {
    super('LibreOffice is not installed, so office documents cannot be converted')
    this.name = 'ConversionUnavailableError'
  }
}

export async function convertToPdf(source: string, cacheDir: string): Promise<string> {
  const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const outDir = join(cacheDir, 'converted', token)
  const profileDir = join(cacheDir, 'profiles', token)
  await mkdir(outDir, { recursive: true })
  await mkdir(profileDir, { recursive: true })

  try {
    await run(
      'soffice',
      [
        `-env:UserInstallation=${pathToFileURL(profileDir).href}`,
        '--headless',
        '--norestore',
        '--convert-to',
        'pdf',
        '--outdir',
        outDir,
        source
      ],
      { timeout: 180_000, maxBuffer: 4 * 1024 * 1024 }
    )
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      throw new ConversionUnavailableError()
    }
    throw new Error(`LibreOffice could not convert ${basename(source)}`, { cause: error })
  } finally {
    await rm(profileDir, { recursive: true, force: true }).catch(() => undefined)
  }

  const expected = join(outDir, `${basename(source, extname(source))}.pdf`)
  const entries = await readdir(outDir).catch(() => [] as string[])

  if (entries.includes(basename(expected))) return expected

  const match = entries.find(
    (entry) =>
      entry.toLowerCase().endsWith('.pdf') &&
      entry.toLowerCase().startsWith(basename(source, extname(source)).slice(0, 20).toLowerCase())
  )

  if (match) return join(outDir, match)

  throw new Error(`LibreOffice produced no PDF for ${basename(source)}`)
}
