import type { AlexandriaApi } from '../../shared/api'

declare global {
  interface Window {
    alexandria: AlexandriaApi
  }
}

export {}
