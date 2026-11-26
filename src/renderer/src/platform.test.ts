import { describe, expect, it } from 'vitest'
import { detectDesktopOs, formatShortcut } from './platform'

describe('platform utilities', () => {
  it('identifies macOS, Windows, and Linux platforms accurately', () => {
    expect(detectDesktopOs('MacIntel', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBe('macos')
    expect(detectDesktopOs('iPhone', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)')).toBe('macos')
    expect(detectDesktopOs('Win32', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('windows')
    expect(detectDesktopOs('Linux x86_64', 'Mozilla/5.0 (X11; Linux x86_64)')).toBe('linux')
    expect(detectDesktopOs('', '')).toBe('unknown')
  })

  it('formats platform-aware command shortcuts', () => {
    expect(formatShortcut('K', { isMac: true })).toBe('⌘K')
    expect(formatShortcut('K', { isMac: false })).toBe('Ctrl+K')
    expect(formatShortcut('F', { isMac: true })).toBe('⌘F')
    expect(formatShortcut('F', { isMac: false })).toBe('Ctrl+F')
    expect(formatShortcut('   ', { isMac: true })).toBe('')
  })
})
