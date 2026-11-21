export type MoveKey =
  | 'W'
  | 'A'
  | 'S'
  | 'D'
  | 'Q'
  | 'E'
  | 'Up'
  | 'Down'
  | 'Left'
  | 'Right'
  | 'Shift'

export interface KeyboardEventLike {
  code?: string
  key?: string
  repeat?: boolean
}

export interface MovementSample {
  moveForward: number
  moveRight: number
  turnInput: number
  sprint: boolean
  isMoving: boolean
  tapOnly: boolean
}

interface HeldKeyState {
  pressedAt: number
  lastEventAt: number
  repeated: boolean
}

/**
 * Normalizes WASD, Arrow, Q/E turn, and Shift sprint keys consistently across
 * keydown and keyup events regardless of CapsLock, Shift state, or keyboard layout.
 */
export function normalizeMoveKey(event: KeyboardEventLike): MoveKey | null {
  const code = event.code ?? ''
  const rawKey = event.key ?? ''
  const k = rawKey.toLowerCase()

  if (code === 'KeyW' || k === 'w') return 'W'
  if (code === 'KeyA' || k === 'a') return 'A'
  if (code === 'KeyS' || k === 's') return 'S'
  if (code === 'KeyD' || k === 'd') return 'D'
  if (code === 'KeyQ' || k === 'q') return 'Q'
  if (code === 'KeyE' || k === 'e') return 'E'
  if (code === 'ArrowUp' || rawKey === 'ArrowUp' || k === 'up') return 'Up'
  if (code === 'ArrowDown' || rawKey === 'ArrowDown' || k === 'down') return 'Down'
  if (code === 'ArrowLeft' || rawKey === 'ArrowLeft' || k === 'left') return 'Left'
  if (code === 'ArrowRight' || rawKey === 'ArrowRight' || k === 'right') return 'Right'
  if (code === 'ShiftLeft' || code === 'ShiftRight' || rawKey === 'Shift') return 'Shift'
  return null
}

/**
 * Resilient keyboard movement tracker for the 3D Grand Hall.
 *
 * Prevents two common browser/Electron/iframe input bugs:
 * 1. Stuck keys (missed `keyup` causing endless walking forward and blocking opposite keys)
 *    via an OS key-repeat heartbeat watchdog.
 * 2. Dropped fast taps (keydown + keyup occurring between two render frames, e.g. under
 *    software WebGL throttling) via a one-frame tap pulse queue.
 */
export class MovementInputController {
  private readonly held = new Map<MoveKey, HeldKeyState>()
  private readonly queuedTaps = new Set<MoveKey>()
  private lastActivityAt = 0
  private anyRepeated = false
  private survivedChordRelease = false

  /** Max ms to wait for OS key-repeat before treating an un-repeated key as stuck. */
  private readonly initialRepeatTimeoutMs: number
  /** Max ms after the last OS repeat event before treating a held key as stuck. */
  private readonly repeatHeartbeatTimeoutMs: number

  constructor(options?: {
    initialRepeatTimeoutMs?: number
    repeatHeartbeatTimeoutMs?: number
  }) {
    this.initialRepeatTimeoutMs = options?.initialRepeatTimeoutMs ?? 720
    this.repeatHeartbeatTimeoutMs = options?.repeatHeartbeatTimeoutMs ?? 360
  }

  onKeyDown(token: MoveKey, now: number, isRepeat = false): void {
    const existing = this.held.get(token)
    if (!existing) {
      this.held.set(token, {
        pressedAt: now,
        lastEventAt: now,
        repeated: isRepeat
      })
      if (!isRepeat && token !== 'Shift') {
        this.queuedTaps.add(token)
      }
    } else {
      existing.lastEventAt = now
      if (isRepeat) existing.repeated = true
    }

    this.lastActivityAt = now
    this.survivedChordRelease = false
    if (isRepeat) {
      this.anyRepeated = true
    }
  }

  onKeyUp(token: MoveKey, now: number): void {
    this.held.delete(token)
    if (this.held.size === 0) {
      this.anyRepeated = false
      this.survivedChordRelease = false
    } else {
      this.lastActivityAt = now
      this.anyRepeated = false
      this.survivedChordRelease = true
    }
  }

  clear(): void {
    this.held.clear()
    this.queuedTaps.clear()
    this.anyRepeated = false
    this.survivedChordRelease = false
    this.lastActivityAt = 0
  }

  has(token: MoveKey): boolean {
    return this.held.has(token) || this.queuedTaps.has(token)
  }

  private pruneStale(now: number): void {
    if (this.held.size === 0) return
    const elapsed = now - this.lastActivityAt

    if (this.anyRepeated && elapsed > this.repeatHeartbeatTimeoutMs) {
      this.held.clear()
      this.anyRepeated = false
      this.survivedChordRelease = false
      return
    }

    if (!this.anyRepeated && !this.survivedChordRelease && elapsed > this.initialRepeatTimeoutMs) {
      this.held.clear()
      this.anyRepeated = false
      this.survivedChordRelease = false
    }
  }

  sample(now: number): MovementSample {
    this.pruneStale(now)

    const hasKey = (token: MoveKey): boolean =>
      this.held.has(token) || this.queuedTaps.has(token)

    const moveForward =
      (hasKey('W') || hasKey('Up') ? 1 : 0) - (hasKey('S') || hasKey('Down') ? 1 : 0)
    const moveRight =
      (hasKey('D') || hasKey('Right') ? 1 : 0) - (hasKey('A') || hasKey('Left') ? 1 : 0)
    const turnInput = (hasKey('Q') ? 1 : 0) - (hasKey('E') ? 1 : 0)
    const sprint = this.held.has('Shift')

    const hadHeldDirectional =
      this.held.has('W') ||
      this.held.has('S') ||
      this.held.has('A') ||
      this.held.has('D') ||
      this.held.has('Up') ||
      this.held.has('Down') ||
      this.held.has('Left') ||
      this.held.has('Right')

    const tapOnly = !hadHeldDirectional && this.queuedTaps.size > 0
    this.queuedTaps.clear()

    return {
      moveForward,
      moveRight,
      turnInput,
      sprint,
      isMoving: moveForward !== 0 || moveRight !== 0,
      tapOnly
    }
  }
}
