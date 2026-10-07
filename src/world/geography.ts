// Places are a deterministic function of the cycle number. Constraints:
// inside their region, a minimum distance from each other and from the
// edges, and fragment 22 at the far top of Cielo. Order inside a region
// is free, so positions are not sorted.
import type { Fragment, MovementId } from '../content/canon'
import { config } from '../gestures/config'
import { hashSeed, rng } from './rng'
import type { Place, Rect } from './types'

export interface GeographyInput {
  cycle: number
  region: MovementId
  rect: Rect
  fragments: Fragment[]
  /** Viewport short side in px. */
  short: number
}

export function placePlaces(input: GeographyInput): Place[] {
  const { cycle, region, rect, fragments, short } = input
  const random = rng(hashSeed('geo', cycle, region))
  const margin = config.PLACE_EDGE_MARGIN * short
  let minDist = config.PLACE_MIN_DIST * short
  const inner: Rect = { x: rect.x + margin, y: rect.y + margin, w: rect.w - 2 * margin, h: rect.h - 2 * margin }
  if (inner.w <= 0 || inner.h <= 0) throw new Error('geography: region too small for the edge margin')

  const placed: Place[] = []
  for (const fragment of fragments) {
    const isExit = fragment.n === 22
    let best: { x: number; y: number } | null = null
    // Rejection sampling with a relaxing minimum distance so it always terminates.
    for (let relax = 0; relax < 8 && !best; relax++) {
      for (let attempt = 0; attempt < 64; attempt++) {
        const x = inner.x + random() * inner.w
        const y = isExit ? inner.y + random() * Math.min(inner.h, short * 0.25) : inner.y + random() * inner.h
        const ok = placed.every((p) => Math.hypot(p.x - x, p.y - y) >= minDist)
        if (ok) {
          best = { x, y }
          break
        }
      }
      if (!best) minDist *= 0.85
    }
    if (!best) throw new Error(`geography: could not place fragment ${fragment.n}`)
    const r = rng(hashSeed('stamp', cycle, fragment.n))
    placed.push({
      n: fragment.n,
      fragment,
      region,
      x: best.x,
      y: best.y,
      stamp: {
        rotation: (r() - 0.5) * 8,
        dx: (r() - 0.5) * 0.12 * short,
        dy: (r() - 0.5) * 0.06 * short,
        pressure: 0.82 + r() * 0.18,
      },
      seed: hashSeed('form', cycle, fragment.n) % 1000,
    })
  }
  return placed
}
