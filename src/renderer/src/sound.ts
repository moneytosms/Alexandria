import { getSettingValue } from './state/settings-store'

export type SoundName = 'tick' | 'page' | 'pull' | 'thud'

let context: AudioContext | null = null
let noise: AudioBuffer | null = null

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!context) {
    const Ctor = window.AudioContext
    if (!Ctor) return null
    try {
      context = new Ctor()
    } catch {
      return null
    }
  }
  if (context.state === 'suspended') void context.resume().catch(() => undefined)
  return context
}

function noiseBuffer(ctx: AudioContext): AudioBuffer {
  if (noise) return noise
  const frames = Math.floor(ctx.sampleRate * 0.2)
  noise = ctx.createBuffer(1, frames, ctx.sampleRate)
  const data = noise.getChannelData(0)
  for (let index = 0; index < frames; index += 1) {
    data[index] = (Math.random() * 2 - 1) * (1 - index / frames)
  }
  return noise
}

function envelope(ctx: AudioContext, peak: number, duration: number): GainNode {
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.0001, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), ctx.currentTime + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration)
  gain.connect(ctx.destination)
  return gain
}

/**
 * Small procedural sounds so the app ships without audio assets. Everything is
 * synthesized, mixed at the user's sound volume, and skipped when muted.
 */
export function playSound(name: SoundName, scale = 1): void {
  if (getSettingValue('sound.enabled', 'true') !== 'true') return
  const volume = Number(getSettingValue('sound.volume', '0.3'))
  if (!Number.isFinite(volume) || volume <= 0) return

  const ctx = audio()
  if (!ctx) return
  const level = Math.min(0.5, volume * 0.45 * scale)

  if (name === 'tick') {
    const osc = ctx.createOscillator()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(1080, ctx.currentTime)
    const gain = envelope(ctx, level * 0.5, 0.045)
    osc.connect(gain)
    osc.start()
    osc.stop(ctx.currentTime + 0.05)
    return
  }

  if (name === 'page') {
    const source = ctx.createBufferSource()
    source.buffer = noiseBuffer(ctx)
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(2400, ctx.currentTime)
    filter.frequency.exponentialRampToValueAtTime(700, ctx.currentTime + 0.16)
    filter.Q.value = 0.8
    const gain = envelope(ctx, level * 0.7, 0.18)
    source.connect(filter)
    filter.connect(gain)
    source.start()
    source.stop(ctx.currentTime + 0.2)
    return
  }

  if (name === 'pull') {
    const source = ctx.createBufferSource()
    source.buffer = noiseBuffer(ctx)
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(900, ctx.currentTime)
    filter.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.3)
    const gain = envelope(ctx, level, 0.34)
    source.connect(filter)
    filter.connect(gain)
    source.start()
    source.stop(ctx.currentTime + 0.36)

    const thump = ctx.createOscillator()
    thump.type = 'sine'
    thump.frequency.setValueAtTime(120, ctx.currentTime)
    thump.frequency.exponentialRampToValueAtTime(58, ctx.currentTime + 0.2)
    const thumpGain = envelope(ctx, level * 0.8, 0.24)
    thump.connect(thumpGain)
    thump.start()
    thump.stop(ctx.currentTime + 0.26)
    return
  }

  const source = ctx.createBufferSource()
  source.buffer = noiseBuffer(ctx)
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(320, ctx.currentTime)
  const gain = envelope(ctx, level * 0.8, 0.22)
  source.connect(filter)
  filter.connect(gain)
  source.start()
  source.stop(ctx.currentTime + 0.24)

  const body = ctx.createOscillator()
  body.type = 'sine'
  body.frequency.setValueAtTime(92, ctx.currentTime)
  body.frequency.exponentialRampToValueAtTime(52, ctx.currentTime + 0.18)
  const bodyGain = envelope(ctx, level * 0.6, 0.2)
  body.connect(bodyGain)
  body.start()
  body.stop(ctx.currentTime + 0.22)
}
