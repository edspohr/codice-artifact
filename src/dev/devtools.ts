// Dev-only tooling, stripped from production builds (see main.tsx).
//
// Old journey:
//   ?station=frag:7            jump to a station by id
//   ?station=12                jump to a station by index
// Territory prototype (?proto=territory):
//   ?reveal=1                  reveal all places
//   ?place=3                   glide to place 3 once ready
//   ?stop=2                    jump the linear path to stop index 2
// Both:
//   ?cfg.STALL_CUE_MS=3000     override any config key
//
// At runtime: window.__codice.config / setConfig / jumpTo / stations /
// territory (the Territory and LinearPath instances once ready).
import { journeyStore } from '../app/journeyStore'
import { session } from '../app/session'
import { journey, stationIndex, type StationId } from '../content/journey'
import { config, defaultConfig, resetConfig, setConfig, type ConfigKey } from '../gestures/config'
import type { TerritoryHandles } from '../territory/TerritoryApp'

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
      territory: TerritoryHandles | null
    }
  }
}

function jumpTo(idOrIndex: StationId | number) {
  const i = typeof idOrIndex === 'number' ? idOrIndex : stationIndex(idOrIndex)
  journeyStore.jumpTo(i)
}

export function installDevTools({ prototype }: { prototype: boolean }) {
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
  if (station && !prototype) {
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
    territory: null,
  }
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
