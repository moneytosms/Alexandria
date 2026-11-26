import { useEffect, useRef, useState } from 'react'
import { mountArmillaryCanvas2D } from './armillaryCanvas2D'
import type { AcquiredWebGL2 } from './armillaryWebGL'
import type { HallMoodPreview } from './choreography'

export type { HallMoodPreview }

export interface ArmillaryStageProps {
  scrollProgressRef: React.MutableRefObject<number>
  reducedMotion: boolean
  mood: HallMoodPreview
}

function acquireWebGL2Context(): AcquiredWebGL2 | null {
  const attempts: Array<{ attrs?: WebGLContextAttributes; antialias: boolean }> = [
    {
      attrs: {
        alpha: true,
        antialias: true,
        depth: true,
        powerPreference: 'high-performance',
        failIfMajorPerformanceCaveat: false
      },
      antialias: true
    },
    {
      attrs: {
        alpha: true,
        antialias: false,
        depth: true,
        powerPreference: 'default',
        failIfMajorPerformanceCaveat: false
      },
      antialias: false
    },
    {
      attrs: { alpha: true },
      antialias: false
    },
    {
      attrs: undefined,
      antialias: false
    }
  ]

  for (const attempt of attempts) {
    try {
      const canvas = document.createElement('canvas')
      const gl = (
        attempt.attrs ? canvas.getContext('webgl2', attempt.attrs) : canvas.getContext('webgl2')
      ) as WebGL2RenderingContext | null
      if (gl && !gl.isContextLost()) {
        return { canvas, gl, antialias: attempt.antialias }
      }
    } catch {
      // Try next fallback attribute set
    }
  }
  return null
}

export function ArmillaryFolioStage({
  scrollProgressRef,
  reducedMotion,
  mood
}: ArmillaryStageProps) {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const moodRef = useRef<HallMoodPreview>(mood)
  const [useCanvas2D, setUseCanvas2D] = useState(false)

  useEffect(() => {
    moodRef.current = mood
  }, [mood])

  useEffect(() => {
    const container = mountRef.current
    if (!container) return

    if (useCanvas2D) {
      return mountArmillaryCanvas2D(container, scrollProgressRef, moodRef, reducedMotion)
    }

    // Probe WebGL2 BEFORE downloading Three.js so WebGL-disabled browsers skip ~600kB of 3D JS entirely
    const acquired = acquireWebGL2Context()
    if (!acquired) {
      return mountArmillaryCanvas2D(container, scrollProgressRef, moodRef, reducedMotion)
    }

    let cancelled = false
    let cleanup: (() => void) | null = null

    void import('./armillaryWebGL')
      .then(({ mountArmillaryWebGL }) => {
        if (cancelled) return
        try {
          cleanup = mountArmillaryWebGL(
            container,
            acquired,
            scrollProgressRef,
            moodRef,
            reducedMotion,
            () => setUseCanvas2D(true)
          )
        } catch {
          if (acquired.canvas.parentElement === container) {
            container.removeChild(acquired.canvas)
          }
          cleanup = mountArmillaryCanvas2D(container, scrollProgressRef, moodRef, reducedMotion)
        }
      })
      .catch(() => {
        if (cancelled) return
        cleanup = mountArmillaryCanvas2D(container, scrollProgressRef, moodRef, reducedMotion)
      })

    return () => {
      cancelled = true
      cleanup?.()
    }
  }, [reducedMotion, scrollProgressRef, useCanvas2D])

  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden="true"
    >
      <div ref={mountRef} className="h-full w-full" />
      <div className="stage-vignette absolute inset-0" />
    </div>
  )
}
