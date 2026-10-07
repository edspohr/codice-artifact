import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { canon } from './content/canon'
import './styles/fonts.css'
import './styles/tokens.css'
import './styles/base.css'
import './styles/views.css'

document.documentElement.lang = 'es'
document.title = canon.title

if (import.meta.env.DEV) {
  // Dev-only tooling. The dynamic import inside this dead branch is dropped
  // from production builds entirely.
  const { installDevTools } = await import('./dev/devtools')
  installDevTools()
}

const container = document.getElementById('root')
if (!container) throw new Error('missing #root')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
