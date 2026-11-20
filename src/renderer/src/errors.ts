function report(message: string, detail?: string): void {
  void window.alexandria.log('error', message, detail).catch(() => undefined)
}

export function installGlobalErrorLogging(): void {
  window.addEventListener('error', (event) => {
    report(
      `Uncaught renderer error: ${event.message}`,
      event.error instanceof Error
        ? (event.error.stack ?? event.error.message)
        : `${event.filename}:${event.lineno}:${event.colno}`
    )
  })

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason
    report(
      'Unhandled renderer rejection',
      reason instanceof Error ? (reason.stack ?? reason.message) : String(reason)
    )
  })
}
