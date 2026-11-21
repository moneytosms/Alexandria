import { describe, expect, it } from 'vitest'
import { MovementInputController, normalizeMoveKey } from './controls'

describe('Grand Hall MovementInputController', () => {
  it('normalizes WASD, Arrow keys, Q/E, and Shift consistently across code and key', () => {
    expect(normalizeMoveKey({ code: 'KeyW', key: 'w' })).toBe('W')
    expect(normalizeMoveKey({ code: 'KeyW', key: 'W' })).toBe('W')
    expect(normalizeMoveKey({ code: 'KeyA', key: 'a' })).toBe('A')
    expect(normalizeMoveKey({ code: 'KeyS', key: 's' })).toBe('S')
    expect(normalizeMoveKey({ code: 'KeyD', key: 'd' })).toBe('D')
    expect(normalizeMoveKey({ code: 'ArrowUp', key: 'ArrowUp' })).toBe('Up')
    expect(normalizeMoveKey({ code: 'ArrowDown', key: 'ArrowDown' })).toBe('Down')
    expect(normalizeMoveKey({ code: 'ArrowLeft', key: 'ArrowLeft' })).toBe('Left')
    expect(normalizeMoveKey({ code: 'ArrowRight', key: 'ArrowRight' })).toBe('Right')
    expect(normalizeMoveKey({ code: 'ShiftLeft', key: 'Shift' })).toBe('Shift')
    expect(normalizeMoveKey({ code: 'KeyZ', key: 'z' })).toBeNull()
  })

  it('moves cleanly in all 4 directions (W/Up, S/Down, A/Left, D/Right) and stops immediately on keyup', () => {
    const ctrl = new MovementInputController()

    ctrl.onKeyDown('D', 100, false)
    expect(ctrl.sample(116)).toMatchObject({ moveForward: 0, moveRight: 1, isMoving: true })
    ctrl.onKeyUp('D', 150)
    expect(ctrl.sample(166)).toMatchObject({ moveForward: 0, moveRight: 0, isMoving: false })

    ctrl.onKeyDown('Down', 200, false)
    expect(ctrl.sample(216)).toMatchObject({ moveForward: -1, moveRight: 0, isMoving: true })
    ctrl.onKeyUp('Down', 250)
    expect(ctrl.sample(266)).toMatchObject({ moveForward: 0, moveRight: 0, isMoving: false })

    ctrl.onKeyDown('W', 300, false)
    expect(ctrl.sample(316)).toMatchObject({ moveForward: 1, moveRight: 0, isMoving: true })
    ctrl.onKeyUp('W', 350)
    expect(ctrl.sample(366)).toMatchObject({ moveForward: 0, moveRight: 0, isMoving: false })

    ctrl.onKeyDown('Up', 400, false)
    expect(ctrl.sample(416)).toMatchObject({ moveForward: 1, moveRight: 0, isMoving: true })
    ctrl.onKeyUp('Up', 450)
    expect(ctrl.sample(466)).toMatchObject({ moveForward: 0, moveRight: 0, isMoving: false })
  })

  it('never drops fast taps that start and end between two animation frames', () => {
    const ctrl = new MovementInputController()

    // User taps D and ArrowDown quickly between frames (e.g. under software WebGL)
    ctrl.onKeyDown('D', 100, false)
    ctrl.onKeyUp('D', 145)

    const first = ctrl.sample(180)
    expect(first).toMatchObject({ moveRight: 1, moveForward: 0, isMoving: true, tapOnly: true })

    // Next frame stops cleanly
    const second = ctrl.sample(260)
    expect(second).toMatchObject({ moveRight: 0, moveForward: 0, isMoving: false, tapOnly: false })

    ctrl.onKeyDown('Down', 300, false)
    ctrl.onKeyUp('Down', 340)
    expect(ctrl.sample(380)).toMatchObject({ moveForward: -1, isMoving: true, tapOnly: true })
    expect(ctrl.sample(460)).toMatchObject({ moveForward: 0, isMoving: false })
  })

  it('auto-releases stuck W or Up keys when keyup is lost so walking never runs forever', () => {
    const ctrl = new MovementInputController({
      initialRepeatTimeoutMs: 700,
      repeatHeartbeatTimeoutMs: 350
    })

    // Tap W without ever receiving keyup
    ctrl.onKeyDown('W', 1000, false)
    expect(ctrl.sample(1100)).toMatchObject({ moveForward: 1, isMoving: true })

    // Once OS repeat window passes with no repeats, watchdog clears stuck W
    expect(ctrl.sample(1750)).toMatchObject({ moveForward: 0, isMoving: false })

    // Now Back Arrow (Down) moves backward cleanly without being cancelled by stuck W
    ctrl.onKeyDown('Down', 1800, false)
    expect(ctrl.sample(1820)).toMatchObject({ moveForward: -1, isMoving: true })
    ctrl.onKeyUp('Down', 1900)
    expect(ctrl.sample(1920)).toMatchObject({ moveForward: 0, isMoving: false })
  })

  it('auto-releases a held repeating key if its final keyup is dropped', () => {
    const ctrl = new MovementInputController({
      initialRepeatTimeoutMs: 700,
      repeatHeartbeatTimeoutMs: 350
    })

    ctrl.onKeyDown('Up', 1000, false)
    ctrl.onKeyDown('Up', 1450, true)
    ctrl.onKeyDown('Up', 1500, true)
    expect(ctrl.sample(1600)).toMatchObject({ moveForward: 1, isMoving: true })

    // User lets go at 1500ms, keyup is lost; 360ms later watchdog stops movement
    expect(ctrl.sample(1880)).toMatchObject({ moveForward: 0, isMoving: false })
  })

  it('supports holding diagonal movement (W + D) smoothly while OS repeats the latest key', () => {
    const ctrl = new MovementInputController()

    ctrl.onKeyDown('W', 1000, false)
    ctrl.onKeyDown('D', 1080, false)
    ctrl.onKeyDown('D', 1500, true)
    ctrl.onKeyDown('D', 1550, true)
    ctrl.onKeyDown('D', 1600, true)

    expect(ctrl.sample(1650)).toMatchObject({
      moveForward: 1,
      moveRight: 1,
      isMoving: true
    })

    ctrl.onKeyUp('D', 1700)
    expect(ctrl.sample(1720)).toMatchObject({
      moveForward: 1,
      moveRight: 0,
      isMoving: true
    })

    ctrl.onKeyUp('W', 1900)
    expect(ctrl.sample(1920)).toMatchObject({
      moveForward: 0,
      moveRight: 0,
      isMoving: false
    })
  })
})
