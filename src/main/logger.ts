import { appendFileSync, mkdirSync, renameSync, rmSync, statSync } from 'node:fs'
import { dirname } from 'node:path'

export type LogLevel = 'info' | 'warn' | 'error'

export interface Logger {
  log: (level: LogLevel, message: string, detail?: string) => void
  info: (message: string, detail?: string) => void
  warn: (message: string, detail?: string) => void
  error: (message: string, detail?: string) => void
}

export interface LoggerOptions {
  maxBytes?: number
}

function format(level: LogLevel, message: string, detail?: string): string {
  const line = `${new Date().toISOString()} ${level.toUpperCase()} ${message}`
  return detail ? `${line}\n${detail}\n` : `${line}\n`
}

export function createLogger(file: string, options: LoggerOptions = {}): Logger {
  const maxBytes = options.maxBytes ?? 2_000_000
  mkdirSync(dirname(file), { recursive: true })

  function rotateIfNeeded(): void {
    try {
      if (statSync(file).size < maxBytes) return
    } catch {
      return
    }

    const previous = `${file}.1`
    rmSync(previous, { force: true })
    renameSync(file, previous)
  }

  function log(level: LogLevel, message: string, detail?: string): void {
    const text = format(level, message, detail)

    if (level === 'error') {
      console.error(text.trimEnd())
    } else if (level === 'warn') {
      console.warn(text.trimEnd())
    } else {
      console.log(text.trimEnd())
    }

    try {
      rotateIfNeeded()
      appendFileSync(file, text, 'utf8')
    } catch {
      // Logging must never take the app down.
    }
  }

  return {
    log,
    info: (message, detail) => log('info', message, detail),
    warn: (message, detail) => log('warn', message, detail),
    error: (message, detail) => log('error', message, detail)
  }
}

const consoleLogger: Logger = {
  log: (level, message, detail) => {
    const text = format(level, message, detail).trimEnd()
    if (level === 'error') console.error(text)
    else if (level === 'warn') console.warn(text)
    else console.log(text)
  },
  info: (message, detail) => consoleLogger.log('info', message, detail),
  warn: (message, detail) => consoleLogger.log('warn', message, detail),
  error: (message, detail) => consoleLogger.log('error', message, detail)
}

let current: Logger | null = null

export function setLogger(logger: Logger | null): void {
  current = logger
}

export function getLogger(): Logger {
  return current ?? consoleLogger
}
