import { useEffect, useState } from 'react'

export type DesktopOs = 'macos' | 'windows' | 'linux' | 'unknown'

export interface PlatformCapabilities {
  os: DesktopOs
  isMac: boolean
  isTouchPrimary: boolean
  hasTouch: boolean
  modKey: '⌘' | 'Ctrl'
}

export function detectDesktopOs(
  platformStr = typeof navigator !== 'undefined' ? navigator.platform : '',
  userAgentStr = typeof navigator !== 'undefined' ? navigator.userAgent : ''
): DesktopOs {
  const combined = `${platformStr} ${userAgentStr}`.toLowerCase()
  if (/mac|iphone|ipad|ipod/.test(combined)) return 'macos'
  if (/win/.test(combined)) return 'windows'
  if (/linux|x11|cros/.test(combined)) return 'linux'
  return 'unknown'
}

export function detectPlatformCapabilities(): PlatformCapabilities {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      os: 'unknown',
      isMac: false,
      isTouchPrimary: false,
      hasTouch: false,
      modKey: 'Ctrl'
    }
  }
  const os = detectDesktopOs(navigator.platform, navigator.userAgent)
  const isMac = os === 'macos'
  const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false
  const hasTouch =
    coarsePointer || (typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 0)
  return {
    os,
    isMac,
    isTouchPrimary: coarsePointer,
    hasTouch,
    modKey: isMac ? '⌘' : 'Ctrl'
  }
}

export function formatShortcut(key: string, caps?: Pick<PlatformCapabilities, 'isMac'>): string {
  const isMac = caps ? caps.isMac : detectPlatformCapabilities().isMac
  const normalized = key.trim()
  if (!normalized) return ''
  return isMac ? `⌘${normalized}` : `Ctrl+${normalized}`
}

export function usePlatformCapabilities(): PlatformCapabilities {
  const [caps, setCaps] = useState<PlatformCapabilities>(() => detectPlatformCapabilities())

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(pointer: coarse)')
    const sync = (): void => setCaps(detectPlatformCapabilities())
    const onFirstTouch = (): void => {
      setCaps((prev) => (prev.isTouchPrimary && prev.hasTouch ? prev : { ...prev, isTouchPrimary: true, hasTouch: true }))
    }

    mq.addEventListener?.('change', sync)
    window.addEventListener('touchstart', onFirstTouch, { passive: true, once: true })
    return () => {
      mq.removeEventListener?.('change', sync)
      window.removeEventListener('touchstart', onFirstTouch)
    }
  }, [])

  return caps
}
