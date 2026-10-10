// Places are a deterministic function of the cycle number. In a channel
// they are loosely ordered along the ascent by canonical number, with
// seeded jitter, alternating sides of the centre line. Order stays free:
// nothing forces the visitor to take them in sequence. Constraints: inside
// the region, off the edges, apart from each other, the first place about
// one screen above the start, and fragment 22 at the far top of Cielo.
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
  /** Viewport height in px (the ascent is measured in screens). */
  viewH: number
  /** Viewport width in px (the text block width depends on it). */
  viewW: number
}

export function placePlaces(input: GeographyInput): Place[] {
  const { cycle, region, rect, fragments, short, viewH, viewW } = input
  const random = rng(hashSeed('geo', cycle, region))
  const margin = config.PLACE_EDGE_MARGIN * short
  const minDist = config.PLACE_MIN_DIST * short
  const inner: Rect = { x: rect.x + margin, y: rect.y + margin, w: rect.w - 2 * margin, h: rect.h - 2 * margin }
  if (inner.w <= 0 || inner.h <= 0) throw new Error('geography: region too small for the edge margin')

  const centreX = rect.x + rect.w / 2
  const halfW = inner.w / 2
  // A place's text block (see .place in territory.css: min(30rem, 74vw)) must fit
  // inside the channel with a margin, so the viewpoint can frame it on arrival.
  const textHalf = Math.min(240, 0.37 * viewW)
  const fitMargin = textHalf + 40
  const minX = rect.x + fitMargin
  const maxX = rect.x + rect.w - fitMargin
  const count = fragments.length
  // Slots along the ascent: the first about one screen above the start
  // (the start sits half a screen above the region's bottom), the last
  // near the top. The exit (22) always takes the very top.
  const bottomSlot = rect.y + rect.h - viewH / 2 - config.FIRST_PLACE_SCREENS * viewH
  // The last place of a region stays at least a screen below the closing at its threshold;
  // the exit (22) has no threshold above it and takes the very top.
  const topSlot = inner.y + (fragments.some((f) => f.n === 22) ? short * 0.15 : Math.max(short * 0.15, viewH * 1.05 - margin))
  const span = Math.max(0, bottomSlot - topSlot)
  const step = count > 1 ? span / (count - 1) : 0
  // Places are spread along the ascent by their slots; the minimum distance never asks for more than the slots allow.
  const minDistEff = count > 1 ? Math.min(minDist, step * 0.8) : minDist
  let side = random() < 0.5 ? -1 : 1

  const placed: Place[] = []
  fragments.forEach((fragment, i) => {
    const isExit = fragment.n === 22
    const slotY = isExit ? topSlot : bottomSlot - i * step
    let best: { x: number; y: number } | null = null
    for (let attempt = 0; attempt < 48 && !best; attempt++) {
      const relax = attempt / 48
      const jitterY = (random() - 0.5) * 2 * config.PLACE_JITTER * viewH * (1 - relax)
      const lateral = (config.PLACE_LATERAL + (random() - 0.5) * 2 * config.PLACE_LATERAL_JITTER) * halfW
      const x = Math.min(Math.min(inner.x + inner.w, maxX), Math.max(Math.max(inner.x, minX), centreX + side * lateral))
      const y = Math.min(inner.y + inner.h, Math.max(inner.y, slotY + jitterY))
      const ok = placed.every((p) => Math.hypot(p.x - x, p.y - y) >= minDistEff * (1 - relax * 0.5))
      if (ok) best = { x, y }
    }
    if (!best) throw new Error(`geography: could not place fragment ${fragment.n}`)
    side = -side
    const r = rng(hashSeed('stamp', cycle, fragment.n))
    placed.push({
      n: fragment.n,
      fragment,
      region,
      x: best.x,
      y: best.y,
      stamp: {
        rotation: (r() - 0.5) * 8,
        dx: (r() - 0.5) * 0.05 * short,
        dy: (r() - 0.5) * 0.06 * short,
        pressure: 0.82 + r() * 0.18,
      },
      seed: hashSeed('form', cycle, fragment.n) % 1000,
    })
  })
  return placed
}
