// The patina's life in a visit: connect lazily, hand the shared grids to the
// ink, collect this visit's wear, and send it in a few batches: when a
// threshold is crossed and when the page is hidden or left.
import { config } from '../gestures/config'
import { territoryStore } from '../world/territoryStore'
import type { World } from '../world/types'
import { PatinaCollector } from './collector'
import type { RegionGrid } from './grid'
import { connectRemote, type Remote } from './remote'
import type { MovementId } from '../content/canon'

export class Patina {
  readonly collector: PatinaCollector
  private remote: Remote | null = null
  private lastSent = 0
  private sending = false
  private unsubscribe: (() => void) | null = null
  private onGrids: (grids: Map<MovementId, RegionGrid>) => void

  constructor(world: World, screenH: number, onGrids: (grids: Map<MovementId, RegionGrid>) => void) {
    this.collector = new PatinaCollector(world, screenH)
    this.onGrids = onGrids
  }

  async start() {
    if (config.PATINA_ENABLED <= 0) return
    this.remote = await connectRemote()
    if (!this.remote) return
    this.onGrids(this.remote.grids)
    let region = territoryStore.get().region
    this.unsubscribe = territoryStore.subscribe(() => {
      const next = territoryStore.get().region
      if (next !== region) {
        region = next
        void this.flush()
      }
    })
    document.addEventListener('visibilitychange', this.onHidden)
    window.addEventListener('pagehide', this.onHidden)
  }

  private readonly onHidden = () => {
    if (document.visibilityState === 'hidden') void this.flush()
  }

  /** Sends what is pending, at most once every few seconds. */
  async flush(): Promise<boolean> {
    const remote = this.remote
    if (!remote || this.sending) return false
    if (performance.now() - this.lastSent < config.PATINA_MIN_INTERVAL_MS) return false
    const payload = this.collector.take(remote.cycle)
    if (!payload) return false
    this.sending = true
    this.lastSent = performance.now()
    const ok = await remote.send(payload)
    if (!ok) this.collector.restore(payload)
    this.sending = false
    return ok
  }

  /** Dev/test: the total shared wear loaded at start, per region. */
  loadedTotals(): Record<string, number> {
    const out: Record<string, number> = {}
    for (const [id, g] of this.remote?.grids ?? []) out[id] = g.h.reduce((a, b) => a + b, 0) + g.l.reduce((a, b) => a + b, 0)
    return out
  }

  get connected() {
    return this.remote !== null
  }

  stop() {
    this.unsubscribe?.()
    document.removeEventListener('visibilitychange', this.onHidden)
    window.removeEventListener('pagehide', this.onHidden)
  }
}
