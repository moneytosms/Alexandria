import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    void window.alexandria
      .log('error', `Renderer error: ${error.message}`, `${error.stack ?? ''}\n${info.componentStack}`)
      .catch(() => undefined)
  }

  render(): ReactNode {
    const { error } = this.state

    if (!error) return this.props.children

    return (
      <main className="shell">
        <section className="card">
          <p className="eyebrow">Alexandria</p>
          <h1>The page hit a snag.</h1>
          <p className="lede">
            The error was written to the library log. Your books and notes are untouched.
          </p>
          <pre className="error-detail">{error.message}</pre>
          <button className="button" type="button" onClick={() => window.location.reload()}>
            Reload
          </button>
        </section>
      </main>
    )
  }
}
