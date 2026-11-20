import {
  HALL_MOOD_LIST,
  HALL_MOOD_RIGS,
  HALL_THEME_LIST,
  HALL_THEME_PALETTES,
  type HallMood,
  type HallTheme
} from '../room/atmosphere'
import { playSound, useAmbientStore } from '../sound'

interface Props {
  theme: HallTheme
  mood: HallMood
  onChangeTheme: (theme: HallTheme) => void
  onChangeMood: (mood: HallMood) => void
  onClose: () => void
}

export function AtmospherePopover({
  theme,
  mood,
  onChangeTheme,
  onChangeMood,
  onClose
}: Props) {
  const ambientEnabled = useAmbientStore((s) => s.enabled)
  const rain = useAmbientStore((s) => s.rain)
  const fire = useAmbientStore((s) => s.fire)
  const chimes = useAmbientStore((s) => s.chimes)
  const toggleAmbient = useAmbientStore((s) => s.toggleEnabled)
  const setChannel = useAmbientStore((s) => s.setChannel)

  return (
    <div className="atmosphere-popover" role="dialog" aria-label="Hall atmosphere and soundscape">
      <div className="places-popover__head">
        <span>Atmosphere &amp; Soundscape</span>
        <button
          type="button"
          className="places-popover__close"
          onClick={onClose}
          aria-label="Close atmosphere controls"
        >
          ×
        </button>
      </div>

      <div className="atmosphere-popover__section">
        <p className="places-popover__label">Architectural Theme</p>
        <div className="atmosphere-grid atmosphere-grid--3">
          {HALL_THEME_LIST.map((id) => {
            const spec = HALL_THEME_PALETTES[id]
            const active = theme === id
            return (
              <button
                key={id}
                type="button"
                className={`atmosphere-choice ${active ? 'atmosphere-choice--active' : ''}`}
                onClick={() => {
                  playSound('tick')
                  onChangeTheme(id)
                }}
              >
                <span className="atmosphere-choice__swatches" aria-hidden="true">
                  <span style={{ background: spec.wood }} />
                  <span style={{ background: spec.rugField }} />
                  <span style={{ background: spec.brass }} />
                </span>
                <span className="atmosphere-choice__name">{spec.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="atmosphere-popover__section">
        <p className="places-popover__label">Time &amp; Weather Mood</p>
        <div className="atmosphere-grid atmosphere-grid--2">
          {HALL_MOOD_LIST.map((id) => {
            const rig = HALL_MOOD_RIGS[id]
            const active = mood === id
            return (
              <button
                key={id}
                type="button"
                className={`atmosphere-choice atmosphere-choice--mood ${active ? 'atmosphere-choice--active' : ''}`}
                onClick={() => {
                  playSound('tick')
                  onChangeMood(id)
                }}
              >
                <span className="atmosphere-choice__name">{rig.label}</span>
                <span className="atmosphere-choice__sub">{rig.subtitle}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="atmosphere-popover__section">
        <div className="atmosphere-sound__head">
          <p className="places-popover__label">Procedural Ambient Sound</p>
          <button
            type="button"
            className={`atmosphere-toggle ${ambientEnabled ? 'atmosphere-toggle--on' : ''}`}
            onClick={() => {
              playSound('tick')
              toggleAmbient()
            }}
          >
            {ambientEnabled ? 'On' : 'Muted'}
          </button>
        </div>

        <div className="atmosphere-sliders">
          <label className="atmosphere-slider">
            <span>Rain on glass</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={rain}
              onChange={(e) => setChannel('rain', Number(e.target.value))}
            />
            <span className="atmosphere-slider__val">{Math.round(rain * 100)}%</span>
          </label>
          <label className="atmosphere-slider">
            <span>Fireplace hearth</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={fire}
              onChange={(e) => setChannel('fire', Number(e.target.value))}
            />
            <span className="atmosphere-slider__val">{Math.round(fire * 100)}%</span>
          </label>
          <label className="atmosphere-slider">
            <span>Brass chimes</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={chimes}
              onChange={(e) => setChannel('chimes', Number(e.target.value))}
            />
            <span className="atmosphere-slider__val">{Math.round(chimes * 100)}%</span>
          </label>
        </div>
      </div>
    </div>
  )
}
