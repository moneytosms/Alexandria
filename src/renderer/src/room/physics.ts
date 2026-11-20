export const ROOM_WIDTH = 16
export const ROOM_DEPTH = 14
export const WALL_HEIGHT = 7.4
export const GALLERY_Y = 3.85
export const WALKWAY_DEPTH = 1.55
export const EYE_HEIGHT = 1.68
export const WALL_MARGIN = 0.82

export interface ObstacleBox {
  x: number
  z: number
  halfX: number
  halfZ: number
}

export const HALL_OBSTACLES: ObstacleBox[] = [
  // Central Architect's Reading Desk
  { x: 0, z: 0.35, halfX: 1.85, halfZ: 1.05 },
  // East Armillary Globe Pedestal (shifted slightly west for generous stair approach)
  { x: 4.1, z: 1.25, halfX: 0.78, halfZ: 0.78 },
  // West Brass Gramophone Side Table
  { x: -4.4, z: 1.4, halfX: 0.82, halfZ: 0.76 },
  // Northwest & Northeast Leather Reading Armchairs
  { x: -3.55, z: -2.2, halfX: 0.82, halfZ: 0.82 },
  { x: 3.55, z: -2.2, halfX: 0.82, halfZ: 0.82 },
  // South-West Fireplace Hearth & Fender
  { x: -4.55, z: ROOM_DEPTH / 2 - 0.62, halfX: 1.45, halfZ: 0.75 }
]

/**
 * Grand Twin-Flight Staircase geometry (South-East corner -> East Mezzanine):
 * - Flight 1 climbs East along z in [5.05, 6.25] from x = 1.95 (y = 0) to x = 5.55 (y = 1.925)
 * - Mid-Landing sits at x in [5.55, 6.95], z in [5.05, 6.35] at y = 1.925
 * - Flight 2 climbs North along x in [5.65, 6.95] from z = 5.05 (y = 1.925) to z = 1.05 (y = 3.85)
 * - Joins the East Mezzanine Balcony at z <= 1.05, y = 3.85
 */
export const STAIR_SPEC = {
  midY: GALLERY_Y / 2,
  f1StartX: 1.95,
  f1EndX: 5.55,
  f1MinZ: 5.05,
  f1MaxZ: 6.25,
  landingMinX: 5.55,
  landingMaxX: 6.95,
  landingMinZ: 5.05,
  landingMaxZ: 6.35,
  f2MinX: 5.65,
  f2MaxX: 6.95,
  f2StartZ: 5.05,
  f2EndZ: 1.05,
  southBalconyMaxX: 1.55
} as const

export interface WalkablePosition {
  x: number
  y: number
  z: number
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

export function isOnUpperMezzanineDeck(x: number, z: number): boolean {
  const maxX = ROOM_WIDTH / 2 - 0.55
  const maxZ = ROOM_DEPTH / 2 - 0.55
  if (Math.abs(x) > maxX || Math.abs(z) > maxZ) return false

  const innerX = ROOM_WIDTH / 2 - WALKWAY_DEPTH + 0.25
  const innerZ = ROOM_DEPTH / 2 - WALKWAY_DEPTH + 0.25

  // North walkway (full span)
  if (z <= -innerZ) return true
  // West walkway (full span)
  if (x <= -innerX) return true
  // South-West walkway (west of stairwell opening)
  if (z >= innerZ && x <= STAIR_SPEC.southBalconyMaxX) return true
  // East walkway (north of top of Flight 2)
  if (x >= innerX && z <= STAIR_SPEC.f2EndZ + 0.15) return true

  return false
}

export function stairHeightAt(x: number, z: number): number | null {
  const s = STAIR_SPEC
  // Mid-landing
  if (x >= s.landingMinX - 0.08 && x <= s.landingMaxX + 0.25 && z >= s.landingMinZ - 0.08 && z <= s.landingMaxZ + 0.25) {
    return s.midY
  }
  // Flight 1 (Eastward climb)
  if (x >= s.f1StartX - 0.25 && x <= s.f1EndX + 0.05 && z >= s.f1MinZ - 0.12 && z <= s.f1MaxZ + 0.15) {
    const t = clamp((x - s.f1StartX) / (s.f1EndX - s.f1StartX), 0, 1)
    return t * s.midY
  }
  // Flight 2 (Northward climb)
  if (x >= s.f2MinX - 0.12 && x <= s.f2MaxX + 0.25 && z >= s.f2EndZ - 0.2 && z <= s.f2StartZ + 0.08) {
    const t = clamp((s.f2StartZ - z) / (s.f2StartZ - s.f2EndZ), 0, 1)
    return s.midY + t * (GALLERY_Y - s.midY)
  }
  return null
}

/**
 * Resolves walkable horizontal & vertical movement seamlessly across:
 * 1) Ground floor nave (with furniture AABB sliding and stairwell side protection)
 * 2) Twin-flight Grand Staircase (smooth continuous elevation y: 0 -> 3.85)
 * 3) Wrap-around Upper Mezzanine Balcony (with balustrade guardrail collision)
 */
export function resolveWalkPosition(
  current: WalkablePosition,
  desired: { x: number; z: number }
): WalkablePosition {
  const maxX = ROOM_WIDTH / 2 - WALL_MARGIN
  const maxZ = ROOM_DEPTH / 2 - WALL_MARGIN
  let x = clamp(desired.x, -maxX, maxX)
  let z = clamp(desired.z, -maxZ, maxZ)
  const s = STAIR_SPEC

  // Case A: Currently on upper mezzanine (or top step of Flight 2)
  if (current.y >= GALLERY_Y - 0.35) {
    // Allow smoothly stepping down onto Flight 2 from East balcony
    const enteringFlight2 =
      x >= s.f2MinX - 0.1 &&
      x <= maxX &&
      z >= s.f2EndZ - 0.25 &&
      z <= s.f2StartZ
    if (enteringFlight2 && z > s.f2EndZ) {
      x = clamp(x, s.f2MinX + 0.14, maxX)
      const h = stairHeightAt(x, z) ?? GALLERY_Y
      return { x, y: h, z }
    }

    // Otherwise clamp inside the walkable mezzanine U/L corridor (protecting balustrade edges)
    const innerX = ROOM_WIDTH / 2 - WALKWAY_DEPTH + 0.36
    const innerZ = ROOM_DEPTH / 2 - WALKWAY_DEPTH + 0.36

    // Prevent stepping past the South-West balcony end railing into the stairwell void
    if (z >= innerZ - 0.25 && x > STAIR_SPEC.southBalconyMaxX - 0.12 && current.x <= STAIR_SPEC.southBalconyMaxX + 0.15) {
      x = STAIR_SPEC.southBalconyMaxX - 0.12
    }

    // If inside the central open nave void, push back to whichever balcony edge is nearest
    const inCentralVoid = x > -innerX && x < innerX && z > -innerZ && z < innerZ
    const inSouthEastVoid = x > STAIR_SPEC.southBalconyMaxX - 0.12 && z > s.f2EndZ + 0.05 && x < innerX
    if (inCentralVoid || inSouthEastVoid) {
      const candidates: Array<{ cx: number; cz: number; dist: number }> = [
        { cx: x, cz: -innerZ, dist: Math.abs(z - -innerZ) },
        { cx: -innerX, cz: z, dist: Math.abs(x - -innerX) }
      ]
      if (z <= s.f2EndZ + 0.25) {
        candidates.push({ cx: innerX, cz: z, dist: Math.abs(x - innerX) })
      }
      if (x <= STAIR_SPEC.southBalconyMaxX - 0.12) {
        candidates.push({ cx: x, cz: innerZ, dist: Math.abs(z - innerZ) })
      }
      candidates.sort((a, b) => a.dist - b.dist)
      const best = candidates[0]
      if (best) {
        x = best.cx
        z = best.cz
      }
    }

    // Clamp East deck south boundary unless properly aligned with Flight 2
    if (x >= innerX - 0.1 && z > s.f2EndZ && x < s.f2MinX - 0.05) {
      z = s.f2EndZ
    }

    return { x, y: GALLERY_Y, z }
  }

  // Case B: Mid-staircase (between ground and upper mezzanine)
  if (current.y > 0.22) {
    // Stepping back down onto ground floor at bottom of Flight 1
    if (x < s.f1StartX && z >= s.f1MinZ - 0.2 && z <= s.f1MaxZ + 0.2) {
      return { x, y: 0, z }
    }
    // Stepping up onto East Mezzanine at top of Flight 2
    if (z <= s.f2EndZ && x >= s.f2MinX - 0.15) {
      return { x: clamp(x, s.f2MinX + 0.1, maxX), y: GALLERY_Y, z }
    }

    // Keep player neatly inside Flight 1, Mid-Landing, or Flight 2 guardrails
    const onFlight2Band = current.y > s.midY + 0.08 || (current.x >= s.f2MinX - 0.05 && z < s.landingMinZ)
    if (onFlight2Band) {
      x = clamp(x, s.f2MinX + 0.14, maxX)
      z = clamp(z, s.f2EndZ - 0.1, s.landingMaxZ - 0.15)
    } else if (x >= s.landingMinX - 0.05) {
      // Mid-landing zone — can smoothly transition into either Flight 1 or Flight 2
      x = clamp(x, s.f1StartX - 0.1, maxX)
      z = clamp(z, s.f2EndZ, s.landingMaxZ - 0.15)
      if (z < s.landingMinZ) {
        x = clamp(x, s.f2MinX + 0.14, maxX)
      }
    } else {
      // Flight 1 corridor
      z = clamp(z, s.f1MinZ + 0.14, s.f1MaxZ - 0.14)
    }

    const h = stairHeightAt(x, z)
    return { x, y: h ?? current.y, z }
  }

  // Case C: Ground floor nave (y <= 0.22)
  // Check if player is walking into the open bottom mouth of Flight 1
  const atFlight1Mouth =
    x >= s.f1StartX - 0.05 &&
    x <= s.f1StartX + 0.95 &&
    z >= s.f1MinZ + 0.05 &&
    z <= s.f1MaxZ - 0.05 &&
    current.x <= s.f1StartX + 0.6

  if (atFlight1Mouth) {
    z = clamp(z, s.f1MinZ + 0.14, s.f1MaxZ - 0.14)
    const h = stairHeightAt(x, z) ?? 0
    return { x, y: h, z }
  }

  // Ground-level obstacles + solid under-staircase enclosure so player doesn't clip beneath stairs
  const groundBoxes: ObstacleBox[] = [
    ...HALL_OBSTACLES,
    // Under Flight 1 (past mouth)
    { x: 4.75, z: 5.68, halfX: 2.35, halfZ: 0.72 },
    // Under Flight 2 (along South-East wall)
    { x: 6.35, z: 3.1, halfX: 0.85, halfZ: 2.15 }
  ]

  for (const box of groundBoxes) {
    const dx = x - box.x
    const dz = z - box.z
    if (Math.abs(dx) < box.halfX && Math.abs(dz) < box.halfZ) {
      const overlapX = box.halfX - Math.abs(dx)
      const overlapZ = box.halfZ - Math.abs(dz)
      if (overlapX < overlapZ) {
        x = box.x + (dx >= 0 ? box.halfX : -box.halfX)
      } else {
        z = box.z + (dz >= 0 ? box.halfZ : -box.halfZ)
      }
    }
  }

  return { x, y: 0, z }
}
