import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { createProceduralTextureBundle } from './proceduralTextures'

export type HallMoodPreview = 'dark-academia' | 'sunlit-marble' | 'observatory'

export interface ArmillaryStageProps {
  scrollProgressRef: React.MutableRefObject<number>
  reducedMotion: boolean
  mood: HallMoodPreview
}

interface KeyframePose {
  stop: number
  camX: number
  camY: number
  camZ: number
  lookX: number
  lookY: number
  rigX: number
  rigY: number
  rigScale: number
  rigRotX: number
  rigRotY: number
  ringSpread: number
  folioOpen: number
  folioZ: number
  folioTiltX: number
  folioScale: number
}

// Restrained, editorial 5-chapter choreography:
// The 3D centerpiece stays gracefully proportioned inside the opposite half of the viewport
// so headlines and body copy are always 100% readable and never overlapped.
const KEYFRAMES: KeyframePose[] = [
  // Ch I: Hero (copy left, sculptural armillary poised right with generous margin)
  {
    stop: 0.0,
    camX: 0.0,
    camY: 0.12,
    camZ: 8.8,
    lookX: 0.0,
    lookY: 0.0,
    rigX: 2.15,
    rigY: 0.05,
    rigScale: 0.84,
    rigRotX: 0.2,
    rigRotY: -0.34,
    ringSpread: 0.0,
    folioOpen: 0.0,
    folioZ: 0.0,
    folioTiltX: 0.12,
    folioScale: 0.88
  },
  // Ch II: Grand Hall (copy right, armillary glides cleanly to left half)
  {
    stop: 0.25,
    camX: 0.0,
    camY: 0.24,
    camZ: 8.9,
    lookX: 0.0,
    lookY: 0.0,
    rigX: -2.25,
    rigY: 0.04,
    rigScale: 0.78,
    rigRotX: 0.3,
    rigRotY: 0.88,
    ringSpread: 0.42,
    folioOpen: 0.0,
    folioZ: 0.06,
    folioTiltX: 0.14,
    folioScale: 0.86
  },
  // Ch III: Precision Reader (copy left, hinged leather folio opens smoothly on right)
  {
    stop: 0.52,
    camX: 0.0,
    camY: 0.06,
    camZ: 7.9,
    lookX: 0.0,
    lookY: 0.0,
    rigX: 2.02,
    rigY: -0.02,
    rigScale: 0.82,
    rigRotX: 0.1,
    rigRotY: 0.14,
    ringSpread: 0.82,
    folioOpen: 1.0,
    folioZ: 0.56,
    folioTiltX: -0.1,
    folioScale: 1.04
  },
  // Ch IV: Local-First Architecture (copy right, elevated concentric schematic left)
  {
    stop: 0.77,
    camX: 0.0,
    camY: 1.65,
    camZ: 8.85,
    lookX: 0.0,
    lookY: -0.08,
    rigX: -2.2,
    rigY: -0.06,
    rigScale: 0.78,
    rigRotX: 0.74,
    rigRotY: 1.72,
    ringSpread: 0.2,
    folioOpen: 0.28,
    folioZ: 0.08,
    folioTiltX: 0.22,
    folioScale: 0.84
  },
  // Ch V: Downloads Vault (recedes quietly high-center behind the card)
  {
    stop: 1.0,
    camX: 0.0,
    camY: 0.12,
    camZ: 10.8,
    lookX: 0.0,
    lookY: 0.0,
    rigX: 0.0,
    rigY: 0.22,
    rigScale: 0.66,
    rigRotX: 0.18,
    rigRotY: 2.5,
    ringSpread: 0.28,
    folioOpen: 0.0,
    folioZ: -0.25,
    folioTiltX: 0.1,
    folioScale: 0.82
  }
]

const MOOD_LIGHTS: Record<
  HallMoodPreview,
  { key: THREE.Color; rim: THREE.Color; hearth: THREE.Color; keyInt: number; rimInt: number }
> = {
  'dark-academia': {
    key: new THREE.Color(0xffe0aa),
    rim: new THREE.Color(0x7c98c6),
    hearth: new THREE.Color(0xd59642),
    keyInt: 2.25,
    rimInt: 1.05
  },
  'sunlit-marble': {
    key: new THREE.Color(0xfff5e0),
    rim: new THREE.Color(0xd8c8ad),
    hearth: new THREE.Color(0xe6c896),
    keyInt: 2.65,
    rimInt: 1.35
  },
  observatory: {
    key: new THREE.Color(0xcbdcff),
    rim: new THREE.Color(0x6d96e8),
    hearth: new THREE.Color(0x88a8d8),
    keyInt: 2.0,
    rimInt: 1.75
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function smoothstep01(t: number): number {
  const c = Math.max(0, Math.min(1, t))
  return c * c * (3 - 2 * c)
}

function sampleChoreography(progress: number, width: number, height: number): KeyframePose {
  const p = Math.max(0, Math.min(1, progress))
  let lo = KEYFRAMES[0]
  let hi = KEYFRAMES[KEYFRAMES.length - 1]
  for (let i = 0; i < KEYFRAMES.length - 1; i++) {
    if (p >= KEYFRAMES[i].stop && p <= KEYFRAMES[i + 1].stop) {
      lo = KEYFRAMES[i]
      hi = KEYFRAMES[i + 1]
      break
    }
  }
  const span = Math.max(0.0001, hi.stop - lo.stop)
  const t = smoothstep01((p - lo.stop) / span)

  const isNarrow = width < 1024
  const aspect = width / Math.max(1, height)
  // Scale horizontal offset cleanly with aspect ratio so the armillary sits centered in its open half
  const xFactor = isNarrow ? 0.0 : Math.min(1.08, Math.max(0.76, aspect / 1.62))
  const narrowScale = isNarrow ? 0.62 : 1.0
  const narrowCamZ = isNarrow ? 2.1 : 0.0

  return {
    stop: p,
    camX: lerp(lo.camX, hi.camX, t),
    camY: lerp(lo.camY, hi.camY, t),
    camZ: lerp(lo.camZ, hi.camZ, t) + narrowCamZ,
    lookX: lerp(lo.lookX, hi.lookX, t),
    lookY: lerp(lo.lookY, hi.lookY, t),
    rigX: lerp(lo.rigX, hi.rigX, t) * xFactor,
    rigY: lerp(lo.rigY, hi.rigY, t) + (isNarrow ? 0.45 : 0),
    rigScale: lerp(lo.rigScale, hi.rigScale, t) * narrowScale,
    rigRotX: lerp(lo.rigRotX, hi.rigRotX, t),
    rigRotY: lerp(lo.rigRotY, hi.rigRotY, t),
    ringSpread: lerp(lo.ringSpread, hi.ringSpread, t),
    folioOpen: lerp(lo.folioOpen, hi.folioOpen, t),
    folioZ: lerp(lo.folioZ, hi.folioZ, t),
    folioTiltX: lerp(lo.folioTiltX, hi.folioTiltX, t),
    folioScale: lerp(lo.folioScale, hi.folioScale, t)
  }
}

function detectSoftwareWebGL(renderer: THREE.WebGLRenderer): boolean {
  try {
    const gl = renderer.getContext()
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    if (!ext) return false
    const vendor = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '').toLowerCase()
    return (
      vendor.includes('swiftshader') ||
      vendor.includes('llvmpipe') ||
      vendor.includes('software') ||
      vendor.includes('mesa')
    )
  } catch {
    return false
  }
}

export function ArmillaryFolioStage({
  scrollProgressRef,
  reducedMotion,
  mood
}: ArmillaryStageProps) {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const moodRef = useRef<HallMoodPreview>(mood)
  const [webglFailed, setWebglFailed] = useState(false)

  useEffect(() => {
    moodRef.current = mood
  }, [mood])

  useEffect(() => {
    const container = mountRef.current
    if (!container) return

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance'
      })
    } catch {
      setWebglFailed(true)
      return
    }

    const isSoftwareGl = detectSoftwareWebGL(renderer)
    const maxDpr = isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2)
    renderer.setPixelRatio(maxDpr)
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.12
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.setClearColor(0x0c0a09, 0)

    const canvas = renderer.domElement
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    canvas.style.display = 'block'
    container.appendChild(canvas)

    const scene = new THREE.Scene()
    scene.fog = new THREE.FogExp2(0x0c0a09, 0.044)

    const camera = new THREE.PerspectiveCamera(
      34,
      window.innerWidth / Math.max(1, window.innerHeight),
      0.1,
      60
    )

    // Studio PMREM reflections for brushed antique brass
    const pmrem = new THREE.PMREMGenerator(renderer)
    const envTarget = pmrem.fromScene(new RoomEnvironment(), 0.04)
    scene.environment = envTarget.texture
    scene.environmentIntensity = 0.68

    // Dynamic 3-point studio lighting (transitions smoothly with HallMoodPreview)
    const initialMood = MOOD_LIGHTS[moodRef.current]
    const keyLight = new THREE.DirectionalLight(initialMood.key.clone(), initialMood.keyInt)
    keyLight.position.set(5.5, 6.2, 5.2)
    scene.add(keyLight)

    const rimLight = new THREE.DirectionalLight(initialMood.rim.clone(), initialMood.rimInt)
    rimLight.position.set(-6.0, 2.8, -4.5)
    scene.add(rimLight)

    const hearthLight = new THREE.PointLight(initialMood.hearth.clone(), 2.2, 14, 1.6)
    hearthLight.position.set(0.2, -3.0, 2.5)
    scene.add(hearthLight)

    const ambient = new THREE.AmbientLight(0x3a2e22, 0.5)
    scene.add(ambient)

    const textures = createProceduralTextureBundle()

    const brushedBrassMat = new THREE.MeshPhysicalMaterial({
      color: 0xc9a35f,
      metalness: 0.9,
      roughness: 0.26,
      clearcoat: 0.25,
      clearcoatRoughness: 0.24,
      bumpMap: textures.brassBump,
      bumpScale: 0.014
    })

    const engravedBrassBandMat = new THREE.MeshPhysicalMaterial({
      map: textures.brassEngraving,
      bumpMap: textures.brassBump,
      bumpScale: 0.024,
      metalness: 0.88,
      roughness: 0.28,
      clearcoat: 0.2,
      side: THREE.DoubleSide
    })

    const darkBronzeMat = new THREE.MeshStandardMaterial({
      color: 0x574124,
      metalness: 0.84,
      roughness: 0.4
    })

    const polishedGoldMat = new THREE.MeshPhysicalMaterial({
      color: 0xdec07e,
      metalness: 0.94,
      roughness: 0.17,
      clearcoat: 0.34
    })

    const leatherMat = new THREE.MeshStandardMaterial({
      map: textures.leatherCover,
      bumpMap: textures.leatherBump,
      bumpScale: 0.02,
      roughness: 0.66,
      metalness: 0.08
    })

    const plainLeatherMat = new THREE.MeshStandardMaterial({
      color: 0x20100e,
      bumpMap: textures.leatherBump,
      bumpScale: 0.018,
      roughness: 0.7,
      metalness: 0.06
    })

    const pageEdgeMat = new THREE.MeshStandardMaterial({
      map: textures.pageEdge,
      roughness: 0.76,
      metalness: 0.1
    })

    const parchmentLeftMat = new THREE.MeshStandardMaterial({
      map: textures.parchmentLeft,
      roughness: 0.88,
      metalness: 0.02
    })

    const parchmentRightMat = new THREE.MeshStandardMaterial({
      map: textures.parchmentRight,
      roughness: 0.88,
      metalness: 0.02
    })

    const centerpiece = new THREE.Group()
    scene.add(centerpiece)

    // =========================================================================
    // 1. SCULPTURAL BRASS ARMILLARY SPHERE (COMPACT PROPORTIONS)
    // =========================================================================
    const armillaryGroup = new THREE.Group()
    centerpiece.add(armillaryGroup)

    // Outer Meridian Ring (radius 1.62)
    const outerMeridianGroup = new THREE.Group()
    outerMeridianGroup.add(
      new THREE.Mesh(new THREE.TorusGeometry(1.62, 0.036, 22, 120), brushedBrassMat),
      new THREE.Mesh(new THREE.TorusGeometry(1.56, 0.014, 12, 120), darkBronzeMat)
    )

    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2
      const bracket = new THREE.Group()
      bracket.position.set(Math.cos(angle) * 1.62, Math.sin(angle) * 1.62, 0)
      bracket.rotation.z = angle
      const collar = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.085, 0.1), darkBronzeMat)
      const stud = new THREE.Mesh(new THREE.SphereGeometry(0.038, 14, 14), polishedGoldMat)
      stud.position.x = 0.055
      bracket.add(collar, stud)
      outerMeridianGroup.add(bracket)
    }

    const polarAxis = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, 3.45, 14),
      darkBronzeMat
    )
    const northFinial = new THREE.Mesh(new THREE.OctahedronGeometry(0.075, 0), polishedGoldMat)
    northFinial.position.y = 1.82
    northFinial.scale.set(0.7, 1.5, 0.7)
    const southFinial = northFinial.clone()
    southFinial.position.y = -1.82
    outerMeridianGroup.add(polarAxis, northFinial, southFinial)
    armillaryGroup.add(outerMeridianGroup)

    // Engraved Ecliptic Zodiac Band (radius 1.38)
    const eclipticGroup = new THREE.Group()
    eclipticGroup.rotation.z = THREE.MathUtils.degToRad(23.4)
    const eclipticBand = new THREE.Mesh(
      new THREE.CylinderGeometry(1.38, 1.38, 0.2, 96, 1, true),
      engravedBrassBandMat
    )
    const eclipticTopRim = new THREE.Mesh(
      new THREE.TorusGeometry(1.38, 0.016, 14, 110),
      polishedGoldMat
    )
    eclipticTopRim.rotation.x = Math.PI / 2
    eclipticTopRim.position.y = 0.1
    const eclipticBotRim = eclipticTopRim.clone()
    eclipticBotRim.position.y = -0.1
    eclipticGroup.add(eclipticBand, eclipticTopRim, eclipticBotRim)
    armillaryGroup.add(eclipticGroup)

    // Equatorial Ring (radius 1.24)
    const equatorialGroup = new THREE.Group()
    const equatorialRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.24, 0.024, 18, 110),
      brushedBrassMat
    )
    equatorialRing.rotation.x = Math.PI / 2
    equatorialGroup.add(equatorialRing)
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      const pin = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 12), polishedGoldMat)
      pin.position.set(Math.cos(a) * 1.24, 0, Math.sin(a) * 1.24)
      equatorialGroup.add(pin)
    }
    armillaryGroup.add(equatorialGroup)

    // Inner Solstitial Colure (radius 1.04)
    const innerColureGroup = new THREE.Group()
    const innerColure = new THREE.Mesh(
      new THREE.TorusGeometry(1.04, 0.017, 14, 96),
      brushedBrassMat
    )
    innerColure.rotation.y = Math.PI / 2
    innerColureGroup.add(innerColure)
    armillaryGroup.add(innerColureGroup)

    // Delicate Outer Horizon Astrolabe Hairline (radius 1.84)
    const horizonGroup = new THREE.Group()
    const horizonRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.84, 0.011, 12, 128),
      polishedGoldMat
    )
    horizonRing.rotation.x = Math.PI / 2 + 0.18
    horizonGroup.add(horizonRing)
    armillaryGroup.add(horizonGroup)

    // =========================================================================
    // 2. HINGED LEATHER-BOUND ILLUMINATED FOLIO (CLEAN FLUSH BINDING)
    // =========================================================================
    const folioRoot = new THREE.Group()
    centerpiece.add(folioRoot)

    const bookW = 0.86
    const bookH = 1.18
    const coverT = 0.028
    const pageBlockT = 0.056
    const spineHalfSpan = pageBlockT + coverT * 0.5

    // Sculpted wrap-around leather spine covering the back seam completely
    const spineGroup = new THREE.Group()
    const spinePlate = new THREE.Mesh(
      new THREE.CylinderGeometry(
        spineHalfSpan + 0.018,
        spineHalfSpan + 0.018,
        bookH + 0.012,
        24,
        1,
        false,
        Math.PI * 0.5,
        Math.PI
      ),
      plainLeatherMat
    )
    spinePlate.position.set(0, 0, -0.008)
    spineGroup.add(spinePlate)

    // 5 raised gilded binding ribs around the spine
    for (let i = -2; i <= 2; i++) {
      const rib = new THREE.Mesh(
        new THREE.TorusGeometry(spineHalfSpan + 0.022, 0.009, 10, 24, Math.PI),
        polishedGoldMat
      )
      rib.rotation.x = Math.PI / 2
      rib.position.set(0, i * 0.21, -0.008)
      spineGroup.add(rib)
    }
    folioRoot.add(spineGroup)

    const buildCornerClasps = (xSign: number): THREE.Group => {
      const group = new THREE.Group()
      const claspGeo = new THREE.BoxGeometry(0.085, 0.085, coverT + 0.01)
      const positions: Array<[number, number]> = [
        [xSign * (bookW - 0.036), bookH / 2 - 0.036],
        [xSign * (bookW - 0.036), -bookH / 2 + 0.036]
      ]
      for (const [cx, cy] of positions) {
        const clasp = new THREE.Mesh(claspGeo, polishedGoldMat)
        clasp.position.set(cx, cy, -coverT / 2)
        group.add(clasp)
      }
      return group
    }

    // LEFT HINGE (pivots from x = -spineHalfSpan when closed, converges smoothly when open)
    const leftHinge = new THREE.Group()
    folioRoot.add(leftHinge)

    const leftBoard = new THREE.Mesh(
      new THREE.BoxGeometry(bookW, bookH, coverT),
      [plainLeatherMat, plainLeatherMat, plainLeatherMat, plainLeatherMat, plainLeatherMat, leatherMat]
    )
    leftBoard.position.set(-bookW / 2, 0, -coverT / 2)
    leftHinge.add(leftBoard)
    leftHinge.add(buildCornerClasps(-1))

    // Recessed page block tucked cleanly inside the leather cover (no white spine seam!)
    const leftPageBlock = new THREE.Mesh(
      new THREE.BoxGeometry(bookW - 0.06, bookH - 0.075, pageBlockT),
      pageEdgeMat
    )
    leftPageBlock.position.set(-bookW / 2 + 0.018, 0, pageBlockT / 2)
    leftHinge.add(leftPageBlock)

    const leftParchmentLeaf = new THREE.Mesh(
      new THREE.PlaneGeometry(bookW - 0.072, bookH - 0.088),
      parchmentLeftMat
    )
    leftParchmentLeaf.position.set(-bookW / 2 + 0.018, 0, pageBlockT + 0.003)
    leftHinge.add(leftParchmentLeaf)

    // RIGHT HINGE
    const rightHinge = new THREE.Group()
    folioRoot.add(rightHinge)

    const rightBoard = new THREE.Mesh(
      new THREE.BoxGeometry(bookW, bookH, coverT),
      [plainLeatherMat, plainLeatherMat, plainLeatherMat, plainLeatherMat, plainLeatherMat, leatherMat]
    )
    rightBoard.position.set(bookW / 2, 0, -coverT / 2)
    rightHinge.add(rightBoard)
    rightHinge.add(buildCornerClasps(1))

    const rightPageBlock = new THREE.Mesh(
      new THREE.BoxGeometry(bookW - 0.06, bookH - 0.075, pageBlockT),
      pageEdgeMat
    )
    rightPageBlock.position.set(bookW / 2 - 0.018, 0, pageBlockT / 2)
    rightHinge.add(rightPageBlock)

    const rightParchmentLeaf = new THREE.Mesh(
      new THREE.PlaneGeometry(bookW - 0.072, bookH - 0.088),
      parchmentRightMat
    )
    rightParchmentLeaf.position.set(bookW / 2 - 0.018, 0, pageBlockT + 0.003)
    rightHinge.add(rightParchmentLeaf)

    // =========================================================================
    // 3. SUBTLE GOLDEN LIBRARY DUST MOTES
    // =========================================================================
    const moteCount = isSoftwareGl ? 36 : 95
    const motePositions = new Float32Array(moteCount * 3)
    const moteSpeeds = new Float32Array(moteCount)
    for (let i = 0; i < moteCount; i++) {
      const r = 1.4 + Math.random() * 4.8
      const theta = Math.random() * Math.PI * 2
      const y = (Math.random() - 0.5) * 5.8
      motePositions[i * 3] = Math.cos(theta) * r
      motePositions[i * 3 + 1] = y
      motePositions[i * 3 + 2] = Math.sin(theta) * r - 0.8
      moteSpeeds[i] = 0.06 + Math.random() * 0.14
    }
    const moteGeometry = new THREE.BufferGeometry()
    moteGeometry.setAttribute('position', new THREE.BufferAttribute(motePositions, 3))
    const moteMaterial = new THREE.PointsMaterial({
      size: 0.065,
      map: textures.dustMote,
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
    const motes = new THREE.Points(moteGeometry, moteMaterial)
    scene.add(motes)

    const pointerTarget = { x: 0, y: 0 }
    const pointerCurrent = { x: 0, y: 0 }

    const onPointerMove = (e: PointerEvent): void => {
      if (reducedMotion) return
      pointerTarget.x = (e.clientX / Math.max(1, window.innerWidth) - 0.5) * 2
      pointerTarget.y = (e.clientY / Math.max(1, window.innerHeight) - 0.5) * 2
    }
    window.addEventListener('pointermove', onPointerMove, { passive: true })

    let viewportW = window.innerWidth
    let viewportH = Math.max(1, window.innerHeight)
    const onResize = (): void => {
      viewportW = window.innerWidth
      viewportH = Math.max(1, window.innerHeight)
      camera.aspect = viewportW / viewportH
      camera.updateProjectionMatrix()
      renderer.setSize(viewportW, viewportH)
      renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2))
    }
    window.addEventListener('resize', onResize)

    const onContextLost = (event: Event): void => {
      event.preventDefault()
      setWebglFailed(true)
    }
    const onContextRestored = (): void => {
      setWebglFailed(false)
    }
    canvas.addEventListener('webglcontextlost', onContextLost)
    canvas.addEventListener('webglcontextrestored', onContextRestored)

    const initial = sampleChoreography(scrollProgressRef.current, viewportW, viewportH)
    const state = { ...initial }
    const clock = new THREE.Clock()
    let rafId = 0
    let disposed = false

    const animate = (): void => {
      if (disposed) return
      rafId = window.requestAnimationFrame(animate)

      const dt = Math.min(0.05, clock.getDelta())
      const elapsed = clock.getElapsedTime()
      const target = sampleChoreography(scrollProgressRef.current, viewportW, viewportH)

      const damp = reducedMotion ? 1 : 1 - Math.exp(-5.0 * dt)
      state.camX = lerp(state.camX, target.camX, damp)
      state.camY = lerp(state.camY, target.camY, damp)
      state.camZ = lerp(state.camZ, target.camZ, damp)
      state.lookX = lerp(state.lookX, target.lookX, damp)
      state.lookY = lerp(state.lookY, target.lookY, damp)
      state.rigX = lerp(state.rigX, target.rigX, damp)
      state.rigY = lerp(state.rigY, target.rigY, damp)
      state.rigScale = lerp(state.rigScale, target.rigScale, damp)
      state.rigRotX = lerp(state.rigRotX, target.rigRotX, damp)
      state.rigRotY = lerp(state.rigRotY, target.rigRotY, damp)
      state.ringSpread = lerp(state.ringSpread, target.ringSpread, damp)
      state.folioOpen = lerp(state.folioOpen, target.folioOpen, damp)
      state.folioZ = lerp(state.folioZ, target.folioZ, damp)
      state.folioTiltX = lerp(state.folioTiltX, target.folioTiltX, damp)
      state.folioScale = lerp(state.folioScale, target.folioScale, damp)

      // Smoothly transition studio lighting colors when mood changes
      const targetMood = MOOD_LIGHTS[moodRef.current]
      const lightDamp = reducedMotion ? 1 : 1 - Math.exp(-3.5 * dt)
      keyLight.color.lerp(targetMood.key, lightDamp)
      rimLight.color.lerp(targetMood.rim, lightDamp)
      hearthLight.color.lerp(targetMood.hearth, lightDamp)
      keyLight.intensity = lerp(keyLight.intensity, targetMood.keyInt, lightDamp)
      rimLight.intensity = lerp(rimLight.intensity, targetMood.rimInt, lightDamp)

      const pDamp = 1 - Math.exp(-3.0 * dt)
      pointerCurrent.x = lerp(pointerCurrent.x, pointerTarget.x, pDamp)
      pointerCurrent.y = lerp(pointerCurrent.y, pointerTarget.y, pDamp)

      camera.position.set(
        state.camX + pointerCurrent.x * 0.16,
        state.camY - pointerCurrent.y * 0.12,
        state.camZ
      )
      camera.lookAt(state.lookX, state.lookY, 0)

      const floatY = reducedMotion ? 0 : Math.sin(elapsed * 0.8) * 0.055
      centerpiece.position.set(state.rigX, state.rigY + floatY, 0)
      centerpiece.scale.setScalar(state.rigScale)

      const idleSpin = reducedMotion ? 0 : elapsed
      armillaryGroup.rotation.set(
        state.rigRotX + pointerCurrent.y * 0.06,
        state.rigRotY + pointerCurrent.x * 0.09 + idleSpin * 0.075,
        0
      )

      // Subtle, restrained spread so rings never bleed across text
      const spreadScale = 1 + state.ringSpread * 0.08
      armillaryGroup.scale.setScalar(spreadScale)
      armillaryGroup.position.z = -state.ringSpread * 0.45

      eclipticGroup.rotation.y = idleSpin * 0.16 + state.ringSpread * 0.72
      equatorialGroup.rotation.y = -idleSpin * 0.11
      equatorialGroup.rotation.z = state.ringSpread * 0.36
      innerColureGroup.rotation.y = idleSpin * 0.22 + state.ringSpread * 0.9
      innerColureGroup.rotation.x = state.ringSpread * 0.28
      horizonGroup.rotation.y = -idleSpin * 0.055
      horizonGroup.scale.setScalar(1 + state.ringSpread * 0.06)

      // Hinged Leather Folio: closes cleanly with flush spine, opens gracefully in Chapter III
      const openT = smoothstep01(state.folioOpen)
      const hingeAngle = lerp(Math.PI * 0.5, 0.22, openT)
      const hingeOffset = lerp(spineHalfSpan, 0.01, openT)
      leftHinge.position.set(-hingeOffset, 0, 0)
      rightHinge.position.set(hingeOffset, 0, 0)
      leftHinge.rotation.y = hingeAngle
      rightHinge.rotation.y = -hingeAngle
      // Hide parchment leaves slightly while fully closed so zero inner edge ever flickers through
      leftParchmentLeaf.visible = openT > 0.03
      rightParchmentLeaf.visible = openT > 0.03

      const closedYaw = -0.82 + (reducedMotion ? 0 : Math.sin(elapsed * 0.52) * 0.12)
      const openYaw = -0.18 + pointerCurrent.x * 0.08
      folioRoot.rotation.set(
        state.folioTiltX + pointerCurrent.y * 0.04,
        lerp(closedYaw, openYaw, openT),
        lerp(-0.06, 0.0, openT)
      )
      folioRoot.position.set(0, 0, state.folioZ)
      folioRoot.scale.setScalar(state.folioScale)

      if (!reducedMotion) {
        const posAttr = moteGeometry.getAttribute('position') as THREE.BufferAttribute
        const arr = posAttr.array as Float32Array
        for (let i = 0; i < moteCount; i++) {
          arr[i * 3 + 1] += moteSpeeds[i] * dt
          if (arr[i * 3 + 1] > 3.0) arr[i * 3 + 1] = -3.0
        }
        posAttr.needsUpdate = true
        motes.rotation.y = elapsed * 0.02
      }

      renderer.render(scene, camera)
    }

    animate()

    return () => {
      disposed = true
      window.cancelAnimationFrame(rafId)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('resize', onResize)
      canvas.removeEventListener('webglcontextlost', onContextLost)
      canvas.removeEventListener('webglcontextrestored', onContextRestored)

      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Points) {
          obj.geometry.dispose()
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose())
          } else {
            obj.material.dispose()
          }
        }
      })
      textures.dispose()
      envTarget.dispose()
      pmrem.dispose()
      renderer.dispose()
      if (canvas.parentElement === container) {
        container.removeChild(canvas)
      }
    }
  }, [reducedMotion, scrollProgressRef])

  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden="true"
    >
      <div ref={mountRef} className="h-full w-full" />
      <div className="stage-vignette absolute inset-0" />

      {webglFailed ? (
        <div className="absolute inset-0 flex items-center justify-end pr-8 opacity-45 md:pr-24">
          <svg
            viewBox="0 0 420 420"
            className="h-[260px] w-[260px] md:h-[360px] md:w-[360px]"
            fill="none"
          >
            <circle cx="210" cy="210" r="154" stroke="#b08d57" strokeWidth="1.5" />
            <ellipse
              cx="210"
              cy="210"
              rx="154"
              ry="52"
              stroke="#b08d57"
              strokeOpacity="0.7"
              strokeWidth="1.3"
              transform="rotate(-23 210 210)"
            />
            <rect
              x="170"
              y="152"
              width="80"
              height="116"
              rx="3"
              fill="#1b110f"
              stroke="#d2ae76"
              strokeWidth="1.3"
            />
          </svg>
        </div>
      ) : null}
    </div>
  )
}
