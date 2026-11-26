import { useState } from 'react'
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall'
import { isNativeCapacitorApp } from '../native-android'

export function PWAInstallButton({ compact = false }: { compact?: boolean }) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall()
  const [showIOSGuide, setShowIOSGuide] = useState(false)

  if (isInstalled) return null

  if (isInstallable) {
    return (
      <button
        type="button"
        className={`pwa-install-btn ${compact ? 'pwa-install-btn--compact' : ''}`}
        onClick={() => void install()}
        aria-label="Install Alexandria app"
        title="Install Alexandria for offline use"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        <span>{compact ? 'Install' : 'Install App'}</span>
      </button>
    )
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          className={`pwa-install-btn ${compact ? 'pwa-install-btn--compact' : ''}`}
          onClick={() => setShowIOSGuide(true)}
          aria-label="Install Alexandria on iPhone or iPad"
        >
          <span>Install</span>
        </button>

        {showIOSGuide ? (
          <div
            className="pwa-ios-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Install Alexandria on iOS"
            onClick={() => setShowIOSGuide(false)}
          >
            <div className="pwa-ios-modal__card" onClick={(e) => e.stopPropagation()}>
              <h3>Install on iPhone / iPad</h3>
              <p>
                1. Tap the <strong>Share</strong> icon in Safari&apos;s toolbar.
                <br />
                2. Scroll down and choose <strong>Add to Home Screen</strong>.
                <br />
                3. Launch Alexandria fullscreen offline anytime.
              </p>
              <button
                type="button"
                className="pwa-ios-modal__close"
                onClick={() => setShowIOSGuide(false)}
              >
                Close
              </button>
            </div>
          </div>
        ) : null}
      </>
    )
  }

  return null
}

export function OfflineIndicator() {
  const isOnline = useOnlineStatus()
  const isElectron = typeof navigator !== 'undefined' && /electron/i.test(navigator.userAgent)

  if (isOnline || isElectron || isNativeCapacitorApp()) return null

  return (
    <div className="pwa-offline-pill" role="status" aria-live="polite">
      <span className="pwa-offline-pill__dot" aria-hidden="true" />
      <span>Offline mode · On-device vault active</span>
    </div>
  )
}
