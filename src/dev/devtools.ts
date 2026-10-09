// Dev-only tooling, stripped from production builds (see main.tsx).
//
//   ?reveal=1                  reveal all places
//   ?place=3                   glide to place 3 once ready
//   ?stop=2                    jump the linear path to stop index 2 (0 cover, 1 epigraph, then places and thresholds)
//   ?cfg.STALL_CUE_MS=3000     override any config key
//
// At runtime: window.__codice.config / setConfig / resetConfig / territory
// (the Territory and LinearPath instances once ready).
import { session } from '../app/session'
import { config, defaultConfig, resetConfig, setConfig, type ConfigKey } from '../gestures/config'
import type { TerritoryHandles } from '../territory/TerritoryApp'

declare global {
  interface Window {
    __codice?: {
      config: typeof config
      defaultConfig: typeof defaultConfig
      setConfig: typeof setConfig
      resetConfig: typeof resetConfig
      session: typeof session
      territory: TerritoryHandles | null
    }
  }
}

export function installDevTools() {
  const params = new URLSearchParams(window.location.search)
  const overrides: Record<string, number> = {}
  for (const [key, value] of params) {
    if (!key.startsWith('cfg.')) continue
    const name = key.slice(4) as ConfigKey
    const n = Number(value)
    try {
      setConfig(name, n)
      overrides[name] = n
    } catch (err) {
      console.warn('[codice dev]', (err as Error).message)
    }
  }
  window.__codice = { config, defaultConfig, setConfig, resetConfig, session, territory: null }
  console.info('[codice dev] tools on window.__codice', Object.keys(overrides).length ? { overrides } : '')

  return {
    onTerritoryReady(h: unknown) {
      const handles = h as TerritoryHandles
      if (window.__codice) window.__codice.territory = handles
      const place = params.get('place')
      if (place) {
        const p = handles.territory.world.places.find((x) => x.n === Number(place))
        if (p) handles.territory.glideTo({ x: p.x, y: p.y })
      }
      const stop = params.get('stop')
      if (stop) handles.path.jump(Number(stop))
    },
  }
}
