export const ROOM_WIDTH = 16
export const ROOM_DEPTH = 14
export const WALL_HEIGHT = 7.4
export const GALLERY_Y = 3.85
export const WALKWAY_DEPTH = 2.15
export const EYE_HEIGHT = 1.68
export const WALL_MARGIN = 0.78

export interface ObstacleBox {
  x: number
  z: number
  halfX: number
  halfZ: number
}

export const HALL_OBSTACLES: ObstacleBox[] = [
  // Central Architect's Reading Desk
  { x: 0, z: 0.35, halfX: 1.85, halfZ: 1.05 },
  // East Armillary Globe Pedestal (clear of colonnade & stair approach)
  { x: 3.9, z: 1.25, halfX: 0.76, halfZ: 0.76 },
  // West Brass Gramophone Side Table
  { x: -4.1, z: 1.35, halfX: 0.8, halfZ: 0.74 },
  // Northwest & Northeast Leather Reading Armchairs
  { x: -3.45, z: -2.15, halfX: 0.8, halfZ: 0.8 },
  { x: 3.45, z: -2.15, halfX: 0.8, halfZ: 0.8 },
  // South-West Fireplace Hearth & Fender
  { x: -4.55, z: ROOM_DEPTH / 2 - 0.62, halfX: 1.42, halfZ: 0.72 }
]

/**
 * Flush Corner Grand Staircase geometry (South-East corner -> Wide East Mezzanine):
 * - Flight 1 climbs East flush against the South wall (z in [5.25, 7.0])
 *   from x = 2.05 (y = 0) to x = 5.85 (y = 1.925)
 * - Mid-Landing sits flush in the South-East corner:
 *   x in [5.85, 8.0], z in [5.25, 7.0] at y = 1.925
 * - Flight 2 climbs North flush against the East wall (x in [5.85, 8.0], exact WALKWAY_DEPTH = 2.15m!)
 *   from z = 5.25 (y = 1.925) to z = 1.25 (y = 3.85)
 * - Joins the East Mezzanine Gallery seamlessly at z = 1.25, y = 3.85 with zero overhang or wall gap.
 */
export const STAIR_SPEC = {
  midY: GALLERY_Y / 2,
  f1StartX: 2.05,
  f1EndX: ROOM_WIDTH / 2 - WALKWAY_DEPTH, // 5.85
  f1MinZ: ROOM_DEPTH / 2 - 1.75, // 5.25
  f1MaxZ: ROOM_DEPTH / 2, // 7.0 (flush against South wall)
  landingMinX: ROOM_WIDTH / 2 - WALKWAY_DEPTH, // 5.85
  landingMaxX: ROOM_WIDTH / 2, // 8.0 (flush against East wall)
  landingMinZ: ROOM_DEPTH / 2 - 1.75, // 5.25
  landingMaxZ: ROOM_DEPTH / 2, // 7.0 (flush against South wall)
  f2MinX: ROOM_WIDTH / 2 - WALKWAY_DEPTH, // 5.85 (matches East gallery inner edge)
  f2MaxX: ROOM_WIDTH / 2, // 8.0 (flush against East wall)
  f2StartZ: ROOM_DEPTH / 2 - 1.75, // 5.25
  f2EndZ: 1.25,
  southBalconyMaxX: 1.65
} as const

/**
 * Secret Upper Study Nook bounds on the far South-West mezzanine alcove.
 */
export const SECRET_NOOK_BOUNDS = {
  minX: -ROOM_WIDTH / 2 + 0.5,
  maxX: -4.15,
  minZ: ROOM_DEPTH / 2 - WALKWAY_DEPTH,
  maxZ: ROOM_DEPTH / 2 - 0.5,
  y: GALLERY_Y
} as const

export interface WalkablePosition {
  x: number
  y: number
  z: number
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

export function isInsideSecretNook(pos: WalkablePosition): boolean {
  return (
    pos.y >= GALLERY_Y - 0.3 &&
    pos.x >= SECRET_NOOK_BOUNDS.minX &&
    pos.x <= SECRET_NOOK_BOUNDS.maxX &&
    pos.z >= SECRET_NOOK_BOUNDS.minZ &&
    pos.z <= SECRET_NOOK_BOUNDS.maxZ
  )
}

export function isOnUpperMezzanineDeck(x: number, z: number): boolean {
  const maxX = ROOM_WIDTH / 2 - 0.45
  const maxZ = ROOM_DEPTH / 2 - 0.45
  if (Math.abs(x) > maxX || Math.abs(z) > maxZ) return false

  const innerX = ROOM_WIDTH / 2 - WALKWAY_DEPTH + 0.18
  const innerZ = ROOM_DEPTH / 2 - WALKWAY_DEPTH + 0.18

  // North walkway (full span)
  if (z <= -innerZ) return true
  // West walkway (full span)
  if (x <= -innerX) return true
  // South-West walkway (west of stairwell opening)
  if (z >= innerZ && x <= STAIR_SPEC.southBalconyMaxX) return true
  // East walkway (north of top of Flight 2)
  if (x >= innerX && z <= STAIR_SPEC.f2EndZ + 0.12) return true

  return false
}

export function stairHeightAt(x: number, z: number): number | null {
  const s = STAIR_SPEC
  // Mid-landing (SE corner)
  if (
    x >= s.landingMinX - 0.08 &&
    x <= s.landingMaxX + 0.05 &&
    z >= s.landingMinZ - 0.08 &&
    z <= s.landingMaxZ + 0.05
  ) {
    return s.midY
  }
  // Flight 1 (Eastward climb flush against South wall)
  if (
    x >= s.f1StartX - 0.22 &&
    x <= s.f1EndX + 0.05 &&
    z >= s.f1MinZ - 0.1 &&
    z <= s.f1MaxZ + 0.05
  ) {
    const t = clamp((x - s.f1StartX) / (s.f1EndX - s.f1StartX), 0, 1)
    return t * s.midY
  }
  // Flight 2 (Northward climb flush against East wall)
  if (
    x >= s.f2MinX - 0.1 &&
    x <= s.f2MaxX + 0.05 &&
    z >= s.f2EndZ - 0.18 &&
    z <= s.f2StartZ + 0.08
  ) {
    const t = clamp((s.f2StartZ - z) / (s.f2StartZ - s.f2EndZ), 0, 1)
    return s.midY + t * (GALLERY_Y - s.midY)
  }
  return null
}

/**
 * Resolves walkable horizontal & vertical movement seamlessly across:
 * 1) Ground floor nave (with furniture AABB sliding and enclosed under-stair protection)
 * 2) Flush Corner Grand Staircase (smooth continuous elevation y: 0 -> 3.85)
 * 3) Wide Grand Gallery Mezzanine (2.15m decks with balustrade guardrail collision)
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
    // Allow smoothly stepping down onto Flight 2 from the East balcony
    const enteringFlight2 =
      x >= s.f2MinX + 0.08 &&
      x <= maxX &&
      z > s.f2EndZ &&
      z <= s.f2StartZ + 0.2
    if (enteringFlight2) {
      x = clamp(x, s.f2MinX + 0.28, maxX)
      const h = stairHeightAt(x, z) ?? GALLERY_Y
      return { x, y: h, z }
    }

    // Clamp cleanly inside the wide 2.15m perimeter gallery corridor
    const innerX = ROOM_WIDTH / 2 - WALKWAY_DEPTH + 0.34 // 6.19
    const innerZ = ROOM_DEPTH / 2 - WALKWAY_DEPTH + 0.34 // 5.19

    // Prevent stepping past the South-West balcony return railing into the open stairwell
    if (
      z >= innerZ - 0.22 &&
      x > s.southBalconyMaxX - 0.18 &&
      current.x <= s.southBalconyMaxX + 0.2
    ) {
      x = s.southBalconyMaxX - 0.18
    }

    // Push out of the central nave void or South-East stairwell void onto the nearest balcony edge
    const inCentralVoid = x > -innerX && x < innerX && z > -innerZ && z < innerZ
    const inSouthEastVoid = x > s.southBalconyMaxX - 0.18 && z > s.f2EndZ + 0.05 && x < innerX
    if (inCentralVoid || inSouthEastVoid) {
      const candidates: Array<{ cx: number; cz: number; dist: number }> = [
        { cx: x, cz: -innerZ, dist: Math.abs(z - -innerZ) },
        { cx: -innerX, cz: z, dist: Math.abs(x - -innerX) }
      ]
      if (z <= s.f2EndZ + 0.2) {
        candidates.push({ cx: innerX, cz: z, dist: Math.abs(x - innerX) })
      }
      if (x <= s.southBalconyMaxX - 0.18) {
        candidates.push({ cx: x, cz: innerZ, dist: Math.abs(z - innerZ) })
      }
      candidates.sort((a, b) => a.dist - b.dist)
      const best = candidates[0]
      if (best) {
        x = best.cx
        z = best.cz
      }
    }

    // Keep East deck south boundary flush with top of Flight 2 if outside Flight 2 handrail
    if (x >= innerX - 0.1 && z > s.f2EndZ && x < s.f2MinX + 0.08) {
      z = s.f2EndZ
    }

    return { x, y: GALLERY_Y, z }
  }

  // Case B: Mid-staircase (between ground and upper mezzanine)
  if (current.y > 0.03) {
    // Stepping back down onto the ground floor at bottom of Flight 1
    if (x < s.f1StartX && z >= s.f1MinZ - 0.25 && z <= maxZ) {
      return { x, y: 0, z }
    }
    // Stepping up onto the wide East Mezzanine at top of Flight 2
    if (z <= s.f2EndZ && x >= s.f2MinX - 0.1) {
      return { x: clamp(x, s.f2MinX + 0.28, maxX), y: GALLERY_Y, z }
    }

    // Keep player neatly inside Flight 1, corner Mid-Landing, or Flight 2 guardrails
    const onFlight2Band =
      current.y > s.midY + 0.08 || (current.x >= s.f2MinX - 0.05 && z < s.landingMinZ)
    if (onFlight2Band) {
      x = clamp(x, s.f2MinX + 0.28, maxX)
      z = clamp(z, s.f2EndZ - 0.08, maxZ)
    } else if (x >= s.landingMinX - 0.06) {
      // Flush South-East corner landing: smooth turn between Flight 1 and Flight 2
      x = clamp(x, s.f1StartX - 0.08, maxX)
      z = clamp(z, s.f2EndZ, maxZ)
      if (z < s.landingMinZ) {
        x = clamp(x, s.f2MinX + 0.28, maxX)
      }
    } else {
      // Flight 1 corridor flush along South wall
      z = clamp(z, s.f1MinZ + 0.26, maxZ)
    }

    const h = stairHeightAt(x, z)
    return { x, y: h ?? current.y, z }
  }

  // Case C: Ground floor nave (y <= 0.03)
  // Check if player is walking into the open bottom mouth of Flight 1
  const atFlight1Mouth =
    x >= s.f1StartX - 0.05 &&
    x <= s.f1EndX &&
    z >= s.f1MinZ &&
    z <= maxZ &&
    current.x <= s.f1StartX + 0.85

  if (atFlight1Mouth) {
    z = clamp(z, s.f1MinZ + 0.26, maxZ)
    const h = stairHeightAt(x, z) ?? 0
    return { x, y: Math.max(h, x > s.f1StartX ? 0.04 : 0), z }
  }

  // Ground-level obstacles + solid under-staircase wainscoting enclosure
  const groundBoxes: ObstacleBox[] = [
    ...HALL_OBSTACLES,
    // Under Flight 1 & Mid-Landing (strictly south of f1MinZ and east of mouth clearance)
    {
      x: (s.f1StartX + 0.55 + ROOM_WIDTH / 2) / 2,
      z: (s.f1MinZ + ROOM_DEPTH / 2) / 2,
      halfX: (ROOM_WIDTH / 2 - (s.f1StartX + 0.55)) / 2,
      halfZ: (ROOM_DEPTH / 2 - s.f1MinZ) / 2 + 0.08
    },
    // Under Flight 2 (flush against East wall, south of f2EndZ)
    {
      x: (s.f2MinX + ROOM_WIDTH / 2) / 2,
      z: (s.f2EndZ + s.f2StartZ) / 2,
      halfX: (ROOM_WIDTH / 2 - s.f2MinX) / 2 + 0.12,
      halfZ: (s.f2StartZ - s.f2EndZ) / 2
    }
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
