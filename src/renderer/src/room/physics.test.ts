import { describe, expect, it } from 'vitest'
import {
  GALLERY_Y,
  ROOM_DEPTH,
  ROOM_WIDTH,
  SECRET_NOOK_BOUNDS,
  STAIR_SPEC,
  WALKWAY_DEPTH,
  isInsideSecretNook,
  isOnUpperMezzanineDeck,
  resolveWalkPosition,
  stairHeightAt
} from './physics'

describe('Grand Hall wide mezzanine & flush corner staircase physics', () => {
  it('aligns the flush corner staircase seamlessly against the South and East walls and East gallery', () => {
    expect(WALKWAY_DEPTH).toBe(2.15)
    expect(STAIR_SPEC.f1MaxZ).toBe(ROOM_DEPTH / 2)
    expect(STAIR_SPEC.landingMaxX).toBe(ROOM_WIDTH / 2)
    expect(STAIR_SPEC.landingMaxZ).toBe(ROOM_DEPTH / 2)
    expect(STAIR_SPEC.f2MaxX).toBe(ROOM_WIDTH / 2)
    expect(STAIR_SPEC.f2MinX).toBeCloseTo(ROOM_WIDTH / 2 - WALKWAY_DEPTH, 4)
  })

  it('pushes ground-floor walking out of the central reading desk obstacle', () => {
    const pos = resolveWalkPosition({ x: 0, y: 0, z: 2.2 }, { x: 0, z: 0.35 })
    expect(pos.y).toBe(0)
    expect(Math.abs(pos.z - 0.35)).toBeGreaterThanOrEqual(1.04)
  })

  it('smoothly elevates from ground through Flight 1, Corner Mid-Landing, and Flight 2 onto the wide Mezzanine and back down', () => {
    let pos = { x: 1.5, y: 0, z: 5.95 }

    // Walk East up Flight 1 to the flush South-East corner mid-landing
    for (let x = 1.9; x <= 6.8; x += 0.3) {
      pos = resolveWalkPosition(pos, { x, z: 5.95 })
    }
    expect(pos.y).toBeCloseTo(STAIR_SPEC.midY, 2)

    // Turn North and climb Flight 2 to the wide East Mezzanine gallery
    for (let z = 5.6; z >= 0.6; z -= 0.3) {
      pos = resolveWalkPosition(pos, { x: 6.75, z })
    }
    expect(pos.y).toBeCloseTo(GALLERY_Y, 2)
    expect(isOnUpperMezzanineDeck(pos.x, pos.z)).toBe(true)

    // Walk back South down Flight 2 -> Corner Mid-Landing -> West down Flight 1 -> Ground
    for (let z = 0.8; z <= 6.1; z += 0.3) {
      pos = resolveWalkPosition(pos, { x: 6.75, z })
    }
    expect(pos.y).toBeCloseTo(STAIR_SPEC.midY, 2)

    for (let x = 6.4; x >= 1.5; x -= 0.3) {
      pos = resolveWalkPosition(pos, { x, z: 5.95 })
    }
    expect(pos.y).toBe(0)
  })

  it('prevents walking off the wide mezzanine balustrade into the open central nave void', () => {
    const start = { x: 0, y: GALLERY_Y, z: -(ROOM_DEPTH / 2 - 1.1) }
    const clamped = resolveWalkPosition(start, { x: 0, z: -2.0 })
    const innerZ = ROOM_DEPTH / 2 - WALKWAY_DEPTH + 0.34
    expect(clamped.y).toBe(GALLERY_Y)
    expect(clamped.z).toBeLessThanOrEqual(-innerZ + 0.01)
  })

  it('computes continuous stair heights along both flights and null off the stairs', () => {
    expect(stairHeightAt(0, 0)).toBeNull()
    expect(stairHeightAt(STAIR_SPEC.f1StartX, 6.0)).toBeCloseTo(0, 2)
    expect(stairHeightAt((STAIR_SPEC.f1StartX + STAIR_SPEC.f1EndX) / 2, 6.0)).toBeCloseTo(
      STAIR_SPEC.midY / 2,
      2
    )
    expect(stairHeightAt(6.8, STAIR_SPEC.f2EndZ)).toBeCloseTo(GALLERY_Y, 2)
    expect(ROOM_WIDTH).toBe(16)
  })

  it('allows unobstructed rightward walking (D / +X) from the entrance foyer', () => {
    let pos = { x: 0, y: 0, z: 4.45 }
    for (let step = 0; step < 26; step += 1) {
      const next = resolveWalkPosition(pos, { x: pos.x + 0.18, z: pos.z })
      expect(next.x).toBeGreaterThan(pos.x)
      expect(next.y).toBe(0)
      pos = next
    }
    expect(pos.x).toBeGreaterThan(4.5)
  })

  it('transitions smoothly onto Flight 1 from y = 0 without snagging at the stair mouth', () => {
    let pos = { x: 2.2, y: 0, z: 5.95 }
    for (let step = 0; step < 12; step += 1) {
      const next = resolveWalkPosition(pos, { x: pos.x + 0.15, z: pos.z })
      expect(next.x).toBeGreaterThan(pos.x)
      pos = next
    }
    expect(pos.x).toBeGreaterThan(3.8)
    expect(pos.y).toBeGreaterThan(0.5)
  })

  it('detects the Secret Upper Study Nook exclusively on Level 2 in the far South-West alcove', () => {
    expect(
      isInsideSecretNook({
        x: (SECRET_NOOK_BOUNDS.minX + SECRET_NOOK_BOUNDS.maxX) / 2,
        y: GALLERY_Y,
        z: (SECRET_NOOK_BOUNDS.minZ + SECRET_NOOK_BOUNDS.maxZ) / 2
      })
    ).toBe(true)
    expect(
      isInsideSecretNook({
        x: (SECRET_NOOK_BOUNDS.minX + SECRET_NOOK_BOUNDS.maxX) / 2,
        y: 0,
        z: (SECRET_NOOK_BOUNDS.minZ + SECRET_NOOK_BOUNDS.maxZ) / 2
      })
    ).toBe(false)
    expect(isInsideSecretNook({ x: 0, y: GALLERY_Y, z: -5.8 })).toBe(false)
  })
})
