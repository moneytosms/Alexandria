import { describe, expect, it } from 'vitest'
import {
  AdaptiveQualityGovernor,
  normalizeQualityPreference,
  profileForTier
} from './adaptive-quality'

describe('AdaptiveQualityGovernor', () => {
  it('normalizes unknown quality strings to auto', () => {
    expect(normalizeQualityPreference('auto')).toBe('auto')
    expect(normalizeQualityPreference('low')).toBe('low')
    expect(normalizeQualityPreference('medium')).toBe('medium')
    expect(normalizeQualityPreference('high')).toBe('high')
    expect(normalizeQualityPreference(undefined)).toBe('auto')
    expect(normalizeQualityPreference('ultra')).toBe('auto')
  })

  it('locks software WebGL contexts to tier 0 without shadows', () => {
    const gov = new AdaptiveQualityGovernor({
      preference: 'high',
      isSoftwareGl: true,
      devicePixelRatio: 2
    })

    expect(gov.getTier()).toBe(0)
    expect(gov.getProfile().shadowsEnabled).toBe(false)
    expect(gov.getProfile().dprCap).toBe(1.0)

    // Fast frames never promote software GL
    for (let i = 0; i < 600; i += 1) {
      expect(gov.recordFrame(8)).toBe(false)
    }
    expect(gov.getTier()).toBe(0)
  })

  it('starts touch-primary devices conservatively at tier 1 in auto mode', () => {
    const touchGov = new AdaptiveQualityGovernor({
      preference: 'auto',
      isSoftwareGl: false,
      isTouchPrimary: true,
      devicePixelRatio: 2
    })
    const desktopGov = new AdaptiveQualityGovernor({
      preference: 'auto',
      isSoftwareGl: false,
      isTouchPrimary: false,
      devicePixelRatio: 2
    })

    expect(touchGov.getTier()).toBe(1)
    expect(desktopGov.getTier()).toBe(2)
  })

  it('steps down after sustained slow frames and enforces cooldown', () => {
    const gov = new AdaptiveQualityGovernor({
      preference: 'auto',
      isSoftwareGl: false,
      isTouchPrimary: false,
      devicePixelRatio: 2
    })
    expect(gov.getTier()).toBe(2)

    // Brief spike should NOT trigger step-down
    let changed = false
    for (let i = 0; i < 10; i += 1) {
      changed = gov.recordFrame(40) || changed
    }
    expect(changed).toBe(false)
    expect(gov.getTier()).toBe(2)

    // Sustained >26ms frames for >2s triggers step-down to tier 1
    let steppedDown = false
    for (let i = 0; i < 80; i += 1) {
      if (gov.recordFrame(40)) {
        steppedDown = true
        break
      }
    }
    expect(steppedDown).toBe(true)
    expect(gov.getTier()).toBe(1)

    // Cooldown prevents immediate second drop within 3s
    let droppedDuringCooldown = false
    for (let i = 0; i < 50; i += 1) {
      if (gov.recordFrame(40)) {
        droppedDuringCooldown = true
      }
    }
    expect(droppedDuringCooldown).toBe(false)
    expect(gov.getTier()).toBe(1)
  })

  it('steps up on sustained headroom when high-DPR ceiling allows', () => {
    const gov = new AdaptiveQualityGovernor({
      preference: 'auto',
      isSoftwareGl: false,
      isTouchPrimary: false,
      devicePixelRatio: 2
    })
    expect(gov.getTier()).toBe(2)

    let steppedUp = false
    for (let i = 0; i < 700; i += 1) {
      if (gov.recordFrame(10)) {
        steppedUp = true
        break
      }
    }
    expect(steppedUp).toBe(true)
    expect(gov.getTier()).toBe(3)
    expect(profileForTier(3).dprCap).toBe(2.0)
  })

  it('respects manual overrides without auto-scaling', () => {
    const gov = new AdaptiveQualityGovernor({
      preference: 'low',
      isSoftwareGl: false,
      devicePixelRatio: 2
    })
    expect(gov.getTier()).toBe(0)

    for (let i = 0; i < 700; i += 1) {
      expect(gov.recordFrame(8)).toBe(false)
    }
    expect(gov.getTier()).toBe(0)

    expect(gov.setPreference('high')).toBe(true)
    expect(gov.getTier()).toBe(3)
  })
})
