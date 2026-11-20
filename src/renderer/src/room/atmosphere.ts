export type HallTheme = 'dark-academia' | 'sunlit-marble' | 'observatory'
export type HallMood = 'dawn' | 'afternoon' | 'dusk' | 'storm'

export interface HallThemePalette {
  id: HallTheme
  label: string
  subtitle: string
  wood: string
  woodDark: string
  trim: string
  limestone: string
  stoneTrim: string
  brass: string
  inlay: string
  leather: string
  ceiling: string
  blotter: string
  floorBase: string
  floorSlatTint: [number, number, number]
  floorMode: 'parquet' | 'marble' | 'ebony'
  wallStops: [string, string, string, string, string]
  wallPanel: string
  wallCornice: string
  rugField: string
  rugOuterBorder: string
  rugInnerBorder: string
  rugAccent: string
  rugMedallion: string
  plaqueGradient: [string, string, string, string]
  plaqueInk: string
  bankerShade: string
  bankerEmissive: string
  starfieldOculus: boolean
  bgTint: string
}

export interface HallMoodRig {
  id: HallMood
  label: string
  subtitle: string
  background: string
  fogColor: string
  fogDensity: number
  exposure: number
  envIntensity: number
  hemiSky: string
  hemiGround: string
  hemiIntensity: number
  keyColor: string
  keyIntensity: number
  keyPos: [number, number, number]
  fillColor: string
  fillIntensity: number
  windowStops: [string, string, string, string]
  windowEmissive: string
  windowEmissiveIntensity: number
  windowHaloColor: string
  windowHaloOpacity: number
  shaftColor: string
  shaftOpacity: number
  oculusColor: string
  oculusEmissive: string
  oculusIntensity: number
  chandelierIntensity: number
  chandelierHaloOpacity: number
  lampIntensity: number
  fireplaceIntensity: number
  dustColor: string
  dustOpacity: number
  hasRain: boolean
  hasLightning: boolean
  starsOpacity: number
}

export const HALL_THEME_LIST: HallTheme[] = ['dark-academia', 'sunlit-marble', 'observatory']
export const HALL_MOOD_LIST: HallMood[] = ['dawn', 'afternoon', 'dusk', 'storm']

export const HALL_THEME_PALETTES: Record<HallTheme, HallThemePalette> = {
  'dark-academia': {
    id: 'dark-academia',
    label: 'Dark Academia',
    subtitle: 'Walnut, oxblood & brass',
    wood: '#5c3c27',
    woodDark: '#342116',
    trim: '#473021',
    limestone: '#8f806e',
    stoneTrim: '#6b5e4f',
    brass: '#d4ab66',
    inlay: '#a88348',
    leather: '#5b271f',
    ceiling: '#241a13',
    blotter: '#1b382a',
    floorBase: '#442d1e',
    floorSlatTint: [20, 0.72, 0.45],
    floorMode: 'parquet',
    wallStops: ['#2a221c', '#3b3026', '#32261d', '#271b13', '#20150f'],
    wallPanel: '#261a12',
    wallCornice: '#5c432e',
    rugField: '#5f221d',
    rugOuterBorder: '#cca25d',
    rugInnerBorder: '#202d3b',
    rugAccent: '#e0be7c',
    rugMedallion: '#223340',
    plaqueGradient: ['#d8b46e', '#b88f4c', '#cfa65f', '#8c6a32'],
    plaqueInk: '#1b1108',
    bankerShade: '#1c6f49',
    bankerEmissive: '#228a58',
    starfieldOculus: false,
    bgTint: '#18120e'
  },
  'sunlit-marble': {
    id: 'sunlit-marble',
    label: 'Sunlit Marble',
    subtitle: 'Travertine, oak & champagne gold',
    wood: '#9c7853',
    woodDark: '#6b5037',
    trim: '#836345',
    limestone: '#d7cfc2',
    stoneTrim: '#b8ae9f',
    brass: '#d2b274',
    inlay: '#b99b62',
    leather: '#3c5a4f',
    ceiling: '#cfc6b8',
    blotter: '#2c4c43',
    floorBase: '#cfc5b4',
    floorSlatTint: [12, 0.96, 0.88],
    floorMode: 'marble',
    wallStops: ['#dbd3c5', '#e4ddd0', '#d2c8b6', '#c5b9a6', '#b7a994'],
    wallPanel: '#c8bea9',
    wallCornice: '#a7967d',
    rugField: '#3d594e',
    rugOuterBorder: '#d7bc84',
    rugInnerBorder: '#293e37',
    rugAccent: '#ebdab2',
    rugMedallion: '#5c7266',
    plaqueGradient: ['#e2c98e', '#c6a766', '#dac082', '#9c7f45'],
    plaqueInk: '#241a10',
    bankerShade: '#2c7e62',
    bankerEmissive: '#389977',
    starfieldOculus: false,
    bgTint: '#9c9284'
  },
  observatory: {
    id: 'observatory',
    label: 'Observatory',
    subtitle: 'Midnight slate, ebony & starlight',
    wood: '#33303d',
    woodDark: '#1b1a24',
    trim: '#282634',
    limestone: '#5b6178',
    stoneTrim: '#40455a',
    brass: '#c89b6e',
    inlay: '#987556',
    leather: '#283652',
    ceiling: '#111422',
    blotter: '#1a2740',
    floorBase: '#20222f',
    floorSlatTint: [6, 0.94, 1.15],
    floorMode: 'ebony',
    wallStops: ['#161b2e', '#202740', '#1a2035', '#151929', '#101320'],
    wallPanel: '#171c2e',
    wallCornice: '#3c4361',
    rugField: '#1e2c4a',
    rugOuterBorder: '#c9a36f',
    rugInnerBorder: '#121a2e',
    rugAccent: '#e2c99d',
    rugMedallion: '#2e4169',
    plaqueGradient: ['#d4ae80', '#aa8258', '#c69d70', '#7e5d3e'],
    plaqueInk: '#12101a',
    bankerShade: '#285a7a',
    bankerEmissive: '#367ba6',
    starfieldOculus: true,
    bgTint: '#0d101b'
  }
}

export const HALL_MOOD_RIGS: Record<HallMood, HallMoodRig> = {
  dawn: {
    id: 'dawn',
    label: 'Dawn',
    subtitle: 'Rose-gold morning shafts',
    background: '#251e26',
    fogColor: '#2d232b',
    fogDensity: 0.018,
    exposure: 1.24,
    envIntensity: 0.64,
    hemiSky: '#f4c8b4',
    hemiGround: '#634438',
    hemiIntensity: 1.38,
    keyColor: '#ffcaa3',
    keyIntensity: 1.62,
    keyPos: [5.4, 5.2, -3.5],
    fillColor: '#9eb4df',
    fillIntensity: 0.56,
    windowStops: ['#4f5c8f', '#9c7d9e', '#e3a591', '#f9d8a7'],
    windowEmissive: '#d89b87',
    windowEmissiveIntensity: 0.82,
    windowHaloColor: '#f6bc9a',
    windowHaloOpacity: 0.34,
    shaftColor: '#ffd2ad',
    shaftOpacity: 0.056,
    oculusColor: '#c9a9b5',
    oculusEmissive: '#eab9a1',
    oculusIntensity: 0.88,
    chandelierIntensity: 14,
    chandelierHaloOpacity: 0.22,
    lampIntensity: 6.5,
    fireplaceIntensity: 8,
    dustColor: '#ffe0c0',
    dustOpacity: 0.48,
    hasRain: false,
    hasLightning: false,
    starsOpacity: 0.15
  },
  afternoon: {
    id: 'afternoon',
    label: 'Afternoon',
    subtitle: 'Bright warm daylight',
    background: '#3c3a37',
    fogColor: '#45413b',
    fogDensity: 0.011,
    exposure: 1.32,
    envIntensity: 0.78,
    hemiSky: '#eaf3ff',
    hemiGround: '#876d53',
    hemiIntensity: 1.72,
    keyColor: '#fff2d8',
    keyIntensity: 2.05,
    keyPos: [2.8, 7.6, 2.2],
    fillColor: '#bfd8f8',
    fillIntensity: 0.72,
    windowStops: ['#6fa2db', '#9dc6ec', '#d8e9f8', '#f9edd4'],
    windowEmissive: '#bcd7f2',
    windowEmissiveIntensity: 0.95,
    windowHaloColor: '#fff1d4',
    windowHaloOpacity: 0.38,
    shaftColor: '#fff0cf',
    shaftOpacity: 0.068,
    oculusColor: '#cbe0f7',
    oculusEmissive: '#e6f0fb',
    oculusIntensity: 1.05,
    chandelierIntensity: 8,
    chandelierHaloOpacity: 0.14,
    lampIntensity: 4.5,
    fireplaceIntensity: 5.5,
    dustColor: '#fff4da',
    dustOpacity: 0.52,
    hasRain: false,
    hasLightning: false,
    starsOpacity: 0
  },
  dusk: {
    id: 'dusk',
    label: 'Candlelit Dusk',
    subtitle: 'Twilight glass & glowing brass',
    background: '#18120e',
    fogColor: '#18120e',
    fogDensity: 0.024,
    exposure: 1.22,
    envIntensity: 0.58,
    hemiSky: '#c6d8f2',
    hemiGround: '#66462e',
    hemiIntensity: 1.22,
    keyColor: '#ffddb0',
    keyIntensity: 1.32,
    keyPos: [3.2, 6.8, 3.0],
    fillColor: '#86a6d8',
    fillIntensity: 0.52,
    windowStops: ['#243860', '#446394', '#7e9bc2', '#c7ab88'],
    windowEmissive: '#6485ba',
    windowEmissiveIntensity: 0.68,
    windowHaloColor: '#91b4eb',
    windowHaloOpacity: 0.24,
    shaftColor: '#9ab9e8',
    shaftOpacity: 0.036,
    oculusColor: '#5c7db3',
    oculusEmissive: '#6e93cc',
    oculusIntensity: 0.72,
    chandelierIntensity: 26,
    chandelierHaloOpacity: 0.38,
    lampIntensity: 9.5,
    fireplaceIntensity: 14,
    dustColor: '#f6e3ba',
    dustOpacity: 0.4,
    hasRain: false,
    hasLightning: false,
    starsOpacity: 0.55
  },
  storm: {
    id: 'storm',
    label: 'Stormy Night',
    subtitle: 'Rain on tall arches & hearth fire',
    background: '#0d1018',
    fogColor: '#0e121b',
    fogDensity: 0.03,
    exposure: 1.15,
    envIntensity: 0.45,
    hemiSky: '#7d98c4',
    hemiGround: '#4a3122',
    hemiIntensity: 0.88,
    keyColor: '#ffd096',
    keyIntensity: 0.92,
    keyPos: [1.5, 6.4, 2.2],
    fillColor: '#5575ad',
    fillIntensity: 0.66,
    windowStops: ['#0d1426', '#182640', '#2b3e5e', '#3c4d66'],
    windowEmissive: '#344c75',
    windowEmissiveIntensity: 0.56,
    windowHaloColor: '#7599cf',
    windowHaloOpacity: 0.22,
    shaftColor: '#7398d4',
    shaftOpacity: 0.028,
    oculusColor: '#253554',
    oculusEmissive: '#344b75',
    oculusIntensity: 0.58,
    chandelierIntensity: 31,
    chandelierHaloOpacity: 0.45,
    lampIntensity: 11.5,
    fireplaceIntensity: 19,
    dustColor: '#e6d0a6',
    dustOpacity: 0.32,
    hasRain: true,
    hasLightning: true,
    starsOpacity: 0.2
  }
}

export function normalizeHallTheme(value: string | undefined): HallTheme {
  if (value === 'sunlit-marble' || value === 'observatory' || value === 'dark-academia') {
    return value
  }
  return 'dark-academia'
}

export function normalizeHallMood(value: string | undefined): HallMood {
  if (value === 'dawn' || value === 'afternoon' || value === 'dusk' || value === 'storm') {
    return value
  }
  return 'dusk'
}

export function applyThemeToDocument(theme: HallTheme): void {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.hallTheme = theme
}
