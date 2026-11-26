export type HallMoodPreview = 'dark-academia' | 'sunlit-marble' | 'observatory'

export interface KeyframePose {
  stop: number
  camX: number
  camY: number
  camZ: number
  lookX: number
  lookY: number
  rigX: number
  rigY: number
  rigScale: number
  rigRotX: number
  rigRotY: number
  ringSpread: number
  folioOpen: number
  folioZ: number
  folioTiltX: number
  folioScale: number
}

// Restrained, editorial 5-chapter choreography:
// The 3D centerpiece stays gracefully proportioned inside the opposite half of the viewport
// so headlines and body copy are always 100% readable and never overlapped.
export const KEYFRAMES: KeyframePose[] = [
  // Ch I: Hero (copy left, sculptural armillary poised right with generous margin)
  {
    stop: 0.0,
    camX: 0.0,
    camY: 0.12,
    camZ: 8.8,
    lookX: 0.0,
    lookY: 0.0,
    rigX: 2.15,
    rigY: 0.05,
    rigScale: 0.84,
    rigRotX: 0.2,
    rigRotY: -0.34,
    ringSpread: 0.0,
    folioOpen: 0.0,
    folioZ: 0.0,
    folioTiltX: 0.12,
    folioScale: 0.88
  },
  // Ch II: Grand Hall (copy right, armillary glides cleanly to left half)
  {
    stop: 0.25,
    camX: 0.0,
    camY: 0.24,
    camZ: 8.9,
    lookX: 0.0,
    lookY: 0.0,
    rigX: -2.25,
    rigY: 0.04,
    rigScale: 0.78,
    rigRotX: 0.3,
    rigRotY: 0.88,
    ringSpread: 0.42,
    folioOpen: 0.0,
    folioZ: 0.06,
    folioTiltX: 0.14,
    folioScale: 0.86
  },
  // Ch III: Precision Reader (copy left, hinged leather folio opens smoothly on right)
  {
    stop: 0.52,
    camX: 0.0,
    camY: 0.06,
    camZ: 7.9,
    lookX: 0.0,
    lookY: 0.0,
    rigX: 2.02,
    rigY: -0.02,
    rigScale: 0.82,
    rigRotX: 0.1,
    rigRotY: 0.14,
    ringSpread: 0.82,
    folioOpen: 1.0,
    folioZ: 0.56,
    folioTiltX: -0.1,
    folioScale: 1.04
  },
  // Ch IV: Local-First Architecture (copy right, elevated concentric schematic left)
  {
    stop: 0.77,
    camX: 0.0,
    camY: 1.65,
    camZ: 8.85,
    lookX: 0.0,
    lookY: -0.08,
    rigX: -2.2,
    rigY: -0.06,
    rigScale: 0.78,
    rigRotX: 0.74,
    rigRotY: 1.72,
    ringSpread: 0.2,
    folioOpen: 0.28,
    folioZ: 0.08,
    folioTiltX: 0.22,
    folioScale: 0.84
  },
  // Ch V: Downloads Vault (recedes quietly high-center behind the card)
  {
    stop: 1.0,
    camX: 0.0,
    camY: 0.12,
    camZ: 10.8,
    lookX: 0.0,
    lookY: 0.0,
    rigX: 0.0,
    rigY: 0.22,
    rigScale: 0.66,
    rigRotX: 0.18,
    rigRotY: 2.5,
    ringSpread: 0.28,
    folioOpen: 0.0,
    folioZ: -0.25,
    folioTiltX: 0.1,
    folioScale: 0.82
  }
]

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function smoothstep01(t: number): number {
  const c = Math.max(0, Math.min(1, t))
  return c * c * (3 - 2 * c)
}

export function sampleChoreography(progress: number, width: number, height: number): KeyframePose {
  const p = Math.max(0, Math.min(1, progress))
  let lo = KEYFRAMES[0]
  let hi = KEYFRAMES[KEYFRAMES.length - 1]
  for (let i = 0; i < KEYFRAMES.length - 1; i++) {
    if (p >= KEYFRAMES[i].stop && p <= KEYFRAMES[i + 1].stop) {
      lo = KEYFRAMES[i]
      hi = KEYFRAMES[i + 1]
      break
    }
  }
  const span = Math.max(0.0001, hi.stop - lo.stop)
  const t = smoothstep01((p - lo.stop) / span)

  const isNarrow = width < 1024
  const aspect = width / Math.max(1, height)
  // Scale horizontal offset cleanly with aspect ratio so the armillary sits centered in its open half
  const xFactor = isNarrow ? 0.0 : Math.min(1.08, Math.max(0.76, aspect / 1.62))
  const narrowScale = isNarrow ? 0.62 : 1.0
  const narrowCamZ = isNarrow ? 2.1 : 0.0

  return {
    stop: p,
    camX: lerp(lo.camX, hi.camX, t),
    camY: lerp(lo.camY, hi.camY, t),
    camZ: lerp(lo.camZ, hi.camZ, t) + narrowCamZ,
    lookX: lerp(lo.lookX, hi.lookX, t),
    lookY: lerp(lo.lookY, hi.lookY, t),
    rigX: lerp(lo.rigX, hi.rigX, t) * xFactor,
    rigY: lerp(lo.rigY, hi.rigY, t) + (isNarrow ? 0.45 : 0),
    rigScale: lerp(lo.rigScale, hi.rigScale, t) * narrowScale,
    rigRotX: lerp(lo.rigRotX, hi.rigRotX, t),
    rigRotY: lerp(lo.rigRotY, hi.rigRotY, t),
    ringSpread: lerp(lo.ringSpread, hi.ringSpread, t),
    folioOpen: lerp(lo.folioOpen, hi.folioOpen, t),
    folioZ: lerp(lo.folioZ, hi.folioZ, t),
    folioTiltX: lerp(lo.folioTiltX, hi.folioTiltX, t),
    folioScale: lerp(lo.folioScale, hi.folioScale, t)
  }
}
