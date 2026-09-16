import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Stylesheet order matters: third-party CSS first, our design system last, so our overrides of
// MapLibre control chrome win on equal specificity.
import '@fontsource-variable/schibsted-grotesk'
import '@fontsource-variable/jetbrains-mono'
import 'maplibre-gl/dist/maplibre-gl.css'
import './styles/globals.css'
import App from './App.tsx'
import { useAppStore } from './state/appStore'
import { readViewStateFromLocation } from './lib/viewState'

// Seed the store from a shared URL before first render, so a deep link opens on the linked module
// without a state-sync effect that would render the default view first.
const initialView = readViewStateFromLocation()
if (initialView.mode) {
  useAppStore.setState({ mode: initialView.mode })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
