import { describe, expect, it } from 'vitest'
import {
  GALLERY_Y,
  ROOM_DEPTH,
  ROOM_WIDTH,
  STAIR_SPEC,
  WALKWAY_DEPTH,
  isOnUpperMezzanineDeck,
  resolveWalkPosition,
  stairHeightAt
} from './physics'

describe('Grand Hall staircase & mezzanine physics', () => {
  it('pushes ground-floor walking out of the central reading desk obstacle', () => {
    const pos = resolveWalkPosition({ x: 0, y: 0, z: 2.2 }, { x: 0, z: 0.35 })
    expect(pos.y).toBe(0)
    expect(Math.abs(pos.z - 0.35)).toBeGreaterThanOrEqual(1.04)
  })

  it('smoothly elevates from ground through Flight 1, Mid-Landing, and Flight 2 onto the Mezzanine', () => {
    let pos = { x: 1.5, y: 0, z: 5.65 }

    // Walk East up Flight 1 to the mid-landing
    for (let x = 1.9; x <= 6.2; x += 0.35) {
      pos = resolveWalkPosition(pos, { x, z: 5.65 })
    }
    expect(pos.y).toBeCloseTo(STAIR_SPEC.midY, 2)

    // Turn North and climb Flight 2 to the East Mezzanine balcony
    for (let z = 5.4; z >= 0.8; z -= 0.35) {
      pos = resolveWalkPosition(pos, { x: 6.3, z })
    }
    expect(pos.y).toBeCloseTo(GALLERY_Y, 2)
    expect(isOnUpperMezzanineDeck(pos.x, pos.z)).toBe(true)
  })

  it('prevents walking off the mezzanine balustrade into the open central nave void', () => {
    const start = { x: 0, y: GALLERY_Y, z: -(ROOM_DEPTH / 2 - 0.9) }
    const clamped = resolveWalkPosition(start, { x: 0, z: -2.0 })
    const innerZ = ROOM_DEPTH / 2 - WALKWAY_DEPTH + 0.36
    expect(clamped.y).toBe(GALLERY_Y)
    expect(clamped.z).toBeLessThanOrEqual(-innerZ + 0.01)
  })

  it('computes continuous stair heights along both flights and null off the stairs', () => {
    expect(stairHeightAt(0, 0)).toBeNull()
    expect(stairHeightAt(STAIR_SPEC.f1StartX, 5.65)).toBeCloseTo(0, 2)
    expect(stairHeightAt((STAIR_SPEC.f1StartX + STAIR_SPEC.f1EndX) / 2, 5.65)).toBeCloseTo(
      STAIR_SPEC.midY / 2,
      2
    )
    expect(stairHeightAt(6.3, STAIR_SPEC.f2EndZ)).toBeCloseTo(GALLERY_Y, 2)
    expect(ROOM_WIDTH).toBe(16)
  })
})
