import '@fontsource/almendra/400.css'
import '@fontsource/almendra/400-italic.css'
import '@fontsource/almendra/700.css'
import '@fontsource/almendra/700-italic.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { LandingApp } from './components/LandingApp'
import './landing.css'

const root = document.getElementById('root')
if (!root) {
  throw new Error('Missing #root element')
}

createRoot(root).render(
  <StrictMode>
    <LandingApp />
  </StrictMode>
)
