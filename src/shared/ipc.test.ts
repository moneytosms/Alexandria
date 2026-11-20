import { describe, expect, it } from 'vitest'
import { IPC } from './ipc'

describe('IPC channels', () => {
  it('keeps stable channel names', () => {
    expect(IPC.appPing).toBe('app:ping')
  })
})
