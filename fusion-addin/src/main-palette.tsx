import './styles.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from './components/app'

export const renderMainPalette = (root: HTMLElement) => {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
