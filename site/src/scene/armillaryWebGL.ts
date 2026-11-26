import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import {
  lerp,
  sampleChoreography,
  smoothstep01,
  type HallMoodPreview
} from './choreography'
import { createProceduralTextureBundle } from './proceduralTextures'

export interface AcquiredWebGL2 {
  canvas: HTMLCanvasElement
  gl: WebGL2RenderingContext
  antialias: boolean
}

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

function detectSoftwareWebGL(gl: WebGLRenderingContext | WebGL2RenderingContext): boolean {
  try {
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER
    const gpu = String(gl.getParameter(param) || '')
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render|Mesa/i.test(gpu)
  } catch {
    return false
  }
}

export function mountArmillaryWebGL(
  container: HTMLDivElement,
  acquired: AcquiredWebGL2,
  scrollProgressRef: { current: number },
  moodRef: { current: HallMoodPreview },
  reducedMotion: boolean,
  onContextLostFallback: () => void
): () => void {
  const { canvas, gl } = acquired
  const isSoftwareGl = detectSoftwareWebGL(gl)

  const renderer = new THREE.WebGLRenderer({
    canvas,
    context: gl,
    antialias: !isSoftwareGl && acquired.antialias,
    alpha: true,
    powerPreference: isSoftwareGl ? 'default' : 'high-performance'
  })

  const maxDpr = isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2)
  renderer.setPixelRatio(maxDpr)
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.12
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.setClearColor(0x0c0a09, 0)

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

  const pmrem = new THREE.PMREMGenerator(renderer)
  const envTarget = pmrem.fromScene(new RoomEnvironment(), 0.04)
  scene.environment = envTarget.texture
  scene.environmentIntensity = 0.68

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
  const maxAniso = renderer.capabilities.getMaxAnisotropy()
  textures.brassEngraving.anisotropy = maxAniso
  textures.brassBump.anisotropy = maxAniso
  textures.leatherCover.anisotropy = maxAniso
  textures.leatherBump.anisotropy = maxAniso
  textures.parchmentLeft.anisotropy = maxAniso
  textures.parchmentRight.anisotropy = maxAniso

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

  // 1. Sculptural Brass Armillary Sphere
  const armillaryGroup = new THREE.Group()
  centerpiece.add(armillaryGroup)

  const outerMeridianGroup = new THREE.Group()
  outerMeridianGroup.add(
    new THREE.Mesh(new THREE.TorusGeometry(1.62, 0.036, 22, 120), brushedBrassMat),
    new THREE.Mesh(new THREE.TorusGeometry(1.56, 0.014, 12, 120), darkBronzeMat)
  )

  const collarGeo = new THREE.BoxGeometry(0.11, 0.085, 0.1)
  const studGeo = new THREE.SphereGeometry(0.038, 14, 14)
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2
    const bracket = new THREE.Group()
    bracket.position.set(Math.cos(angle) * 1.62, Math.sin(angle) * 1.62, 0)
    bracket.rotation.z = angle
    const collar = new THREE.Mesh(collarGeo, darkBronzeMat)
    const stud = new THREE.Mesh(studGeo, polishedGoldMat)
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

  const equatorialGroup = new THREE.Group()
  const equatorialRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.24, 0.024, 18, 110),
    brushedBrassMat
  )
  equatorialRing.rotation.x = Math.PI / 2
  equatorialGroup.add(equatorialRing)
  const pinGeo = new THREE.SphereGeometry(0.022, 12, 12)
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    const pin = new THREE.Mesh(pinGeo, polishedGoldMat)
    pin.position.set(Math.cos(a) * 1.24, 0, Math.sin(a) * 1.24)
    equatorialGroup.add(pin)
  }
  armillaryGroup.add(equatorialGroup)

  const innerColureGroup = new THREE.Group()
  const innerColure = new THREE.Mesh(
    new THREE.TorusGeometry(1.04, 0.017, 14, 96),
    brushedBrassMat
  )
  innerColure.rotation.y = Math.PI / 2
  innerColureGroup.add(innerColure)
  armillaryGroup.add(innerColureGroup)

  const horizonGroup = new THREE.Group()
  const horizonRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.84, 0.011, 12, 128),
    polishedGoldMat
  )
  horizonRing.rotation.x = Math.PI / 2 + 0.18
  horizonGroup.add(horizonRing)
  armillaryGroup.add(horizonGroup)

  // 2. Hinged Leather-Bound Illuminated Folio
  const folioRoot = new THREE.Group()
  centerpiece.add(folioRoot)

  const bookW = 0.86
  const bookH = 1.18
  const coverT = 0.028
  const pageBlockT = 0.056
  const spineHalfSpan = pageBlockT + coverT * 0.5

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

  const ribGeo = new THREE.TorusGeometry(spineHalfSpan + 0.022, 0.009, 10, 24, Math.PI)
  for (let i = -2; i <= 2; i++) {
    const rib = new THREE.Mesh(ribGeo, polishedGoldMat)
    rib.rotation.x = Math.PI / 2
    rib.position.set(0, i * 0.21, -0.008)
    spineGroup.add(rib)
  }
  folioRoot.add(spineGroup)

  const sharedClaspGeo = new THREE.BoxGeometry(0.085, 0.085, coverT + 0.01)
  const buildCornerClasps = (xSign: number): THREE.Group => {
    const group = new THREE.Group()
    const positions: Array<[number, number]> = [
      [xSign * (bookW - 0.036), bookH / 2 - 0.036],
      [xSign * (bookW - 0.036), -bookH / 2 + 0.036]
    ]
    for (const [cx, cy] of positions) {
      const clasp = new THREE.Mesh(sharedClaspGeo, polishedGoldMat)
      clasp.position.set(cx, cy, -coverT / 2)
      group.add(clasp)
    }
    return group
  }

  const boardGeo = new THREE.BoxGeometry(bookW, bookH, coverT)
  const pageBlockGeo = new THREE.BoxGeometry(bookW - 0.06, bookH - 0.075, pageBlockT)
  const leafGeo = new THREE.PlaneGeometry(bookW - 0.072, bookH - 0.088)
  const boardMats = [
    plainLeatherMat,
    plainLeatherMat,
    plainLeatherMat,
    plainLeatherMat,
    plainLeatherMat,
    leatherMat
  ]

  const leftHinge = new THREE.Group()
  folioRoot.add(leftHinge)
  const leftBoard = new THREE.Mesh(boardGeo, boardMats)
  leftBoard.position.set(-bookW / 2, 0, -coverT / 2)
  leftHinge.add(leftBoard, buildCornerClasps(-1))

  const leftPageBlock = new THREE.Mesh(pageBlockGeo, pageEdgeMat)
  leftPageBlock.position.set(-bookW / 2 + 0.018, 0, pageBlockT / 2)
  leftHinge.add(leftPageBlock)

  const leftParchmentLeaf = new THREE.Mesh(leafGeo, parchmentLeftMat)
  leftParchmentLeaf.position.set(-bookW / 2 + 0.018, 0, pageBlockT + 0.003)
  leftHinge.add(leftParchmentLeaf)

  const rightHinge = new THREE.Group()
  folioRoot.add(rightHinge)
  const rightBoard = new THREE.Mesh(boardGeo, boardMats)
  rightBoard.position.set(bookW / 2, 0, -coverT / 2)
  rightHinge.add(rightBoard, buildCornerClasps(1))

  const rightPageBlock = new THREE.Mesh(pageBlockGeo, pageEdgeMat)
  rightPageBlock.position.set(bookW / 2 - 0.018, 0, pageBlockT / 2)
  rightHinge.add(rightPageBlock)

  const rightParchmentLeaf = new THREE.Mesh(leafGeo, parchmentRightMat)
  rightParchmentLeaf.position.set(bookW / 2 - 0.018, 0, pageBlockT + 0.003)
  rightHinge.add(rightParchmentLeaf)

  // 3. Subtle Golden Library Dust Motes
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

  if (!isSoftwareGl) {
    renderer.compile(scene, camera)
  }

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
    onContextLostFallback()
  }
  canvas.addEventListener('webglcontextlost', onContextLost)

  const initial = sampleChoreography(scrollProgressRef.current, viewportW, viewportH)
  const state = { ...initial }
  let rafId = 0
  let timeoutId = 0
  let disposed = false
  let lastNow = performance.now()
  let elapsed = 0

  const afterDraw = (cb: () => void): void => {
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0)
    gl.flush()
    const poll = (): void => {
      if (disposed || document.hidden) {
        if (sync) gl.deleteSync(sync)
        return
      }
      const status = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED
      if (status === gl.UNSIGNALED) {
        timeoutId = window.setTimeout(poll, 5)
      } else {
        if (sync) gl.deleteSync(sync)
        timeoutId = window.setTimeout(cb, 80)
      }
    }
    timeoutId = window.setTimeout(poll, 5)
  }

  const animate = (): void => {
    if (disposed || document.hidden) return

    const now = performance.now()
    const dt = Math.min(0.05, Math.max(0.001, (now - lastNow) / 1000))
    lastNow = now
    elapsed += dt

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

    const openT = smoothstep01(state.folioOpen)
    const hingeAngle = lerp(Math.PI * 0.5, 0.22, openT)
    const hingeOffset = lerp(spineHalfSpan, 0.01, openT)
    leftHinge.position.set(-hingeOffset, 0, 0)
    rightHinge.position.set(hingeOffset, 0, 0)
    leftHinge.rotation.y = hingeAngle
    rightHinge.rotation.y = -hingeAngle
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

    if (isSoftwareGl) {
      afterDraw(animate)
    } else {
      rafId = window.requestAnimationFrame(animate)
    }
  }

  const onVisibilityChange = (): void => {
    if (document.hidden) {
      window.cancelAnimationFrame(rafId)
      window.clearTimeout(timeoutId)
      rafId = 0
      timeoutId = 0
    } else if (!disposed) {
      lastNow = performance.now()
      animate()
    }
  }
  document.addEventListener('visibilitychange', onVisibilityChange)

  if (!document.hidden) {
    animate()
  }

  return () => {
    disposed = true
    window.cancelAnimationFrame(rafId)
    window.clearTimeout(timeoutId)
    document.removeEventListener('visibilitychange', onVisibilityChange)
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('resize', onResize)
    canvas.removeEventListener('webglcontextlost', onContextLost)

    const disposedGeos = new Set<THREE.BufferGeometry>()
    const disposedMats = new Set<THREE.Material>()
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Points) {
        if (!disposedGeos.has(obj.geometry)) {
          disposedGeos.add(obj.geometry)
          obj.geometry.dispose()
        }
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
        for (const m of mats) {
          if (!disposedMats.has(m)) {
            disposedMats.add(m)
            m.dispose()
          }
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
}
