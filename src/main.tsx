import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/fonts.css'
import './styles/tokens.css'
import './styles/base.css'
import './styles/canon.css'
import './styles/seal.css'
import { canon } from './content/canon'
import TerritoryApp from './territory/TerritoryApp'

document.documentElement.lang = 'es'
document.title = canon.title

const params = new URLSearchParams(window.location.search)

let devHandles: { onTerritoryReady?: (h: unknown) => void } = {}
if (import.meta.env.DEV) {
  // Dev-only tooling. The dynamic import inside this dead branch is dropped
  // from production builds entirely.
  const { installDevTools } = await import('./dev/devtools')
  devHandles = installDevTools()
}

const container = document.getElementById('root')
if (!container) throw new Error('missing #root')

const revealAll = import.meta.env.DEV && params.get('reveal') === '1'

// One root per container, even if this module is evaluated twice (dev reloads).
const rootHolder = window as unknown as { __codiceRoot?: ReturnType<typeof createRoot> }
const root = (rootHolder.__codiceRoot ??= createRoot(container))
root.render(
  <StrictMode>
    <TerritoryApp revealAll={revealAll} onReady={(h) => devHandles.onTerritoryReady?.(h)} />
  </StrictMode>,
)
