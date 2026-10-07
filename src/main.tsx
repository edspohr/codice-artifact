import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { canon } from './content/canon'
import './styles/fonts.css'
import './styles/tokens.css'
import './styles/base.css'
import './styles/views.css'

document.documentElement.lang = 'es'
document.title = canon.title

const params = new URLSearchParams(window.location.search)
// Phase 2: the territory prototype lives beside the old journey until the gate.
const prototype = params.get('proto') === 'territory'

let devHandles: { onTerritoryReady?: (h: unknown) => void } = {}
if (import.meta.env.DEV) {
  // Dev-only tooling. The dynamic import inside this dead branch is dropped
  // from production builds entirely.
  const { installDevTools } = await import('./dev/devtools')
  devHandles = installDevTools({ prototype })
}

const container = document.getElementById('root')
if (!container) throw new Error('missing #root')

const TerritoryApp = lazy(() => import('./territory/TerritoryApp'))
const revealAll = import.meta.env.DEV && params.get('reveal') === '1'

createRoot(container).render(
  <StrictMode>
    {prototype ? (
      <Suspense fallback={null}>
        <TerritoryApp revealAll={revealAll} onReady={(h) => devHandles.onTerritoryReady?.(h)} />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
)
