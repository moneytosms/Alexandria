import { create } from 'zustand'
import { getSettingValue, useSettingsStore } from './state/settings-store'

export type SoundName = 'tick' | 'page' | 'pull' | 'thud' | 'chime'

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

  if (name === 'chime') {
    const freqs = [523.25, 659.25, 1046.5]
    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(f, ctx.currentTime + idx * 0.06)
      const gain = ctx.createGain()
      const start = ctx.currentTime + idx * 0.06
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, level * (0.45 / (idx + 1))), start + 0.025)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.6)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(start)
      osc.stop(start + 1.65)
    })
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

/* -------------------------------------------------------------------------- */
/* Procedural Ambient Soundscape Engine (Rain, Fireplace, Brass Chimes)       */
/* -------------------------------------------------------------------------- */

interface AmbientNodes {
  masterGain: GainNode
  rainGain: GainNode
  fireGain: GainNode
  rainSource: AudioBufferSourceNode
  fireSource: AudioBufferSourceNode
  crackleTimer: ReturnType<typeof setInterval>
  chimeTimer: ReturnType<typeof setInterval>
}

let ambientNodes: AmbientNodes | null = null
const PENTATONIC_CHIMES = [523.25, 587.33, 659.25, 783.99, 880, 1046.5]

function createPinkNoiseBuffer(ctx: AudioContext, seconds = 3): AudioBuffer {
  const frames = Math.floor(ctx.sampleRate * seconds)
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate)
  const out = buffer.getChannelData(0)
  let b0 = 0
  let b1 = 0
  let b2 = 0
  let b3 = 0
  let b4 = 0
  let b5 = 0
  let b6 = 0
  for (let i = 0; i < frames; i += 1) {
    const white = Math.random() * 2 - 1
    b0 = 0.99886 * b0 + white * 0.0555179
    b1 = 0.99332 * b1 + white * 0.0750759
    b2 = 0.969 * b2 + white * 0.153852
    b3 = 0.8665 * b3 + white * 0.3104856
    b4 = 0.55 * b4 + white * 0.5329522
    b5 = -0.7616 * b5 - white * 0.016898
    out[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.06
    b6 = white * 0.115926
  }
  return buffer
}

function createBrownNoiseBuffer(ctx: AudioContext, seconds = 3): AudioBuffer {
  const frames = Math.floor(ctx.sampleRate * seconds)
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate)
  const out = buffer.getChannelData(0)
  let last = 0
  for (let i = 0; i < frames; i += 1) {
    const white = Math.random() * 2 - 1
    last = (last + 0.025 * white) / 1.025
    out[i] = last * 1.8
  }
  return buffer
}

function triggerFireCrackle(ctx: AudioContext, dest: AudioNode, level: number): void {
  if (level <= 0.01) return
  const osc = ctx.createBufferSource()
  osc.buffer = noiseBuffer(ctx)
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.setValueAtTime(1400 + Math.random() * 2600, ctx.currentTime)
  bp.Q.value = 3.2
  const g = ctx.createGain()
  const peak = Math.min(0.18, level * (0.04 + Math.random() * 0.09))
  g.gain.setValueAtTime(0.0001, ctx.currentTime)
  g.gain.exponentialRampToValueAtTime(peak, ctx.currentTime + 0.004)
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.032 + Math.random() * 0.03)
  osc.connect(bp)
  bp.connect(g)
  g.connect(dest)
  osc.start()
  osc.stop(ctx.currentTime + 0.08)
}

function triggerSoftChime(ctx: AudioContext, dest: AudioNode, level: number): void {
  if (level <= 0.01) return
  const base = PENTATONIC_CHIMES[Math.floor(Math.random() * PENTATONIC_CHIMES.length)] ?? 659.25
  const now = ctx.currentTime
  for (const [mult, weight] of [
    [1, 1],
    [2.01, 0.25]
  ] as const) {
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(base * mult, now)
    const g = ctx.createGain()
    const peak = Math.min(0.1, level * 0.055 * weight)
    g.gain.setValueAtTime(0.0001, now)
    g.gain.exponentialRampToValueAtTime(peak, now + 0.04)
    g.gain.exponentialRampToValueAtTime(0.0001, now + 2.6)
    osc.connect(g)
    g.connect(dest)
    osc.start(now)
    osc.stop(now + 2.7)
  }
}

function syncAmbientEngine(enabled: boolean, rain: number, fire: number, chimes: number): void {
  if (!enabled || (rain <= 0.01 && fire <= 0.01 && chimes <= 0.01)) {
    if (ambientNodes) {
      try {
        ambientNodes.rainSource.stop()
        ambientNodes.fireSource.stop()
      } catch {
        // already stopped
      }
      clearInterval(ambientNodes.crackleTimer)
      clearInterval(ambientNodes.chimeTimer)
      ambientNodes.masterGain.disconnect()
      ambientNodes = null
    }
    return
  }

  const ctx = audio()
  if (!ctx) return

  if (!ambientNodes) {
    const masterGain = ctx.createGain()
    masterGain.gain.setValueAtTime(0.9, ctx.currentTime)
    masterGain.connect(ctx.destination)

    // Rain channel: filtered pink noise
    const rainSource = ctx.createBufferSource()
    rainSource.buffer = createPinkNoiseBuffer(ctx, 3)
    rainSource.loop = true
    const rainFilter = ctx.createBiquadFilter()
    rainFilter.type = 'bandpass'
    rainFilter.frequency.setValueAtTime(1150, ctx.currentTime)
    rainFilter.Q.value = 0.55
    const rainGain = ctx.createGain()
    rainGain.gain.setValueAtTime(rain * 0.24, ctx.currentTime)
    rainSource.connect(rainFilter)
    rainFilter.connect(rainGain)
    rainGain.connect(masterGain)
    rainSource.start()

    // Fireplace channel: low warm brown noise rumble + randomized crackles
    const fireSource = ctx.createBufferSource()
    fireSource.buffer = createBrownNoiseBuffer(ctx, 3)
    fireSource.loop = true
    const fireFilter = ctx.createBiquadFilter()
    fireFilter.type = 'lowpass'
    fireFilter.frequency.setValueAtTime(155, ctx.currentTime)
    const fireGain = ctx.createGain()
    fireGain.gain.setValueAtTime(fire * 0.28, ctx.currentTime)
    fireSource.connect(fireFilter)
    fireFilter.connect(fireGain)
    fireGain.connect(masterGain)
    fireSource.start()

    const crackleTimer = setInterval(() => {
      const s = useAmbientStore.getState()
      if (!s.enabled || !context || context.state !== 'running') return
      if (s.fire > 0.02 && Math.random() < 0.52) {
        triggerFireCrackle(context, masterGain, s.fire)
      }
      if (s.rain > 0.05 && Math.random() < 0.35) {
        triggerFireCrackle(context, masterGain, s.rain * 0.35)
      }
    }, 260)

    const chimeTimer = setInterval(() => {
      const s = useAmbientStore.getState()
      if (!s.enabled || !context || context.state !== 'running') return
      if (s.chimes > 0.02 && Math.random() < 0.55) {
        triggerSoftChime(context, masterGain, s.chimes)
      }
    }, 4600)

    ambientNodes = {
      masterGain,
      rainGain,
      fireGain,
      rainSource,
      fireSource,
      crackleTimer,
      chimeTimer
    }
  } else {
    ambientNodes.rainGain.gain.setTargetAtTime(rain * 0.24, ctx.currentTime, 0.12)
    ambientNodes.fireGain.gain.setTargetAtTime(fire * 0.28, ctx.currentTime, 0.12)
  }
}

interface AmbientState {
  enabled: boolean
  rain: number
  fire: number
  chimes: number
  hydrated: boolean
  hydrate: () => void
  setEnabled: (enabled: boolean) => void
  toggleEnabled: () => void
  setChannel: (channel: 'rain' | 'fire' | 'chimes', value: number) => void
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0))
}

export const useAmbientStore = create<AmbientState>((set, get) => ({
  enabled: false,
  rain: 0.35,
  fire: 0.45,
  chimes: 0.2,
  hydrated: false,

  hydrate: () => {
    const enabled = getSettingValue('ambient.enabled', 'false') === 'true'
    const rain = clamp01(Number(getSettingValue('ambient.rain', '0.35')))
    const fire = clamp01(Number(getSettingValue('ambient.fire', '0.45')))
    const chimes = clamp01(Number(getSettingValue('ambient.chimes', '0.2')))
    set({ enabled, rain, fire, chimes, hydrated: true })
    if (enabled) syncAmbientEngine(true, rain, fire, chimes)
  },

  setEnabled: (enabled) => {
    const { rain, fire, chimes } = get()
    set({ enabled })
    syncAmbientEngine(enabled, rain, fire, chimes)
    void useSettingsStore.getState().setValue('ambient.enabled', enabled ? 'true' : 'false')
  },

  toggleEnabled: () => {
    get().setEnabled(!get().enabled)
  },

  setChannel: (channel, value) => {
    const clamped = clamp01(value)
    const next = { ...get(), [channel]: clamped }
    // Automatically unmute ambient soundscape if user turns up a slider
    const enabled = clamped > 0.02 ? true : next.enabled
    set({ [channel]: clamped, enabled })
    syncAmbientEngine(enabled, next.rain, next.fire, next.chimes)
    void useSettingsStore.getState().setValue(`ambient.${channel}`, clamped.toFixed(2))
    if (enabled !== get().enabled) {
      void useSettingsStore.getState().setValue('ambient.enabled', enabled ? 'true' : 'false')
    }
  }
}))
