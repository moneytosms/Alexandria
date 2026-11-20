import './web-bridge'
import '@fontsource/almendra/400.css'
import '@fontsource/almendra/400-italic.css'
import '@fontsource/almendra/700.css'
import '@fontsource/almendra/700-italic.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ErrorBoundary } from './ErrorBoundary'
import { installGlobalErrorLogging } from './errors'
import './styles.css'

const root = document.getElementById('root')

if (!root) {
  throw new Error('Missing #root element')
}

installGlobalErrorLogging()

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
)
