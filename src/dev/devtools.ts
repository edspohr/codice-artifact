// Dev-only tooling, stripped from production builds (see main.tsx).
//
//   ?station=frag:7            jump to a station by id
//   ?station=12                jump to a station by index
//   ?cfg.STALL_CUE_MS=3000     override any gesture config key
//
// At runtime: window.__codice.config / setConfig / jumpTo / stations.
import { journeyStore } from '../app/journeyStore'
import { session } from '../app/session'
import { journey, stationIndex, type StationId } from '../content/journey'
import { config, defaultConfig, resetConfig, setConfig, type ConfigKey } from '../gestures/config'

declare global {
  interface Window {
    __codice?: {
      config: typeof config
      defaultConfig: typeof defaultConfig
      setConfig: typeof setConfig
      resetConfig: typeof resetConfig
      jumpTo: (idOrIndex: StationId | number) => void
      stations: StationId[]
      store: typeof journeyStore
      session: typeof session
    }
  }
}

function jumpTo(idOrIndex: StationId | number) {
  const i = typeof idOrIndex === 'number' ? idOrIndex : stationIndex(idOrIndex)
  journeyStore.jumpTo(i)
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
  const station = params.get('station')
  if (station) {
    try {
      jumpTo(/^\d+$/.test(station) ? Number(station) : (station as StationId))
    } catch (err) {
      console.warn('[codice dev]', (err as Error).message)
    }
  }
  window.__codice = {
    config,
    defaultConfig,
    setConfig,
    resetConfig,
    jumpTo,
    stations: journey.map((s) => s.id),
    store: journeyStore,
    session,
  }
  console.info('[codice dev] tools on window.__codice', Object.keys(overrides).length ? { overrides } : '')
}
