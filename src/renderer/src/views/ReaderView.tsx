import { navigate } from '../router'

export function ReaderView() {
  return (
    <div className="empty">
      <p className="eyebrow">Reader</p>
      <h2 className="display">The room is quiet.</h2>
      <p className="lede">
        The reader fills the room with a single book. Open one from the index or from its shelf
        and it will wait here where you left it.
      </p>
      <button className="button" type="button" onClick={() => navigate('index')}>
        Go to the index
      </button>
    </div>
  )
}
