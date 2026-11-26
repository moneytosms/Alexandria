export type QualityPreference = 'auto' | 'low' | 'medium' | 'high'
export type QualityTier = 0 | 1 | 2 | 3

export interface QualityProfile {
  tier: QualityTier
  label: 'Low' | 'Balanced' | 'High' | 'Ultra'
  dprCap: number
  shadowsEnabled: boolean
  shadowAutoUpdate: boolean
  particleRatio: number
  ambientStep: 1 | 2
}

const TIER_PROFILES: Record<QualityTier, QualityProfile> = {
  0: {
    tier: 0,
    label: 'Low',
    dprCap: 1.0,
    shadowsEnabled: false,
    shadowAutoUpdate: false,
    particleRatio: 0.35,
    ambientStep: 2
  },
  1: {
    tier: 1,
    label: 'Balanced',
    dprCap: 1.25,
    shadowsEnabled: true,
    shadowAutoUpdate: false,
    particleRatio: 0.65,
    ambientStep: 2
  },
  2: {
    tier: 2,
    label: 'High',
    dprCap: 1.5,
    shadowsEnabled: true,
    shadowAutoUpdate: true,
    particleRatio: 0.85,
    ambientStep: 1
  },
  3: {
    tier: 3,
    label: 'Ultra',
    dprCap: 2.0,
    shadowsEnabled: true,
    shadowAutoUpdate: true,
    particleRatio: 1.0,
    ambientStep: 1
  }
}

export function normalizeQualityPreference(raw: string | undefined): QualityPreference {
  if (raw === 'low' || raw === 'medium' || raw === 'high' || raw === 'auto') {
    return raw
  }
  return 'auto'
}

export function profileForTier(tier: QualityTier, isSoftwareGl = false): QualityProfile {
  if (isSoftwareGl) {
    return {
      ...TIER_PROFILES[0],
      dprCap: 1.0,
      shadowsEnabled: false,
      shadowAutoUpdate: false
    }
  }
  return TIER_PROFILES[tier]
}

export interface AdaptiveGovernorOptions {
  preference: QualityPreference
  isSoftwareGl: boolean
  isTouchPrimary?: boolean
  devicePixelRatio?: number
}

const SLOW_FRAME_MS = 26
const FAST_FRAME_MS = 14
const STEP_DOWN_HOLD_MS = 1800
const STEP_UP_HOLD_MS = 4500
const COOLDOWN_MS = 3000

/**
 * Hysteresis-backed 3D adaptive quality governor.
 * Keeps frame pacing smooth on laptops, tablets, and integrated GPUs while
 * scaling up cleanly on high-headroom desktops without oscillating.
 */
export class AdaptiveQualityGovernor {
  private preference: QualityPreference
  private readonly isSoftwareGl: boolean
  private readonly maxTier: QualityTier
  private tier: QualityTier
  private emaFrameMs = 16.6
  private slowAccumMs = 0
  private fastAccumMs = 0
  private cooldownMs = 0

  constructor(options: AdaptiveGovernorOptions) {
    this.preference = options.preference
    this.isSoftwareGl = options.isSoftwareGl
    const dpr = options.devicePixelRatio ?? 1
    this.maxTier = options.isSoftwareGl ? 0 : dpr > 1.35 ? 3 : 2
    this.tier = this.resolveInitialTier(options.preference, options.isSoftwareGl, options.isTouchPrimary ?? false)
  }

  private resolveInitialTier(
    pref: QualityPreference,
    isSoftwareGl: boolean,
    isTouchPrimary: boolean
  ): QualityTier {
    if (isSoftwareGl) return 0
    if (pref === 'low') return 0
    if (pref === 'medium') return 1
    if (pref === 'high') return this.maxTier
    // Auto mode starts conservatively on touch devices, High on desktop
    return isTouchPrimary ? 1 : Math.min(2, this.maxTier) as QualityTier
  }

  public getTier(): QualityTier {
    return this.tier
  }

  public getProfile(): QualityProfile {
    return profileForTier(this.tier, this.isSoftwareGl)
  }

  public getAverageFrameMs(): number {
    return this.emaFrameMs
  }

  public setPreference(pref: QualityPreference, isTouchPrimary = false): boolean {
    this.preference = pref
    this.slowAccumMs = 0
    this.fastAccumMs = 0
    this.cooldownMs = 0
    const next = this.resolveInitialTier(pref, this.isSoftwareGl, isTouchPrimary)
    if (next !== this.tier) {
      this.tier = next
      return true
    }
    return false
  }

  /**
   * Feed the latest rendered frame delta in milliseconds.
   * Returns true when the active quality tier changed and renderer settings should sync.
   */
  public recordFrame(frameMs: number): boolean {
    const clamped = Math.max(4, Math.min(120, frameMs))
    this.emaFrameMs = this.emaFrameMs * 0.9 + clamped * 0.1

    if (this.preference !== 'auto' || this.isSoftwareGl) {
      return false
    }

    if (this.cooldownMs > 0) {
      this.cooldownMs = Math.max(0, this.cooldownMs - clamped)
      return false
    }

    if (this.emaFrameMs > SLOW_FRAME_MS && this.tier > 0) {
      this.slowAccumMs += clamped
      this.fastAccumMs = 0
      if (this.slowAccumMs >= STEP_DOWN_HOLD_MS) {
        this.tier = (this.tier - 1) as QualityTier
        this.slowAccumMs = 0
        this.cooldownMs = COOLDOWN_MS
        return true
      }
      return false
    }

    if (this.emaFrameMs < FAST_FRAME_MS && this.tier < this.maxTier) {
      this.fastAccumMs += clamped
      this.slowAccumMs = 0
      if (this.fastAccumMs >= STEP_UP_HOLD_MS) {
        this.tier = (this.tier + 1) as QualityTier
        this.fastAccumMs = 0
        this.cooldownMs = COOLDOWN_MS
        return true
      }
      return false
    }

    // Decay accumulators gradually inside the deadband (14ms..26ms)
    this.slowAccumMs = Math.max(0, this.slowAccumMs - clamped * 0.5)
    this.fastAccumMs = Math.max(0, this.fastAccumMs - clamped * 0.5)
    return false
  }
}
