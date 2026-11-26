import { Capacitor } from '@capacitor/core'
import { App as CapacitorApp } from '@capacitor/app'
import { SplashScreen } from '@capacitor/splash-screen'
import { StatusBar, Style } from '@capacitor/status-bar'
import { currentView, navigate } from './router'
import { useUiStore } from './state/ui-store'

let initialized = false

export function isNativeCapacitorApp(): boolean {
  try {
    return Capacitor.isNativePlatform()
  } catch {
    return false
  }
}

/**
 * Configures native Android/Capacitor chrome:
 * - Dark obsidian status bar matching the Grand Hall aesthetic
 * - Smooth splash dismissal after first paint
 * - Hardware back button navigation (close modal -> return to Grand Hall -> exit)
 */
export function initNativeAndroid(): void {
  if (initialized || !isNativeCapacitorApp()) return
  initialized = true

  document.documentElement.classList.add('platform-native-android')

  void StatusBar.setStyle({ style: Style.Dark }).catch(() => undefined)
  void StatusBar.setBackgroundColor({ color: '#0c0a09' }).catch(() => undefined)

  window.requestAnimationFrame(() => {
    void SplashScreen.hide({ fadeOutDuration: 260 }).catch(() => undefined)
  })

  void CapacitorApp.addListener('backButton', ({ canGoBack }) => {
    const ui = useUiStore.getState()
    if (ui.settingsOpen) {
      ui.setSettingsOpen(false)
      return
    }
    if (ui.searchOpen) {
      ui.setSearchOpen(false)
      return
    }
    if (ui.tipsOpen) {
      ui.setTipsOpen(false)
      return
    }

    const activeView = currentView()
    if (activeView !== 'room') {
      navigate('room')
      return
    }

    if (canGoBack) {
      window.history.back()
      return
    }

    void CapacitorApp.exitApp()
  }).catch(() => undefined)
}
