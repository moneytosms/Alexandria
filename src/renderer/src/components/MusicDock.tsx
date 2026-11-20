import { useEffect, useRef } from 'react'
import { audioUrl } from '../media'
import { usePlayerStore } from '../state/ui-store'

function clock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00'
  const minutes = Math.floor(seconds / 60)
  const rest = Math.floor(seconds % 60)
  return `${minutes}:${String(rest).padStart(2, '0')}`
}

export function MusicDock() {
  const tracks = usePlayerStore((state) => state.tracks)
  const index = usePlayerStore((state) => state.currentIndex)
  const playing = usePlayerStore((state) => state.playing)
  const volume = usePlayerStore((state) => state.volume)
  const progress = usePlayerStore((state) => state.progress)
  const duration = usePlayerStore((state) => state.duration)
  const collapsed = usePlayerStore((state) => state.collapsed)
  const toggle = usePlayerStore((state) => state.toggle)
  const next = usePlayerStore((state) => state.next)
  const previous = usePlayerStore((state) => state.previous)
  const setVolume = usePlayerStore((state) => state.setVolume)
  const setProgress = usePlayerStore((state) => state.setProgress)
  const setPlaying = usePlayerStore((state) => state.setPlaying)
  const setCollapsed = usePlayerStore((state) => state.setCollapsed)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const current = index >= 0 ? tracks[index] : null

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !current) return
    if (audio.dataset.path !== current.path) {
      audio.dataset.path = current.path
      audio.src = audioUrl(current.path)
      audio.load()
    }
    audio.volume = volume
    if (playing) void audio.play().catch(() => setPlaying(false))
    else audio.pause()
    // Volume changes are applied in their own effect.
  }, [current, playing, setPlaying])

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
  }, [volume])

  if (tracks.length === 0) return null

  return (
    <div className={`music-player ${collapsed ? 'music-player--collapsed' : ''}`}>
      <audio
        ref={audioRef}
        onTimeUpdate={(event) =>
          setProgress(event.currentTarget.currentTime, event.currentTarget.duration || 0)
        }
        onLoadedMetadata={(event) =>
          setProgress(event.currentTarget.currentTime, event.currentTarget.duration || 0)
        }
        onEnded={() => next()}
        onPause={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
      />

      <button
        type="button"
        className="music-player__art"
        title={collapsed ? 'Show player' : 'Hide player'}
        onClick={() => setCollapsed(!collapsed)}
      >
        {current?.artPath ? (
          <img src={current.artPath} alt="" />
        ) : (
          <span aria-hidden="true">♪</span>
        )}
      </button>

      {collapsed ? null : (
        <>
          <div className="music-player__meta">
            <span className="music-player__title" title={current?.title}>
              {current?.title ?? 'Choose a track'}
            </span>
            <span className="music-player__artist">{current?.artist ?? current?.album ?? 'Local music'}</span>
          </div>

          <div className="music-player__controls">
            <button type="button" className="icon-button" onClick={previous} aria-label="Previous track">
              ⏮
            </button>
            <button
              type="button"
              className="icon-button music-player__play"
              onClick={toggle}
              aria-label={playing ? 'Pause' : 'Play'}
            >
              {playing ? '⏸' : '▶'}
            </button>
            <button type="button" className="icon-button" onClick={next} aria-label="Next track">
              ⏭
            </button>
          </div>

          <div className="music-player__seek">
            <span>{clock(progress)}</span>
            <input
              type="range"
              min={0}
              max={Math.max(1, duration)}
              step={1}
              value={Math.min(progress, duration || 0)}
              aria-label="Seek"
              onChange={(event) => {
                const audio = audioRef.current
                if (!audio) return
                audio.currentTime = Number(event.target.value)
                setProgress(Number(event.target.value), duration)
              }}
            />
            <span>{clock(duration)}</span>
          </div>

          <input
            className="music-player__volume"
            type="range"
            min={0}
            max={1}
            step={0.02}
            value={volume}
            aria-label="Volume"
            onChange={(event) => setVolume(Number(event.target.value))}
          />
        </>
      )}
    </div>
  )
}
