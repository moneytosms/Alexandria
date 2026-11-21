import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { createProceduralTextureBundle } from './proceduralTextures'

export interface ArmillaryStageProps {
  scrollProgressRef: React.MutableRefObject<number>
  reducedMotion: boolean
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
  rigRotX: number
  rigRotY: number
  ringSpread: number
  folioOpen: number
  folioZ: number
  folioTiltX: number
  folioScale: number
}

// 5-Chapter editorial choreography keyed to normalized scroll progress (0 -> 1)
const KEYFRAMES: KeyframePose[] = [
  // Ch I — Hero: poised center-right, closed folio framed by celestial meridian
  {
    stop: 0.0,
    camX: 0.0,
    camY: 0.25,
    camZ: 7.4,
    lookX: 0.0,
    lookY: 0.0,
    rigX: 1.55,
    rigY: 0.05,
    rigRotX: 0.22,
    rigRotY: -0.35,
    ringSpread: 0.0,
    folioOpen: 0.0,
    folioZ: 0.0,
    folioTiltX: 0.14,
    folioScale: 0.96
  },
  // Ch II — Grand Hall: glides leftward as outer brass rings open like a dome
  {
    stop: 0.25,
    camX: -0.35,
    camY: 0.55,
    camZ: 6.7,
    lookX: -0.15,
    lookY: 0.05,
    rigX: -1.55,
    rigY: 0.08,
    rigRotX: 0.34,
    rigRotY: 0.95,
    ringSpread: 0.52,
    folioOpen: 0.06,
    folioZ: 0.12,
    folioTiltX: 0.18,
    folioScale: 0.94
  },
  // Ch III — Precision Reader: intimate close-up, hinged leather folio opens smoothly
  {
    stop: 0.52,
    camX: 0.15,
    camY: 0.15,
    camZ: 5.55,
    lookX: 0.12,
    lookY: 0.0,
    rigX: 1.32,
    rigY: -0.05,
    rigRotX: 0.12,
    rigRotY: 0.16,
    ringSpread: 1.0,
    folioOpen: 1.0,
    folioZ: 0.85,
    folioTiltX: -0.16,
    folioScale: 1.24
  },
  // Ch IV — Local-First Architecture: elevated astronomical schematic alignment
  {
    stop: 0.77,
    camX: -0.1,
    camY: 2.35,
    camZ: 6.35,
    lookX: -0.25,
    lookY: -0.12,
    rigX: -1.45,
    rigY: -0.1,
    rigRotX: 0.88,
    rigRotY: 1.85,
    ringSpread: 0.24,
    folioOpen: 0.38,
    folioZ: 0.15,
    folioTiltX: 0.28,
    folioScale: 0.95
  },
  // Ch V — Cross-Platform Downloads: centered luminous brass emblem receding cleanly
  {
    stop: 1.0,
    camX: 0.0,
    camY: 0.2,
    camZ: 8.6,
    lookX: 0.0,
    lookY: 0.0,
    rigX: 0.0,
    rigY: 0.2,
    rigRotX: 0.18,
    rigRotY: 2.65,
    ringSpread: 0.42,
    folioOpen: 0.0,
    folioZ: -0.4,
    folioTiltX: 0.12,
    folioScale: 0.86
  }
]

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function smoothstep01(t: number): number {
  const c = Math.max(0, Math.min(1, t))
  return c * c * (3 - 2 * c)
}

function sampleChoreography(progress: number, isNarrow: boolean): KeyframePose {
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

  const rigXScale = isNarrow ? 0.0 : 1.0
  const camZOffset = isNarrow ? 1.85 : 0.0

  return {
    stop: p,
    camX: lerp(lo.camX, hi.camX, t) * rigXScale,
    camY: lerp(lo.camY, hi.camY, t),
    camZ: lerp(lo.camZ, hi.camZ, t) + camZOffset,
    lookX: lerp(lo.lookX, hi.lookX, t) * rigXScale,
    lookY: lerp(lo.lookY, hi.lookY, t),
    rigX: lerp(lo.rigX, hi.rigX, t) * rigXScale,
    rigY: lerp(lo.rigY, hi.rigY, t) + (isNarrow ? 0.2 : 0),
    rigRotX: lerp(lo.rigRotX, hi.rigRotX, t),
    rigRotY: lerp(lo.rigRotY, hi.rigRotY, t),
    ringSpread: lerp(lo.ringSpread, hi.ringSpread, t),
    folioOpen: lerp(lo.folioOpen, hi.folioOpen, t),
    folioZ: lerp(lo.folioZ, hi.folioZ, t),
    folioTiltX: lerp(lo.folioTiltX, hi.folioTiltX, t),
    folioScale: lerp(lo.folioScale, hi.folioScale, t) * (isNarrow ? 0.88 : 1.0)
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

export function ArmillaryFolioStage({ scrollProgressRef, reducedMotion }: ArmillaryStageProps) {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const [webglFailed, setWebglFailed] = useState(false)

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
    renderer.toneMappingExposure = 1.15
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.setClearColor(0x090807, 0)

    const canvas = renderer.domElement
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    canvas.style.display = 'block'
    container.appendChild(canvas)

    const scene = new THREE.Scene()
    scene.fog = new THREE.FogExp2(0x090807, 0.052)

    const camera = new THREE.PerspectiveCamera(
      38,
      window.innerWidth / Math.max(1, window.innerHeight),
      0.1,
      60
    )

    // Studio PMREM reflections for brushed brass
    const pmrem = new THREE.PMREMGenerator(renderer)
    const envTarget = pmrem.fromScene(new RoomEnvironment(), 0.04)
    scene.environment = envTarget.texture
    scene.environmentIntensity = 0.72

    // Warm 3-point museum studio lighting
    const keyLight = new THREE.DirectionalLight(0xffe1ac, 2.35)
    keyLight.position.set(5.5, 6.5, 5.0)
    scene.add(keyLight)

    const rimLight = new THREE.DirectionalLight(0x88a8d8, 1.15)
    rimLight.position.set(-6.0, 2.8, -4.5)
    scene.add(rimLight)

    const hearthLight = new THREE.PointLight(0xd99b44, 2.4, 14, 1.6)
    hearthLight.position.set(0.4, -3.2, 2.2)
    scene.add(hearthLight)

    const ambient = new THREE.AmbientLight(0x3a2e22, 0.55)
    scene.add(ambient)

    const textures = createProceduralTextureBundle()

    // Shared PBR materials
    const brushedBrassMat = new THREE.MeshPhysicalMaterial({
      color: 0xd9b56c,
      metalness: 0.9,
      roughness: 0.25,
      clearcoat: 0.28,
      clearcoatRoughness: 0.22,
      bumpMap: textures.brassBump,
      bumpScale: 0.015
    })

    const engravedBrassBandMat = new THREE.MeshPhysicalMaterial({
      map: textures.brassEngraving,
      bumpMap: textures.brassBump,
      bumpScale: 0.025,
      metalness: 0.88,
      roughness: 0.27,
      clearcoat: 0.2,
      side: THREE.DoubleSide
    })

    const darkBronzeMat = new THREE.MeshStandardMaterial({
      color: 0x5c4627,
      metalness: 0.84,
      roughness: 0.38
    })

    const polishedGoldMat = new THREE.MeshPhysicalMaterial({
      color: 0xebc980,
      metalness: 0.94,
      roughness: 0.16,
      clearcoat: 0.35
    })

    const leatherMat = new THREE.MeshStandardMaterial({
      map: textures.leatherCover,
      bumpMap: textures.leatherBump,
      bumpScale: 0.02,
      roughness: 0.64,
      metalness: 0.08
    })

    const plainLeatherMat = new THREE.MeshStandardMaterial({
      color: 0x22100f,
      bumpMap: textures.leatherBump,
      bumpScale: 0.018,
      roughness: 0.68,
      metalness: 0.06
    })

    const pageEdgeMat = new THREE.MeshStandardMaterial({
      map: textures.pageEdge,
      roughness: 0.72,
      metalness: 0.12
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

    // Master centerpiece root
    const centerpiece = new THREE.Group()
    scene.add(centerpiece)

    // =========================================================================
    // 1. MULTI-PART PROCEDURAL BRASS CELESTIAL ARMILLARY SPHERE
    // =========================================================================
    const armillaryGroup = new THREE.Group()
    centerpiece.add(armillaryGroup)

    // Ring A: Outer Meridian Ring with riveted cardinal brackets
    const outerMeridianGroup = new THREE.Group()
    const outerMeridian = new THREE.Mesh(
      new THREE.TorusGeometry(2.38, 0.052, 24, 128),
      brushedBrassMat
    )
    outerMeridianGroup.add(outerMeridian)

    // Inner bevel track along outer meridian
    const outerTrack = new THREE.Mesh(
      new THREE.TorusGeometry(2.31, 0.018, 12, 128),
      darkBronzeMat
    )
    outerMeridianGroup.add(outerTrack)

    // 4 Cardinal riveted finial brackets
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2
      const bracket = new THREE.Group()
      bracket.position.set(Math.cos(angle) * 2.38, Math.sin(angle) * 2.38, 0)
      bracket.rotation.z = angle
      const collar = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.14), darkBronzeMat)
      const stud = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 16), polishedGoldMat)
      stud.position.x = 0.08
      bracket.add(collar, stud)
      outerMeridianGroup.add(bracket)
    }

    // Polar axis spindle with top & bottom finials
    const polarAxis = new THREE.Mesh(
      new THREE.CylinderGeometry(0.016, 0.016, 4.95, 16),
      darkBronzeMat
    )
    const northFinial = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), polishedGoldMat)
    northFinial.position.y = 2.6
    northFinial.scale.set(0.7, 1.5, 0.7)
    const southFinial = northFinial.clone()
    southFinial.position.y = -2.6
    outerMeridianGroup.add(polarAxis, northFinial, southFinial)
    armillaryGroup.add(outerMeridianGroup)

    // Ring B: Engraved Ecliptic Zodiac Band (wide cylindrical band + gold rims)
    const eclipticGroup = new THREE.Group()
    eclipticGroup.rotation.z = THREE.MathUtils.degToRad(23.4)
    const eclipticBand = new THREE.Mesh(
      new THREE.CylinderGeometry(2.04, 2.04, 0.28, 96, 1, true),
      engravedBrassBandMat
    )
    const eclipticTopRim = new THREE.Mesh(
      new THREE.TorusGeometry(2.04, 0.022, 14, 120),
      polishedGoldMat
    )
    eclipticTopRim.rotation.x = Math.PI / 2
    eclipticTopRim.position.y = 0.14
    const eclipticBotRim = eclipticTopRim.clone()
    eclipticBotRim.position.y = -0.14
    eclipticGroup.add(eclipticBand, eclipticTopRim, eclipticBotRim)
    armillaryGroup.add(eclipticGroup)

    // Ring C: Equatorial Ring with 12 hour-stud markers
    const equatorialGroup = new THREE.Group()
    const equatorialRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.86, 0.036, 20, 120),
      brushedBrassMat
    )
    equatorialRing.rotation.x = Math.PI / 2
    equatorialGroup.add(equatorialRing)
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      const pin = new THREE.Mesh(new THREE.SphereGeometry(0.032, 12, 12), polishedGoldMat)
      pin.position.set(Math.cos(a) * 1.86, 0, Math.sin(a) * 1.86)
      equatorialGroup.add(pin)
    }
    armillaryGroup.add(equatorialGroup)

    // Ring D: Inner Solstitial Colure
    const innerColureGroup = new THREE.Group()
    const innerColure = new THREE.Mesh(
      new THREE.TorusGeometry(1.56, 0.024, 16, 96),
      brushedBrassMat
    )
    innerColure.rotation.y = Math.PI / 2
    innerColureGroup.add(innerColure)
    armillaryGroup.add(innerColureGroup)

    // Ring E: Outer Floating Horizon Hairline Ring
    const horizonGroup = new THREE.Group()
    const horizonRing = new THREE.Mesh(
      new THREE.TorusGeometry(2.74, 0.016, 12, 140),
      polishedGoldMat
    )
    horizonRing.rotation.x = Math.PI / 2 + 0.18
    horizonGroup.add(horizonRing)
    armillaryGroup.add(horizonGroup)

    // =========================================================================
    // 2. HINGED LEATHER-BOUND ILLUMINATED FOLIO (OPENS ON SCROLL IN CH III)
    // =========================================================================
    const folioRoot = new THREE.Group()
    centerpiece.add(folioRoot)

    const bookW = 1.08
    const bookH = 1.46
    const coverT = 0.034
    const pageBlockT = 0.088
    const spineRadius = 0.125

    // Sculpted leather spine with 5 raised binding ribs
    const spineGroup = new THREE.Group()
    const spineShell = new THREE.Mesh(
      new THREE.CylinderGeometry(spineRadius, spineRadius, bookH + 0.02, 24, 1, false, -Math.PI * 0.5, Math.PI),
      plainLeatherMat
    )
    spineShell.rotation.y = Math.PI
    spineShell.position.z = -0.02
    spineGroup.add(spineShell)

    for (let i = -2; i <= 2; i++) {
      const rib = new THREE.Mesh(
        new THREE.TorusGeometry(spineRadius + 0.008, 0.012, 10, 28, Math.PI),
        polishedGoldMat
      )
      rib.rotation.x = Math.PI / 2
      rib.rotation.z = Math.PI
      rib.position.set(0, i * 0.25, -0.02)
      spineGroup.add(rib)
    }
    folioRoot.add(spineGroup)

    // Helper for 4 beveled brass corner clasps on a cover board
    const buildCornerClasps = (xSign: number): THREE.Group => {
      const group = new THREE.Group()
      const claspGeo = new THREE.BoxGeometry(0.11, 0.11, coverT + 0.012)
      const positions: Array<[number, number]> = [
        [xSign * (bookW - 0.045), bookH / 2 - 0.045],
        [xSign * (bookW - 0.045), -bookH / 2 + 0.045]
      ]
      for (const [cx, cy] of positions) {
        const clasp = new THREE.Mesh(claspGeo, polishedGoldMat)
        clasp.position.set(cx, cy, 0)
        group.add(clasp)
      }
      return group
    }

    // LEFT COVER + LEFT PAGE BLOCK (hinged at spine x = -0.015)
    const leftHinge = new THREE.Group()
    leftHinge.position.set(-0.015, 0, 0)
    folioRoot.add(leftHinge)

    const leftBoard = new THREE.Mesh(
      new THREE.BoxGeometry(bookW, bookH, coverT),
      [plainLeatherMat, plainLeatherMat, plainLeatherMat, plainLeatherMat, plainLeatherMat, leatherMat]
    )
    leftBoard.position.set(-bookW / 2, 0, -coverT / 2)
    leftHinge.add(leftBoard)
    leftHinge.add(buildCornerClasps(-1))

    const leftPageBlock = new THREE.Mesh(
      new THREE.BoxGeometry(bookW - 0.06, bookH - 0.08, pageBlockT),
      pageEdgeMat
    )
    leftPageBlock.position.set(-bookW / 2 + 0.02, 0, pageBlockT / 2 + 0.002)
    leftHinge.add(leftPageBlock)

    const leftParchmentLeaf = new THREE.Mesh(
      new THREE.PlaneGeometry(bookW - 0.075, bookH - 0.095),
      parchmentLeftMat
    )
    leftParchmentLeaf.position.set(-bookW / 2 + 0.02, 0, pageBlockT + 0.006)
    leftHinge.add(leftParchmentLeaf)

    // RIGHT COVER + RIGHT PAGE BLOCK (hinged at spine x = +0.015)
    const rightHinge = new THREE.Group()
    rightHinge.position.set(0.015, 0, 0)
    folioRoot.add(rightHinge)

    const rightBoard = new THREE.Mesh(
      new THREE.BoxGeometry(bookW, bookH, coverT),
      [plainLeatherMat, plainLeatherMat, plainLeatherMat, plainLeatherMat, plainLeatherMat, leatherMat]
    )
    rightBoard.position.set(bookW / 2, 0, -coverT / 2)
    rightHinge.add(rightBoard)
    rightHinge.add(buildCornerClasps(1))

    const rightPageBlock = new THREE.Mesh(
      new THREE.BoxGeometry(bookW - 0.06, bookH - 0.08, pageBlockT),
      pageEdgeMat
    )
    rightPageBlock.position.set(bookW / 2 - 0.02, 0, pageBlockT / 2 + 0.002)
    rightHinge.add(rightPageBlock)

    const rightParchmentLeaf = new THREE.Mesh(
      new THREE.PlaneGeometry(bookW - 0.075, bookH - 0.095),
      parchmentRightMat
    )
    rightParchmentLeaf.position.set(bookW / 2 - 0.02, 0, pageBlockT + 0.006)
    rightHinge.add(rightParchmentLeaf)

    // =========================================================================
    // 3. FLOATING GOLDEN LIBRARY DUST MOTES
    // =========================================================================
    const moteCount = isSoftwareGl ? 45 : 130
    const motePositions = new Float32Array(moteCount * 3)
    const moteSpeeds = new Float32Array(moteCount)
    for (let i = 0; i < moteCount; i++) {
      const r = 1.6 + Math.random() * 4.4
      const theta = Math.random() * Math.PI * 2
      const y = (Math.random() - 0.5) * 6.2
      motePositions[i * 3] = Math.cos(theta) * r
      motePositions[i * 3 + 1] = y
      motePositions[i * 3 + 2] = Math.sin(theta) * r - 0.5
      moteSpeeds[i] = 0.08 + Math.random() * 0.18
    }
    const moteGeometry = new THREE.BufferGeometry()
    moteGeometry.setAttribute('position', new THREE.BufferAttribute(motePositions, 3))
    const moteMaterial = new THREE.PointsMaterial({
      size: 0.085,
      map: textures.dustMote,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
    const motes = new THREE.Points(moteGeometry, moteMaterial)
    scene.add(motes)

    // Pointer parallax state
    const pointerTarget = { x: 0, y: 0 }
    const pointerCurrent = { x: 0, y: 0 }

    const onPointerMove = (e: PointerEvent): void => {
      if (reducedMotion) return
      pointerTarget.x = (e.clientX / Math.max(1, window.innerWidth) - 0.5) * 2
      pointerTarget.y = (e.clientY / Math.max(1, window.innerHeight) - 0.5) * 2
    }
    window.addEventListener('pointermove', onPointerMove, { passive: true })

    // Resize listener
    let isNarrow = window.innerWidth < 1024
    const onResize = (): void => {
      isNarrow = window.innerWidth < 1024
      const w = window.innerWidth
      const h = Math.max(1, window.innerHeight)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
      renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2))
    }
    window.addEventListener('resize', onResize)

    // WebGL context loss resilience
    const onContextLost = (event: Event): void => {
      event.preventDefault()
      setWebglFailed(true)
    }
    const onContextRestored = (): void => {
      setWebglFailed(false)
    }
    canvas.addEventListener('webglcontextlost', onContextLost)
    canvas.addEventListener('webglcontextrestored', onContextRestored)

    // Smoothly damped runtime state
    const initial = sampleChoreography(scrollProgressRef.current, isNarrow)
    const state = { ...initial }
    const clock = new THREE.Clock()
    let rafId = 0
    let disposed = false

    const animate = (): void => {
      if (disposed) return
      rafId = window.requestAnimationFrame(animate)

      const dt = Math.min(0.05, clock.getDelta())
      const elapsed = clock.getElapsedTime()
      const target = sampleChoreography(scrollProgressRef.current, isNarrow)

      const damp = reducedMotion ? 1 : 1 - Math.exp(-5.4 * dt)
      state.camX = lerp(state.camX, target.camX, damp)
      state.camY = lerp(state.camY, target.camY, damp)
      state.camZ = lerp(state.camZ, target.camZ, damp)
      state.lookX = lerp(state.lookX, target.lookX, damp)
      state.lookY = lerp(state.lookY, target.lookY, damp)
      state.rigX = lerp(state.rigX, target.rigX, damp)
      state.rigY = lerp(state.rigY, target.rigY, damp)
      state.rigRotX = lerp(state.rigRotX, target.rigRotX, damp)
      state.rigRotY = lerp(state.rigRotY, target.rigRotY, damp)
      state.ringSpread = lerp(state.ringSpread, target.ringSpread, damp)
      state.folioOpen = lerp(state.folioOpen, target.folioOpen, damp)
      state.folioZ = lerp(state.folioZ, target.folioZ, damp)
      state.folioTiltX = lerp(state.folioTiltX, target.folioTiltX, damp)
      state.folioScale = lerp(state.folioScale, target.folioScale, damp)

      const pDamp = 1 - Math.exp(-3.2 * dt)
      pointerCurrent.x = lerp(pointerCurrent.x, pointerTarget.x, pDamp)
      pointerCurrent.y = lerp(pointerCurrent.y, pointerTarget.y, pDamp)

      // Camera positioning with subtle pointer parallax
      camera.position.set(
        state.camX + pointerCurrent.x * 0.24,
        state.camY - pointerCurrent.y * 0.16,
        state.camZ
      )
      camera.lookAt(state.lookX, state.lookY, 0)

      // Centerpiece floating cadence
      const floatY = reducedMotion ? 0 : Math.sin(elapsed * 0.85) * 0.075
      centerpiece.position.set(state.rigX, state.rigY + floatY, 0)

      // Armillary rings choreography & continuous celestial rotation
      const idleSpin = reducedMotion ? 0 : elapsed
      armillaryGroup.rotation.set(
        state.rigRotX + pointerCurrent.y * 0.08,
        state.rigRotY + pointerCurrent.x * 0.12 + idleSpin * 0.08,
        0
      )

      const spreadScale = 1 + state.ringSpread * 0.28
      armillaryGroup.scale.setScalar(spreadScale)
      armillaryGroup.position.z = -state.ringSpread * 0.65

      eclipticGroup.rotation.y = idleSpin * 0.18 + state.ringSpread * 0.85
      equatorialGroup.rotation.y = -idleSpin * 0.12
      equatorialGroup.rotation.z = state.ringSpread * 0.45
      innerColureGroup.rotation.y = idleSpin * 0.25 + state.ringSpread * 1.1
      innerColureGroup.rotation.x = state.ringSpread * 0.35
      horizonGroup.rotation.y = -idleSpin * 0.06
      horizonGroup.scale.setScalar(1 + state.ringSpread * 0.14)

      // Hinged Leather Folio opening choreography
      // Closed: leftHinge.rotation.y = +PI/2 (faces left-outward), rightHinge = -PI/2 (faces right-outward)
      // Open (folioOpen = 1): covers swing open to +/- 0.26 rad (~150 deg spread) facing the viewer!
      const closedHalfAngle = Math.PI * 0.495
      const openHalfAngle = 0.24
      const hingeAngle = lerp(closedHalfAngle, openHalfAngle, state.folioOpen)
      leftHinge.rotation.y = hingeAngle
      rightHinge.rotation.y = -hingeAngle

      // When closed, angle the book gracefully so the gold-tooled cover catches the warm key light;
      // when open, orient the parchment spread squarely toward the viewer!
      const closedYaw = -0.78 + (reducedMotion ? 0 : Math.sin(elapsed * 0.55) * 0.14)
      const openYaw = -0.14 + pointerCurrent.x * 0.1
      folioRoot.rotation.set(
        state.folioTiltX + pointerCurrent.y * 0.05,
        lerp(closedYaw, openYaw, state.folioOpen),
        lerp(-0.08, 0.0, state.folioOpen)
      )
      folioRoot.position.set(0, 0, state.folioZ)
      folioRoot.scale.setScalar(state.folioScale)

      // Gentle upward drift of golden dust motes
      if (!reducedMotion) {
        const posAttr = moteGeometry.getAttribute('position') as THREE.BufferAttribute
        const arr = posAttr.array as Float32Array
        for (let i = 0; i < moteCount; i++) {
          arr[i * 3 + 1] += moteSpeeds[i] * dt
          if (arr[i * 3 + 1] > 3.2) {
            arr[i * 3 + 1] = -3.2
          }
        }
        posAttr.needsUpdate = true
        motes.rotation.y = elapsed * 0.025
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
            className="h-[340px] w-[340px] md:h-[480px] md:w-[480px]"
            fill="none"
          >
            <circle cx="210" cy="210" r="168" stroke="#C8A25B" strokeWidth="1.6" />
            <ellipse
              cx="210"
              cy="210"
              rx="168"
              ry="58"
              stroke="#C8A25B"
              strokeOpacity="0.7"
              strokeWidth="1.4"
              transform="rotate(-23 210 210)"
            />
            <ellipse
              cx="210"
              cy="210"
              rx="62"
              ry="168"
              stroke="#C8A25B"
              strokeOpacity="0.45"
              strokeWidth="1.2"
              transform="rotate(14 210 210)"
            />
            <rect
              x="166"
              y="148"
              width="88"
              height="124"
              rx="4"
              fill="#1E110F"
              stroke="#E3C27F"
              strokeWidth="1.4"
            />
            <line x1="210" y1="22" x2="210" y2="398" stroke="#8E7342" strokeWidth="1" />
          </svg>
        </div>
      ) : null}
    </div>
  )
}
