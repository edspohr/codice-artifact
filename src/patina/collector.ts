// What one visit adds to the shared patina, accumulated in memory and sent
// in a few batches (never as strokes): how much the ink was worked in each
// cell (in screens of finger slip) and how long the viewpoint lingered there
// (seconds). Nothing here identifies a person; the session id is random per
// visit and lives only in memory.
import type { MovementId } from '../content/canon'
import type { World } from '../world/types'
import { regionAt } from '../world/world'
import { CELLS, cellOf, emptyGrid, REGIONS, type RegionGrid } from './grid'

export interface DeltaPayload {
  cycle: number
  sessionId: string
  regions: Partial<Record<MovementId, { h?: Array<[number, number]>; l?: Array<[number, number]> }>>
}

function randomId(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export class PatinaCollector {
  readonly sessionId = randomId()
  private pending = new Map<MovementId, RegionGrid>()
  private world: World
  private screenH: number

  constructor(world: World, screenH: number) {
    this.world = world
    this.screenH = Math.max(1, screenH)
  }

  private grid(id: MovementId): RegionGrid {
    let g = this.pending.get(id)
    if (!g) {
      g = emptyGrid()
      this.pending.set(id, g)
    }
    return g
  }

  /** The finger worked the ink along a slip segment (world px). */
  handled(ax: number, ay: number, bx: number, by: number) {
    const len = Math.hypot(bx - ax, by - ay)
    if (len <= 0) return
    const x = (ax + bx) / 2
    const y = (ay + by) / 2
    const region = regionAt(this.world, y)
    const cell = cellOf(region.rect, x, y)
    if (cell === null) return
    this.grid(region.id).h[cell]! += len / this.screenH
  }

  /** The viewpoint lingered at a point for `seconds`. */
  lingered(x: number, y: number, seconds: number) {
    if (seconds <= 0) return
    const region = regionAt(this.world, y)
    const cell = cellOf(region.rect, x, y)
    if (cell === null) return
    this.grid(region.id).l[cell]! += seconds
  }

  get isEmpty() {
    for (const g of this.pending.values()) for (let i = 0; i < CELLS; i++) if (g.h[i]! > 0.001 || g.l[i]! > 0.05) return false
    return true
  }

  /** Takes everything pending as a delta payload and clears it. */
  take(cycle: number): DeltaPayload | null {
    const regions: DeltaPayload['regions'] = {}
    let any = false
    for (const id of REGIONS) {
      const g = this.pending.get(id)
      if (!g) continue
      const h: Array<[number, number]> = []
      const l: Array<[number, number]> = []
      for (let i = 0; i < CELLS; i++) {
        if (g.h[i]! > 0.001) h.push([i, Math.round(g.h[i]! * 1000) / 1000])
        if (g.l[i]! > 0.05) l.push([i, Math.round(g.l[i]! * 100) / 100])
      }
      if (h.length || l.length) {
        regions[id] = { ...(h.length ? { h } : {}), ...(l.length ? { l } : {}) }
        any = true
      }
    }
    this.pending.clear()
    return any ? { cycle, sessionId: this.sessionId, regions } : null
  }

  /** Puts a payload that could not be sent back into the pending grids. */
  restore(payload: DeltaPayload) {
    for (const [id, r] of Object.entries(payload.regions) as Array<[MovementId, { h?: Array<[number, number]>; l?: Array<[number, number]> }]>) {
      const g = this.grid(id)
      for (const [c, v] of r.h ?? []) g.h[c]! += v
      for (const [c, v] of r.l ?? []) g.l[c]! += v
    }
  }
}
