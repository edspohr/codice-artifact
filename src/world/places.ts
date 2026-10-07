// Places emerge when the viewpoint comes near and disperse if the visitor
// leaves without arriving. Arrival stamps the seal; only a stamped place
// stays for the session.
import { config } from '../gestures/config'
import type { Place, Vec2, World } from './types'

export type PlaceState = 'hidden' | 'emerging' | 'present' | 'dispersing' | 'found'

export interface PlaceStatus {
  n: number
  state: PlaceState
  /** 0..1 how much of its ink has gathered. */
  reveal: number
  found: boolean
  /** Set when the stamp happens (ms). */
  stampedAt: number | null
}

export interface PlacesEvents {
  onChange(status: PlaceStatus): void
  onStamp(place: Place): void
}

export class Places {
  readonly status = new Map<number, PlaceStatus>()
  private world: World
  private events: PlacesEvents

  constructor(world: World, events: PlacesEvents) {
    this.world = world
    this.events = events
    for (const p of world.places) {
      this.status.set(p.n, { n: p.n, state: 'hidden', reveal: 0, found: false, stampedAt: null })
    }
  }

  get(n: number): PlaceStatus {
    const s = this.status.get(n)
    if (!s) throw new Error(`places: unknown ${n}`)
    return s
  }

  found(): Set<number> {
    const out = new Set<number>()
    for (const s of this.status.values()) if (s.found) out.add(s.n)
    return out
  }

  nearestUnfound(from: Vec2): Vec2 | null {
    let best: Place | null = null
    let bestD = Infinity
    for (const p of this.world.places) {
      if (this.get(p.n).found) continue
      const d = Math.hypot(p.x - from.x, p.y - from.y)
      if (d < bestD) {
        bestD = d
        best = p
      }
    }
    return best ? { x: best.x, y: best.y } : null
  }

  /** Force-arrive (linear path). */
  arrive(n: number, now: number) {
    const s = this.get(n)
    if (s.found) return
    s.found = true
    s.state = 'found'
    s.reveal = 1
    s.stampedAt = now
    this.events.onChange({ ...s })
    const place = this.world.places.find((p) => p.n === n)
    if (place) this.events.onStamp(place)
  }

  /** Returns true while any reveal is animating. */
  update(centre: Vec2, dt: number, now: number, revealAll: boolean): boolean {
    const short = this.world.short
    const emergeD = config.EMERGE_DISTANCE * short
    const arriveD = config.ARRIVE_DISTANCE * short
    let animating = false
    for (const p of this.world.places) {
      const s = this.get(p.n)
      const d = Math.hypot(p.x - centre.x, p.y - centre.y)
      const near = revealAll || d <= emergeD
      const before = s.state
      const beforeReveal = s.reveal

      if (s.found) {
        s.reveal = 1
      } else if (d <= arriveD) {
        this.arrive(p.n, now)
        continue
      } else if (near) {
        s.reveal = Math.min(1, s.reveal + dt / Math.max(1, config.EMERGE_MS))
        s.state = s.reveal >= 1 ? 'present' : 'emerging'
      } else if (s.reveal > 0) {
        s.reveal = Math.max(0, s.reveal - dt / Math.max(1, config.DISPERSE_MS))
        s.state = s.reveal <= 0 ? 'hidden' : 'dispersing'
      }
      if (s.state === 'emerging' || s.state === 'dispersing') animating = true
      if (before !== s.state || (before === 'emerging' && beforeReveal !== s.reveal && s.reveal >= 1)) {
        this.events.onChange({ ...s })
      }
    }
    return animating
  }
}
